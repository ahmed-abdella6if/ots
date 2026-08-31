// Cart context — client-side cart state (guest + logged-in customers alike),
// persisted to localStorage. Built in Stage 14 since the customer Product
// page needs somewhere real to send "Add to Cart" — no cart existed before
// this (CartPage/useCart/CartContext were empty TODO stubs, and main.jsx
// had a "wrap with CartProvider once cart state is built" note).
//
// The store has no server-side cart table (checkout builds `orders` /
// `order_items` directly — see supabase/functions/create-checkout-session),
// so a client-side cart is the correct architecture here, not a shortcut.
//
// Each cart line is keyed by product id + variant id (when the product has
// a resolved variant) so the same product in two different color/size
// combinations is two separate lines. Products without a variant are keyed
// by product id alone. Quantity is clamped to `maxStock` (the variant's
// live stock_quantity at add-time) when present.
//
// STAGE 30 FIX — cart isolation between authenticated users.
// Previously all of this was persisted under a single global localStorage
// key ('cart_items') shared by every visitor on the browser, regardless of
// who was signed in. So: Customer A logs in, adds items, logs out; Customer
// B logs in on the same browser and sees Customer A's cart. That's a data
// leak between accounts, not just a UX bug.
//
// Fix: each cart now lives under its own storage slot — one for guests
// (`cart_items:guest`) and one per authenticated user id
// (`cart_items:user:<uid>`). CartProvider tracks which slot `items`
// currently reflects (`activeKeyRef`) and, whenever AuthContext reports a
// different user (login, logout, or switching accounts), swaps to that
// user's own slot instead of carrying the previous state over. This is
// NOT a blind `clearCart()` on every auth change — a returning user still
// gets their own persisted cart back (Scenario C), a new user just gets an
// empty one (their slot has never been written), and a guest cart is left
// alone unless/until someone actually signs in on this browser.
//
// This only changes *where the cart is stored*. Final pricing, stock, and
// totals are still re-validated server-side at checkout
// (validateCartForCheckout() / createOrder()) — the client-side cart was
// never the source of truth for that, and still isn't.

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export const CartContext = createContext(undefined)

const STORAGE_PREFIX = 'cart_items'
const GUEST_KEY = `${STORAGE_PREFIX}:guest`

function cartKeyFor(userId) {
  return userId ? `${STORAGE_PREFIX}:user:${userId}` : GUEST_KEY
}

function readStoredCart(key) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStoredCart(key, items) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // Storage can fail (private browsing, quota) — the cart still works
    // for the current session in memory, it just won't persist a reload.
  }
}

function itemKey({ productId, variantId }) {
  return variantId ? `${productId}:${variantId}` : productId
}

export function CartProvider({ children }) {
  // CartProvider is mounted inside AuthProvider (see main.jsx), so this is
  // always available — it's what lets the cart know *whose* cart to load.
  const { user, loading: authLoading } = useAuth()

  // Optimistically start from the guest cart (the common case — most page
  // loads are either a guest or a session restore that resolves almost
  // immediately) so there's no empty-cart flash for guests. If a session
  // restores to a logged-in user, the effect below swaps to that user's
  // own cart as soon as auth settles.
  const [items, setItems] = useState(() => readStoredCart(GUEST_KEY))
  const activeKeyRef = useRef(GUEST_KEY)

  useEffect(() => {
    // Don't decide which cart to show until session restoration has
    // resolved — deciding early could briefly show/hide the wrong slot.
    if (authLoading) return

    const nextKey = cartKeyFor(user?.id ?? null)
    if (activeKeyRef.current === nextKey) return // same user (or still guest) — nothing to do

    activeKeyRef.current = nextKey
    setItems(readStoredCart(nextKey))
  }, [user?.id, authLoading])

  useEffect(() => {
    writeStoredCart(activeKeyRef.current, items)
  }, [items])

  /**
   * Adds `quantity` of an item to the cart. If the same product/variant
   * combination is already in the cart, the quantities are merged instead
   * of creating a duplicate line. `item.maxStock` (nullable) clamps the
   * resulting quantity when the product is stock-tracked via a variant.
   */
  const addItem = useCallback((item, quantity = 1) => {
    const key = itemKey(item)
    const maxStock = item.maxStock ?? null

    setItems((prev) => {
      const existing = prev.find((i) => i.key === key)

      if (existing) {
        const nextQty = maxStock != null
          ? Math.min(existing.quantity + quantity, maxStock)
          : existing.quantity + quantity
        return prev.map((i) => (i.key === key ? { ...i, quantity: nextQty } : i))
      }

      const initialQty = maxStock != null ? Math.min(quantity, maxStock) : quantity
      return [...prev, { ...item, key, quantity: Math.max(1, initialQty) }]
    })
  }, [])

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const updateQuantity = useCallback((key, quantity) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i
        const clamped = i.maxStock != null
          ? Math.min(Math.max(quantity, 1), i.maxStock)
          : Math.max(quantity, 1)
        return { ...i, quantity: clamped }
      })
    )
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), [items])

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }),
    [items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
