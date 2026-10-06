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

// Fires at most once per order per browser session, so refreshing the
// payment-return page doesn't double-count a sale. eventID lets Meta
// de-duplicate if a server-side event is ever added later.
export function trackPurchase({ orderId, items, value }) {
  const key = `pixel_purchase_${orderId}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // sessionStorage unavailable — fall through and fire anyway
  }
  track(
    'Purchase',
    {
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
    },
    { eventID: `order_${orderId}` }
  )
}
