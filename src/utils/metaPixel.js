// Thin wrapper around the Meta Pixel (`fbq`) snippet in index.html.
//
// Safe to call anywhere: if the pixel was blocked (ad blocker, offline) or
// hasn't loaded, every helper silently does nothing instead of throwing.
// The base snippet in index.html already fires the first PageView on a hard
// load; PixelRouteTracker (components/PixelRouteTracker.jsx) covers every
// in-app route change after that.

const CURRENCY = 'KWD'

function track(event, params, options) {
  try {
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
    if (options) window.fbq('track', event, params, options)
    else window.fbq('track', event, params)
  } catch {
    // tracking must never break the storefront
  }
}

const round = (n) => Math.round((Number(n) || 0) * 100) / 100

export function trackPageView() {
  track('PageView')
}

export function trackViewContent({ id, name, price, category }) {
  track('ViewContent', {
    content_ids: [String(id)],
    content_type: 'product',
    content_name: name,
    content_category: category || undefined,
    value: round(price),
    currency: CURRENCY,
  })
}

export function trackAddToCart({ id, name, price, quantity }) {
  const qty = Number(quantity) || 1
  track('AddToCart', {
    content_ids: [String(id)],
    content_type: 'product',
    content_name: name,
    contents: [{ id: String(id), quantity: qty, item_price: round(price) }],
    value: round(price * qty),
    currency: CURRENCY,
  })
}

// items: [{ productId, quantity, unitPrice }]
export function trackInitiateCheckout({ items, value }) {
  track('InitiateCheckout', {
    content_ids: items.map((i) => String(i.productId)),
    content_type: 'product',
    contents: items.map((i) => ({
      id: String(i.productId),
      quantity: Number(i.quantity) || 1,
      item_price: round(i.unitPrice),
    })),
    num_items: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    value: round(value),
    currency: CURRENCY,
  })
}

// ---- Purchase ---------------------------------------------------------
//
// Where the value/items for a Purchase come from, most trusted first:
//   1. `verified` — the summary the myfatoorah-verify-payment Edge Function
//      returns together with `paid: true`, read from our database
//      server-side. This is the authoritative source.
//   2. `order` — the order read back through the Supabase client. Only the
//      order's owner can read it, so a GUEST checkout gets nothing here.
//   3. The stash saved at checkout (below). It lives in the customer's own
//      browser and is therefore NOT trustworthy — it exists only so guest
//      orders still report a value while (1) isn't available, and it is
//      validated and expires.
// A browser pixel can always be spoofed from the console; none of this
// changes that, it only keeps honest customers' events complete and correct.

const PENDING_PREFIX = 'pixel_pending_purchase_'
const DONE_PREFIX = 'pixel_purchase_done_'
const PENDING_TTL_MS = 3 * 24 * 60 * 60 * 1000 // ignore/prune stashes older than 3 days
const MAX_ITEMS = 50

const pendingKey = (orderId) => `${PENDING_PREFIX}${orderId}`
const doneKey = (orderId) => `${DONE_PREFIX}${orderId}`

// Coerces anything (server JSON, DB order, parsed localStorage) into a clean
// { value, items } or null. Rejects non-finite / non-positive totals.
function sanitize(value, rawItems) {
  const total = Number(value)
  if (!Number.isFinite(total) || total <= 0) return null
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .slice(0, MAX_ITEMS)
    .filter((i) => i && i.productId != null)
    .map((i) => {
      const quantity = Math.floor(Number(i.quantity))
      const unitPrice = Number(i.unitPrice)
      return {
        productId: String(i.productId),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
      }
    })
  return { value: total, items }
}

function pruneStalePending() {
  const now = Date.now()
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(PENDING_PREFIX)) continue
    try {
      const saved = JSON.parse(localStorage.getItem(key))
      if (!saved || !(now - saved.savedAt < PENDING_TTL_MS)) localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
}

// Call right after the order is created, before redirecting to payment.
// Keyed by the order's own id, so it can only ever be used for that order.
export function rememberPendingPurchase(order) {
  try {
    pruneStalePending()
    localStorage.setItem(
      pendingKey(order.id),
      JSON.stringify({ value: order.total, items: order.items, savedAt: Date.now() })
    )
  } catch {
    // storage unavailable — Purchase will rely on the server/database value
  }
}

function readPending(orderId) {
  try {
    const saved = JSON.parse(localStorage.getItem(pendingKey(orderId)) || 'null')
    if (!saved || !(Date.now() - saved.savedAt < PENDING_TTL_MS)) return null
    return sanitize(saved.value, saved.items)
  } catch {
    return null
  }
}

// Fires Purchase at most once per order (per browser) and only when a valid
// total is known. Callers must only call this once the order is confirmed
// paid. Returns whether the event was sent.
export function trackPurchase({ orderId, verified, order }) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return false

  try {
    if (localStorage.getItem(doneKey(orderId))) return false
  } catch {
    // storage unavailable — fall through and fire anyway
  }

  const data =
    sanitize(verified?.total, verified?.items) ||
    sanitize(order?.total, order?.items) ||
    readPending(orderId)
  if (!data) return false

  track(
    'Purchase',
    {
      content_ids: data.items.map((i) => i.productId),
      content_type: 'product',
      contents: data.items.map((i) => ({
        id: i.productId,
        quantity: i.quantity,
        item_price: round(i.unitPrice),
      })),
      num_items: data.items.reduce((s, i) => s + i.quantity, 0),
      value: round(data.value),
      currency: CURRENCY,
    },
    // eventID lets Meta de-duplicate if a server-side event is ever added.
    { eventID: `order_${orderId}` }
  )

  try {
    localStorage.setItem(doneKey(orderId), '1')
    localStorage.removeItem(pendingKey(orderId))
  } catch {
    // ignore
  }
  return true
}
