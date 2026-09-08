// Customer "My Orders" list (Stage 16) — /account/orders
// Only ever shows the authenticated customer's own orders. Ownership is
// enforced by the database itself (RLS on `orders`), not by fetching
// everything and filtering client-side — see the security note above
// orderService.getMyOrders(). Reuses the same StatusBadge/label/style
// constants as the Admin Orders list instead of duplicating them.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageX, ChevronLeft, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { getMyOrders } from '../services/orderService'
import { formatKWD } from '../utils/formatPrice'
import { StatusBadge, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES, ORDER_STATUS_STYLES } from '../admin/pages/Orders'

function OrderRowSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 bg-gray-100 rounded" />
        <div className="h-3 w-20 bg-gray-100 rounded" />
      </div>
      <div className="h-6 w-16 bg-gray-100 rounded-full" />
      <div className="h-3.5 w-16 bg-gray-100 rounded" />
    </div>
  )
}

export default function MyOrdersPage() {
  const { user } = useAuth()
  const { t, dir, language } = useLanguage()
  const [orders, setOrders] = useState(null) // null = loading
  const [error, setError] = useState('')

  // STAGE 30 — date locale follows the active language (was hardcoded 'ar-EG').
  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  useEffect(() => {
    if (!user?.id) return
    let isMounted = true

    setError('')
    getMyOrders(user.id)
      .then((result) => {
        if (isMounted) setOrders(result)
      })
      .catch((err) => {
        console.error('Failed to load orders:', err.message)
        if (isMounted) setError(t('account.ordersLoadError'))
      })

    return () => {
      isMounted = false
    }
  }, [user?.id])

  return (
    <div dir={dir} className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('account.myOrders')}</h1>
        <Link to="/account" className="text-sm text-gray-500 hover:text-brand-gold transition-colors">
          {t('account.backToAccount')}
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {orders === null && !error ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <OrderRowSkeleton key={i} />
          ))}
        </div>
      ) : orders && orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
            <PackageX size={28} />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mt-6">{t('account.noOrdersYet')}</h2>
          <p className="text-sm text-gray-500 mt-2">{t('account.noOrdersHint')}</p>
          <Link
            to="/"
            className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('cart.browseProducts')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(orders || []).map((order) => (
            <Link
              key={order.id}
              to={`/account/orders/${order.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-brand-gold/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p dir="ltr" className="text-sm font-bold text-gray-900 text-right">
                    {order.orderNumber}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(order.createdAt)} · {order.itemCount}{' '}
                    {order.itemCount === 1 ? t('account.itemSingular') : t('account.itemPlural')}
                  </p>
                </div>
                <ChevronLeft size={18} className={`text-gray-300 shrink-0 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    text={order.orderStatus}
                    className={ORDER_STATUS_STYLES[order.orderStatus] || 'bg-gray-100 text-gray-500'}
                  />
                  <StatusBadge
                    text={PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                    className={PAYMENT_STATUS_STYLES[order.paymentStatus] || 'bg-gray-100 text-gray-500'}
                  />
                </div>
                <span className="text-sm font-bold text-red-500">{formatKWD(order.total, language)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
