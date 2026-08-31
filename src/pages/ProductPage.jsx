// Customer product detail page: color-aware image gallery, color/size
// selection, live availability resolved from the existing product_variants
// structure (Stage 8 — reused as-is, no new variant system), quantity, and
// Add to Cart wired to the shared CartContext.
//
// Variant resolution notes (see supabase/schema.sql, product_variants):
// a variant row always has BOTH a color_id and size_id (both NOT NULL), so
// stock is only ever tracked once a product has both colors AND sizes AND
// an admin has created that color+size combination as a variant. A product
// can still define colors and/or sizes with zero variants (e.g. a
// colors-only product, or sizes entered before stock was set up) — in that
// case color/size selection is informational only (still required before
// Add to Cart, so the cart line records what was picked) and no stock
// constraint is applied, since the schema has none to apply.

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ImageOff, Minus, Plus, Check, ChevronLeft } from 'lucide-react'
import NotFoundPage from './NotFoundPage'
import { useProductPage } from '../hooks/useProducts'
import { useCart } from '../hooks/useCart'
import { useLanguage } from '../hooks/useLanguage'
import { formatKWD } from '../utils/formatPrice'

const DEFAULT_MAX_QUANTITY = 10

function GallerySkeleton() {
  return <div className="aspect-[3/4] rounded-2xl bg-gray-100 animate-pulse" />
}

