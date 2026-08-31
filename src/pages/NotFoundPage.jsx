// 404 page — also reused inline (not via redirect) for "category not found"
// and "product not found" states, i.e. an invalid or deactivated slug under
// /category/:slug or /product/:slug, since that's the same "there's
// nothing here" experience for a customer.

import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

export default function NotFoundPage() {
  const { t } = useLanguage()

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
        <SearchX size={28} />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mt-6">{t('error.notFoundTitle')}</h1>
      <p className="text-sm text-gray-500 mt-2">
        {t('error.notFoundMessage')}
      </p>
      <Link
        to="/"
        className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t('error.backHome')}
      </Link>
    </div>
  )
}
