// Category / subcategory listing page: header, subcategory chips (when the
// category has active children), active-products grid, loading/empty/error
// states. Mirrors HomePage's data-fetching + skeleton conventions.

import { Link, useParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import NotFoundPage from './NotFoundPage'
import { useCategoryPage } from '../hooks/useCategories'
import { useLanguage } from '../hooks/useLanguage'
import { getLocalizedName } from '../utils/localizedName'

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-gray-100">
          <div className="aspect-[3/4] bg-gray-100 animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-gray-100 animate-pulse" />
            <div className="h-3.5 w-1/3 rounded bg-gray-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CategoryPage() {
  const { slug } = useParams()
  const { category, products, loading, error, notFound } = useCategoryPage(slug)
  const { t, language } = useLanguage()

  // Invalid/deactivated category slug — same "not found" experience as a
  // bad route, rendered inline (no redirect) so the URL stays intact.
  if (notFound) return <NotFoundPage />

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {loading ? (
        <>
          <div className="h-7 w-40 rounded bg-gray-100 animate-pulse mb-8" />
          <ProductGridSkeleton />
        </>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-red-500">{t('category.loadError')}</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{getLocalizedName(category, language)}</h1>
            {category.description && (
              <p className="text-sm text-gray-500 mt-2 max-w-2xl">{category.description}</p>
            )}
          </div>

          {category.subcategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {category.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  to={`/category/${sub.slug}`}
                  className="px-4 py-2 rounded-full text-sm border border-gray-200 text-gray-700 hover:border-brand-gold hover:text-brand-gold transition-colors"
                >
                  {getLocalizedName(sub, language)}
                </Link>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400">{t('category.noProducts')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}