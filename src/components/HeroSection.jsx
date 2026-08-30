// Small elegant hero section. Content comes from homepage_content (admin-editable
// in a future stage); since no admin UI has populated it yet, every field falls
// back to a sensible default derived from store_settings.brand_name so the
// section always renders something real instead of a blank/broken hero.

import { Link } from 'react-router-dom'

export default function HeroSection({ homepageContent, storeSettings, fallbackCategorySlug }) {
  const brandName = storeSettings?.brandName || 'المتجر'

  const title = homepageContent?.heroTitle || brandName
  const message =
    homepageContent?.heroMessage || 'ملابس داخلية عصرية بجودة عالية وتصميم يليق بك'
  const ctaText = homepageContent?.heroCtaText || 'تسوق الان'
  const ctaLink =
    homepageContent?.heroCtaLink || (fallbackCategorySlug ? `/category/${fallbackCategorySlug}` : '/')
  const imageUrl = homepageContent?.heroImageUrl || storeSettings?.logoUrl

  return (
    <section className="bg-brand-light">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 flex flex-col sm:flex-row items-center gap-8">
        <div className="flex-1 text-center sm:text-right">
          <h1 className="text-2xl sm:text-3xl font-bold text-brand">{title}</h1>
          <p className="text-gray-600 mt-3 max-w-md mx-auto sm:mx-0">{message}</p>
          <Link
            to={ctaLink}
            className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {ctaText}
          </Link>
        </div>

        {imageUrl && (
  <div className="flex-1 w-full max-w-xl">
    <img
      src={imageUrl}
      alt={brandName}
      className="w-full rounded-2xl object-cover aspect-[16/9]"
    />
  </div>
)}
      </div>
    </section>
  )
}