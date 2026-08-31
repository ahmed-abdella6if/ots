// Order payment page (Stage 18) — /order-payment/:orderId
//
// Reached in two ways:
//   1. Right after checkout, when the customer chose online payment
//      (CheckoutPage navigates here after createOrder() succeeds).
//   2. As the "إعادة المحاولة" / retry-payment entry point for an existing
//      unpaid order (see MyOrderDetailPage.jsx).
//
// Either way this page does the same thing: ask the secure
// myfatoorah-create-payment Edge Function for a PaymentURL for this order,
// then redirect the whole browser to it (leaving the SPA — MyFatoorah's
// hosted page is a different origin). No card data ever touches this app;
// no MyFatoorah key is ever present here (see src/services/paymentService.js).
//
// If the order is already paid (e.g. the customer bookmarked/reused this
// link), skip straight to the order-success view instead of creating a
// pointless new payment.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, AlertCircle, CreditCard } from 'lucide-react'
import { createMyFatoorahPayment } from '../services/paymentService'
import { useLanguage } from '../hooks/useLanguage'

export default function OrderPaymentPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { t, dir } = useLanguage()

  const [status, setStatus] = useState('starting') // starting | redirecting | error
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function start() {
      setStatus('starting')
      setErrorMessage('')
      try {
        const result = await createMyFatoorahPayment(orderId)
        if (!isMounted) return

        if (result.alreadyPaid) {
          navigate(`/order-success/${orderId}`)
          return
        }

        if (!result.paymentUrl) {
          setStatus('error')
          setErrorMessage(t('payment.failedToPrepareLink'))
          return
        }

        setStatus('redirecting')
        // Full navigation on purpose — MyFatoorah's hosted page is a
        // different origin, this isn't an in-app route.
        window.location.href = result.paymentUrl
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to start MyFatoorah payment:', err.message)
        setStatus('error')
        setErrorMessage(err.message || t('payment.failedToPreparePayment'))
      }
    }

    start()
    return () => {
      isMounted = false
    }
  }, [orderId, navigate])

  return (
    <div dir={dir} className="max-w-md mx-auto px-4 py-24 text-center">
      {status !== 'error' ? (
        <>
          <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
            <CreditCard size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-6">{t('payment.preparing')}</h1>
          <p className="text-sm text-gray-500 mt-2 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            {t('payment.redirectingHint')}
          </p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto text-red-500">
            <AlertCircle size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-6">{t('payment.failedTitle')}</h1>
          <p className="text-sm text-gray-500 mt-2">{errorMessage}</p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => window.location.reload()}
              className="bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('payment.retry')}
            </button>
            <Link
              to="/account/orders"
              className="border border-gray-200 text-gray-700 rounded-xl px-6 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {t('account.myOrders')}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
