// Customer order detail (Stage 16, extended in Stage 17) — /account/orders/:id
//
// SECURITY: this reuses orderService.getOrderById(orderId) as-is — the
// exact same function the Admin Order Detail page uses. It takes only the
// order id, with no customer_id filter in the query at all, and relies
// entirely on the existing RLS policy "Customers can view own orders"
// (auth.uid() = customer_id or is_admin()) to decide what comes back. If a
// customer edits the URL to another customer's order id, the query returns
// zero rows and getOrderById's `.single()` call throws — caught below and
// shown as a generic "order not found" state, never a raw Supabase error
// and never any of that order's data. This is exactly what the stage brief
// asks for: ownership enforced by the database, not a client-side
// `if (order.customerId === user.id)` check after the fact.
//
// STAGE 17 additions:
//   - visual order-status timeline (OrderStatusTimeline)
//   - status explanation + "next step" copy (from admin/pages/Orders.jsx)
//   - order number copy-to-clipboard
//   - customer cancellation, only while order_status === 'جديد', via the
//     cancel_my_order RPC (see orderService.cancelMyOrder + the Stage 17
//     migration SQL — REQUIRES that SQL to be run once in Supabase; see
//     the implementation report)
//   - per-item current availability (still active / unavailable / price
//     changed) computed via the existing validateCartForCheckout, without
//     ever hiding the historical order_items snapshot
//   - "إعادة الطلب" — adds still-available items at CURRENT prices/stock
//     to the existing CartContext and sends the customer to /cart; does
//     NOT create an order directly

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronRight,
  PackageSearch,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Info,
  CreditCard,
} from 'lucide-react'
import { getOrderById, cancelMyOrder, validateCartForCheckout } from '../services/orderService'
import { formatKWD } from '../utils/formatPrice'
import { useCart } from '../hooks/useCart'
import {
  StatusBadge,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  ORDER_STATUS_STYLES,
  ORDER_STATUS_EXPLANATIONS,
  ORDER_STATUS_NEXT_STEP,
  CANCELLED_STATUS,
} from '../admin/pages/Orders'
import OrderStatusTimeline from '../components/OrderStatusTimeline'
import { useLanguage } from '../hooks/useLanguage'

// Only the very first stage of the order flow is safe for a customer to
// self-cancel — once it's "قيد التجهيز" or beyond, staff are already
// acting on it.
const CANCELLABLE_STATUS = 'جديد'

// STAGE 30 — date locale follows the active language (was hardcoded 'ar-EG').
function formatDateTime(dateStr, language) {
  return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DetailSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 animate-pulse space-y-4">
      <div className="h-6 w-40 bg-gray-100 rounded" />
      <div className="h-24 bg-gray-100 rounded-2xl" />
      <div className="h-40 bg-gray-100 rounded-2xl" />
      <div className="h-52 bg-gray-100 rounded-2xl" />
    </div>
  )
}

function availabilityNote(result, t) {
  if (!result) return null
  if (result.ok) return null
  if (result.reason === 'insufficient_stock') {
    return t('order.insufficientStock', { count: result.availableStock })
  }
  if (result.reason === 'variant_unavailable') return t('order.variantUnavailable')
  if (result.reason === 'product_unavailable') return t('order.productUnavailable')
  return t('order.currentlyUnavailable')
}

