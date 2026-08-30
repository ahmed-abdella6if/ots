// Admin — Discounts management: list, add, edit, activate/deactivate, delete.
// Fields shown are exactly what exists on the discounts table: code, type,
// value, min_order_amount, usage_limit/times_used, starts_at/ends_at,
// is_active. There is no max_discount_amount column in the existing schema,
// so it is intentionally not shown here.

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  TicketX,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Loader2,
  Search,
  X,
  Eye,
  EyeOff,
} from 'lucide-react'
import {
  getDiscounts,
  createDiscount,
  updateDiscount,
  toggleDiscountStatus,
  deleteDiscount,
} from '../../services/discountService'
import { formatKWD } from '../../utils/formatPrice'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Converts an ISO timestamp to a value usable in <input type="date">, and back.
function toDateInputValue(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toISOString().slice(0, 10)
}
function fromDateInputValue(dateStr, endOfDay) {
  if (!dateStr) return null
  return endOfDay ? `${dateStr}T23:59:59` : `${dateStr}T00:00:00`
}

function formatDiscountValue(discount) {
  return discount.discountType === 'percentage'
    ? `${Number(discount.discountValue)}%`
    : formatKWD(discount.discountValue)
}

function getValidityLabel(discount) {
  const now = new Date()
  const starts = discount.startsAt ? new Date(discount.startsAt) : null
  const ends = discount.endsAt ? new Date(discount.endsAt) : null

  if (ends && ends < now) return { text: 'منتهي', className: 'bg-gray-100 text-gray-500' }
  if (starts && starts > now) return { text: 'قادم', className: 'bg-indigo-50 text-indigo-600' }
  if (discount.usageLimit && discount.timesUsed >= discount.usageLimit) {
    return { text: 'استنفد الحد', className: 'bg-amber-50 text-amber-600' }
  }
  return { text: 'ساري', className: 'bg-green-50 text-green-600' }
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

function ValidityBadge({ discount }) {
  const { text, className } = getValidityLabel(discount)
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
      {text}
    </span>
  )
}

