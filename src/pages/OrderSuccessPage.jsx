// Order success page (Stage 15) — shown right after a successful checkout.
// Route: /order-success/:id
//
// Prefers the order data handed off via router state (set by
// CheckoutPage right after createOrder() succeeds) so the confirmation is
// instant and needs no extra round-trip. On a hard refresh that state is
// gone, so it falls back to orderService.getOrderForSuccessPage(id) — which
// works for a logged-in customer viewing their own order, but returns null
// for a guest order (a reported RLS limitation, see orderService.js).
// Either way, this page never re-creates an order — it only ever reads.

import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, PackageSearch } from 'lucide-react'
import { getOrderForSuccessPage } from '../services/orderService'
import { formatKWD } from '../utils/formatPrice'

export default function OrderSuccessPage() {
  const { id } = useParams()
  const location = useLocation()
  const stateOrder = location.state?.order || null

  const [order, setOrder] = useState(stateOrder)
  const [loading, setLoading] = useState(!stateOrder)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (stateOrder) return // already have everything we need, no fetch necessary

    let isMounted = true
    setLoading(true)
    getOrderForSuccessPage(id)
      .then((result) => {
        if (!isMounted) return
        if (!result) {
          setNotFound(true)
        } else {
          setOrder({
            id: result.id,
            orderNumber: result.orderNumber,
            total: result.total,
            subtotal: result.subtotal,
            discountAmount: result.discountAmount,
            shippingCost: result.shippingCost,
            customer: { fullName: result.customerName },
            items: result.items,
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load order:', err.message)
        if (isMounted) setNotFound(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div dir="rtl" className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span>...جاري تحميل بيانات الطلب</span>
        </div>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div dir="rtl" className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
          <PackageSearch size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">لا يمكن عرض تفاصيل الطلب</h1>
        <p className="text-sm text-gray-500 mt-2">
          لكن لا تقلق، اذا تم إنشاء الطلب بنجاح فسيصلك تأكيد قريبا. لأي استفسار برجاء التواصل معنا مع ذكر رقم الطلب.
        </p>
        <Link
          to="/"
          className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          العودة للرئيسية
        </Link>
      </div>
    )
  }

  return (
    <div dir="rtl" className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto text-green-600">
        <CheckCircle2 size={32} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mt-6">تم استلام طلبك بنجاح</h1>
      <p className="text-sm text-gray-500 mt-2">
        شكرا لك{order.customer?.fullName ? ` ${order.customer.fullName}` : ''}، سنتواصل معك قريبا لتأكيد التوصيل
      </p>

      <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-6 text-right space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">رقم الطلب</span>
          <span dir="ltr" className="text-sm font-bold text-gray-900">
            {order.orderNumber}
          </span>
        </div>

        {order.items && order.items.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            {order.items.map((item, idx) => (
              <div key={item.key || item.id || idx} className="flex items-center justify-between text-sm">
                <div className="text-gray-700">
                  <span>{item.name || item.productName}</span>
                  {(item.colorName || item.sizeName) && (
                    <span className="text-gray-400"> ({[item.colorName, item.sizeName].filter(Boolean).join(' / ')})</span>
                  )}
                  <span className="text-gray-400"> × {item.quantity}</span>
                </div>
                <span className="font-medium text-gray-900">{formatKWD(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">الإجمالي</span>
          <span className="text-base font-bold text-gray-900">{formatKWD(order.total)}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-8">
        <Link
          to="/"
          className="bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          العودة للرئيسية
        </Link>
        <Link
          to="/"
          className="border border-gray-200 text-gray-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          متابعة التسوق
        </Link>
      </div>
    </div>
  )
}
