// Product list display. Desktop: table. Mobile: stacked cards so the table
// doesn't break the layout on small screens.

import { Link } from 'react-router-dom'
import { ImageOff, Images, Layers, Pencil, Star, Loader2 } from 'lucide-react'
import { formatKWD } from '../../utils/formatPrice'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ProductImage({ url, name }) {
  return (
    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <ImageOff size={18} className="text-gray-300" />
      )}
    </div>
  )
}

function StatusBadge({ isActive }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {isActive ? 'نشط' : 'غير نشط'}
    </span>
  )
}

export default function ProductTable({ products, onToggleBestseller, togglingBestsellerIds }) {
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs border-b border-gray-100">
              <th className="text-right font-medium pb-3 pr-2">المنتج</th>
              <th className="text-right font-medium pb-3">التصنيف</th>
              <th className="text-right font-medium pb-3">السعر</th>
              <th className="text-right font-medium pb-3">حالة المنتج</th>
              <th className="text-right font-medium pb-3">الاكثر مبيعا</th>
              <th className="text-right font-medium pb-3">تاريخ الاضافة</th>
              <th className="text-right font-medium pb-3">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isTogglingBestseller = togglingBestsellerIds?.has(p.id)
              return (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-3">
                      <ProductImage url={p.imageUrl} name={p.name} />
                      <span className="font-medium text-gray-800">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 whitespace-nowrap">{p.categoryName}</td>
                  <td className="py-3 text-gray-800 whitespace-nowrap">{formatKWD(p.basePrice)}</td>
                  <td className="py-3">
                    <StatusBadge isActive={p.isActive} />
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => onToggleBestseller(p)}
                      disabled={isTogglingBestseller}
                      title={p.isBestseller ? 'ازالة من الاكثر مبيعا' : 'اضافة الى الاكثر مبيعا'}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                    >
                      {isTogglingBestseller ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Star size={16} className={p.isBestseller ? 'fill-brand-gold text-brand-gold' : ''} />
                      )}
                    </button>
                  </td>
                  <td className="py-3 text-gray-500 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                  <td className="py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/admin/products/${p.id}/edit`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Pencil size={14} />
                        <span>تعديل</span>
                      </Link>
                      <Link
                        to={`/admin/products/${p.id}/images`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-gold hover:opacity-80 transition-opacity"
                      >
                        <Images size={14} />
                        <span>ادارة الصور</span>
                      </Link>
                      <Link
                        to={`/admin/products/${p.id}/variants`}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        <Layers size={14} />
                        <span>المتغيرات</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {products.map((p) => {
          const isTogglingBestseller = togglingBestsellerIds?.has(p.id)
          return (
            <div key={p.id} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
              <ProductImage url={p.imageUrl} name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-gray-800 truncate">{p.name}</p>
                  <button
                    type="button"
                    onClick={() => onToggleBestseller(p)}
                    disabled={isTogglingBestseller}
                    title={p.isBestseller ? 'ازالة من الاكثر مبيعا' : 'اضافة الى الاكثر مبيعا'}
                    className="p-1 rounded-lg text-gray-400 disabled:opacity-40 transition-colors shrink-0"
                  >
                    {isTogglingBestseller ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Star size={15} className={p.isBestseller ? 'fill-brand-gold text-brand-gold' : ''} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400">{p.categoryName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-800">{formatKWD(p.basePrice)}</span>
                  <StatusBadge isActive={p.isActive} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{formatDate(p.createdAt)}</p>
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    to={`/admin/products/${p.id}/edit`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600"
                  >
                    <Pencil size={13} />
                    <span>تعديل</span>
                  </Link>
                  <Link
                    to={`/admin/products/${p.id}/images`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-gold"
                  >
                    <Images size={13} />
                    <span>ادارة الصور</span>
                  </Link>
                  <Link
                    to={`/admin/products/${p.id}/variants`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600"
                  >
                    <Layers size={13} />
                    <span>المتغيرات</span>
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}