// Admin products list — read-only for this stage.
// Creation/editing/deletion/images/variants are separate later stages.

import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, PackageX, CheckCircle2, AlertTriangle } from 'lucide-react'
import ProductFilters from '../components/ProductFilters'
import ProductTable from '../components/ProductTable'
import { getProducts } from '../../services/productService'

function ProductRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-12 h-12 rounded-lg bg-gray-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/5 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

export default function Products() {
  const location = useLocation()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const [successMessage, setSuccessMessage] = useState(location.state?.successMessage || '')
  const [imageWarning, setImageWarning] = useState(location.state?.imageWarning || '')

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    let isMounted = true

    getProducts()
      .then((data) => {
        if (isMounted) setProducts(data)
      })
      .catch((err) => {
        console.error('Failed to load products:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Categories for the filter dropdown, derived from the loaded products
  // themselves (no extra query needed for this stage).
  const categories = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      if (p.categoryId && !map.has(p.categoryId)) {
        map.set(p.categoryId, { id: p.categoryId, name: p.categoryName })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [products])

  const filteredProducts = useMemo(() => {
    let result = products

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(query))
    }

    if (categoryId !== 'all') {
      result = result.filter((p) => p.categoryId === categoryId)
    }

    const sorted = [...result]
    switch (sortBy) {
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        break
      case 'price_asc':
        sorted.sort((a, b) => a.basePrice - b.basePrice)
        break
      case 'price_desc':
        sorted.sort((a, b) => b.basePrice - a.basePrice)
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
        break
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }

    return sorted
  }, [products, search, categoryId, sortBy])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">المنتجات</h2>
          <p className="text-sm text-gray-500 mt-1">
            استعراض وادارة منتجات المتجر
          </p>
        </div>

        <Link
          to="/admin/products/new"
          className="flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          <span>اضافة منتج</span>
        </Link>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {imageWarning && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{imageWarning}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Count + filters */}
        <div className="flex flex-col gap-4 mb-5">
          <p className="text-sm text-gray-500">
            عدد المنتجات: <span className="font-semibold text-gray-800">{products.length}</span>
          </p>

          <ProductFilters
            search={search}
            onSearchChange={setSearch}
            categories={categories}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>

        {/* Content states */}
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <ProductRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 py-10 text-center">
            حدث خطا اثناء تحميل المنتجات
          </p>
        ) : products.length === 0 ? (
          <div className="py-14 text-center">
            <PackageX size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">لا توجد منتجات حاليا</p>
            <Link
              to="/admin/products/new"
              className="inline-flex items-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              <span>اضافة اول منتج</span>
            </Link>
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">
            لا توجد نتائج مطابقة لبحثك
          </p>
        ) : (
          <ProductTable products={filteredProducts} />
        )}
      </div>
    </div>
  )
}