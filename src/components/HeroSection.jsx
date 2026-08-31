// Small elegant hero section. Content comes from homepage_content (admin-editable
// in a future stage); since no admin UI has populated it yet, every field falls
// back to a sensible default derived from store_settings.brand_name so the
// section always renders something real instead of a blank/broken hero.

import { Link } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'

// STAGE 30 FIX — the default CTA used to link to `/category/<categories[0].slug>`,
// i.e. whichever category happened to sort first (in practice: men's). That sent
// every visitor who hadn't set a custom homepage CTA straight into one category
// instead of the general category-selection experience. There's no separate
// "shop" route to link to (and Stage 30 says not to invent one), so the default
// now points at the homepage's own categories section (#shop-categories, see
// HomePage.jsx) — the existing general category-selection UI. An admin-configured
// heroCtaLink (HomepageManagement) still always wins and is untouched.
export const DEFAULT_CTA_LINK = '/#shop-categories'

export default function HeroSection({ homepageContent, storeSettings }) {
  const { t, dir } = useLanguage()
  const brandName = storeSettings?.brandName || 'المتجر'

  // heroTitle/heroMessage/heroCtaText are admin-entered business content
  // (homepage_content table) — stored data, not UI copy, so they are NOT
  // translated here (Stage 30 explicitly excludes rewriting stored business
  // data). Only the *fallback* shown when the admin hasn't set them uses the
  // i18n dictionary, since that fallback is genuinely UI copy.
  const title = homepageContent?.heroTitle || brandName
  const message = homepageContent?.heroMessage || t('home.heroDefaultMessage')
  const ctaText = homepageContent?.heroCtaText || t('home.shopNow')
  const ctaLink = homepageContent?.heroCtaLink || DEFAULT_CTA_LINK
  const imageUrl = homepageContent?.heroImageUrl || storeSettings?.logoUrl

  return (
    <section className="bg-brand-light">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 flex flex-col sm:flex-row items-center gap-8">
        <div className={`flex-1 text-center ${dir === 'rtl' ? 'sm:text-right' : 'sm:text-left'}`}>
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
