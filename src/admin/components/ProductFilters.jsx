// Search / category filter / sort controls for the Admin Products list.
// Purely presentational — filtering/sorting logic lives in Products.jsx.

import { Search } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'newest', label: 'الاحدث' },
  { value: 'oldest', label: 'الاقدم' },
  { value: 'price_asc', label: 'السعر من الاقل للاعلى' },
  { value: 'price_desc', label: 'السعر من الاعلى للاقل' },
  { value: 'name', label: 'الاسم' },
]

export default function ProductFilters({
  search,
  onSearchChange,
  categories,
  categoryId,
  onCategoryChange,
  sortBy,
  onSortChange,
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="بحث عن منتج"
          aria-label="بحث عن منتج"
          className="w-full rounded-xl border border-gray-200 pr-10 pl-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold"
        />
      </div>

      {categories.length > 0 && (
        <select
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          aria-label="التصنيف"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none bg-white transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold sm:w-48"
        >
          <option value="all">كل التصنيفات</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        aria-label="الترتيب"
        className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none bg-white transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold sm:w-56"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
