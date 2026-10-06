// Fires a Meta Pixel PageView on every in-app route change. The snippet in
// index.html already sent the PageView for the first load, so the first
// render here is skipped to avoid counting it twice. Admin routes are not
// tracked. Renders nothing.

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageView } from '../utils/metaPixel'

export default function PixelRouteTracker() {
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (pathname.startsWith('/admin')) return
    trackPageView()
  }, [pathname])

  return null
}
