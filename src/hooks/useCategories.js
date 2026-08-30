// Data-fetching hook for the customer Category page: resolves a category by
// slug (with its active subcategories) and that category's active products.

import { useEffect, useState } from 'react'
import { getCategoryBySlug } from '../services/categoryService'
import { getProductsByCategoryId } from '../services/productService'

export function useCategoryPage(slug) {
  const [category, setCategory] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(false)
    setNotFound(false)

    getCategoryBySlug(slug)
      .then(async (cat) => {
        if (!isMounted) return
        if (!cat) {
          setNotFound(true)
          return
        }
        setCategory(cat)
        const prods = await getProductsByCategoryId(cat.id)
        if (!isMounted) return
        setProducts(prods)
      })
      .catch((err) => {
        console.error('Failed to load category:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [slug])

  return { category, products, loading, error, notFound }
}