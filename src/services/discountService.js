// Discount queries — kept separate from UI components.
// Uses the existing Supabase client and existing schema/RLS only (no schema
// changes). RLS already in place (verified against schema.sql):
//   "Admins can manage discounts" — discounts: for all using (is_admin())
// This already allows an authenticated admin to select/insert/update/delete
// discounts, so no policy changes were needed for this stage.
//
// Only columns that actually exist on discounts are used:
//   id, code, discount_type, discount_value, min_order_amount,
//   starts_at, ends_at, is_active, usage_limit, times_used,
//   created_at, updated_at
// There is no max_discount_amount column in the existing schema, so it is
// not shown or editable here.

import { supabase } from '../lib/supabaseClient'

const DISCOUNT_COLUMNS =
  'id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, is_active, usage_limit, times_used, created_at, updated_at'

function mapDiscountRow(d) {
  return {
    id: d.id,
    code: d.code,
    discountType: d.discount_type,
    discountValue: d.discount_value,
    minOrderAmount: d.min_order_amount,
    startsAt: d.starts_at,
    endsAt: d.ends_at,
    isActive: d.is_active,
    usageLimit: d.usage_limit,
    timesUsed: d.times_used,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }
}

/**
 * Fetches all discounts for the Admin Discounts page (search/status
 * filtering is done client-side on this result, consistent with the
 * Products/Categories/Orders admin pages).
 */
export async function getDiscounts() {
  const { data, error } = await supabase
    .from('discounts')
    .select(DISCOUNT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapDiscountRow)
}

/**
 * Creates a new discount. The code is normalized to uppercase/trimmed so
 * "save10" and "SAVE10" can't both be inserted as distinct codes.
 * @param {{ code: string, discountType: 'percentage'|'fixed', discountValue: number,
 *   minOrderAmount?: number, startsAt?: string|null, endsAt?: string|null,
 *   usageLimit?: number|null, isActive: boolean }} data
 */
export async function createDiscount({
  code,
  discountType,
  discountValue,
  minOrderAmount,
  startsAt,
  endsAt,
  usageLimit,
  isActive,
}) {
  const { data, error } = await supabase
    .from('discounts')
    .insert({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount ?? 0,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      usage_limit: usageLimit || null,
      is_active: isActive,
    })
    .select(DISCOUNT_COLUMNS)
    .single()

  if (error) throw error
  return mapDiscountRow(data)
}

/**
 * Updates a discount's editable fields. times_used is never written here —
 * it's only ever incremented by order/checkout logic, not the admin form.
 * @param {string} discountId
 */
export async function updateDiscount(discountId, {
  code,
  discountType,
  discountValue,
  minOrderAmount,
  startsAt,
  endsAt,
  usageLimit,
  isActive,
}) {
  const { data, error } = await supabase
    .from('discounts')
    .update({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrderAmount ?? 0,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      usage_limit: usageLimit || null,
      is_active: isActive,
    })
    .eq('id', discountId)
    .select(DISCOUNT_COLUMNS)
    .single()

  if (error) throw error
  return mapDiscountRow(data)
}

/**
 * Toggles a discount's active status without touching any other field.
 * @param {string} discountId
 * @param {boolean} isActive
 */
export async function toggleDiscountStatus(discountId, isActive) {
  const { data, error } = await supabase
    .from('discounts')
    .update({ is_active: isActive })
    .eq('id', discountId)
    .select(DISCOUNT_COLUMNS)
    .single()

  if (error) throw error
  return mapDiscountRow(data)
}

/**
 * Deletes a discount. discounts.id is referenced by orders.discount_id with
 * `on delete set null` (not restrict), so deleting a discount is always
 * safe — it will simply detach from any past orders that used it rather
 * than being blocked, unlike categories which are protected by a
 * restrict constraint.
 * @param {string} discountId
 */
