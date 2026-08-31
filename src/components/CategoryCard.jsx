// Large category card for the homepage's featured-categories section.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ImageOff } from 'lucide-react'

export default function CategoryCard({ category }) {
  const { name, slug, description, imageUrl } = category
  // STAGE 30 — a broken/unreachable admin-uploaded image falls back to the
  // same ImageOff placeholder as "no image set", instead of a broken <img>.
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <Link
      to={`/category/${slug}`}
      className="group relative block rounded-2xl overflow-hidden aspect-[4/5] bg-gray-100"
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt={name}
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        <span className="inline-flex items-center gap-1.5 text-sm font-medium mt-3 text-brand-gold">
          تسوق الان
          <ArrowLeft size={15} />
        </span>
      </div>
    </Link>
  )
}