export default function ProductPage() {
  const { slug } = useParams()
  const { product, loading, error, notFound } = useProductPage(slug)
  const { addItem } = useCart()
  const { t, dir } = useLanguage()

  const [selectedColorId, setSelectedColorId] = useState(null)
  const [selectedSizeId, setSelectedSizeId] = useState(null)
  const [activeImageId, setActiveImageId] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  // NOTE: every hook below runs unconditionally on every render (Rules of
  // Hooks) — branching on loading/error/notFound only happens in the JSX
  // return further down, never before a hook call.

  const hasColors = product?.colors.length > 0
  const hasSizes = product?.sizes.length > 0
  const hasVariants = product?.variants.length > 0

  // Reset selection when the product itself changes (new slug navigated to),
  // and auto-pick when there's only a single color/size option.
  useEffect(() => {
    if (!product) return
    setSelectedColorId(product.colors.length === 1 ? product.colors[0].id : null)
    setSelectedSizeId(product.sizes.length === 1 ? product.sizes[0].id : null)
    setQuantity(1)
    setJustAdded(false)
  }, [product])

  const selectedVariant = useMemo(() => {
    if (!product || !hasVariants) return null
    return (
      product.variants.find(
        (v) =>
          (!hasColors || v.colorId === selectedColorId) &&
          (!hasSizes || v.sizeId === selectedSizeId)
      ) || null
    )
  }, [product, hasVariants, hasColors, hasSizes, selectedColorId, selectedSizeId])

  // A color is offered only if at least one variant of that color has
  // stock; sizes are scoped to whichever color is currently selected (or
  // across all colors if none is selected yet) so an out-of-stock or
  // nonexistent color/size combination is never selectable.
  const colorAvailable = useMemo(() => {
    if (!product || !hasVariants) return () => true
    const map = {}
    for (const c of product.colors) {
      map[c.id] = product.variants.some((v) => v.colorId === c.id && v.stockQuantity > 0)
    }
    return (id) => map[id] ?? true
  }, [product, hasVariants])

  const sizeAvailable = useMemo(() => {
    if (!product || !hasVariants) return () => true
    const map = {}
    for (const s of product.sizes) {
      map[s.id] = product.variants.some(
        (v) => v.sizeId === s.id && v.stockQuantity > 0 && (!selectedColorId || v.colorId === selectedColorId)
      )
    }
    return (id) => map[id] ?? true
  }, [product, hasVariants, selectedColorId])

  // Gallery: prefer images tagged with the selected color, fall back to
  // general (color_id null) images, then to whatever images exist at all.
  const displayImages = useMemo(() => {
    if (!product) return []
    if (selectedColorId) {
      const colorSpecific = product.images.filter((img) => img.colorId === selectedColorId)
      if (colorSpecific.length > 0) return colorSpecific
    }
    const general = product.images.filter((img) => img.colorId === null)
    return general.length > 0 ? general : product.images
  }, [product, selectedColorId])

  const primaryImage = displayImages.find((img) => img.isPrimary) || displayImages[0] || null

  useEffect(() => {
    setActiveImageId(primaryImage?.id ?? null)
  }, [primaryImage?.id])

  const activeImage = displayImages.find((img) => img.id === activeImageId) || primaryImage

  const maxQuantity = hasVariants && selectedVariant ? selectedVariant.stockQuantity : DEFAULT_MAX_QUANTITY

  useEffect(() => {
    setQuantity((q) => Math.max(1, Math.min(q, maxQuantity || 1)))
  }, [maxQuantity])

  if (notFound) return <NotFoundPage />

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-2 gap-10">
        <GallerySkeleton />
        <div className="space-y-4">
          <div className="h-7 w-2/3 rounded bg-gray-100 animate-pulse" />
          <div className="h-5 w-1/3 rounded bg-gray-100 animate-pulse" />
          <div className="h-24 w-full rounded bg-gray-100 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-sm text-red-500">{t('product.loadError')}</p>
      </div>
    )
  }

  const unitPrice =
    selectedVariant?.priceOverride ??
    (product.hasDiscount && product.discountPrice != null ? product.discountPrice : product.basePrice)

  const needsColor = hasColors
  const needsSize = hasSizes

  const isOutOfStock = hasVariants && selectedVariant != null && selectedVariant.stockQuantity <= 0
  const noMatchingVariant =
    hasVariants && needsColor && needsSize && selectedColorId && selectedSizeId && !selectedVariant

  const readyToAdd =
    (!needsColor || !!selectedColorId) &&
    (!needsSize || !!selectedSizeId) &&
    (!hasVariants || (!!selectedVariant && selectedVariant.stockQuantity > 0))

  function handleAddToCart() {
    if (!readyToAdd) return

    addItem(
      {
        productId: product.id,
        productSlug: product.slug,
        variantId: selectedVariant?.id || null,
        name: product.name,
        imageUrl: primaryImage?.imageUrl || null,
        unitPrice,
        colorId: selectedColorId,
        colorName: product.colors.find((c) => c.id === selectedColorId)?.name || null,
        sizeId: selectedSizeId,
        sizeName: product.sizes.find((s) => s.id === selectedSizeId)?.name || null,
        maxStock: hasVariants ? selectedVariant?.stockQuantity ?? null : null,
      },
      quantity
    )

    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {product.category && (
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
          <Link to="/" className="hover:text-brand-gold transition-colors">
            {t('nav.home')}
          </Link>
          <ChevronLeft size={12} />
          <Link to={`/category/${product.category.slug}`} className="hover:text-brand-gold transition-colors">
            {product.category.name}
          </Link>
          <ChevronLeft size={12} />
          <span className="text-gray-600">{product.name}</span>
        </nav>
      )}

      <div className="grid lg:grid-cols-2 gap-10">
        {/* معرض الصور */}
        <div>
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-50">
            {activeImage ? (
              <img src={activeImage.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageOff size={36} className="text-gray-300" />
              </div>
            )}
            {product.isBestseller && (
              <span className={`absolute top-3 ${dir === 'rtl' ? 'right-3' : 'left-3'} bg-brand text-white text-xs font-medium px-2.5 py-1 rounded-full`}>
                {t('home.bestSellers')}
              </span>
            )}
            {product.hasDiscount && (
              <span className={`absolute top-3 ${dir === 'rtl' ? 'left-3' : 'right-3'} bg-red-500 text-white text-xs font-medium px-2.5 py-1 rounded-full`}>
                {t('home.discountPrefix')}
              </span>
            )}
          </div>

          {displayImages.length > 1 && (
            <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
              {displayImages.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImageId(img.id)}
                  className={`w-16 h-20 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${
                    activeImage?.id === img.id ? 'border-brand-gold' : 'border-transparent'
                  }`}
                  aria-label={t('product.viewImage')}
                >
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>

          <div className="flex items-center gap-3 mt-3">
            {product.hasDiscount && product.discountPrice != null ? (
              <>
                <span className="text-xl font-bold text-red-500">{formatKWD(unitPrice)}</span>
                <span className="text-sm text-gray-400 line-through">{formatKWD(product.basePrice)}</span>
              </>
            ) : (
              <span className="text-xl font-bold text-gray-900">{formatKWD(unitPrice)}</span>
            )}
          </div>

          {product.description && (
            <p className="text-sm text-gray-600 mt-5 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          {product.material && (
            <p className="text-sm text-gray-500 mt-3">
              <span className="text-gray-400">{t('product.material')}: </span>
              {product.material}
            </p>
          )}

          {/* الألوان */}
          {hasColors && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-800 mb-2.5">{t('product.color')}</p>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((color) => {
                  const available = colorAvailable(color.id)
                  const selected = selectedColorId === color.id
                  return (
                    <button
                      key={color.id}
                      onClick={() => available && setSelectedColorId(color.id)}
                      disabled={!available}
                      title={color.name}
                      className={`relative w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selected ? 'border-brand-gold' : 'border-gray-200'
                      } ${!available ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className="w-6 h-6 rounded-full border border-black/10"
                        style={{ backgroundColor: color.hexCode || '#e5e5e5' }}
                      />
                      {selected && (
                        <Check
                          size={12}
                          className="absolute -bottom-1 -left-1 bg-brand-gold text-white rounded-full p-0.5"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* المقاسات */}
          {hasSizes && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-800 mb-2.5">{t('product.size')}</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => {
                  const available = sizeAvailable(size.id)
                  const selected = selectedSizeId === size.id
                  return (
                    <button
                      key={size.id}
                      onClick={() => available && setSelectedSizeId(size.id)}
                      disabled={!available}
                      className={`min-w-[2.75rem] px-3 py-2 rounded-lg text-sm border transition-colors ${
                        selected ? 'border-brand-gold bg-brand-light text-brand' : 'border-gray-200 text-gray-700'
                      } ${!available ? 'opacity-30 cursor-not-allowed line-through' : ''}`}
                    >
                      {size.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* حالة التوفر */}
          {hasVariants && selectedColorId && selectedSizeId && (
            <p className={`text-xs mt-4 ${isOutOfStock || noMatchingVariant ? 'text-red-500' : 'text-green-600'}`}>
              {isOutOfStock || noMatchingVariant
                ? t('product.outOfStock')
                : t('product.availableCount', { count: selectedVariant.stockQuantity })}
            </p>
          )}

          {/* الكمية */}
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-800 mb-2.5">{t('product.quantity')}</p>
            <div className="flex items-center border border-gray-200 rounded-lg w-fit">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="p-2.5 text-gray-600 hover:text-brand-gold disabled:opacity-30 transition-colors"
                aria-label={t('cart.decreaseQty')}
              >
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-sm">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(maxQuantity || DEFAULT_MAX_QUANTITY, q + 1))}
                disabled={quantity >= (maxQuantity || DEFAULT_MAX_QUANTITY)}
                className="p-2.5 text-gray-600 hover:text-brand-gold disabled:opacity-30 transition-colors"
                aria-label={t('cart.increaseQty')}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* اضافة الى السلة */}
          <button
            onClick={handleAddToCart}
            disabled={!readyToAdd}
            className="w-full mt-8 bg-brand text-white rounded-xl px-6 py-3.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {justAdded
              ? t('product.addedToCart')
              : isOutOfStock || noMatchingVariant
              ? t('product.outOfStock')
              : t('product.addToCart')}
          </button>
        </div>
      </div>
    </div>
  )
}