import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { formatKWD } from '../utils/formatPrice'

export default function ProductCard({ product }) {
  const {
    name,
    slug,
    basePrice,
    hasDiscount,
    discountPrice,
    imageUrl,
    isBestseller,
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
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={28} className="text-gray-300" />
          </div>
        )}

        {/* Bestseller */}
        {isBestseller && (
          <span className="absolute top-3 right-3 bg-brand text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
            الاكثر مبيعا
          </span>
        )}

        {/* Discount */}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-red-500 text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
            خصم
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
                {formatKWD(discountPrice)}
              </span>

              <span className="text-xs text-gray-400 line-through">
                {formatKWD(basePrice)}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-gray-900">
              {formatKWD(basePrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}