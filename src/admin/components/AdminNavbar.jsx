// Admin top header: page title, admin user info, logout, mobile menu button.
// Uses the existing AuthContext — no separate auth logic here.

import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const PAGE_TITLES = {
  '/admin': 'الرئيسية',
  '/admin/products': 'المنتجات',
  '/admin/categories': 'التصنيفات',
  '/admin/orders': 'الطلبات',
  '/admin/customers': 'العملاء',
  '/admin/discounts': 'العروض والخصومات',
  '/admin/homepage': 'الصفحة الرئيسية',
  '/admin/settings': 'الاعدادات',
}

export default function AdminNavbar({ onMenuClick }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const title = PAGE_TITLES[location.pathname] || 'لوحة التحكم'

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error('Logout failed:', err.message)
    }
  }

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-4 lg:px-6 border-b border-gray-100 bg-white">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100"
          aria-label="فتح القائمة"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-bold text-gray-900 text-base lg:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
          <UserCircle size={20} className="text-gray-400" />
          <span className="truncate max-w-[160px]">
            {profile?.full_name || user?.email || 'المسؤول'}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">تسجيل الخروج</span>
        </button>
      </div>
    </header>
  )
}