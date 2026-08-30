// Responsive admin sidebar. Desktop: always visible fixed column.
// Mobile: slides in as an overlay, controlled by AdminLayout's open state.

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  Percent,
  LayoutTemplate,
  Settings,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/admin', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'المنتجات', icon: Package },
  { to: '/admin/categories', label: 'التصنيفات', icon: FolderTree },
  { to: '/admin/orders', label: 'الطلبات', icon: ShoppingCart },
  { to: '/admin/customers', label: 'العملاء', icon: Users },
  { to: '/admin/discounts', label: 'العروض والخصومات', icon: Percent },
  { to: '/admin/homepage', label: 'الصفحة الرئيسية', icon: LayoutTemplate },
  { to: '/admin/settings', label: 'الاعدادات', icon: Settings },
]

function SidebarContent({ onNavigate }) {
  return (
    <nav className="flex-1 overflow-y-auto py-4">
      <ul className="space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function AdminSidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-l border-gray-100 bg-white">
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <span className="font-bold text-lg text-brand">لوحة التحكم</span>
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="absolute top-0 right-0 h-full w-72 bg-white flex flex-col shadow-xl">
            <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
              <span className="font-bold text-lg text-brand">لوحة التحكم</span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="اغلاق القائمة"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}