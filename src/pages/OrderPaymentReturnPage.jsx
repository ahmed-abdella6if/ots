// Order payment RETURN page (Stage 18) — /order-payment/:orderId/return
//
// This is the single IntegrationUrls.Redirection URL used for the
// MyFatoorah payment created in OrderPaymentPage.jsx — MyFatoorah sends the
// customer back here after EVERY outcome (paid, failed, cancelled),
// appending ?paymentId=... . This page never trusts that query param by
// itself: it hands paymentId + orderId to the myfatoorah-verify-payment
// Edge Function, which is the only thing authorized to actually confirm
// payment (server-to-server call to MyFatoorah + amount/currency/reference
// cross-check against the database — see that function for the full
// security note).
//
// Safe to land on twice (refresh, or returning again) — verification is
// idempotent server-side.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { verifyMyFatoorahPayment } from '../services/paymentService'
import { getOrderForSuccessPage } from '../services/orderService'

export default function OrderPaymentReturnPage() {
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const paymentId = searchParams.get('paymentId')

  const [status, setStatus] = useState('checking') // checking | paid | failed | error
  const [message, setMessage] = useState('')
  const [order, setOrder] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function run() {
      if (!paymentId) {
        setStatus('error')
        setMessage('لم يتم استلام بيانات الدفع من MyFatoorah')
        return
      }

      try {
        const result = await verifyMyFatoorahPayment(orderId, paymentId)
        if (!isMounted) return

        if (result.paid) {
          setStatus('paid')
          getOrderForSuccessPage(orderId)
            .then((o) => isMounted && setOrder(o))
            .catch(() => {})
        } else {
          setStatus('failed')
          setMessage(result.message || 'لم يتم إتمام الدفع')
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Payment verification failed:', err.message)
        setStatus('error')
        setMessage(err.message || 'تعذر التحقق من حالة الدفع')
      }
    }

    run()
    return () => {
      isMounted = false
    }
  }, [orderId, paymentId])

  if (status === 'checking') {
    return (
      <div dir="rtl" className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
        <span>...جاري التحقق من حالة الدفع</span>
      </div>
    )
  }

  if (status === 'paid') {
    return (
      <div dir="rtl" className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto text-green-600">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-6">تم الدفع بنجاح</h1>
        <p className="text-sm text-gray-500 mt-2">
          شكرا لك{order?.customerName ? ` ${order.customerName}` : ''}، تم تأكيد طلبك وسنبدأ تجهيزه
        </p>
        {order?.orderNumber && (
          <p dir="ltr" className="text-sm font-bold text-gray-900 mt-4">
            {order.orderNumber}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            to="/"
            className="bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            العودة للرئيسية
          </Link>
          <Link
            to="/account/orders"
            className="border border-gray-200 text-gray-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            طلباتي
          </Link>
        </div>
      </div>
    )
  }

  // 'failed' (payment not completed) or 'error' (couldn't verify) — same
  // recovery UI either way: keep the order, offer a retry, never claim success.
  return (
    <div dir="rtl" className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto text-red-500">
        {status === 'failed' ? <XCircle size={32} /> : <AlertCircle size={32} />}
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mt-6">
        {status === 'failed' ? 'لم يتم إتمام الدفع' : 'تعذر التحقق من الدفع'}
      </h1>
      <p className="text-sm text-gray-500 mt-2">{message}</p>
      <p className="text-xs text-gray-400 mt-2">طلبك محفوظ، يمكنك المحاولة مرة أخرى في أي وقت</p>
      <div className="flex items-center justify-center gap-3 mt-8">
        <button
          onClick={() => navigate(`/order-payment/${orderId}`)}
          className="bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          إعادة محاولة الدفع
        </button>
        <Link
          to="/account/orders"
          className="border border-gray-200 text-gray-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          طلباتي
        </Link>
      </div>
    </div>
  )
}
