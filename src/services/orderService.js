// Order creation, status updates, order history queries
// Order queries — kept separate from UI components.
// Uses the existing Supabase client and existing schema/RLS only (no schema changes).
// RLS already in place (verified against schema.sql, not modified here):
//   "Admins can manage all orders"       — orders: for all using (is_admin()) with check (is_admin())
//   "Admins can manage order items"      — order_items: for all using (is_admin()) with check (is_admin())
// This already allows an authenticated admin to select/update orders and read
// their line items (including updating order_status / payment_status), so no
// policy changes were needed for this stage.
//
// Note on payment_status: the "never trust the frontend to confirm payment"
// rule is about the *customer checkout* flow — payment only flips to "paid"
// via the server-side MyFatoorah verification (Stage 18, see
// supabase/functions/myfatoorah-verify-payment/index.ts and
// supabase/functions/myfatoorah-webhook/index.ts), never from here or from
// any client call. updatePaymentStatus() below is a separate, authenticated
// *admin* action — e.g. correcting a stuck status or recording a refund —
// gated by is_admin(), which is a normal admin-panel capability.

import { supabase } from '../lib/supabaseClient'
import { getProductsByIds } from './productService'
import { getVariantsByIds } from './productVariantService'
import { getStoreSettings } from './settingsService'

const ORDER_LIST_COLUMNS = 'id, order_number, customer_name, total, payment_status, order_status, created_at'

const ORDER_DETAIL_COLUMNS = `
  id, order_number, customer_id,
  customer_name, customer_phone, customer_email, customer_address, customer_city, customer_governorate, order_notes,
  subtotal, discount_amount, shipping_cost, total,
  payment_status, order_status,
  stripe_checkout_session_id, stripe_payment_intent_id,
  created_at, updated_at,
  discount:discounts(code)
`

const ORDER_ITEM_COLUMNS = 'id, product_id, variant_id, product_name, color_name, size_name, unit_price, quantity, line_total'

function mapOrderListRow(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    total: row.total,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    createdAt: row.created_at,
  }
}

/**
 * Fetches all orders for the Admin Orders list (search/status filtering is
 * done client-side on this result, consistent with the Products/Categories
 * admin pages).
 */
export async function getOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapOrderListRow)
}

/**
 * Fetches a single order's full details plus its line items, for the Order
 * Detail page.
 */
export async function getOrderById(orderId) {
  const [orderRes, itemsRes] = await Promise.all([
    supabase.from('orders').select(ORDER_DETAIL_COLUMNS).eq('id', orderId).single(),
    supabase
      .from('order_items')
      .select(ORDER_ITEM_COLUMNS)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
  ])

  if (orderRes.error) throw orderRes.error
  if (itemsRes.error) throw itemsRes.error

  const o = orderRes.data
  const rawItems = itemsRes.data || []

  // Best-effort: attach each item's current product image (Stage 16 —
  // "product image where available"). order_items doesn't store an image
  // itself, only product_id, so this re-reads the product's current
  // primary image via the existing getProductsByIds helper (same one
  // checkout uses). Wrapped so a failure here (e.g. the product was later
  // deleted) never breaks the rest of the order detail.
  let imageByProductId = new Map()
  try {
    const productIds = [...new Set(rawItems.map((i) => i.product_id).filter(Boolean))]
    const products = await getProductsByIds(productIds)
    imageByProductId = new Map(products.map((p) => [p.id, p.imageUrl]))
  } catch (err) {
    console.error('Failed to load order item images:', err.message)
  }

  return {
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.customer_id,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    customerEmail: o.customer_email,
    customerAddress: o.customer_address,
    customerCity: o.customer_city,
    customerGovernorate: o.customer_governorate,
    orderNotes: o.order_notes,
    subtotal: o.subtotal,
    discountAmount: o.discount_amount,
    discountCode: o.discount?.code || null,
    shippingCost: o.shipping_cost,
    total: o.total,
    paymentStatus: o.payment_status,
    orderStatus: o.order_status,
    // STAGE 18 — MyFatoorah reference, reusing the existing (originally
    // Stripe-named) text columns rather than adding new ones. See
    // supabase/functions/myfatoorah-create-payment/index.ts for where
    // these are written.
    myFatoorahInvoiceId: o.stripe_checkout_session_id,
    myFatoorahPaymentId: o.stripe_payment_intent_id,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items: rawItems.map((item) => ({
      id: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product_name,
      imageUrl: imageByProductId.get(item.product_id) || null,
      colorName: item.color_name,
      sizeName: item.size_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: item.line_total,
    })),
  }
}

