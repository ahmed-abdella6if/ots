// Admin — Orders list: search, filter by order status, view details.
// Status/payment updates happen on the Order Detail page, not here.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ClipboardList, Eye } from 'lucide-react'
import { getOrders } from '../../services/orderService'
import { formatKWD } from '../../utils/formatPrice'

// Single source of truth for the order-status flow (values come straight
// from order_status_enum in supabase/schema.sql — nothing invented here).
// 'ملغي' (cancelled) is a terminal/exception state, not a step in the
// normal progression, so it's kept separate from ORDER_STATUS_FLOW below.
export const ORDER_STATUS_OPTIONS = ['جديد', 'قيد التجهيز', 'تم الشحن', 'تم التسليم', 'ملغي']

// The normal, in-order progression a non-cancelled order moves through.
// Used by the customer-facing status timeline (Stage 17) to know what
// counts as "completed" vs "upcoming" relative to the current status.
export const ORDER_STATUS_FLOW = ['جديد', 'قيد التجهيز', 'تم الشحن', 'تم التسليم']

export const CANCELLED_STATUS = 'ملغي'

// Short Arabic explanation of what each status means for the customer.
export const ORDER_STATUS_EXPLANATIONS = {
  'جديد': 'تم استلام طلبك وهو في انتظار المراجعة',
  'قيد التجهيز': 'جاري تجهيز طلبك',
  'تم الشحن': 'تم شحن طلبك وهو في الطريق إليك',
  'تم التسليم': 'تم تسليم طلبك بنجاح',
  'ملغي': 'تم إلغاء هذا الطلب',
}

// "الخطوة التالية" — the next expected step from the current status.
// No dates/estimates are included since the schema doesn't store any.
export const ORDER_STATUS_NEXT_STEP = {
  'جديد': 'سيتم مراجعة طلبك وبدء تجهيزه قريبًا',
  'قيد التجهيز': 'سيتم شحن طلبك بمجرد الانتهاء من تجهيزه',
  'تم الشحن': 'سيصلك طلبك قريبًا',
  'تم التسليم': null,
  'ملغي': null,
}

export const PAYMENT_STATUS_LABELS = {
  pending: 'في الانتظار',
  paid: 'مدفوع',
  failed: 'فشل',
  refunded: 'مسترد',
}

export const PAYMENT_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-600',
  paid: 'bg-green-50 text-green-600',
  failed: 'bg-red-50 text-red-600',
  refunded: 'bg-gray-100 text-gray-500',
}

export const ORDER_STATUS_STYLES = {
  'جديد': 'bg-blue-50 text-blue-600',
  'قيد التجهيز': 'bg-amber-50 text-amber-600',
  'تم الشحن': 'bg-indigo-50 text-indigo-600',
  'تم التسليم': 'bg-green-50 text-green-600',
  'ملغي': 'bg-red-50 text-red-600',
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function StatusBadge({ text, className }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {text}
    </span>
  )
}

function OrderRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/4 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/6 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    let isMounted = true

    getOrders()
      .then((data) => {
        if (isMounted) setOrders(data)
      })
      .catch((err) => {
        console.error('Failed to load orders:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const filteredOrders = useMemo(() => {
    let result = orders

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(query) ||
          o.customerName.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((o) => o.orderStatus === statusFilter)
    }

    return result
  }, [orders, search, statusFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">الطلبات</h2>
        <p className="text-sm text-gray-500 mt-1">استعراض وادارة طلبات المتجر</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Count + filters */}
        <div className="flex flex-col gap-4 mb-5">
          <p className="text-sm text-gray-500">
            عدد الطلبات: <span className="font-semibold text-gray-800">{orders.length}</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم الطلب او اسم العميل"
                aria-label="بحث عن طلب"
                className="w-full rounded-xl border border-gray-200 pr-10 pl-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="حالة الطلب"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none bg-white transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold sm:w-52"
            >
              <option value="all">كل الحالات</option>
              {ORDER_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content states */}
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <OrderRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 py-10 text-center">حدث خطا اثناء تحميل الطلبات</p>
        ) : orders.length === 0 ? (
          <div className="py-14 text-center">
            <ClipboardList size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا توجد طلبات حتى الان</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">لا توجد نتائج مطابقة لبحثك</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-right font-medium pb-3 pr-2">رقم الطلب</th>
                    <th className="text-right font-medium pb-3">العميل</th>
                    <th className="text-right font-medium pb-3">التاريخ</th>
                    <th className="text-right font-medium pb-3">الاجمالي</th>
                    <th className="text-right font-medium pb-3">حالة الدفع</th>
                    <th className="text-right font-medium pb-3">حالة الطلب</th>
                    <th className="text-right font-medium pb-3">اجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-2 font-medium text-gray-800 whitespace-nowrap">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 text-gray-600 whitespace-nowrap">{order.customerName}</td>
                      <td className="py-3 text-gray-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="py-3 text-gray-800 whitespace-nowrap">{formatKWD(order.total)}</td>
                      <td className="py-3">
                        <StatusBadge
                          text={PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                          className={PAYMENT_STATUS_STYLES[order.paymentStatus] || 'bg-gray-100 text-gray-500'}
                        />
                      </td>
                      <td className="py-3">
                        <StatusBadge
                          text={order.orderStatus}
                          className={ORDER_STATUS_STYLES[order.orderStatus] || 'bg-gray-100 text-gray-500'}
                        />
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Eye size={14} />
                          <span>عرض التفاصيل</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="block border border-gray-100 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{order.orderNumber}</span>
                    <span className="text-sm text-gray-800">{formatKWD(order.total)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{order.customerName}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge
                      text={PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                      className={PAYMENT_STATUS_STYLES[order.paymentStatus] || 'bg-gray-100 text-gray-500'}
                    />
                    <StatusBadge
                      text={order.orderStatus}
                      className={ORDER_STATUS_STYLES[order.orderStatus] || 'bg-gray-100 text-gray-500'}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{formatDate(order.createdAt)}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}