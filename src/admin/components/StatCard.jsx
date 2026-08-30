// Reusable dashboard stat card: icon, label, value, optional loading/error state

export default function StatCard({ icon: Icon, label, value, loading, error, accent = 'brand' }) {
  const accentClasses = {
    brand: 'bg-brand/10 text-brand',
    gold: 'bg-brand-gold/15 text-brand-gold',
    danger: 'bg-red-100 text-red-600',
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${accentClasses[accent] || accentClasses.brand}`}>
        {Icon ? <Icon size={22} strokeWidth={2} /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500">{label}</p>

        {loading ? (
          <div className="h-6 w-24 mt-1 rounded bg-gray-100 animate-pulse" />
        ) : error ? (
          <p className="text-sm text-red-500 mt-1">تعذر تحميل البيانات</p>
        ) : (
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
        )}
      </div>
    </div>
  )
}
