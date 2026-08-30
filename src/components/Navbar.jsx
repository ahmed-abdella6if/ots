// Main site navbar: brand logo/name, category navigation, cart icon, mobile menu.
// The cart icon now shows a live item-count badge — CartContext exists as of
// Stage 14 (see context/CartContext.jsx) and is the single source of truth
// for cart contents across the site.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Menu, X, User, LogOut } from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'

export default function Navbar({ storeSettings, categories }) {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false)
  const { totalItems } = useCart()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const brandName = storeSettings?.brandName || 'المتجر'

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
            الرئيسية
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="text-sm text-gray-700 hover:text-brand-gold transition-colors"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="الحساب"
            >
              <User size={20} />
            </button>
            {isAccountMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAccountMenuOpen(false)} />
                <div className="absolute left-0 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-40">
                  {user ? (
                    <>
                      <Link
                        to="/account"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        الحساب
                      </Link>
                      <Link
                        to="/account/orders"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        طلباتي
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-1.5 text-right px-4 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors"
                      >
                        <LogOut size={14} />
                        تسجيل الخروج
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      تسجيل الدخول
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
          <Link
            to="/cart"
            className="relative p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="السلة"
          >
            <ShoppingBag size={20} />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-brand-gold text-white text-[10px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label={isMenuOpen ? 'اغلاق القائمة' : 'فتح القائمة'}
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
            الرئيسية
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
            >
              {cat.name}
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
                  الحساب
                </Link>
                <Link
                  to="/account/orders"
                  onClick={() => setMenuOpen(false)}
                  className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
                >
                  طلباتي
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-right py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  تسجيل الخروج
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block py-2 text-sm text-gray-700 hover:text-brand-gold transition-colors"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}