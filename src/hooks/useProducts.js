// Data-fetching hook for the customer Product detail page: resolves a
// single active product by slug, including images, colors, sizes, and
// variants (reusing the existing Stage 8 structure via productService).

import { useEffect, useState } from 'react'
import { getProductBySlug } from '../services/productService'

export function useProductPage(slug) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(false)
    setNotFound(false)

    getProductBySlug(slug)
      .then((p) => {
        if (!isMounted) return
        if (!p) {
          setNotFound(true)
          return
        }
        setProduct(p)
      })
      .catch((err) => {
        console.error('Failed to load product:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [slug])

  return { product, loading, error, notFound }
}