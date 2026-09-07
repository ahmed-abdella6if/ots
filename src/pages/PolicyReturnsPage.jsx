// سياسة الاستبدال والاسترجاع — Returns policy page, content from
// store_settings.return_policy (returnPolicyEn for English, falling back to
// the Arabic text when no translation has been entered — same fallback
// pattern as product/category names, see getLocalizedName.js).

import { useEffect, useState } from 'react'
import { getStoreSettings } from '../services/settingsService'
import { useLanguage } from '../hooks/useLanguage'

export default function PolicyReturnsPage() {
  const { t, language } = useLanguage()
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true
    getStoreSettings()
      .then((data) => {
        if (isMounted) setContent((language === 'en' ? data?.returnPolicyEn : null) || data?.returnPolicy || '')
      })
      .catch((err) => {
        console.error('Failed to load return policy:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [language])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('footer.returnsPolicy')}</h1>
      {loading ? (
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-gray-100 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">{t('policy.loadError')}</p>
      ) : content ? (
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>
      ) : (
        <p className="text-gray-400">{t('policy.noContentYet')}</p>
      )}
    </div>
  )
}