/**
 * Updates an order's fulfillment status (order_status_enum values only —
 * these already come from the existing schema, not invented here).
 *
 * STAGE 17 FIX (Issue 2): a cancelled order ('ملغي') is terminal. This is
 * enforced at the DATABASE level by a trigger added in
 * supabase/migrations/stage17_fix_stock_and_cancelled_status.sql
 * (trg_orders_enforce_terminal_status), not just hidden in the UI — so
 * even a direct API/Admin call attempting 'ملغي' -> anything else fails
 * here with a Postgres error, which the Admin OrderDetail page already
 * catches and shows as "تعذر تحديث حالة الطلب". The UI additionally
 * disables the status control for cancelled orders so this path is rarely
 * hit in practice (see admin/pages/OrderDetail.jsx).
 */
export async function updateOrderStatus(orderId, orderStatus) {
  const { data, error } = await supabase
    .from('orders')
    .update({ order_status: orderStatus })
    .eq('id', orderId)
    .select('order_status')
    .single()

  if (error) throw error
  return data.order_status
}

/**
 * Updates an order's payment status (payment_status_enum values only).
 * Intended for manual admin corrections (e.g. marking a refund or a COD
 * order as paid on delivery) — normal online-checkout payment confirmation
 * happens via the MyFatoorah verification Edge Functions (Stage 18), not here.
 */
export async function updatePaymentStatus(orderId, paymentStatus) {
  const { data, error } = await supabase
    .from('orders')
    .update({ payment_status: paymentStatus })
    .eq('id', orderId)
    .select('payment_status')
    .single()

  if (error) throw error
  return data.payment_status
}



// ---------------------------------------------------------------------
// Per-customer order history (Stage 10 — Customers Management)
// ---------------------------------------------------------------------
// Reuses the same ORDER_LIST_COLUMNS / mapOrderListRow used by getOrders()
// above, so a customer's order list has exactly the same shape as the main
// Orders list and links to the same /admin/orders/:id detail page.

/**
 * Fetches all orders placed by a registered customer (profiles.id).
 * @param {string} customerId
 */
export async function getOrdersByCustomerId(customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_COLUMNS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapOrderListRow)
}

// ---------------------------------------------------------------------
// Customer-facing "My Orders" (Stage 16)
// ---------------------------------------------------------------------
// SECURITY NOTE: ownership is enforced by the database itself, not just by
// passing the logged-in user's own id as `customerId` here. The existing
// RLS policy "Customers can view own orders" (orders: select using
// (auth.uid() = customer_id or is_admin())) means that even if this
// function were ever called with someone else's id, Postgres would still
// only return rows where auth.uid() actually matches customer_id — the
// `.eq('customer_id', customerId)` filter narrows the query, but it is the
// RLS policy, evaluated against the caller's own JWT, that actually
// guarantees a customer can never read another customer's orders. The same
// applies to getOrderById above for a single order's detail — it takes only
// an order id (no customer_id filter at all) and relies entirely on RLS to
// return zero rows for an order that isn't the caller's.

/**
 * Fetches the authenticated customer's own order history for the
 * /account/orders page, including each order's item count (via an
 * embedded order_items count aggregate) since that isn't part of the
 * shared ORDER_LIST_COLUMNS used by the admin Orders list.
 * @param {string} customerId - the logged-in user's own id (auth.uid()/profiles.id)
 */
export async function getMyOrders(customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`${ORDER_LIST_COLUMNS}, order_items(count)`)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((row) => ({
    ...mapOrderListRow(row),
    itemCount: row.order_items?.[0]?.count ?? 0,
  }))
}

/**
 * Fetches all guest orders (customer_id is null) matching a given contact
 * value against either customer_email or customer_phone — used to group
 * guest-checkout orders into a single "customer" record with no account.
 * @param {string} contactValue
 */
