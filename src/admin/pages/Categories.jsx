// Admin — Categories management: list, add, edit, activate/deactivate, delete.
// Deletion is blocked when products still reference the category (the
// database itself also enforces this via an on-delete-restrict foreign key —
// see deleteCategory() in categoryService.js).

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  FolderX,
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
  getAllCategoriesForAdmin,
  getCategoryProductCounts,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} from '../../services/categoryService'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

// -----------------------------------------------------------------------
// Add / Edit modal
// -----------------------------------------------------------------------
function CategoryModal({ category, onClose, onSaved }) {
  const isEditMode = Boolean(category)

  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [sortOrder, setSortOrder] = useState(
    category?.sortOrder !== undefined && category?.sortOrder !== null ? String(category.sortOrder) : '0'
  )
  const [isActive, setIsActive] = useState(category?.isActive ?? true)

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const errors = {}
    if (!name.trim()) {
      errors.name = 'اسم التصنيف مطلوب'
    } else if (name.trim().length > 80) {
      errors.name = 'اسم التصنيف طويل جدا'
    }

    if (sortOrder.trim() && Number.isNaN(Number(sortOrder))) {
      errors.sortOrder = 'ترتيب العرض يجب ان يكون رقما'
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
        name,
        description,
        sortOrder: sortOrder.trim() ? Number(sortOrder) : 0,
        isActive,
      }

      const saved = isEditMode
        ? await updateCategory(category.id, payload)
        : await createCategory(payload)

      onSaved(saved, isEditMode)
    } catch (err) {
      console.error('Failed to save category:', err.message)
      setSubmitError(isEditMode ? 'تعذر تعديل التصنيف' : 'تعذر اضافة التصنيف')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !submitting && onClose()}
      />

      <div
        dir="rtl"
        className="relative bg-white rounded-2xl shadow-lg w-full max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">
            {isEditMode ? 'تعديل التصنيف' : 'اضافة تصنيف'}
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
            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              الاسم
            </label>
            <input
              id="cat-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.name ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="مثال: رجالي"
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
            {isEditMode && (
              <p className="text-xs text-gray-400 mt-1">
                الرابط الحالي (slug) سيبقى كما هو: <span dir="ltr">{category.slug}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="cat-description" className="block text-sm font-medium text-gray-700 mb-1.5">
              الوصف
            </label>
            <textarea
              id="cat-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-none"
              placeholder="وصف مختصر للتصنيف (اختياري)"
            />
          </div>

          <div>
            <label htmlFor="cat-sort" className="block text-sm font-medium text-gray-700 mb-1.5">
              ترتيب العرض
            </label>
            <input
              id="cat-sort"
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.sortOrder ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="0"
            />
            {fieldErrors.sortOrder && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.sortOrder}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الحالة</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="cat-isActive"
                  checked={isActive === true}
                  onChange={() => setIsActive(true)}
                  className="accent-brand"
                />
                نشط
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="cat-isActive"
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
export default function Categories() {
  const [categories, setCategories] = useState([])
  const [productCounts, setProductCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  const [successMessage, setSuccessMessage] = useState('')
  const [rowError, setRowError] = useState({ id: null, message: '' })

  // Per-row busy state, tracked separately so the correct button shows its
  // own "...جاري الحفظ" / "...جاري الحذف" wording instead of a shared spinner.
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
      const [cats, counts] = await Promise.all([getAllCategoriesForAdmin(), getCategoryProductCounts()])
      setCategories(cats)
      setProductCounts(counts)
    } catch (err) {
      console.error('Failed to load categories:', err.message)
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

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const query = search.trim().toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(query))
  }, [categories, search])

  function handleOpenAdd() {
    setEditingCategory(null)
    setModalOpen(true)
  }

  function handleOpenEdit(category) {
    setEditingCategory(category)
    setModalOpen(true)
  }

  function handleModalSaved(saved, wasEdit) {
    setModalOpen(false)
    setEditingCategory(null)
    setSuccessMessage(wasEdit ? 'تم تعديل التصنيف بنجاح' : 'تمت اضافة التصنيف بنجاح')

    setCategories((prev) => {
      if (wasEdit) {
        return prev.map((c) => (c.id === saved.id ? saved : c))
      }
      return [saved, ...prev]
    })
  }

  async function handleToggleStatus(category) {
    setIdInSet(setTogglingIds, category.id, true)
    try {
      const updated = await toggleCategoryStatus(category.id, !category.isActive)
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)))
    } catch (err) {
      console.error('Failed to toggle category status:', err.message)
      setRowError({ id: category.id, message: 'تعذر تغيير حالة التصنيف' })
    } finally {
      setIdInSet(setTogglingIds, category.id, false)
    }
  }

  async function handleDelete(category) {
    const count = productCounts[category.id] || 0

    if (count > 0) {
      setRowError({ id: category.id, message: 'لا يمكن حذف هذا التصنيف لوجود منتجات مرتبطة به' })
      return
    }

    if (!window.confirm(`هل تريد حذف تصنيف "${category.name}"؟`)) return

    setIdInSet(setDeletingIds, category.id, true)
    try {
      await deleteCategory(category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
      setSuccessMessage('تم حذف التصنيف بنجاح')
    } catch (err) {
      console.error('Failed to delete category:', err.message)
      if (err.isRestricted) {
        setRowError({ id: category.id, message: 'لا يمكن حذف هذا التصنيف لوجود منتجات مرتبطة به' })
      } else {
        setRowError({ id: category.id, message: 'تعذر حذف التصنيف' })
      }
    } finally {
      setIdInSet(setDeletingIds, category.id, false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">التصنيفات</h2>
          <p className="text-sm text-gray-500 mt-1">استعراض وادارة تصنيفات المتجر</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          <span>اضافة تصنيف</span>
        </button>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Count + search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <p className="text-sm text-gray-500">
            عدد التصنيفات: <span className="font-semibold text-gray-800">{categories.length}</span>
          </p>

          <div className="relative sm:w-64">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن تصنيف..."
              className="w-full rounded-xl border border-gray-200 pr-9 pl-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
            />
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
          <p className="text-sm text-red-500 py-10 text-center">تعذر تحميل التصنيفات</p>
        ) : categories.length === 0 ? (
          <div className="py-14 text-center">
            <FolderX size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">لا توجد تصنيفات حاليا</p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 bg-brand text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              <span>اضافة تصنيف</span>
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">لا توجد نتائج مطابقة لبحثك</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs border-b border-gray-100">
                    <th className="text-right font-medium pb-3 pr-2">الاسم</th>
                    <th className="text-right font-medium pb-3">الرابط (slug)</th>
                    <th className="text-right font-medium pb-3">الحالة</th>
                    <th className="text-right font-medium pb-3">ترتيب العرض</th>
                    <th className="text-right font-medium pb-3">عدد المنتجات</th>
                    <th className="text-right font-medium pb-3">تاريخ الاضافة</th>
                    <th className="text-right font-medium pb-3">اجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((cat) => {
                    const isToggling = togglingIds.has(cat.id)
                    const isDeleting = deletingIds.has(cat.id)
                    const isRowBusy = isToggling || isDeleting
                    const count = productCounts[cat.id] || 0
                    return (
                      <tr key={cat.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 pr-2">
                          <span className="font-medium text-gray-800">{cat.name}</span>
                          {rowError.id === cat.id && (
                            <p className="text-xs text-red-500 mt-1">{rowError.message}</p>
                          )}
                        </td>
                        <td className="py-3 text-gray-500 whitespace-nowrap" dir="ltr">
                          {cat.slug}
                        </td>
                        <td className="py-3">
                          <StatusBadge isActive={cat.isActive} />
                        </td>
                        <td className="py-3 text-gray-600 whitespace-nowrap">{cat.sortOrder}</td>
                        <td className="py-3 text-gray-600 whitespace-nowrap">{count}</td>
                        <td className="py-3 text-gray-500 whitespace-nowrap">{formatDate(cat.createdAt)}</td>
                        <td className="py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(cat)}
                              disabled={isRowBusy}
                              title="تعديل"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 transition-colors"
                            >
                              <Pencil size={14} />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(cat)}
                              disabled={isRowBusy}
                              title={cat.isActive ? 'تعطيل' : 'تفعيل'}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 transition-colors"
                            >
                              {isToggling ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>...جاري الحفظ</span>
                                </>
                              ) : (
                                <>
                                  {cat.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                                  <span>{cat.isActive ? 'تعطيل' : 'تفعيل'}</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat)}
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
              {filteredCategories.map((cat) => {
                const isToggling = togglingIds.has(cat.id)
                const isDeleting = deletingIds.has(cat.id)
                const isRowBusy = isToggling || isDeleting
                const count = productCounts[cat.id] || 0
                return (
                  <div key={cat.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">{cat.name}</span>
                      <StatusBadge isActive={cat.isActive} />
                    </div>
                    <p className="text-xs text-gray-400" dir="ltr">
                      {cat.slug}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>ترتيب: {cat.sortOrder}</span>
                      <span>المنتجات: {count}</span>
                      <span>{formatDate(cat.createdAt)}</span>
                    </div>
                    {rowError.id === cat.id && (
                      <p className="text-xs text-red-500">{rowError.message}</p>
                    )}
                    <div className="flex items-center gap-4 pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cat)}
                        disabled={isRowBusy}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
                      >
                        <Pencil size={13} />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cat)}
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
                            {cat.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                            <span>{cat.isActive ? 'تعطيل' : 'تفعيل'}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
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
        <CategoryModal
          category={editingCategory}
          onClose={() => {
            setModalOpen(false)
            setEditingCategory(null)
          }}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  )
}