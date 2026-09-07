// Large category card for the homepage's featured-categories section.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ImageOff } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { getLocalizedName } from '../utils/localizedName'

export default function CategoryCard({ category }) {
  const { t, dir, language } = useLanguage()
  const { slug, description, imageUrl } = category
  const name = getLocalizedName(category, language)
  // STAGE 30 — a broken/unreachable admin-uploaded image falls back to the
  // same ImageOff placeholder as "no image set", instead of a broken <img>.
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Link
      to={`/category/${slug}`}
      className="group relative block overflow-hidden aspect-[2/3] bg-gray-100"
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff size={28} className="text-gray-300" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="text-lg font-bold">{name}</h3>
        {description && <p className="text-sm text-white/80 mt-1 line-clamp-2">{description}</p>}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium mt-3 text-white border border-white/50 bg-white/10 backdrop-blur-sm px-3.5 py-1.5 group-hover:bg-white/20 group-hover:border-white transition-colors">
          {t('category.shopNow')}
          <ArrowLeft size={14} className={dir === 'ltr' ? 'rotate-180' : ''} />
        </span>
      </div>
    </Link>
  )
}