// Admin portal layout: AdminSidebar + AdminNavbar + <Outlet />, RTL wrapper

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from '../admin/components/AdminSidebar'
import AdminNavbar from '../admin/components/AdminNavbar'

export default function AdminLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div dir="rtl" className="min-h-screen flex bg-gray-50">
      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminNavbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
