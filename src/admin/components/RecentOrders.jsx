// Read-only preview of the latest orders. Full order management comes in a later stage.

import { formatKWD } from '../../utils/formatPrice'

const PAYMENT_STATUS_LABELS = {
  pending: 'في الانتظار',
  paid: 'مدفوع',
  failed: 'فشل',
  refunded: 'مسترد',
}

const PAYMENT_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-600',
  paid: 'bg-green-50 text-green-600',
  failed: 'bg-red-50 text-red-600',
  refunded: 'bg-gray-100 text-gray-500',
}

const ORDER_STATUS_STYLES = {
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

function StatusBadge({ text, className }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {text}
    </span>
  )
}

export default function RecentOrders({ orders, loading, error }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-900 mb-4">اخر الطلبات</h3>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">تعذر تحميل الطلبات، حاول مرة اخرى لاحقا</p>
      ) : !orders || orders.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">لا توجد طلبات حتى الان</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-100">
                <th className="text-right font-medium pb-2 pr-2">رقم الطلب</th>
                <th className="text-right font-medium pb-2">اسم العميل</th>
                <th className="text-right font-medium pb-2">الاجمالي</th>
                <th className="text-right font-medium pb-2">حالة الدفع</th>
                <th className="text-right font-medium pb-2">حالة الطلب</th>
                <th className="text-right font-medium pb-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-2 font-medium text-gray-800 whitespace-nowrap">
                    {order.order_number}
                  </td>
                  <td className="py-3 text-gray-600 whitespace-nowrap">{order.customer_name}</td>
                  <td className="py-3 text-gray-800 whitespace-nowrap">{formatKWD(order.total)}</td>
                  <td className="py-3">
                    <StatusBadge
                      text={PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
                      className={PAYMENT_STATUS_STYLES[order.payment_status] || 'bg-gray-100 text-gray-500'}
                    />
                  </td>
                  <td className="py-3">
                    <StatusBadge
                      text={order.order_status}
                      className={ORDER_STATUS_STYLES[order.order_status] || 'bg-gray-100 text-gray-500'}
                    />
                  </td>
                  <td className="py-3 text-gray-500 whitespace-nowrap">{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
