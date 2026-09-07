// Customer homepage: Hero, featured categories, best sellers, new arrivals,
// promotional codes, policies. storeSettings + categories come from
// MainLayout via Outlet context (already fetched once there); this page
// fetches only what's specific to it (hero content, active products,
// active promotions) in a single parallel batch.

import { useEffect, useState } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { Tag } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import HeroSection from '../components/HeroSection'
import CategoryCard from '../components/CategoryCard'
import ProductCard from '../components/ProductCard'
import PolicyLinks from '../components/PolicyLinks'
import { getHomepageContent } from '../services/settingsService'
import { getActiveProducts } from '../services/productService'
import { getActivePromotions } from '../services/discountService'
import { formatKWD } from '../utils/formatPrice'

const BEST_SELLERS_LIMIT = 8
const NEW_ARRIVALS_LIMIT = 8

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
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

function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="aspect-[4/5] rounded-2xl bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-xl font-bold text-gray-900 mb-5">{children}</h2>
}

export default function HomePage() {
  const { storeSettings, categories } = useOutletContext() ?? { storeSettings: null, categories: [] }
  const location = useLocation()
  const { t, language } = useLanguage()

  const [homepageContent, setHomepageContent] = useState(null)
  const [products, setProducts] = useState([])
  const [promotions, setPromotions] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // STAGE 30 — supports HeroSection's "تسوق الان" default (/#shop-categories):
  // React Router doesn't scroll to a hash target itself (that's native
  // full-page-load behavior only), so once the categories section exists in
  // the DOM, scroll to it manually if that's the hash we landed on.
  useEffect(() => {
    if (location.hash !== '#shop-categories') return
    if (loading) return
    const target = document.getElementById('shop-categories')
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, loading])

  useEffect(() => {
    let isMounted = true

    Promise.all([getHomepageContent(), getActiveProducts(), getActivePromotions()])
      .then(([content, activeProducts, activePromotions]) => {
        if (!isMounted) return
        setHomepageContent(content)
        setProducts(activeProducts)
        setPromotions(activePromotions)
      })
      .catch((err) => {
        console.error('Failed to load homepage data:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const bestSellers = products.filter((p) => p.isBestseller).slice(0, BEST_SELLERS_LIMIT)
  const newArrivals = [...products]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, NEW_ARRIVALS_LIMIT)

  // Admin-curated, ordered featured products (homepage_content.featured_product_ids).
  // Derived from the already-fetched active products list — no extra query needed.
  const featuredIds = homepageContent?.featuredProductIds || []
  const productsById = new Map(products.map((p) => [p.id, p]))
  const featuredProducts = featuredIds.map((id) => productsById.get(id)).filter(Boolean)

  const banners = homepageContent?.banners || []

  return (
    <div>
      <HeroSection homepageContent={homepageContent} storeSettings={storeSettings} />

      {/* البانرات */}
      {!loading && banners.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid sm:grid-cols-2 gap-4">
            {banners.map((banner, index) => (
              <Link
                key={index}
                to={banner.link || '/'}
                className="group relative block rounded-2xl overflow-hidden aspect-[16/7] bg-gray-100"
              >
                {banner.image_url && (
                  <img
                    src={banner.image_url}
                    alt={banner.title || ''}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                {banner.title && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-white font-bold">{banner.title}</p>
                    </div>
                  </>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* التصنيفات */}
      {(loading || categories.length > 0) && (
        <section id="shop-categories" className="max-w-6xl mx-auto px-4 py-10 scroll-mt-20">
          <SectionTitle>{t('home.shopByCategory')}</SectionTitle>
          {categories.length === 0 ? (
            <CategoryGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <CategoryCard key={cat.id} category={cat} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* المنتجات المميزة */}
      {!loading && featuredProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10">
          <SectionTitle>{t('home.featuredProducts')}</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* الاكثر مبيعا */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <SectionTitle>{t('home.bestSellers')}</SectionTitle>
        {loading ? (
          <ProductGridSkeleton />
        ) : error ? (
          <p className="text-sm text-red-500 py-6 text-center">{t('home.productsLoadError')}</p>
        ) : bestSellers.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">{t('home.noFeaturedProducts')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* وصل حديثا */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <SectionTitle>{t('home.newArrivals')}</SectionTitle>
        {loading ? (
          <ProductGridSkeleton />
        ) : error ? (
          <p className="text-sm text-red-500 py-6 text-center">{t('home.productsLoadError')}</p>
        ) : newArrivals.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">{t('home.noProducts')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* العروض */}
      {!loading && promotions.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-10">
          <SectionTitle>{t('home.currentOffers')}</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotions.map((promo) => (
              <div
                key={promo.code}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-brand-gold/60 bg-brand-light p-4"
              >
                <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-gold shrink-0">
                  <Tag size={18} />
                </span>
                <div>
                  <p className="font-bold text-brand" dir="ltr">
                    {promo.code}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {t('home.discountPrefix')} {promo.discountType === 'percentage' ? `${Number(promo.discountValue)}%` : formatKWD(promo.discountValue, language)}
                    {promo.minOrderAmount > 0 && <> {t('home.onOrdersOverSuffix', { amount: formatKWD(promo.minOrderAmount, language) })}</>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <PolicyLinks />
    </div>
  )
}