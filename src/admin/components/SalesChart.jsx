// Sales overview: last N days, orders count + sales amount.
// Implemented as a small hand-rolled SVG bar chart to avoid adding a new
// charting dependency for a single simple visualization.

import { formatKWD } from '../../utils/formatPrice'

function formatDayLabel(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

export default function SalesChart({ data, loading, error }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="h-5 w-40 rounded bg-gray-100 animate-pulse mb-6" />
        <div className="h-48 rounded bg-gray-50 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-2">نظرة عامة على المبيعات</h3>
        <p className="text-sm text-red-500">تعذر تحميل بيانات المبيعات، حاول مرة اخرى لاحقا</p>
      </div>
    )
  }

  const items = data || []
  const hasAnySales = items.some((d) => d.sales > 0 || d.orders > 0)
  const maxSales = Math.max(1, ...items.map((d) => d.sales))

  const chartHeight = 160
  const barWidth = 28
  const gap = 18
  const chartWidth = items.length * (barWidth + gap)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-900 mb-1">نظرة عامة على المبيعات</h3>
      <p className="text-sm text-gray-400 mb-4">اخر {items.length} ايام</p>

      {!hasAnySales ? (
        <p className="text-sm text-gray-400 py-10 text-center">لا توجد مبيعات في هذه الفترة بعد</p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
            width="100%"
            height={chartHeight + 40}
            className="min-w-[420px]"
          >
            {items.map((d, i) => {
              const barHeight = Math.max(2, (d.sales / maxSales) * chartHeight)
              const x = i * (barWidth + gap) + gap / 2
              const y = chartHeight - barHeight

              return (
                <g key={d.date}>
                  <title>
                    {formatDayLabel(d.date)} — {d.orders} طلب — {formatKWD(d.sales)}
                  </title>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={6}
                    className="fill-brand-gold"
                  />
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 18}
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-gray-500"
                  >
                    {formatDayLabel(d.date)}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 32}
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-gray-400"
                  >
                    {d.orders} طلب
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}
