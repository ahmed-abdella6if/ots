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

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'

export const CartContext = createContext(undefined)

const STORAGE_KEY = 'cart_items'

function readStoredCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function itemKey({ productId, variantId }) {
  return variantId ? `${productId}:${variantId}` : productId
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // Storage can fail (private browsing, quota) — the cart still works
      // for the current session in memory, it just won't persist a reload.
    }
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