export default function MyOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { t, dir, language } = useLanguage()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [copied, setCopied] = useState(false)

  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelSuccess, setCancelSuccess] = useState('')

  // key -> validateCartForCheckout result, best-effort, only for display +
  // reorder; never blocks rendering the order itself if it fails.
  const [availability, setAvailability] = useState(null)
  const [reordering, setReordering] = useState(false)
  const [reorderMessage, setReorderMessage] = useState('')

  const loadOrder = useCallback(() => {
    let isMounted = true
    setLoading(true)
    setNotFound(false)

    getOrderById(id)
      .then((result) => {
        if (isMounted) setOrder(result)
      })
      .catch((err) => {
        // Covers both a genuinely invalid id and an id that belongs to
        // another customer — RLS makes both look identical (zero rows),
        // which is exactly the point: no distinction is leaked either way.
        console.error('Failed to load order:', err.message)
        if (isMounted) setNotFound(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => loadOrder(), [loadOrder])

  // Best-effort current-availability check for each item, once the order
  // is loaded. Wrapped so any failure here never breaks the order detail
  // view itself — it only powers the optional "غير متوفر الآن" badges and
  // the reorder button.
  useEffect(() => {
    if (!order) return
    let isMounted = true

    const cartShapedItems = order.items.map((item) => ({
      key: item.id,
      productId: item.productId,
      variantId: item.variantId || null,
      colorId: null,
      colorName: item.colorName,
      sizeId: null,
      sizeName: item.sizeName,
      name: item.productName,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
    }))

    validateCartForCheckout(cartShapedItems)
      .then((results) => {
        if (!isMounted) return
        const map = new Map(results.map((r) => [r.key, r]))
        setAvailability(map)
      })
      .catch((err) => {
        console.error('Failed to check item availability:', err.message)
      })

    return () => {
      isMounted = false
    }
  }, [order])

  function handleCopyOrderNumber() {
    if (!order) return
    navigator.clipboard
      ?.writeText(order.orderNumber)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  async function handleCancelOrder() {
    if (!order || cancelling) return
    if (!window.confirm(t('order.confirmCancel'))) return

    setCancelling(true)
    setCancelError('')
    setCancelSuccess('')
    try {
      await cancelMyOrder(order.id)
      setOrder((prev) => (prev ? { ...prev, orderStatus: CANCELLED_STATUS } : prev))
      setCancelSuccess(t('order.cancelSuccess'))
    } catch (err) {
      console.error('Failed to cancel order:', err.message)
      setCancelError(t('order.cancelFailed'))
    } finally {
      setCancelling(false)
    }
  }

  async function handleReorder() {
    if (!order || !availability || reordering) return

    setReordering(true)
    setReorderMessage('')

    try {
      let addedCount = 0
      let unavailableCount = 0

      for (const item of order.items) {
        const result = availability.get(item.id)
        if (result?.ok) {
          addItem(
            {
              productId: result.productId,
              variantId: result.variantId,
              name: result.name,
              imageUrl: result.imageUrl,
              colorName: result.colorName,
              sizeName: result.sizeName,
              unitPrice: result.unitPrice,
            },
            result.quantity
          )
          addedCount += 1
        } else {
          unavailableCount += 1
        }
      }

      if (addedCount === 0) {
        setReorderMessage(t('order.reorderNoneAvailable'))
      } else if (unavailableCount > 0) {
        navigate('/cart', {
          state: {
            notice: t('order.reorderPartial', { added: addedCount, unavailable: unavailableCount }),
          },
        })
      } else {
        navigate('/cart')
      }
    } finally {
      setReordering(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (notFound || !order) {
    return (
      <div dir={dir} className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
          <PackageSearch size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">{t('order.notFound')}</h1>
        <p className="text-sm text-gray-500 mt-2">
          {t('order.notFoundHint')}
        </p>
        <Link
          to="/account/orders"
          className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('order.backToMyOrders')}
        </Link>
      </div>
    )
  }

  const explanation = ORDER_STATUS_EXPLANATIONS[order.orderStatus]
  const nextStep = ORDER_STATUS_NEXT_STEP[order.orderStatus]
  const canCancel = order.orderStatus === CANCELLABLE_STATUS
  const canReorder = availability && [...availability.values()].some((r) => r.ok)

  return (
    <div dir={dir} className="max-w-2xl mx-auto px-4 py-10">
      <Link
        to="/account/orders"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-gold transition-colors mb-6"
      >
        <ChevronRight size={16} className={dir === 'ltr' ? 'rotate-180' : ''} />
        {t('order.backToMyOrders')}
      </Link>

      <div className="flex items-center justify-between mb-1 gap-2">
        <h1 dir="ltr" className="text-xl font-bold text-gray-900 text-right">
          {order.orderNumber}
        </h1>
        <button
          onClick={handleCopyOrderNumber}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-gold transition-colors shrink-0"
          aria-label={t('order.copyOrderNumber')}
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          {copied ? t('order.copied') : t('order.copyNumber')}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('order.placedOn', { date: formatDateTime(order.createdAt, language) })}</p>

      <div className="flex items-center gap-2 mb-4">
        <StatusBadge
          text={order.orderStatus}
          className={ORDER_STATUS_STYLES[order.orderStatus] || 'bg-gray-100 text-gray-500'}
        />
        <StatusBadge
          text={PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
          className={PAYMENT_STATUS_STYLES[order.paymentStatus] || 'bg-gray-100 text-gray-500'}
        />
      </div>

      {/* STAGE 18 — retry payment for eligible unpaid orders. Not offered
          for a cancelled order (nothing to pay for), an already-paid one,
          or — since online payment is now disabled at checkout — a plain
          COD order that never actually went through MyFatoorah in the
          first place (order.myFatoorahInvoiceId is only ever set once
          myfatoorah-create-payment has actually run for this order). */}
      {order.paymentStatus !== 'paid' && order.orderStatus !== CANCELLED_STATUS && order.myFatoorahInvoiceId && (
        <Link
          to={`/order-payment/${order.id}`}
          className="flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-3 text-sm font-medium mb-4 hover:opacity-90 transition-opacity"
        >
          <CreditCard size={16} />
          {t('order.completeOrRetryPayment')}
        </Link>
      )}

      {/* Status timeline */}
      <div className="mb-4">
        <OrderStatusTimeline status={order.orderStatus} />
      </div>

      {/* Explanation + next step */}
      {(explanation || nextStep) && (
        <div className="bg-brand-light/50 rounded-2xl p-4 mb-4 space-y-1.5">
          {explanation && <p className="text-sm text-gray-800">{explanation}</p>}
          {nextStep && (
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-600">{t('order.nextStep')}</span>
              {nextStep}
            </p>
          )}
        </div>
      )}

      {cancelSuccess && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4">
          <Check size={16} className="shrink-0" />
          <span>{cancelSuccess}</span>
        </div>
      )}
      {cancelError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{cancelError}</span>
        </div>
      )}

      {/* Cancellation */}
      {canCancel && (
        <button
          onClick={handleCancelOrder}
          disabled={cancelling}
          className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium mb-4 hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          {cancelling && <Loader2 size={16} className="animate-spin" />}
          {t('order.cancelOrder')}
        </button>
      )}

      {/* Shipping info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">{t('order.deliveryInfo')}</h2>
        <div className="space-y-1.5 text-sm text-gray-600">
          <p>{order.customerName}</p>
          <p dir="ltr" className="text-right">{order.customerPhone}</p>
          {order.customerEmail && <p dir="ltr" className="text-right">{order.customerEmail}</p>}
          <p>
            {order.customerAddress}، {order.customerCity}، {order.customerGovernorate}
          </p>
          {order.orderNotes && <p className="text-gray-400 pt-1">{order.orderNotes}</p>}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4">{t('order.products')}</h2>
        <div className="space-y-4">
          {order.items.map((item) => {
            const result = availability?.get(item.id)
            const note = availabilityNote(result, t)

            return (
              <div key={item.id} className="flex gap-3">
                <div className="w-16 h-20 rounded-lg overflow-hidden bg-gray-50 shrink-0 relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <PackageSearch size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                  {(item.colorName || item.sizeName) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[item.colorName, item.sizeName].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  {note && (
                    <p className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                      <Info size={11} className="shrink-0" />
                      {note}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-500">
                      {item.quantity} × {formatKWD(item.unitPrice, language)}
                    </span>
                    <span className="text-sm font-bold text-red-500">{formatKWD(item.lineTotal, language)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-2 text-sm mb-4">
        <div className="flex items-center justify-between text-gray-600">
          <span>{t('checkout.subtotal')}</span>
          <span className="text-red-500 font-medium">{formatKWD(order.subtotal, language)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex items-center justify-between text-brand-gold">
            <span>{t('order.discount')}{order.discountCode ? ` (${order.discountCode})` : ''}</span>
            <span>- {formatKWD(order.discountAmount, language)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-gray-600">
          <span>{t('order.shipping')}</span>
          <span className={order.shippingCost > 0 ? 'text-red-500 font-medium' : 'text-gray-900'}>
            {order.shippingCost > 0 ? formatKWD(order.shippingCost, language) : t('order.freeShipping')}
          </span>
        </div>
        <div className="flex items-center justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>{t('order.total')}</span>
          <span className="text-red-500">{formatKWD(order.total, language)}</span>
        </div>
      </div>

      {/* Reorder */}
      {canReorder && (
        <div>
          <button
            onClick={handleReorder}
            disabled={reordering}
            className="w-full flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {reordering ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            {t('order.reorder')}
          </button>
          {reorderMessage && <p className="text-xs text-amber-600 text-center mt-2">{reorderMessage}</p>}
        </div>
      )}
    </div>
  )
}
