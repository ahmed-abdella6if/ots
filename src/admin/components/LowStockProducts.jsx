// Read-only low-stock preview. Inventory editing comes later in the Products stage.

import { LOW_STOCK_THRESHOLD } from '../../services/dashboardService'

export default function LowStockProducts({ variants, loading, error }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-900 mb-1">منتجات منخفضة المخزون</h3>
      <p className="text-sm text-gray-400 mb-4">الحد الادنى: {LOW_STOCK_THRESHOLD} قطع</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-gray-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500">تعذر تحميل بيانات المخزون</p>
      ) : !variants || variants.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">لا توجد منتجات منخفضة المخزون</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[420px]">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-100">
                <th className="text-right font-medium pb-2 pr-2">المنتج</th>
                <th className="text-right font-medium pb-2">اللون</th>
                <th className="text-right font-medium pb-2">المقاس</th>
                <th className="text-right font-medium pb-2">الكمية المتاحة</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-2 font-medium text-gray-800 whitespace-nowrap">
                    {v.productName}
                  </td>
                  <td className="py-3 text-gray-600 whitespace-nowrap">{v.colorName}</td>
                  <td className="py-3 text-gray-600 whitespace-nowrap">{v.sizeName}</td>
                  <td className="py-3 whitespace-nowrap">
                    <span
                      className={
                        v.stockQuantity <= 2
                          ? 'text-red-600 font-semibold'
                          : 'text-amber-600 font-semibold'
                      }
                    >
                      {v.stockQuantity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