export async function getOrdersByGuestContact(contactValue) {
  if (!contactValue) return []

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_LIST_COLUMNS)
    .is('customer_id', null)
    .or(`customer_email.eq.${contactValue},customer_phone.eq.${contactValue}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapOrderListRow)
}

// =======================================================================
// STAGE 15 — Customer checkout & order creation
// =======================================================================
//
// KNOWN SCHEMA LIMITATION (reported, not silently worked around):
// `order_items.variant_id` is `not null` in the existing schema, but a
// product can legitimately exist with zero product_variants rows (no
// colors/sizes ever added to it — see ProductPage.jsx, which explicitly
// supports adding such a product to the cart with `variantId: null`).
// That means the current schema cannot store an order_item for a
// variant-less product. This function does NOT alter the schema to work
// around it (per the "do not change schema unless justified" instruction);
// instead, `validateCartForCheckout` below flags any such cart line as
// `unavailable` with a clear reason, so checkout blocks that specific line
// with a friendly message instead of failing with a raw Postgres error.
// See the implementation report for the exact one-line SQL fix, offered
// but not executed.

/**
 * Re-validates every cart line against trusted, live database values
 * (never localStorage) and computes trusted pricing. Used by the checkout
 * page both to render an accurate order summary and, again, immediately
 * before order creation.
 *
 * @param {Array<{ key: string, productId: string, variantId: string|null,
 *   colorId: string|null, colorName: string|null, sizeId: string|null,
 *   sizeName: string|null, name: string, imageUrl: string|null,
 *   quantity: number }>} cartItems
 * @returns {Promise<Array<
 *   | { key: string, ok: true, productId: string, variantId: string|null, name: string,
 *       imageUrl: string|null, colorName: string|null, sizeName: string|null,
 *       quantity: number, unitPrice: number, lineTotal: number }
 *   | { key: string, ok: false, reason: 'product_unavailable' | 'variant_unavailable' | 'insufficient_stock' | 'variant_required',
 *       name: string, availableStock?: number }
 * >>}
 */
export async function validateCartForCheckout(cartItems) {
  if (!cartItems || cartItems.length === 0) return []

  const productIds = [...new Set(cartItems.map((i) => i.productId))]
  const variantIds = [...new Set(cartItems.filter((i) => i.variantId).map((i) => i.variantId))]

  const [products, variants] = await Promise.all([
    getProductsByIds(productIds),
    getVariantsByIds(variantIds),
  ])

  const productMap = new Map(products.map((p) => [p.id, p]))
  const variantMap = new Map(variants.map((v) => [v.id, v]))

  return cartItems.map((item) => {
    const product = productMap.get(item.productId)

    if (!product || !product.isActive) {
      return { key: item.key, ok: false, reason: 'product_unavailable', name: item.name }
    }

    let unitPrice = product.hasDiscount && product.discountPrice != null ? product.discountPrice : product.basePrice
    let colorName = item.colorName || null
    let sizeName = item.sizeName || null

    if (item.variantId) {
      const variant = variantMap.get(item.variantId)

      if (!variant || !variant.isActive || variant.productId !== item.productId) {
        return { key: item.key, ok: false, reason: 'variant_unavailable', name: product.name }
      }

      if (variant.stockQuantity < item.quantity) {
        return {
          key: item.key,
          ok: false,
          reason: 'insufficient_stock',
          name: product.name,
          availableStock: variant.stockQuantity,
        }
      }

      if (variant.priceOverride != null) unitPrice = variant.priceOverride
      colorName = variant.colorName || colorName
      sizeName = variant.sizeName || sizeName
    } else if (item.colorId || item.sizeId) {
      // A color/size was picked on the product page but no matching
      // variant row exists for it — the underlying stock record is gone.
      return { key: item.key, ok: false, reason: 'variant_unavailable', name: product.name }
    }
    // else: a genuinely variant-less product (no colors/sizes at all) —
    // allowed to price normally here; blocked at order-creation time only
    // (see the schema limitation note above), so the summary can still
    // show it while checkout explains why it can't be ordered yet.

    const roundedPrice = Math.round(unitPrice * 100) / 100
    const lineTotal = Math.round(roundedPrice * item.quantity * 100) / 100

    return {
      key: item.key,
      ok: true,
      productId: item.productId,
      variantId: item.variantId || null,
      name: product.name,
      imageUrl: item.imageUrl || null,
      colorName,
      sizeName,
      quantity: item.quantity,
      unitPrice: roundedPrice,
      lineTotal,
    }
  })
}

/**
 * STAGE 21 — the single trusted shipping-calculation path. Used by
 * createOrder() below (authoritative, DB-fresh) and may also be used by
 * CheckoutPage (display-only preview from the settings it already loaded)
 * so the free-shipping rule is never implemented twice.
 *
 * Rule: if free shipping is enabled AND `subtotal` >= the configured
 * minimum, shipping is 0. Otherwise shipping is the configured default
 * cost. A threshold of 0 with free shipping enabled means every order
 * qualifies (subtotal is never negative, so `subtotal >= 0` always holds).
 *
 * IMPORTANT — `subtotal` must be the order subtotal BEFORE discount. The
 * free-shipping threshold is intentionally evaluated pre-discount (see the
 * Stage 21 report): e.g. a 30 KWD cart with a 10 KWD discount and a 25 KWD
 * free-shipping threshold still gets free shipping, because 30 >= 25 —
 * the discount does not reduce the subtotal used for this check.
 *
 * @param {number} subtotal - pre-discount order subtotal
 * @param {{ defaultShippingCost?: number, freeShippingEnabled?: boolean, freeShippingMinOrderAmount?: number }|null} settings
 * @returns {number}
 */
export function calculateShippingCost(subtotal, settings) {
  const defaultCost = Math.round((Number(settings?.defaultShippingCost) || 0) * 100) / 100
  const freeEnabled = Boolean(settings?.freeShippingEnabled)
  const threshold = Math.round((Number(settings?.freeShippingMinOrderAmount) || 0) * 100) / 100
  const roundedSubtotal = Math.round((Number(subtotal) || 0) * 100) / 100

  if (freeEnabled && roundedSubtotal >= threshold) {
    return 0
  }
  return defaultCost
}

function generateOrderNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `${y}${m}${d}-${rand}`
}

/**
 * Creates an order + its order_items from server-trusted, already-validated
 * line items (the output of `validateCartForCheckout`, filtered to `ok`
 * lines only — the caller is responsible for blocking submission if any
 * line failed validation).
 *
 * The order id and order_number are generated client-side (instead of
 * relying on Postgres defaults + reading the row back via `.select()`)
 * because the existing RLS select policy on `orders`
 * (`auth.uid() = customer_id or is_admin()`) cannot be satisfied by an
 * anonymous guest checkout row (`customer_id is null`, `auth.uid()` is also
 * null, and `null = null` is not true in SQL) — `insert(...).select()`
 * would come back empty for guests. Generating both up front sidesteps that
 * gap entirely without touching RLS.
 *
 * Never trusts a client-supplied subtotal/total — both are recomputed here
 * from the validated line items and the (also re-validated) discount.
 *
 * STAGE 20: the same rule now applies to shipping. There is intentionally
 * no `shippingCost` parameter — CheckoutPage's own shipping state (loaded
 * from store_settings on page mount, purely for what the customer sees
 * before submitting) is never passed in or trusted here. This function
 * re-reads store_settings itself, right before building the order row, so
 * a customer cannot change the charged shipping amount via devtools/React
 * state manipulation — the persisted `orders.shipping_cost` (and therefore
 * `orders.total`, and therefore the amount later sent to MyFatoorah) always
 * reflects the live, admin-configured value at the moment the order is
 * actually created.
 *
 * STAGE 21: the free-shipping rule (store_settings.free_shipping_enabled /
 * free_shipping_min_order_amount) is applied via calculateShippingCost()
 * above — the one shared calculation path — evaluated against the
 * pre-discount `subtotal` computed just below.
 *
 * @param {{
 *   customer: { fullName: string, phone: string, email?: string|null, address: string, city: string, governorate: string, notes?: string|null },
 *   customerId?: string|null,
 *   items: Array<{ productId: string, variantId: string|null, name: string, colorName: string|null, sizeName: string|null, quantity: number, unitPrice: number, lineTotal: number }>,
 *   discount?: { id: string, discountAmount: number } | null,
 * }} params
 */
export async function createOrder({ customer, customerId, items, discount }) {
  if (!items || items.length === 0) {
    throw new Error('EMPTY_CART')
  }

  const invalidVariantless = items.find((i) => !i.variantId)
  if (invalidVariantless) {
    // See the schema-limitation note above `validateCartForCheckout` —
    // order_items.variant_id is NOT NULL, so this line cannot be persisted
    // without a schema change that was not made in this stage.
    const err = new Error('VARIANT_REQUIRED')
    err.code = 'VARIANT_REQUIRED'
    err.productName = invalidVariantless.name
    throw err
  }

  const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100
  const discountAmount = discount ? Math.min(Math.round(discount.discountAmount * 100) / 100, subtotal) : 0

  // STAGE 20/21 — trusted, DB-fresh shipping cost, including the
  // free-shipping rule, via the single shared calculateShippingCost() path.
  // Falls back to 0 only if store_settings can't be read at all, matching
  // the pre-Stage-20 default and keeping order creation from hard-failing
  // on a transient settings-read error.
  let shipping = 0
  try {
    const settings = await getStoreSettings()
    shipping = calculateShippingCost(subtotal, settings)
  } catch (err) {
    console.error('Failed to read shipping settings, defaulting to 0:', err.message)
  }

  const total = Math.max(0, Math.round((subtotal - discountAmount + shipping) * 100) / 100)

  const orderId = crypto.randomUUID()
  const orderNumber = generateOrderNumber()

  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    order_number: orderNumber,
    customer_id: customerId || null,
    customer_name: customer.fullName.trim(),
    customer_phone: customer.phone.trim(),
    customer_email: customer.email?.trim() || null,
    customer_address: customer.address.trim(),
    customer_city: customer.city.trim(),
    customer_governorate: customer.governorate.trim(),
    order_notes: customer.notes?.trim() || null,
    subtotal,
    discount_id: discount?.id || null,
    discount_amount: discountAmount,
    shipping_cost: shipping,
    total,
    payment_status: 'pending',
    order_status: 'جديد',
  })

  if (orderError) throw orderError

  const orderItemsPayload = items.map((item) => ({
    order_id: orderId,
    product_id: item.productId,
    variant_id: item.variantId,
    product_name: item.name,
    color_name: item.colorName || '-',
    size_name: item.sizeName || '-',
    unit_price: item.unitPrice,
    quantity: item.quantity,
    line_total: item.lineTotal,
  }))

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload)

  if (itemsError) {
    // Best-effort rollback: remove the order we just created so it doesn't
    // linger with zero items. If this delete itself fails (e.g. transient
    // network error) the original itemsError is still what's thrown/reported.
    await supabase.from('orders').delete().eq('id', orderId)
    throw itemsError
  }

  // -----------------------------------------------------------------
  // STAGE 17 FIX (Issue 1) — reserve stock now, atomically, at order
  // creation time.
  //
  // ROOT CAUSE: decrement_stock_for_order() already existed in the schema
  // (row-locking via FOR UPDATE, insufficient-stock check, idempotent via
  // stock_decremented) but nothing in the codebase ever called it. It was
  // written assuming a later payment-webhook-confirmed flow that wasn't
  // wired up at the time (orders were created directly with payment_status
  // 'pending', no gateway call happened at all). With nothing ever calling
  // it, stock was simply never decremented.
  //
  // STAGE 18 note: MyFatoorah online payment now exists, but stock
  // reservation intentionally still happens HERE, at order-creation time,
  // for both payment methods (COD and online) — not gated behind payment
  // confirmation. This matches the Stage 18 brief's own instruction ("do
  // not introduce a new stock-decrement mechanism") and its rule for
  // failed/cancelled online payments ("keep the order, allow retry") —
  // stock stays reserved through retries and is only released via the
  // existing customer-cancellation path (restock_for_order), never
  // re-decremented or silently released just because a payment attempt
  // failed.
  //
  // FIX: call the existing function right here, right after order_items
  // exist for this order (it reads them itself). It is SECURITY DEFINER,
  // so it runs with full table access regardless of the calling customer's
  // RLS — the same trust model already used for restock_for_order() via
  // cancel_my_order() in the Stage 17 migration. The function's own row
  // locking + "insufficient stock" exception is what actually prevents the
  // race condition between two simultaneous orders for the same variant,
  // not anything computed in this JS. No schema change was needed for
  // this — the existing function already does exactly what's required.
  //
  // If it fails (insufficient stock, or any other reason), the order must
  // not be left behind as a "successful" order with unreserved stock, so
  // it's deleted (order_items cascade-delete with it) and a distinct,
  // recognizable error is thrown for the checkout page to handle.
  const { error: stockError } = await supabase.rpc('decrement_stock_for_order', {
    p_order_id: orderId,
  })

  if (stockError) {
    await supabase.from('orders').delete().eq('id', orderId)
    const err = new Error(stockError.message || 'INSUFFICIENT_STOCK')
    err.code = 'INSUFFICIENT_STOCK'
    throw err
  }

  // -----------------------------------------------------------------
  // STAGE 25 FIX — increment_discount_usage() (Stage 22) was not race-
  // safe: it re-checked nothing and took no row lock, so two concurrent
  // orders on a usage_limit=1 code could both increment past the limit
  // (confirmed in the Stage 24 audit, fixed here). It's replaced by
  // redeem_discount_for_order(), which locks the discounts row FIRST
  // (mirroring decrement_stock_for_order()'s proven pattern), THEN
  // re-checks is_active/starts_at/ends_at/usage_limit/min_order_amount
  // against the now-guaranteed-current row, THEN writes — so a second
  // concurrent caller blocks on the lock and correctly fails if the
  // limit was just reached by the first. See
  // supabase/migrations/20260825_stage25_transaction_hardening.sql.
  //
  // Unlike the Stage 22 version, a failure here IS now a real,
  // order-invalidating outcome (someone else took the last redemption
  // between our checkout-time validation and this moment) — not just a
  // bookkeeping miss — so the order and its already-reserved stock must
  // be rolled back rather than silently kept. This mirrors the existing
  // stock-failure rollback above exactly: restock, then delete the order
  // (order_items cascade-delete with it via `on delete cascade`).
  if (discount?.id) {
    const { error: usageError } = await supabase.rpc('redeem_discount_for_order', {
      p_discount_id: discount.id,
      p_subtotal: subtotal,
    })
    if (usageError) {
      await supabase.rpc('restock_for_order', { p_order_id: orderId })
      await supabase.from('orders').delete().eq('id', orderId)
      const err = new Error(usageError.message || 'DISCOUNT_UNAVAILABLE')
      err.code = 'DISCOUNT_UNAVAILABLE'
      throw err
    }
  }

  return {
    id: orderId,
    orderNumber,
    subtotal,
    discountAmount,
    discountCode: discount?.code || null,
    shippingCost: shipping,
    total,
    customer,
    items,
    paymentStatus: 'pending',
    orderStatus: 'جديد',
  }
}

/**
 * Best-effort read of an order for the success page on a hard refresh
 * (when the freshly-created order data is no longer available via router
 * state). Works for a logged-in customer viewing their own order (RLS:
 * `auth.uid() = customer_id`) or an admin. For a GUEST order, this will
 * return null — the existing RLS select policy on `orders` cannot
 * distinguish "the guest who just placed this order" from any other
 * anonymous visitor, since both have `auth.uid() = null`. This is a
 * reported limitation, not a bug: the success page falls back to a
 * friendly "لا يمكن عرض تفاصيل الطلب" state for that case rather than
 * throwing a raw Supabase/RLS error.
 * @param {string} orderId
 */
export async function getOrderForSuccessPage(orderId) {
  try {
    return await getOrderById(orderId)
  } catch {
    return null
  }
}

// =======================================================================
// STAGE 17 — Customer order cancellation
// =======================================================================
//
// SCHEMA LIMITATION (reported, not worked around client-side):
// The existing RLS on `orders` only allows a row UPDATE via the
// "Admins can manage all orders" policy (`for all using (is_admin())`).
// There is NO existing policy letting a customer update their own order
// (only "Customers can view own orders" for select and "Customers can
// create own orders" for insert — see supabase/schema.sql). That means a
// plain `supabase.from('orders').update(...)` call from a customer session
// would be silently rejected by Postgres (zero rows affected), which is
// exactly the kind of fake client-side mechanism this stage says not to
// build.
//
// Instead, this calls a SECURITY DEFINER Postgres function,
// `cancel_my_order`, mirroring the existing `decrement_stock_for_order` /
// `restock_for_order` functions already in the schema. The function itself
// (not the client) verifies auth.uid() = customer_id and that the order is
// still in a cancellable state before doing anything, then flips
// order_status to 'ملغي' and restocks via the existing restock_for_order
// helper if stock had already been decremented.
//
// STAGE 22 FIX: cancel_my_order did not actually exist in the database
// despite being documented here as a completed Stage 17 item (confirmed
// absent from schema.sql and every prior migration) — the "إلغاء الطلب"
// button was failing with a Postgres "function not found" error. It is
// now defined, along with trg_orders_enforce_terminal_status (a
// cancelled order can no longer be moved back to an active status by
// ANY caller, including admin, not just hidden in the admin UI), in
// supabase/migrations/20260825_stage22_cancellation_and_discount_usage.sql.
// REQUIRED SQL — that migration file must be run once in the Supabase
// SQL editor (not run automatically from here — no DB credentials/access
// from this environment) before this RPC call will succeed.
export async function cancelMyOrder(orderId) {
  const { data, error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId })
  if (error) throw error
  return data // the function returns the order's new order_status
}