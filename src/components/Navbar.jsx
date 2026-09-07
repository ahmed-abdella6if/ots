// Main site navbar: brand logo/name, category navigation, cart icon, mobile menu.
// The cart icon now shows a live item-count badge — CartContext exists as of
// Stage 14 (see context/CartContext.jsx) and is the single source of truth
// for cart contents across the site.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X, User, LogOut } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { getLocalizedName } from '../utils/localizedName'

// STAGE 30 — visible AR/EN language switcher, added to the existing Navbar
// (no redesign — placed among the existing icon buttons on both desktop and
// the mobile menu so it's reachable at every breakpoint).
function LanguageSwitcher({ compact = false }) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div
      className={`flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium ${compact ? 'w-fit' : ''}`}
      role="group"
      aria-label={t('nav.language')}
    >
      <button
        type="button"
        onClick={() => setLanguage('ar')}
        aria-pressed={language === 'ar'}
        className={`px-2.5 py-1.5 transition-colors ${
          language === 'ar' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        عربي
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`px-2.5 py-1.5 transition-colors ${
          language === 'en' ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        EN
      </button>
    </div>
  )
}

export default function Navbar({ storeSettings, categories }) {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false)
  const { totalItems } = useCart()
  const { user, signOut } = useAuth()
  const { t, dir, language } = useLanguage()
  const navigate = useNavigate()
  const brandName = storeSettings?.brandName || 'المتجر'
  // STAGE 30 — the account dropdown / cart badge use absolute positioning
  // ("left-0"), which is a *physical* side and doesn't flip automatically
  // with `dir` the way normal document flow does. Resolve the RTL-correct
  // side explicitly so the dropdown and badge land on the right side of
  // their anchor in both languages.
  const dropdownSideClass = dir === 'rtl' ? 'left-0' : 'right-0'
  const badgeSideClass = dir === 'rtl' ? '-left-0.5' : '-right-0.5'

  async function handleLogout() {
    setAccountMenuOpen(false)
    setMenuOpen(false)
    try {
      await signOut()
    } finally {
      navigate('/')
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg text-brand shrink-0">
          {storeSettings?.logoUrl ? (
            <img src={storeSettings.logoUrl} alt={brandName} className="h-9 w-auto" />
          ) : (
            brandName
          )}
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm text-gray-700 hover:text-brand-gold transition-colors">
            {t('nav.home')}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="text-sm text-gray-700 hover:text-brand-gold transition-colors"
            >
              {getLocalizedName(cat, language)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label={t('nav.account')}
            >
              <User size={20} />
            </button>
            {isAccountMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAccountMenuOpen(false)} />
                <div className={`absolute ${dropdownSideClass} mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-40`}>
                  {user ? (
                    <>
                      <Link
                        to="/account"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {t('nav.account')}
                      </Link>
                      <Link
                        to="/account/orders"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {t('nav.myOrders')}
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-1.5 text-right px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
                      >
                        <LogOut size={14} />
                        {t('nav.logout')}
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {t('nav.login')}
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
          <Link
            to="/cart"
            className="relative p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={t('nav.cart')}
          >
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <span className={`absolute -top-0.5 ${badgeSideClass} min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-brand-gold text-white text-[10px] font-bold flex items-center justify-center`}>
                {totalItems}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={isMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav className="md:hidden border-t border-gray-100 px-4 py-3 space-y-1">
          <Link
            to="/"
            onClick={() => setMenuOpen(false)}
            className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
          >
            {t('nav.home')}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
            >
              {getLocalizedName(cat, language)}
            </Link>
          ))}
          <div className="border-t border-gray-100 mt-2 pt-2">
            {user ? (
              <>
                <Link
                  to="/account"
                  onClick={() => setMenuOpen(false)}
                  className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
                >
                  {t('nav.account')}
                </Link>
                <Link
                  to="/account/orders"
                  onClick={() => setMenuOpen(false)}
                  className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
                >
                  {t('nav.myOrders')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-right py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
          <div className="border-t border-gray-100 mt-2 pt-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">{t('nav.language')}</span>
            <LanguageSwitcher compact />
          </div>
        </nav>
      )}
    </header>
  )
}