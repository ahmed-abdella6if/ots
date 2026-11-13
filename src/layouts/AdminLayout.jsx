// Admin portal layout: AdminSidebar + AdminNavbar + <Outlet />, RTL wrapper

import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AdminSidebar from '../admin/components/AdminSidebar'
import AdminNavbar from '../admin/components/AdminNavbar'
import { registerAlertsWorker, listenForOrderSound, unlockAudio } from '../admin/utils/orderAlerts'

export default function AdminLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false)

  // Make the admin portal installable as its own app/shortcut and ready to
  // receive new-order alerts. The manifest is attached only while the admin
  // portal is open, so customers adding the store to their home screen are
  // unaffected (and never get the service worker).
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = '/admin-manifest.webmanifest'
    document.head.appendChild(link)

    registerAlertsWorker()
    const stopListening = listenForOrderSound()

    // Browsers only allow sound after a user gesture — the first tap anywhere
    // in the admin portal unlocks the cha-ching for the rest of the session.
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })

    return () => {
      link.remove()
      stopListening()
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

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
