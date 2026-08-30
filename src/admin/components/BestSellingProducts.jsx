// Read-only best-sellers list, ranked by quantity sold (from paid orders).

import { formatKWD } from '../../utils/formatPrice'

export default function BestSellingProducts({ products, loading, error }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-900 mb-4">الاكثر مبيعا</h3>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded bg-gray-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">تعذر تحميل المنتجات الاكثر مبيعا</p>
      ) : !products || products.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">لا توجد بيانات مبيعات حتى الان</p>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => (
            <li key={p.productId} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">تم بيع {p.quantitySold} قطعة</p>
              </div>

              <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                {formatKWD(p.totalSales)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