/**
 * Fetches currently-active, currently-valid discount codes for the customer
 * homepage's promotional section. Relies on the existing "Anyone can view
 * active discounts" RLS policy (is_active = true or is_admin()) — only
 * customer-relevant fields are selected (no usage/audit columns).
 * Validity (start/end dates, usage limit) is filtered client-side using the
 * exact same logic as the Admin Discounts page's validity badge, so a code
 * that has expired or hit its usage limit — even though still "active" in
 * the is_active sense — won't be advertised to customers.
 */
export async function getActivePromotions() {
  const { data, error } = await supabase
    .from('discounts')
    .select('code, discount_type, discount_value, min_order_amount, starts_at, ends_at, usage_limit, times_used')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  const now = new Date()

  return (data || [])
    .filter((d) => {
      if (d.starts_at && new Date(d.starts_at) > now) return false
      if (d.ends_at && new Date(d.ends_at) < now) return false
      if (d.usage_limit && d.times_used >= d.usage_limit) return false
      return true
    })
    .map((d) => ({
      code: d.code,
      discountType: d.discount_type,
      discountValue: d.discount_value,
      minOrderAmount: d.min_order_amount,
    }))
}

export async function deleteDiscount(discountId) {
  const { error } = await supabase.from('discounts').delete().eq('id', discountId)
  if (error) throw error
}

// ---------------------------------------------------------------------
// Customer checkout — discount code validation (Stage 15)
// ---------------------------------------------------------------------
// Reuses the same "Anyone can view active discounts" RLS policy as
// getActivePromotions above (is_active = true or is_admin()), so an
// anonymous/guest customer can look up a single code by exact match.
// Because the RLS select policy only exposes rows where is_active = true,
// an inactive code and a nonexistent code are indistinguishable from the
// client's point of view — both simply return no row, which is fine since
// both should show the same generic "invalid code" message to the customer.

/**
 * Validates a discount code against a given order subtotal and returns
 * either a valid discount (with the exact discount amount to apply) or a
 * reason code explaining why it can't be applied. Never throws for an
 * invalid/expired/ineligible code — only for a genuine database error.
 *
 * @param {string} code
 * @param {number} subtotal
 * @returns {Promise<
 *   | { valid: true, discount: { id: string, code: string, discountType: 'percentage'|'fixed', discountValue: number, minOrderAmount: number }, discountAmount: number }
 *   | { valid: false, reason: 'not_found' | 'not_started' | 'expired' | 'usage_limit_reached' | 'min_order_amount' , minOrderAmount?: number }
 * >}
 */
export async function validateDiscountCode(code, subtotal) {
  const normalized = (code || '').trim().toUpperCase()
  if (!normalized) return { valid: false, reason: 'not_found' }

  const { data, error } = await supabase
    .from('discounts')
    .select(
      'id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, is_active, usage_limit, times_used'
    )
    .eq('code', normalized)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return { valid: false, reason: 'not_found' }

  const now = new Date()

  if (data.starts_at && new Date(data.starts_at) > now) {
    return { valid: false, reason: 'not_started' }
  }
  if (data.ends_at && new Date(data.ends_at) < now) {
    return { valid: false, reason: 'expired' }
  }
  if (data.usage_limit != null && data.times_used >= data.usage_limit) {
    return { valid: false, reason: 'usage_limit_reached' }
  }
  if (data.min_order_amount && subtotal < data.min_order_amount) {
    return { valid: false, reason: 'min_order_amount', minOrderAmount: data.min_order_amount }
  }

  const discountAmount =
    data.discount_type === 'percentage'
      ? Math.round(((subtotal * data.discount_value) / 100) * 100) / 100
      : Math.min(data.discount_value, subtotal)

  return {
    valid: true,
    discount: {
      id: data.id,
      code: data.code,
      discountType: data.discount_type,
      discountValue: data.discount_value,
      minOrderAmount: data.min_order_amount,
    },
    discountAmount,
  }
}

