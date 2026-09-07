// Site-wide footer: brand info, category links, policy links, social links,
// copyright. Rendered from MainLayout on every customer page.
//
// Note: the original brief's footer also lists "خدمة العملاء" (customer
// service) with "من نحن" / "تواصل معنا" links — those pages (About/Contact)
// are still unimplemented placeholders with no route wired yet, outside this
// stage's scope (Homepage Management), so they're intentionally left out of
// the footer's links for now rather than pointing to a route that doesn't exist.

import { Link } from 'react-router-dom'
import { Instagram, Facebook, Linkedin, MessageCircle } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { getLocalizedName } from '../utils/localizedName'

const SOCIAL_ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
}

export default function Footer({ storeSettings, categories }) {
  const { t, language } = useLanguage()
  const brandName = storeSettings?.brandName || 'المتجر'
  const socialLinks = storeSettings?.socialLinks || {}
  const whatsappNumber = storeSettings?.whatsappNumber
  const year = new Date().getFullYear()

  const socialEntries = Object.entries(socialLinks).filter(([, url]) => url)

  return (
    <footer className="bg-brand text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-3 gap-8">
        
        {/* معلومات البراند */}
        <div>
          <h3 className="font-bold text-lg">{brandName}</h3>

          {storeSettings?.aboutUs && (
            <p className="text-sm text-white/70 mt-2 line-clamp-3">
              {storeSettings.aboutUs}
            </p>
          )}

          {(socialEntries.length > 0 || whatsappNumber) && (
            <div className="flex items-center gap-3 mt-4">
              {socialEntries.map(([key, url]) => {
                const Icon = SOCIAL_ICONS[key]

                if (!Icon) return null

                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                    aria-label={key}
                  >
                    <Icon size={16} />
                  </a>
                )
              })}

              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  aria-label="whatsapp"
                >
                  <MessageCircle size={16} />
                </a>
              )}
            </div>
          )}
        </div>

        {/* التصنيفات */}
        {categories.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm text-white/60 mb-3">
              {t('footer.categories')}
            </h4>

            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/category/${cat.slug}`}
                    className="text-sm text-white/85 hover:text-brand-gold transition-colors"
                  >
                    {getLocalizedName(cat, language)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* سياسات المتجر */}
        <div>
          <h4 className="font-semibold text-sm text-white/60 mb-3">
            {t('footer.storePolicies')}
          </h4>

          <ul className="space-y-2">
            <li>
              <Link
                to="/policies/payment"
                className="text-sm text-white/85 hover:text-brand-gold transition-colors"
              >
                {t('footer.paymentPolicy')}
              </Link>
            </li>

            <li>
              <Link
                to="/policies/shipping"
                className="text-sm text-white/85 hover:text-brand-gold transition-colors"
              >
                {t('footer.shippingPolicy')}
              </Link>
            </li>

            <li>
              <Link
                to="/policies/returns"
                className="text-sm text-white/85 hover:text-brand-gold transition-colors"
              >
                {t('footer.returnsPolicy')}
              </Link>
            </li>

            <li>
              <Link
                to="/policies/privacy"
                className="text-sm text-white/85 hover:text-brand-gold transition-colors"
              >
                {t('footer.privacyPolicy')}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <p className="text-center text-xs text-white/50">
          © {year} {brandName}. {t('footer.rightsReserved')}
        </p>
      </div>
    </footer>
  )
}
