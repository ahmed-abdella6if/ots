// Customer site layout: Navbar + <Outlet /> + Footer, RTL wrapper.
//
// store_settings and the homepage categories are fetched once here (both are
// needed by Navbar and Footer on every customer page, and by HomePage for its
// hero/category sections) and passed down through <Outlet context> so child
// routes like HomePage don't re-fetch the same data — see useOutletContext()
// in HomePage.jsx.

import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getStoreSettings } from '../services/settingsService'
import { getHomepageCategories } from '../services/categoryService'

export default function MainLayout() {
  const [storeSettings, setStoreSettings] = useState(null)
  const [categories, setCategories] = useState([])

  useEffect(() => {
    let isMounted = true

    Promise.all([getStoreSettings(), getHomepageCategories()])
      .then(([settings, cats]) => {
        if (!isMounted) return
        setStoreSettings(settings)
        setCategories(cats)
      })
      .catch((err) => {
        // Non-fatal: Navbar/Footer render fine with defaults/empty state,
        // so a failure here shouldn't block the page from rendering.
        console.error('Failed to load site settings/categories:', err.message)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div dir="rtl" className="min-h-screen flex flex-col">
      <Navbar storeSettings={storeSettings} categories={categories} />
      <main className="flex-1">
        <Outlet context={{ storeSettings, categories }} />
      </main>
      <Footer storeSettings={storeSettings} categories={categories} />
    </div>
  )
}