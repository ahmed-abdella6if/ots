// Cart page: line items (image, name, color/size, qty, price), subtotal,
// empty state. Discount/shipping/total-at-checkout math belongs to
// Checkout (a later stage) — this page covers what Stage 14 asks for: a
// working cart the Product page's "Add to Cart" actually lands in.

import { Link, useLocation } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, Info } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useLanguage } from '../hooks/useLanguage'
import { formatKWD } from '../utils/formatPrice'

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart()
  const { t } = useLanguage()
  // Stage 17 — optional one-time notice from MyOrderDetailPage's "إعادة
  // الطلب" when only some items from the original order could be re-added.
  const notice = useLocation().state?.notice

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
          <ShoppingBag size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mt-6">{t('cart.empty')}</h1>
        <p className="text-sm text-gray-500 mt-2">{t('cart.emptyHint')}</p>
        <Link
          to="/"
          className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {t('cart.browseProducts')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('cart.title')}</h1>

      {notice && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-6">
          <Info size={16} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.key} className="flex gap-4 rounded-2xl border border-gray-100 p-4">
              <Link
                to={`/product/${item.productSlug}`}
                className="w-20 h-24 rounded-xl overflow-hidden bg-gray-50 shrink-0"
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  to={`/product/${item.productSlug}`}
                  className="text-sm font-medium text-gray-900 hover:text-brand-gold transition-colors"
                >
                  {item.name}
                </Link>

                {(item.colorName || item.sizeName) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {[item.colorName, item.sizeName].filter(Boolean).join(' / ')}
                  </p>
                )}

                <p className="text-sm font-bold text-gray-900 mt-2">{formatKWD(item.unitPrice)}</p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="p-2 text-gray-600 hover:text-brand-gold disabled:opacity-30 transition-colors"
                      aria-label={t('cart.decreaseQty')}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      disabled={item.maxStock != null && item.quantity >= item.maxStock}
                      className="p-2 text-gray-600 hover:text-brand-gold disabled:opacity-30 transition-colors"
                      aria-label={t('cart.increaseQty')}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.key)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={t('cart.removeFromCart')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-gray-100 p-5 h-fit">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{t('cart.subtotal')}</span>
            <span className="font-bold text-gray-900">{formatKWD(subtotal)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{t('cart.shippingNote')}</p>
          <Link
            to="/checkout"
            className="block text-center mt-5 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('cart.checkout')}
          </Link>
        </div>
      </div>
    </div>
  )
}