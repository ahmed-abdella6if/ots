// Admin — single order detail: customer info, items, totals, and status management.

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  User,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  Package,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { getOrderById, updateOrderStatus, updatePaymentStatus } from '../../services/orderService'
import { formatKWD } from '../../utils/formatPrice'
import { ORDER_STATUS_OPTIONS, CANCELLED_STATUS } from './Orders'

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'في الانتظار' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'failed', label: 'فشل' },
  { value: 'refunded', label: 'مسترد' },
]

const PAYMENT_STATUS_LABELS = Object.fromEntries(
  PAYMENT_STATUS_OPTIONS.map((o) => [o.value, o.label])
)

const ORDER_STATUS_STYLES = {
  'جديد': 'bg-blue-50 text-blue-600',
  'قيد التجهيز': 'bg-amber-50 text-amber-600',
  'تم الشحن': 'bg-indigo-50 text-indigo-600',
  'تم التسليم': 'bg-green-50 text-green-600',
  'ملغي': 'bg-red-50 text-red-600',
}

const PAYMENT_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-600',
  paid: 'bg-green-50 text-green-600',
  failed: 'bg-red-50 text-red-600',
  refunded: 'bg-gray-100 text-gray-500',
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ text, className }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {text}
    </span>
  )
}

function Banner({ type, children }) {
  const styles = type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 ${styles}`}>
      <Icon size={16} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export default function OrderDetail() {
  const { id: orderId } = useParams()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [savingOrderStatus, setSavingOrderStatus] = useState(false)
  const [savingPaymentStatus, setSavingPaymentStatus] = useState(false)

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await getOrderById(orderId)
      setOrder(data)
    } catch (err) {
      console.error('Failed to load order:', err.message)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    if (!errorMessage) return
    const timer = setTimeout(() => setErrorMessage(''), 4500)
    return () => clearTimeout(timer)
  }, [errorMessage])

  async function handleOrderStatusChange(newStatus) {
    if (newStatus === order.orderStatus) return

    // STAGE 17 FIX (Issue 2): cancelled orders are terminal. This mirrors
    // the DB-level trigger (trg_orders_enforce_terminal_status) so the UI
    // never even attempts a request that the database would reject anyway.
    if (order.orderStatus === CANCELLED_STATUS) return

    if (newStatus === 'ملغي') {
      if (!window.confirm('هل تريد الغاء هذا الطلب؟ لا يمكن التراجع عن هذا الاجراء من هنا.')) return
    }

    setSavingOrderStatus(true)
    try {
      const updated = await updateOrderStatus(order.id, newStatus)
      setOrder((prev) => ({ ...prev, orderStatus: updated }))
      setSuccessMessage('تم تحديث حالة الطلب بنجاح')
    } catch (err) {
      console.error('Failed to update order status:', err.message)
      setErrorMessage('تعذر تحديث حالة الطلب')
    } finally {
      setSavingOrderStatus(false)
    }
  }

  async function handlePaymentStatusChange(newStatus) {
    if (newStatus === order.paymentStatus) return

    const label = PAYMENT_STATUS_LABELS[newStatus] || newStatus
    if (
      !window.confirm(
        `هل تريد تغيير حالة الدفع الى "${label}"؟ هذا تعديل يدوي وقد لا يعكس حالة الدفع الفعلية عبر MyFatoorah.`
      )
    )
      return

    setSavingPaymentStatus(true)
    try {
      const updated = await updatePaymentStatus(order.id, newStatus)
      setOrder((prev) => ({ ...prev, paymentStatus: updated }))
      setSuccessMessage('تم تحديث حالة الدفع بنجاح')
    } catch (err) {
      console.error('Failed to update payment status:', err.message)
      setErrorMessage('تعذر تحديث حالة الدفع')
    } finally {
      setSavingPaymentStatus(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowRight size={16} />
          <span>العودة الى الطلبات</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900">
          طلب {order ? `#${order.orderNumber}` : ''}
        </h2>
        {order && (
          <p className="text-sm text-gray-500 mt-1">تم الطلب في {formatDateTime(order.createdAt)}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-500 py-10 text-center">حدث خطا اثناء تحميل بيانات الطلب</p>
      ) : (
        <div className="space-y-6">
          {successMessage && <Banner type="success">{successMessage}</Banner>}
          {errorMessage && <Banner type="error">{errorMessage}</Banner>}

          {/* الحالة */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="font-bold text-gray-900">حالة الطلب والدفع</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="order-status" className="block text-xs font-medium text-gray-600 mb-1.5">
                  حالة الطلب
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="order-status"
                    value={order.orderStatus}
                    onChange={(e) => handleOrderStatusChange(e.target.value)}
                    disabled={savingOrderStatus || order.orderStatus === CANCELLED_STATUS}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors disabled:opacity-60"
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  {savingOrderStatus && <Loader2 size={16} className="animate-spin text-gray-400" />}
                </div>
                <div className="mt-2">
                  <StatusBadge
                    text={order.orderStatus}
                    className={ORDER_STATUS_STYLES[order.orderStatus] || 'bg-gray-100 text-gray-500'}
                  />
                </div>
                {/* STAGE 17 FIX (Issue 2/Part D) — cancelled orders are terminal;
                    the select above is disabled and this makes it explicit why. */}
                {order.orderStatus === CANCELLED_STATUS && (
                  <p className="text-xs text-red-500 mt-2">الطلب ملغي ولا يمكن تغيير حالته</p>
                )}
              </div>

              <div>
                <label htmlFor="payment-status" className="block text-xs font-medium text-gray-600 mb-1.5">
                  حالة الدفع
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="payment-status"
                    value={order.paymentStatus}
                    onChange={(e) => handlePaymentStatusChange(e.target.value)}
                    disabled={savingPaymentStatus}
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors disabled:opacity-60"
                  >
                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {savingPaymentStatus && <Loader2 size={16} className="animate-spin text-gray-400" />}
                </div>
                <div className="mt-2">
                  <StatusBadge
                    text={PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                    className={PAYMENT_STATUS_STYLES[order.paymentStatus] || 'bg-gray-100 text-gray-500'}
                  />
                </div>
                {/* STAGE 18 — MyFatoorah reference, if this order was paid/attempted online */}
                {order.myFatoorahPaymentId && (
                  <p dir="ltr" className="text-[11px] text-gray-400 mt-2 text-right">
                    مرجع الدفع (MyFatoorah): {order.myFatoorahPaymentId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* معلومات العميل */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <User size={18} className="text-brand-gold" />
              <h3 className="font-bold text-gray-900">معلومات العميل</h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <User size={15} className="text-gray-400 shrink-0" />
                <span>{order.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Phone size={15} className="text-gray-400 shrink-0" />
                <span dir="ltr">{order.customerPhone}</span>
              </div>
              {order.customerEmail && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Mail size={15} className="text-gray-400 shrink-0" />
                  <span dir="ltr">{order.customerEmail}</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-gray-700 sm:col-span-2">
                <MapPin size={15} className="text-gray-400 shrink-0 mt-0.5" />
                <span>
                  {order.customerAddress}، {order.customerCity}، {order.customerGovernorate}
                </span>
              </div>
              {order.orderNotes && (
                <div className="flex items-start gap-2 text-gray-700 sm:col-span-2">
                  <StickyNote size={15} className="text-gray-400 shrink-0 mt-0.5" />
                  <span>{order.orderNotes}</span>
                </div>
              )}
            </div>
          </div>

          {/* المنتجات */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-brand-gold" />
              <h3 className="font-bold text-gray-900">المنتجات</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-right font-medium pb-2 pr-2">المنتج</th>
                    <th className="text-right font-medium pb-2">اللون</th>
                    <th className="text-right font-medium pb-2">المقاس</th>
                    <th className="text-right font-medium pb-2">الكمية</th>
                    <th className="text-right font-medium pb-2">السعر</th>
                    <th className="text-right font-medium pb-2">الاجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-2 text-gray-800">{item.productName}</td>
                      <td className="py-2.5 text-gray-600 whitespace-nowrap">{item.colorName}</td>
                      <td className="py-2.5 text-gray-600 whitespace-nowrap">{item.sizeName}</td>
                      <td className="py-2.5 text-gray-600 whitespace-nowrap">{item.quantity}</td>
                      <td className="py-2.5 text-gray-600 whitespace-nowrap">{formatKWD(item.unitPrice)}</td>
                      <td className="py-2.5 text-gray-800 whitespace-nowrap">{formatKWD(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* الملخص المالي */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-brand-gold" />
              <h3 className="font-bold text-gray-900">الملخص المالي</h3>
            </div>

            <dl className="text-sm space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">المجموع الفرعي</dt>
                <dd className="text-gray-800">{formatKWD(order.subtotal)}</dd>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">
                    الخصم{order.discountCode ? ` (${order.discountCode})` : ''}
                  </dt>
                  <dd className="text-red-500">- {formatKWD(order.discountAmount)}</dd>
                </div>
              )}

              <div className="flex items-center justify-between">
                <dt className="text-gray-500">تكلفة الشحن</dt>
                <dd className="text-gray-800">{formatKWD(order.shippingCost)}</dd>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 font-bold">
                <dt className="text-gray-900">الاجمالي النهائي</dt>
                <dd className="text-gray-900">{formatKWD(order.total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}