// -----------------------------------------------------------------------
// Add / Edit modal
// -----------------------------------------------------------------------
function DiscountModal({ discount, onClose, onSaved }) {
  const isEditMode = Boolean(discount)

  const [code, setCode] = useState(discount?.code || '')
  const [discountType, setDiscountType] = useState(discount?.discountType || 'percentage')
  const [discountValue, setDiscountValue] = useState(
    discount?.discountValue !== undefined && discount?.discountValue !== null
      ? String(discount.discountValue)
      : ''
  )
  const [minOrderAmount, setMinOrderAmount] = useState(
    discount?.minOrderAmount !== undefined && discount?.minOrderAmount !== null
      ? String(discount.minOrderAmount)
      : '0'
  )
  const [usageLimit, setUsageLimit] = useState(
    discount?.usageLimit !== undefined && discount?.usageLimit !== null ? String(discount.usageLimit) : ''
  )
  const [startsAt, setStartsAt] = useState(toDateInputValue(discount?.startsAt))
  const [endsAt, setEndsAt] = useState(toDateInputValue(discount?.endsAt))
  const [isActive, setIsActive] = useState(discount?.isActive ?? true)

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const errors = {}

    if (!code.trim()) {
      errors.code = 'كود الخصم مطلوب'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
      errors.code = 'الكود يجب ان يحتوي على حروف وارقام انجليزية فقط'
    }

    if (!discountValue.trim()) {
      errors.discountValue = 'قيمة الخصم مطلوبة'
    } else {
      const v = Number(discountValue)
      if (Number.isNaN(v) || v <= 0) {
        errors.discountValue = 'قيمة الخصم يجب ان تكون رقما اكبر من صفر'
      } else if (discountType === 'percentage' && v > 100) {
        errors.discountValue = 'نسبة الخصم لا يمكن ان تتجاوز 100%'
      }
    }

    if (minOrderAmount.trim() && (Number.isNaN(Number(minOrderAmount)) || Number(minOrderAmount) < 0)) {
      errors.minOrderAmount = 'الحد الادنى للطلب يجب ان يكون رقما صحيحا'
    }

    if (usageLimit.trim() && (Number.isNaN(Number(usageLimit)) || Number(usageLimit) <= 0)) {
      errors.usageLimit = 'حد الاستخدام يجب ان يكون رقما صحيحا اكبر من صفر'
    }

    if (startsAt && endsAt && startsAt >= endsAt) {
      errors.endsAt = 'تاريخ النهاية يجب ان يكون بعد تاريخ البداية'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')

    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        code,
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: minOrderAmount.trim() ? Number(minOrderAmount) : 0,
        startsAt: fromDateInputValue(startsAt, false),
        endsAt: fromDateInputValue(endsAt, true),
        usageLimit: usageLimit.trim() ? Number(usageLimit) : null,
        isActive,
      }

      const saved = isEditMode
        ? await updateDiscount(discount.id, payload)
        : await createDiscount(payload)

      onSaved(saved, isEditMode)
    } catch (err) {
      console.error('Failed to save discount:', err.message)
      if (err.code === '23505') {
        setFieldErrors({ code: 'هذا الكود مستخدم بالفعل، اختر كودا اخر' })
      } else {
        setSubmitError(isEditMode ? 'تعذر تعديل الخصم' : 'تعذر اضافة الخصم')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      <div
        dir="rtl"
        className="relative bg-white rounded-2xl shadow-lg w-full max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">
            {isEditMode ? 'تعديل الخصم' : 'اضافة كود خصم'}
          </h3>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {submitError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div>
            <label htmlFor="disc-code" className="block text-sm font-medium text-gray-700 mb-1.5">
              كود الخصم
            </label>
            <input
              id="disc-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.code ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="SAVE10"
            />
            {fieldErrors.code && <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="disc-type" className="block text-sm font-medium text-gray-700 mb-1.5">
                نوع الخصم
              </label>
              <select
                id="disc-type"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
              >
                <option value="percentage">نسبة مئوية</option>
                <option value="fixed">قيمة ثابتة</option>
              </select>
            </div>

            <div>
              <label htmlFor="disc-value" className="block text-sm font-medium text-gray-700 mb-1.5">
                {discountType === 'percentage' ? 'النسبة (%)' : 'القيمة (د.ك)'}
              </label>
              <input
                id="disc-value"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.discountValue ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder="0"
              />
            </div>
          </div>
          {fieldErrors.discountValue && (
            <p className="text-xs text-red-500 -mt-2">{fieldErrors.discountValue}</p>
          )}

          <div>
            <label htmlFor="disc-min" className="block text-sm font-medium text-gray-700 mb-1.5">
              الحد الادنى للطلب (د.ك)
            </label>
            <input
              id="disc-min"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.minOrderAmount ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="0"
            />
            {fieldErrors.minOrderAmount && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.minOrderAmount}</p>
            )}
          </div>

          <div>
            <label htmlFor="disc-usage" className="block text-sm font-medium text-gray-700 mb-1.5">
              حد الاستخدام (اختياري)
            </label>
            <input
              id="disc-usage"
              type="number"
              inputMode="numeric"
              min="1"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.usageLimit ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="بدون حد اقصى"
            />
            {fieldErrors.usageLimit && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.usageLimit}</p>
            )}
            {isEditMode && (
              <p className="text-xs text-gray-400 mt-1">عدد مرات الاستخدام حتى الان: {discount.timesUsed}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="disc-starts" className="block text-sm font-medium text-gray-700 mb-1.5">
                تاريخ البداية
              </label>
              <input
                id="disc-starts"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
              />
            </div>
            <div>
              <label htmlFor="disc-ends" className="block text-sm font-medium text-gray-700 mb-1.5">
                تاريخ النهاية
              </label>
              <input
                id="disc-ends"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.endsAt ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
              />
            </div>
          </div>
          {fieldErrors.endsAt && <p className="text-xs text-red-500 -mt-2">{fieldErrors.endsAt}</p>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="disc-isActive"
                  checked={isActive === true}
                  onChange={() => setIsActive(true)}
                  className="accent-brand"
                />
                نشط
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="disc-isActive"
                  checked={isActive === false}
                  onChange={() => setIsActive(false)}
                  className="accent-brand"
                />
                غير نشط
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              الغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>...جاري الحفظ</span>
                </>
              ) : (
                <span>حفظ</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------
export default function Discounts() {
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState(null)

  const [successMessage, setSuccessMessage] = useState('')
  const [rowError, setRowError] = useState({ id: null, message: '' })

  const [togglingIds, setTogglingIds] = useState(new Set())
  const [deletingIds, setDeletingIds] = useState(new Set())

  function setIdInSet(setter, id, isIn) {
    setter((prev) => {
      const next = new Set(prev)
      if (isIn) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function loadData() {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await getDiscounts()
      setDiscounts(data)
    } catch (err) {
      console.error('Failed to load discounts:', err.message)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    if (!rowError.message) return
    const timer = setTimeout(() => setRowError({ id: null, message: '' }), 4500)
    return () => clearTimeout(timer)
  }, [rowError])

  const filteredDiscounts = useMemo(() => {
    let result = discounts

    if (search.trim()) {
      const query = search.trim().toLowerCase()
      result = result.filter((d) => d.code.toLowerCase().includes(query))
    }

    if (statusFilter === 'active') {
      result = result.filter((d) => d.isActive)
    } else if (statusFilter === 'inactive') {
      result = result.filter((d) => !d.isActive)
    }

    return result
  }, [discounts, search, statusFilter])

  function handleOpenAdd() {
    setEditingDiscount(null)
    setModalOpen(true)
  }

  function handleOpenEdit(discount) {
    setEditingDiscount(discount)
    setModalOpen(true)
  }

  function handleModalSaved(saved, wasEdit) {
    setModalOpen(false)
    setEditingDiscount(null)
    setSuccessMessage(wasEdit ? 'تم تعديل الخصم بنجاح' : 'تمت اضافة الخصم بنجاح')

    setDiscounts((prev) => {
      if (wasEdit) return prev.map((d) => (d.id === saved.id ? saved : d))
      return [saved, ...prev]
    })
  }

  async function handleToggleStatus(discount) {
    setIdInSet(setTogglingIds, discount.id, true)
    try {
      const updated = await toggleDiscountStatus(discount.id, !discount.isActive)
      setDiscounts((prev) => prev.map((d) => (d.id === discount.id ? updated : d)))
    } catch (err) {
      console.error('Failed to toggle discount status:', err.message)
      setRowError({ id: discount.id, message: 'تعذر تغيير حالة الخصم' })
    } finally {
      setIdInSet(setTogglingIds, discount.id, false)
    }
  }

  async function handleDelete(discount) {
    if (!window.confirm(`هل تريد حذف كود الخصم "${discount.code}"؟`)) return

    setIdInSet(setDeletingIds, discount.id, true)
    try {
      await deleteDiscount(discount.id)
      setDiscounts((prev) => prev.filter((d) => d.id !== discount.id))
      setSuccessMessage('تم حذف الخصم بنجاح')
    } catch (err) {
      console.error('Failed to delete discount:', err.message)
      setRowError({ id: discount.id, message: 'تعذر حذف الخصم' })
    } finally {
      setIdInSet(setDeletingIds, discount.id, false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">اكواد الخصم</h2>
          <p className="text-sm text-gray-500 mt-1">استعراض وادارة اكواد الخصم</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          <span>اضافة كود خصم</span>
        </button>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Count + filters */}
        <div className="flex flex-col gap-4 mb-5">
          <p className="text-sm text-gray-500">
            عدد الاكواد: <span className="font-semibold text-gray-800">{discounts.length}</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بكود الخصم"
                aria-label="بحث عن كود خصم"
                className="w-full rounded-xl border border-gray-200 pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="حالة الخصم"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none bg-white transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold sm:w-44"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
        </div>

        {/* Content states */}
        {loading ? (
          <div className="divide-y divide-gray-50">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/4 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-1/6 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <p className="text-sm text-red-500 py-10 text-center">تعذر تحميل اكواد الخصم</p>
        ) : discounts.length === 0 ? (
          <div className="py-14 text-center">
            <TicketX size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">لا توجد اكواد خصم حاليا</p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              <span>اضافة كود خصم</span>
            </button>
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">لا توجد نتائج مطابقة لبحثك</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-right font-medium pb-3 pr-2">الكود</th>
                    <th className="text-right font-medium pb-3">النوع</th>
                    <th className="text-right font-medium pb-3">القيمة</th>
                    <th className="text-right font-medium pb-3">الحد الادنى</th>
                    <th className="text-right font-medium pb-3">الاستخدام</th>
                    <th className="text-right font-medium pb-3">الصلاحية</th>
                    <th className="text-right font-medium pb-3">الحالة</th>
                    <th className="text-right font-medium pb-3">اجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscounts.map((d) => {
                    const isToggling = togglingIds.has(d.id)
                    const isDeleting = deletingIds.has(d.id)
                    const isRowBusy = isToggling || isDeleting
                    return (
                      <tr key={d.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 pr-2">
                          <span className="font-medium text-gray-800" dir="ltr">
                            {d.code}
                          </span>
                          {rowError.id === d.id && (
                            <p className="text-xs text-red-500 mt-1">{rowError.message}</p>
                          )}
                        </td>
                        <td className="py-3 text-gray-600 whitespace-nowrap">
                          {d.discountType === 'percentage' ? 'نسبة مئوية' : 'قيمة ثابتة'}
                        </td>
                        <td className="py-3 text-gray-800 whitespace-nowrap">{formatDiscountValue(d)}</td>
                        <td className="py-3 text-gray-600 whitespace-nowrap">
                          {d.minOrderAmount > 0 ? formatKWD(d.minOrderAmount) : '—'}
                        </td>
                        <td className="py-3 text-gray-600 whitespace-nowrap">
                          {d.usageLimit ? `${d.timesUsed} / ${d.usageLimit}` : `${d.timesUsed} (بدون حد)`}
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <ValidityBadge discount={d} />
                            <span className="text-xs text-gray-400">
                              {formatDate(d.startsAt)} — {formatDate(d.endsAt)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <StatusBadge isActive={d.isActive} />
                        </td>
                        <td className="py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(d)}
                              disabled={isRowBusy}
                              title="تعديل"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 transition-colors"
                            >
                              <Pencil size={14} />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(d)}
                              disabled={isRowBusy}
                              title={d.isActive ? 'تعطيل' : 'تفعيل'}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 transition-colors"
                            >
                              {isToggling ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>...جاري الحفظ</span>
                                </>
                              ) : (
                                <>
                                  {d.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                                  <span>{d.isActive ? 'تعطيل' : 'تفعيل'}</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(d)}
                              disabled={isRowBusy}
                              title="حذف"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-40 transition-colors"
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>...جاري الحذف</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 size={14} />
                                  <span>حذف</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filteredDiscounts.map((d) => {
                const isToggling = togglingIds.has(d.id)
                const isDeleting = deletingIds.has(d.id)
                const isRowBusy = isToggling || isDeleting
                return (
                  <div key={d.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800" dir="ltr">
                        {d.code}
                      </span>
                      <StatusBadge isActive={d.isActive} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-800">{formatDiscountValue(d)}</span>
                      <span className="text-xs text-gray-400">
                        ({d.discountType === 'percentage' ? 'نسبة مئوية' : 'قيمة ثابتة'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ValidityBadge discount={d} />
                      <span className="text-xs text-gray-400">
                        {formatDate(d.startsAt)} — {formatDate(d.endsAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>الحد الادنى: {d.minOrderAmount > 0 ? formatKWD(d.minOrderAmount) : '—'}</span>
                      <span>
                        الاستخدام: {d.usageLimit ? `${d.timesUsed}/${d.usageLimit}` : d.timesUsed}
                      </span>
                    </div>
                    {rowError.id === d.id && <p className="text-xs text-red-500">{rowError.message}</p>}
                    <div className="flex items-center gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(d)}
                        disabled={isRowBusy}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
                      >
                        <Pencil size={13} />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(d)}
                        disabled={isRowBusy}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
                      >
                        {isToggling ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>...جاري الحفظ</span>
                          </>
                        ) : (
                          <>
                            {d.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{d.isActive ? 'تعطيل' : 'تفعيل'}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(d)}
                        disabled={isRowBusy}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>...جاري الحذف</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={13} />
                            <span>حذف</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <DiscountModal
          discount={editingDiscount}
          onClose={() => {
            setModalOpen(false)
            setEditingDiscount(null)
          }}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  )
}