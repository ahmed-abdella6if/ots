// Admin — Customers list: registered accounts + guest checkouts, derived
// from profiles + orders (see customerService.js for why). Client-side
// search, consistent with the Products/Categories/Orders admin pages.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, Eye } from 'lucide-react'
import { getCustomers } from '../../services/customerService'
import { formatKWD } from '../../utils/formatPrice'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function AccountBadge({ isRegistered }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        isRegistered ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {isRegistered ? 'حساب مسجل' : 'طلب بدون تسجيل'}
    </span>
  )
}

function CustomerRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/4 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-1/6 rounded bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [search, setSearch] = useState('')

  useEffect(() => {
    let isMounted = true

    getCustomers()
      .then((data) => {
        if (isMounted) setCustomers(data)
      })
      .catch((err) => {
        console.error('Failed to load customers:', err.message)
        if (isMounted) setError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers
    const query = search.trim().toLowerCase()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.email && c.email.toLowerCase().includes(query)) ||
        (c.phone && c.phone.toLowerCase().includes(query))
    )
  }, [customers, search])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">العملاء</h2>
        <p className="text-sm text-gray-500 mt-1">استعراض عملاء المتجر وطلباتهم</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Count + search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <p className="text-sm text-gray-500">
            عدد العملاء: <span className="font-semibold text-gray-800">{customers.length}</span>
          </p>

          <div className="relative sm:w-72">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم او البريد او الهاتف"
              aria-label="بحث عن عميل"
              className="w-full rounded-xl border border-gray-200 pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
            />
          </div>
        </div>

        {/* Content states */}
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(5)].map((_, i) => (
              <CustomerRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-red-500 py-10 text-center">تعذر تحميل العملاء</p>
        ) : customers.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">لا يوجد عملاء حتى الان</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">لا توجد نتائج مطابقة لبحثك</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-right font-medium pb-3 pr-2">الاسم</th>
                    <th className="text-right font-medium pb-3">البريد الالكتروني</th>
                    <th className="text-right font-medium pb-3">رقم الهاتف</th>
                    <th className="text-right font-medium pb-3">عدد الطلبات</th>
                    <th className="text-right font-medium pb-3">اجمالي المبلغ المدفوع</th>
                    <th className="text-right font-medium pb-3">الحالة</th>
                    <th className="text-right font-medium pb-3">تاريخ التسجيل</th>
                    <th className="text-right font-medium pb-3">اجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-2 font-medium text-gray-800 whitespace-nowrap">{c.name}</td>
                      <td className="py-3 text-gray-600 whitespace-nowrap">{c.email || '—'}</td>
                      <td className="py-3 text-gray-600 whitespace-nowrap" dir="ltr">
                        {c.phone}
                      </td>
                      <td className="py-3 text-gray-600 whitespace-nowrap">{c.orderCount}</td>
                      <td className="py-3 text-gray-800 whitespace-nowrap">{formatKWD(c.totalSpent)}</td>
                      <td className="py-3">
                        <AccountBadge isRegistered={c.isRegistered} />
                      </td>
                      <td className="py-3 text-gray-500 whitespace-nowrap">{formatDate(c.registeredAt)}</td>
                      <td className="py-3 whitespace-nowrap">
                        <Link
                          to={`/admin/customers/${c.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <Eye size={14} />
                          <span>عرض التفاصيل</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {filteredCustomers.map((c) => (
                <Link
                  key={c.id}
                  to={`/admin/customers/${c.id}`}
                  className="block border border-gray-100 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <AccountBadge isRegistered={c.isRegistered} />
                  </div>
                  {c.email && <p className="text-xs text-gray-500 mt-1">{c.email}</p>}
                  <p className="text-xs text-gray-500" dir="ltr">
                    {c.phone}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                    <span>الطلبات: {c.orderCount}</span>
                    <span>{formatKWD(c.totalSpent)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(c.registeredAt)}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}