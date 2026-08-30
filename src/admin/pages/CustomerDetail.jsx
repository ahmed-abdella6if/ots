// Admin — Customer Detail: customer info + order history.
// Reuses the same order status badge styling as the Orders list page, and
// links each order to the existing /admin/orders/:id detail page.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Mail, Phone, Calendar, ClipboardList, Eye } from 'lucide-react'
import { getCustomerDetail } from '../../services/customerService'
import { formatKWD } from '../../utils/formatPrice'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES, ORDER_STATUS_STYLES, StatusBadge } from './Orders'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CustomerDetail() {
  const { id: customerId } = useParams()

  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let isMounted = true

    setLoading(true)
    setError(false)
    setNotFound(false)

    getCustomerDetail(customerId)
      .then((data) => {
        if (isMounted) setCustomer(data)
      })
      .catch((err) => {
        console.error('Failed to load customer:', err.message)
        if (!isMounted) return
        if (err.notFound) setNotFound(true)
        else setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [customerId])

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          to="/admin/customers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowRight size={16} />
          <span>العودة الى العملاء</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900">تفاصيل العميل</h2>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      ) : notFound ? (
        <p className="text-sm text-gray-400 py-10 text-center">لم يتم العثور على هذا العميل</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-10 text-center">تعذر تحميل بيانات العميل</p>
      ) : (
        <>
          {/* Customer info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-gray-900">{customer.name}</h3>
              <span
                className={`inline-block w-fit px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  customer.isRegistered ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {customer.isRegistered ? 'حساب مسجل' : 'طلب بدون تسجيل'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail size={16} className="text-gray-400 shrink-0" />
                <span>{customer.email || 'غير معروف'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600" dir="ltr">
                <Phone size={16} className="text-gray-400 shrink-0" />
                <span>{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <span>
                  {customer.isRegistered
                    ? `تاريخ التسجيل: ${formatDate(customer.registeredAt)}`
                    : 'لا يوجد حساب مسجل'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-gray-50">
              <div>
                <p className="text-xs text-gray-400">عدد الطلبات</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{customer.orderCount}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">اجمالي المبلغ المدفوع</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{formatKWD(customer.totalSpent)}</p>
              </div>
            </div>
          </div>

          {/* Orders */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4">طلبات العميل</h3>

            {customer.orders.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList size={28} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 text-sm">لا توجد طلبات لهذا العميل</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-xs border-b border-gray-100">
                        <th className="text-right font-medium pb-3 pr-2">رقم الطلب</th>
                        <th className="text-right font-medium pb-3">التاريخ</th>
                        <th className="text-right font-medium pb-3">الاجمالي</th>
                        <th className="text-right font-medium pb-3">حالة الدفع</th>
                        <th className="text-right font-medium pb-3">حالة الطلب</th>
                        <th className="text-right font-medium pb-3">اجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.orders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-3 pr-2 font-medium text-gray-800 whitespace-nowrap">
                            {order.orderNumber}
                          </td>
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
                  {customer.orders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/admin/orders/${order.id}`}
                      className="block border border-gray-100 rounded-xl p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{order.orderNumber}</span>
                        <span className="text-sm text-gray-800">{formatKWD(order.total)}</span>
                      </div>
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
        </>
      )}
    </div>
  )
}