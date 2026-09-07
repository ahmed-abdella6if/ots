// React Router doesn't reset scroll position on navigation the way a
// full page load does — without this, clicking from e.g. a long product
// list into a product page (or category to category) lands the new page
// wherever the previous page happened to be scrolled to. Renders nothing;
// just resets the window scroll on every route change.
//
// Skips when the new URL carries a hash — HomePage's own effect already
// scrolls to `#shop-categories` in that case (see HomePage.jsx), and
// jumping to the top first would only fight that.

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
