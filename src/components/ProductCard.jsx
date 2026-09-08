import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { formatKWD } from '../utils/formatPrice'
import { useLanguage } from '../hooks/useLanguage'
import { getLocalizedName } from '../utils/localizedName'

export default function ProductCard({ product }) {
  const { t, dir, language } = useLanguage()
  // STAGE 30 — bestseller/discount badges are absolutely positioned
  // ("top-3 right-3" / "top-3 left-3"), a physical side that doesn't flip
  // with `dir`. Swap them explicitly so they don't collide in LTR.
  const bestsellerSideClass = dir === 'rtl' ? 'right-3' : 'left-3'
  const discountSideClass = dir === 'rtl' ? 'left-3' : 'right-3'
  const name = getLocalizedName(product, language)
  const {
    slug,
    basePrice,
    hasDiscount,
    discountPrice,
    imageUrl,
    isBestseller,
    colors,
  } = product

  return (
    <Link
      to={`/product/${slug}`}
      className="group block overflow-hidden bg-white"
    >
      {/* Product Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-contain p-1.5 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={28} className="text-gray-300" />
          </div>
        )}

        {/* Bestseller */}
        {isBestseller && (
          <span className={`absolute top-3 ${bestsellerSideClass} bg-brand text-white text-[11px] font-medium px-3 py-1.5 rounded-full`}>
            {t('home.bestSellers')}
          </span>
        )}

        {/* Discount */}
        {hasDiscount && (
          <span className={`absolute top-3 ${discountSideClass} bg-red-500 text-white text-[11px] font-medium px-3 py-1.5 rounded-full`}>
            {t('home.discountPrefix')}
          </span>
        )}
      </div>

      {/* Product Info */}
      <div className="pt-4 pb-2">
        <p className="text-sm font-medium text-gray-900 truncate">
          {name}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          {hasDiscount && discountPrice != null ? (
            <>
              <span className="text-sm font-bold text-red-500">
                {formatKWD(discountPrice, language)}
              </span>

              <span className="text-xs text-gray-400 line-through">
                {formatKWD(basePrice, language)}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-red-500">
              {formatKWD(basePrice, language)}
            </span>
          )}
        </div>

        {colors && colors.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {colors.slice(0, 5).map((color) => (
              <span
                key={color.id}
                title={color.name}
                className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: color.hexCode || '#e5e5e5' }}
              />
            ))}
            {colors.length > 5 && (
              <span className="text-[10px] text-gray-400 ms-0.5">+{colors.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}