// Admin — Homepage Management: hero content, featured products (ordered),
// best sellers toggle, promotional banners — everything the existing schema
// actually supports (homepage_content single row + products.is_bestseller).
//
// NOT supported by the current schema (reported, not invented):
//   - "Featured categories" as a distinct curated list: categories has no
//     is_featured/homepage flag. The customer homepage already shows all
//     active top-level categories ordered by categories.sort_order, and
//     that is already fully editable on the existing /admin/categories page
//     (Stage 7) — so this page links there instead of duplicating it.
//   - "Enable/disable homepage sections": no boolean flags exist for this
//     (e.g. show_hero, show_bestsellers). Not implemented — would require
//     new columns, which this stage does not add without approval.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutTemplate,
  Star,
  Megaphone,
  ImagePlus,
  Upload,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderTree,
} from 'lucide-react'
import { getHomepageContent, updateHomepageContent } from '../../services/settingsService'
import { getProducts, toggleProductBestseller } from '../../services/productService'
import {
  uploadSiteAsset,
  deleteSiteAssetFile,
  getSiteAssetPathFromPublicUrl,
} from '../../services/storageService'
import { formatKWD } from '../../utils/formatPrice'

function Banner({ type, children }) {
  const styles = type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle
  return (
    <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 ${styles}`}>
      <Icon size={16} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-brand-gold" />
        <h3 className="font-bold text-gray-900">{title}</h3>
      </div>
      {description && <p className="text-sm text-gray-500 -mt-2">{description}</p>}
      {children}
    </div>
  )
}

export default function HomepageManagement() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [products, setProducts] = useState([]) // all admin products, reused for both featured picker + bestseller list
  const [productsById, setProductsById] = useState(new Map())

  // Hero fields
  const [heroTitle, setHeroTitle] = useState('')
  const [heroMessage, setHeroMessage] = useState('')
  const [heroCtaText, setHeroCtaText] = useState('')
  const [heroCtaLink, setHeroCtaLink] = useState('')
  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [heroImageUploading, setHeroImageUploading] = useState(false)

  // Featured products (ordered ids)
  const [featuredIds, setFeaturedIds] = useState([])
  const [featuredSearch, setFeaturedSearch] = useState('')

  // Banners
  const [banners, setBanners] = useState([]) // [{ image_url, link, title }]
  const [bannerUploadingIndex, setBannerUploadingIndex] = useState(null)

  // Best sellers toggle
  const [bestsellerSearch, setBestsellerSearch] = useState('')
  const [togglingBestsellerIds, setTogglingBestsellerIds] = useState(new Set())

  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    Promise.all([getHomepageContent(), getProducts()])
      .then(([content, adminProducts]) => {
        if (!isMounted) return

        setHeroTitle(content?.heroTitle || '')
        setHeroMessage(content?.heroMessage || '')
        setHeroCtaText(content?.heroCtaText || '')
        setHeroCtaLink(content?.heroCtaLink || '')
        setHeroImageUrl(content?.heroImageUrl || '')
        setFeaturedIds(content?.featuredProductIds || [])
        setBanners(content?.banners || [])

        setProducts(adminProducts)
        setProductsById(new Map(adminProducts.map((p) => [p.id, p])))
      })
      .catch((err) => {
        console.error('Failed to load homepage management data:', err.message)
        if (isMounted) setLoadError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    if (!errorMessage) return
    const timer = setTimeout(() => setErrorMessage(''), 4500)
    return () => clearTimeout(timer)
  }, [errorMessage])

  // ---------------------------------------------------------------------
  // Hero image upload
  // ---------------------------------------------------------------------
  async function handleHeroImageSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setHeroImageUploading(true)
    try {
      const previousPath = getSiteAssetPathFromPublicUrl(heroImageUrl)
      const { publicUrl } = await uploadSiteAsset('hero', file)
      setHeroImageUrl(publicUrl)
      if (previousPath) {
        deleteSiteAssetFile(previousPath).catch((err) =>
          console.error('Failed to remove previous hero image:', err.message)
        )
      }
    } catch (err) {
      console.error('Failed to upload hero image:', err.message)
      setErrorMessage('تعذر رفع صورة الهيرو')
    } finally {
      setHeroImageUploading(false)
    }
  }

  function handleRemoveHeroImage() {
    const previousPath = getSiteAssetPathFromPublicUrl(heroImageUrl)
    setHeroImageUrl('')
    if (previousPath) {
      deleteSiteAssetFile(previousPath).catch((err) =>
        console.error('Failed to remove hero image file:', err.message)
      )
    }
  }

  // ---------------------------------------------------------------------
  // Featured products
  // ---------------------------------------------------------------------
  const featuredProducts = featuredIds.map((id) => productsById.get(id)).filter(Boolean)

  const featuredCandidates = useMemo(() => {
    const query = featuredSearch.trim().toLowerCase()
    return products
      .filter((p) => p.isActive && !featuredIds.includes(p.id))
      .filter((p) => !query || p.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [products, featuredIds, featuredSearch])

  function handleAddFeatured(productId) {
    setFeaturedIds((prev) => [...prev, productId])
  }

  function handleRemoveFeatured(productId) {
    setFeaturedIds((prev) => prev.filter((id) => id !== productId))
  }

  function handleMoveFeatured(index, direction) {
    setFeaturedIds((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  // ---------------------------------------------------------------------
  // Banners
  // ---------------------------------------------------------------------
  function handleAddBanner() {
    setBanners((prev) => [...prev, { image_url: '', link: '', title: '' }])
  }

  function handleBannerFieldChange(index, field, value) {
    setBanners((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)))
  }

  async function handleBannerImageSelect(index, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setBannerUploadingIndex(index)
    try {
      const previousPath = getSiteAssetPathFromPublicUrl(banners[index]?.image_url)
      const { publicUrl } = await uploadSiteAsset('banners', file)
      handleBannerFieldChange(index, 'image_url', publicUrl)
      if (previousPath) {
        deleteSiteAssetFile(previousPath).catch((err) =>
          console.error('Failed to remove previous banner image:', err.message)
        )
      }
    } catch (err) {
      console.error('Failed to upload banner image:', err.message)
      setErrorMessage('تعذر رفع صورة البانر')
    } finally {
      setBannerUploadingIndex(null)
    }
  }

  function handleRemoveBanner(index) {
    const previousPath = getSiteAssetPathFromPublicUrl(banners[index]?.image_url)
    setBanners((prev) => prev.filter((_, i) => i !== index))
    if (previousPath) {
      deleteSiteAssetFile(previousPath).catch((err) =>
        console.error('Failed to remove banner image file:', err.message)
      )
    }
  }

  // ---------------------------------------------------------------------
  // Best sellers (saved instantly per toggle, like Categories' active toggle)
  // ---------------------------------------------------------------------
  const bestsellerCandidates = useMemo(() => {
    const query = bestsellerSearch.trim().toLowerCase()
    return products
      .filter((p) => p.isActive)
      .filter((p) => !query || p.name.toLowerCase().includes(query))
      .slice(0, 12)
  }, [products, bestsellerSearch])

  async function handleToggleBestseller(product) {
    setTogglingBestsellerIds((prev) => new Set(prev).add(product.id))
    try {
      const updated = await toggleProductBestseller(product.id, !product.isBestseller)
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isBestseller: updated.isBestseller } : p))
      )
      setProductsById((prev) => {
        const next = new Map(prev)
        const existing = next.get(product.id)
        if (existing) next.set(product.id, { ...existing, isBestseller: updated.isBestseller })
        return next
      })
    } catch (err) {
      console.error('Failed to toggle bestseller status:', err.message)
      setErrorMessage('تعذر تحديث حالة الاكثر مبيعا')
    } finally {
      setTogglingBestsellerIds((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  // ---------------------------------------------------------------------
  // Save hero + featured products + banners (single homepage_content row)
  // ---------------------------------------------------------------------
  async function handleSave() {
    setSaving(true)
    setErrorMessage('')
    try {
      await updateHomepageContent({
        heroTitle,
        heroMessage,
        heroCtaText,
        heroCtaLink,
        heroImageUrl,
        featuredProductIds: featuredIds,
        banners: banners.filter((b) => b.image_url || b.title || b.link),
      })
      setSuccessMessage('تم حفظ محتوى الصفحة الرئيسية بنجاح')
    } catch (err) {
      console.error('Failed to save homepage content:', err.message)
      setErrorMessage('حدث خطا اثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ادارة الصفحة الرئيسية</h2>
          <p className="text-sm text-gray-500 mt-1">
            التحكم في محتوى الهيرو والمنتجات المميزة والبانرات التي تظهر للعملاء
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || loadError}
          className="flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>...جاري الحفظ</span>
            </>
          ) : (
            <span>حفظ التغييرات</span>
          )}
        </button>
      </div>

      {successMessage && <Banner type="success">{successMessage}</Banner>}
      {errorMessage && <Banner type="error">{errorMessage}</Banner>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-500 py-10 text-center">حدث خطا اثناء تحميل بيانات الصفحة الرئيسية</p>
      ) : (
        <>
          {/* الهيرو */}
          <SectionCard icon={LayoutTemplate} title="قسم الهيرو">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">العنوان</label>
                <input
                  type="text"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="اسم البراند (افتراضي اذا ترك فارغا)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نص الزر (CTA)</label>
                <input
                  type="text"
                  value={heroCtaText}
                  onChange={(e) => setHeroCtaText(e.target.value)}
                  placeholder="تسوق الان"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">الوصف</label>
              <textarea
                value={heroMessage}
                onChange={(e) => setHeroMessage(e.target.value)}
                rows={3}
                placeholder="رسالة قصيرة تظهر اسفل العنوان"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                رابط الزر (مثال: /category/nisai)
              </label>
              <input
                type="text"
                value={heroCtaLink}
                onChange={(e) => setHeroCtaLink(e.target.value)}
                placeholder="/category/nisai"
                dir="ltr"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">صورة الهيرو</label>
              {heroImageUrl ? (
                <div className="flex items-center gap-3">
                  <img src={heroImageUrl} alt="" className="w-24 h-24 rounded-xl object-cover border border-gray-100" />
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer">
                      <Upload size={13} />
                      <span>{heroImageUploading ? '...جاري الرفع' : 'استبدال الصورة'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleHeroImageSelect} disabled={heroImageUploading} />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveHeroImage}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600"
                    >
                      <X size={13} />
                      <span>ازالة الصورة</span>
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl h-24 w-full cursor-pointer text-sm text-gray-400 hover:border-brand-gold/50 transition-colors">
                  {heroImageUploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <ImagePlus size={18} />
                      <span>رفع صورة</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleHeroImageSelect} disabled={heroImageUploading} />
                </label>
              )}
            </div>
          </SectionCard>

          {/* التصنيفات المميزة */}
          <SectionCard
            icon={FolderTree}
            title="التصنيفات المعروضة في الرئيسية"
            description="تظهر الصفحة الرئيسية تلقائيا كل التصنيفات الرئيسية النشطة، مرتبة حسب ترتيبها. لتعديل الترتيب او تفعيل/تعطيل تصنيف، استخدم صفحة التصنيفات."
          >
            <Link
              to="/admin/categories"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-gold hover:opacity-80 transition-opacity"
            >
              الذهاب الى ادارة التصنيفات
            </Link>
          </SectionCard>

          {/* المنتجات المميزة */}
          <SectionCard
            icon={Star}
            title="المنتجات المميزة"
            description="اختر المنتجات التي تظهر في قسم المنتجات المميزة بالصفحة الرئيسية، وحدد ترتيبها"
          >
            {featuredProducts.length === 0 ? (
              <p className="text-sm text-gray-400">لم يتم اختيار منتجات مميزة بعد</p>
            ) : (
              <ul className="space-y-2">
                {featuredProducts.map((product, index) => (
                  <li
                    key={product.id}
                    className="flex items-center gap-3 border border-gray-100 rounded-xl p-2.5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                      <p className="text-xs text-gray-400">{formatKWD(product.basePrice)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveFeatured(index, -1)}
                        disabled={index === 0}
                        title="نقل لاعلى"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveFeatured(index, 1)}
                        disabled={index === featuredProducts.length - 1}
                        title="نقل لاسفل"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeatured(product.id)}
                        title="ازالة"
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="pt-2 border-t border-gray-50 space-y-2">
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={featuredSearch}
                  onChange={(e) => setFeaturedSearch(e.target.value)}
                  placeholder="بحث لاضافة منتج مميز"
                  className="w-full rounded-xl border border-gray-200 pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                />
              </div>
              {featuredCandidates.length > 0 && (
                <ul className="space-y-1.5">
                  {featuredCandidates.map((product) => (
                    <li key={product.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700 flex-1 truncate">{product.name}</span>
                      <button
                        type="button"
                        onClick={() => handleAddFeatured(product.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold hover:opacity-80"
                      >
                        <Plus size={13} />
                        <span>اضافة</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>

          {/* الاكثر مبيعا */}
          <SectionCard
            icon={Star}
            title="المنتجات الاكثر مبيعا"
            description="يتم حفظ هذا التبديل فورا لكل منتج"
          >
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={bestsellerSearch}
                onChange={(e) => setBestsellerSearch(e.target.value)}
                placeholder="بحث عن منتج"
                className="w-full rounded-xl border border-gray-200 pr-9 pl-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
              />
            </div>

            {bestsellerCandidates.length === 0 ? (
              <p className="text-sm text-gray-400">لا توجد منتجات مطابقة</p>
            ) : (
              <ul className="space-y-1.5">
                {bestsellerCandidates.map((product) => {
                  const isToggling = togglingBestsellerIds.has(product.id)
                  return (
                    <li key={product.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700 flex-1 truncate">{product.name}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleBestseller(product)}
                        disabled={isToggling}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${
                          product.isBestseller ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isToggling ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} />}
                        <span>{product.isBestseller ? 'مميز' : 'اضافة'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          {/* البانرات */}
          <SectionCard icon={Megaphone} title="البانرات والعروض">
            {banners.length === 0 ? (
              <p className="text-sm text-gray-400">لا توجد بانرات مضافة بعد</p>
            ) : (
              <ul className="space-y-3">
                {banners.map((banner, index) => (
                  <li key={index} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {banner.image_url ? (
                          <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                        ) : bannerUploadingIndex === index ? (
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : (
                          <ImagePlus size={16} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={banner.title}
                          onChange={(e) => handleBannerFieldChange(index, 'title', e.target.value)}
                          placeholder="عنوان البانر"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                        />
                        <input
                          type="text"
                          value={banner.link}
                          onChange={(e) => handleBannerFieldChange(index, 'link', e.target.value)}
                          placeholder="/category/nisai"
                          dir="ltr"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBanner(index)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer">
                      <Upload size={12} />
                      <span>{banner.image_url ? 'استبدال الصورة' : 'رفع صورة'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleBannerImageSelect(index, e)}
                        disabled={bannerUploadingIndex === index}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={handleAddBanner}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-gold hover:opacity-80 transition-opacity"
            >
              <Plus size={15} />
              <span>اضافة بانر</span>
            </button>
          </SectionCard>
        </>
      )}
    </div>
  )
}