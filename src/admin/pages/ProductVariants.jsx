// Admin — manage a single product's colors, sizes, and color+size variant stock.
// Colors/sizes are simple named lists per product; variants are the color x size
// combinations that actually carry independent stock (product_variants table).

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Palette,
  Ruler,
  Boxes,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { getProduct } from '../../services/productService'
import {
  getProductColors,
  createColor,
  deleteColor,
  getProductSizes,
  createSize,
  deleteSize,
  getProductVariants,
  createVariant,
  updateVariantStock,
  setVariantActive,
  deleteVariant,
} from '../../services/productVariantService'

function Banner({ type, children }) {
  const styles =
    type === 'success'
      ? 'text-green-700 bg-green-50'
      : type === 'error'
      ? 'text-red-600 bg-red-50'
      : 'text-amber-700 bg-amber-50'
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle

  return (
    <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 ${styles}`}>
      <Icon size={16} className="shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export default function ProductVariants() {
  const { id: productId } = useParams()

  const [product, setProduct] = useState(null)
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [variants, setVariants] = useState([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Add-color form
  const [colorName, setColorName] = useState('')
  const [colorHex, setColorHex] = useState('#000000')
  const [colorSubmitting, setColorSubmitting] = useState(false)
  const [colorError, setColorError] = useState('')

  // Add-size form
  const [sizeName, setSizeName] = useState('')
  const [sizeSubmitting, setSizeSubmitting] = useState(false)
  const [sizeError, setSizeError] = useState('')

  // Add-variant form
  const [variantColorId, setVariantColorId] = useState('')
  const [variantSizeId, setVariantSizeId] = useState('')
  const [variantStock, setVariantStock] = useState('0')
  const [variantSubmitting, setVariantSubmitting] = useState(false)
  const [variantError, setVariantError] = useState('')

  // Per-row busy state, keyed by id (colors, sizes, and variants each have
  // their own set since ids don't overlap across tables in practice, but we
  // still separate them to avoid any ambiguity)
  const [deletingColorIds, setDeletingColorIds] = useState(new Set())
  const [deletingSizeIds, setDeletingSizeIds] = useState(new Set())
  const [busyVariantIds, setBusyVariantIds] = useState(new Set())
  const [stockDrafts, setStockDrafts] = useState({}) // variantId -> string being edited

  function setIdInSet(setter, id, isIn) {
    setter((prev) => {
      const next = new Set(prev)
      if (isIn) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [productData, colorsData, sizesData, variantsData] = await Promise.all([
        getProduct(productId),
        getProductColors(productId),
        getProductSizes(productId),
        getProductVariants(productId),
      ])
      setProduct(productData)
      setColors(colorsData)
      setSizes(sizesData)
      setVariants(variantsData)
    } catch (err) {
      console.error('Failed to load product variants data:', err.message)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    if (!errorMessage) return
    const timer = setTimeout(() => setErrorMessage(''), 4500)
    return () => clearTimeout(timer)
  }, [errorMessage])

  // ---------------------------------------------------------------------
  // Colors
  // ---------------------------------------------------------------------
  async function handleAddColor(e) {
    e.preventDefault()
    setColorError('')

    if (!colorName.trim()) {
      setColorError('اسم اللون مطلوب')
      return
    }

    setColorSubmitting(true)
    try {
      const created = await createColor(productId, { name: colorName, hexCode: colorHex })
      setColors((prev) => [...prev, created])
      setColorName('')
      setColorHex('#000000')
      setSuccessMessage('تمت اضافة اللون بنجاح')
    } catch (err) {
      console.error('Failed to add color:', err.message)
      setColorError(err.isDuplicate ? 'هذا اللون موجود بالفعل لهذا المنتج' : 'تعذر اضافة اللون')
    } finally {
      setColorSubmitting(false)
    }
  }

  async function handleDeleteColor(color) {
    const usedByVariants = variants.some((v) => v.colorId === color.id)
    const confirmMsg = usedByVariants
      ? `اللون "${color.name}" مستخدم في توليفات مخزون حالية. حذفه سيحذف تلك التوليفات وصورها المرتبطة به ايضا. هل تريد المتابعة؟`
      : `هل تريد حذف اللون "${color.name}"؟`

    if (!window.confirm(confirmMsg)) return

    setIdInSet(setDeletingColorIds, color.id, true)
    try {
      await deleteColor(color.id)
      setColors((prev) => prev.filter((c) => c.id !== color.id))
      setVariants((prev) => prev.filter((v) => v.colorId !== color.id))
      setSuccessMessage('تم حذف اللون بنجاح')
    } catch (err) {
      console.error('Failed to delete color:', err.message)
      setErrorMessage('تعذر حذف اللون')
    } finally {
      setIdInSet(setDeletingColorIds, color.id, false)
    }
  }

  // ---------------------------------------------------------------------
  // Sizes
  // ---------------------------------------------------------------------
  async function handleAddSize(e) {
    e.preventDefault()
    setSizeError('')

    if (!sizeName.trim()) {
      setSizeError('اسم المقاس مطلوب')
      return
    }

    setSizeSubmitting(true)
    try {
      const created = await createSize(productId, { name: sizeName })
      setSizes((prev) => [...prev, created])
      setSizeName('')
      setSuccessMessage('تمت اضافة المقاس بنجاح')
    } catch (err) {
      console.error('Failed to add size:', err.message)
      setSizeError(err.isDuplicate ? 'هذا المقاس موجود بالفعل لهذا المنتج' : 'تعذر اضافة المقاس')
    } finally {
      setSizeSubmitting(false)
    }
  }

  async function handleDeleteSize(size) {
    const usedByVariants = variants.some((v) => v.sizeId === size.id)
    const confirmMsg = usedByVariants
      ? `المقاس "${size.name}" مستخدم في توليفات مخزون حالية. حذفه سيحذف تلك التوليفات ايضا. هل تريد المتابعة؟`
      : `هل تريد حذف المقاس "${size.name}"؟`

    if (!window.confirm(confirmMsg)) return

    setIdInSet(setDeletingSizeIds, size.id, true)
    try {
      await deleteSize(size.id)
      setSizes((prev) => prev.filter((s) => s.id !== size.id))
      setVariants((prev) => prev.filter((v) => v.sizeId !== size.id))
      setSuccessMessage('تم حذف المقاس بنجاح')
    } catch (err) {
      console.error('Failed to delete size:', err.message)
      setErrorMessage('تعذر حذف المقاس')
    } finally {
      setIdInSet(setDeletingSizeIds, size.id, false)
    }
  }

  // ---------------------------------------------------------------------
  // Variants (stock)
  // ---------------------------------------------------------------------
  async function handleAddVariant(e) {
    e.preventDefault()
    setVariantError('')

    if (!variantColorId || !variantSizeId) {
      setVariantError('يجب اختيار اللون والمقاس')
      return
    }

    // STAGE 23 FIX — the error message here always said "must be a whole
    // number" (رقما صحيحا) but the check never actually verified that:
    // Number("1.5") is neither NaN nor < 0, so a decimal silently passed
    // through, hit product_variants.stock_quantity (an `int` column), and
    // got rounded by Postgres's assignment cast without telling the admin.
    // Number.isInteger() closes that gap in JS, matching what the message
    // already promised — no schema/DB change (the `int` column + its
    // `check (stock_quantity >= 0)` constraint were already correct).
    const stock = Number(variantStock)
    if (variantStock.trim() === '' || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
      setVariantError('الكمية يجب ان تكون رقما صحيحا')
      return
    }

    setVariantSubmitting(true)
    try {
      const created = await createVariant(productId, {
        colorId: variantColorId,
        sizeId: variantSizeId,
        stockQuantity: stock,
      })
      const color = colors.find((c) => c.id === variantColorId)
      const size = sizes.find((s) => s.id === variantSizeId)
      setVariants((prev) => [
        ...prev,
        {
          id: created.id,
          colorId: variantColorId,
          colorName: color?.name || '—',
          sizeId: variantSizeId,
          sizeName: size?.name || '—',
          stockQuantity: created.stockQuantity,
          isActive: created.isActive,
        },
      ])
      setVariantColorId('')
      setVariantSizeId('')
      setVariantStock('0')
      setSuccessMessage('تمت اضافة التوليفة بنجاح')
    } catch (err) {
      console.error('Failed to add variant:', err.message)
      setVariantError(err.isDuplicate ? 'هذه التوليفة موجودة بالفعل' : 'تعذر اضافة التوليفة')
    } finally {
      setVariantSubmitting(false)
    }
  }

  function handleStockDraftChange(variantId, value) {
    setStockDrafts((prev) => ({ ...prev, [variantId]: value }))
  }

  async function handleSaveStock(variant) {
    const draft = stockDrafts[variant.id]
    if (draft === undefined) return

    // STAGE 23 FIX — same integer gap as handleAddVariant above, for the
    // inline stock-edit field.
    const stock = Number(draft)
    if (draft.trim() === '' || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
      setErrorMessage('الكمية يجب ان تكون رقما صحيحا')
      return
    }

    if (stock === variant.stockQuantity) {
      setStockDrafts((prev) => {
        const next = { ...prev }
        delete next[variant.id]
        return next
      })
      return
    }

    setIdInSet(setBusyVariantIds, variant.id, true)
    try {
      await updateVariantStock(variant.id, stock)
      setVariants((prev) =>
        prev.map((v) => (v.id === variant.id ? { ...v, stockQuantity: stock } : v))
      )
      setStockDrafts((prev) => {
        const next = { ...prev }
        delete next[variant.id]
        return next
      })
    } catch (err) {
      console.error('Failed to update stock:', err.message)
      setErrorMessage('تعذر تحديث الكمية')
    } finally {
      setIdInSet(setBusyVariantIds, variant.id, false)
    }
  }

  async function handleToggleVariantActive(variant) {
    setIdInSet(setBusyVariantIds, variant.id, true)
    try {
      await setVariantActive(variant.id, !variant.isActive)
      setVariants((prev) =>
        prev.map((v) => (v.id === variant.id ? { ...v, isActive: !v.isActive } : v))
      )
    } catch (err) {
      console.error('Failed to toggle variant status:', err.message)
      setErrorMessage('تعذر تغيير حالة التوليفة')
    } finally {
      setIdInSet(setBusyVariantIds, variant.id, false)
    }
  }

  async function handleDeleteVariant(variant) {
    if (!window.confirm(`هل تريد حذف توليفة "${variant.colorName} — ${variant.sizeName}"؟`)) return

    setIdInSet(setBusyVariantIds, variant.id, true)
    try {
      await deleteVariant(variant.id)
      setVariants((prev) => prev.filter((v) => v.id !== variant.id))
      setSuccessMessage('تم حذف التوليفة بنجاح')
    } catch (err) {
      console.error('Failed to delete variant:', err.message)
      setErrorMessage('تعذر حذف التوليفة')
    } finally {
      setIdInSet(setBusyVariantIds, variant.id, false)
    }
  }

  // Available color/size options for the add-variant form: combinations that
  // don't already exist as a variant.
  const existingCombos = new Set(variants.map((v) => `${v.colorId}:${v.sizeId}`))

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowRight size={16} />
          <span>العودة الى المنتجات</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900">
          الالوان والمقاسات {product ? `— ${product.name}` : ''}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          ادارة الوان ومقاسات المنتج، وتحديد المخزون المتاح لكل توليفة لون ومقاس.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-500 py-10 text-center">حدث خطا اثناء تحميل بيانات المنتج</p>
      ) : (
        <div className="space-y-6">
          {successMessage && <Banner type="success">{successMessage}</Banner>}
          {errorMessage && <Banner type="error">{errorMessage}</Banner>}

          {/* الالوان */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-brand-gold" />
              <h3 className="font-bold text-gray-900">الالوان</h3>
            </div>

            {colors.length === 0 ? (
              <p className="text-sm text-gray-400">لا توجد الوان مضافة لهذا المنتج بعد</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {colors.map((color) => {
                  const isDeleting = deletingColorIds.has(color.id)
                  return (
                    <li
                      key={color.id}
                      className="flex items-center gap-2 border border-gray-200 rounded-full pr-1.5 pl-3 py-1.5 text-sm"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-gray-200 shrink-0"
                        style={{ backgroundColor: color.hexCode || '#e5e7eb' }}
                      />
                      <span className="text-gray-700">{color.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColor(color)}
                        disabled={isDeleting}
                        title="حذف اللون"
                        className="text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                      >
                        {isDeleting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <form onSubmit={handleAddColor} noValidate className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="color-name" className="block text-xs font-medium text-gray-600 mb-1">
                  اسم اللون
                </label>
                <input
                  id="color-name"
                  type="text"
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="مثال: اسود"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                />
              </div>
              <div>
                <label htmlFor="color-hex" className="block text-xs font-medium text-gray-600 mb-1">
                  اللون
                </label>
                <input
                  id="color-hex"
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer"
                />
              </div>
              <button
                type="submit"
                disabled={colorSubmitting}
                className="flex items-center gap-1.5 bg-brand text-white rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {colorSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                <span>اضافة</span>
              </button>
            </form>
            {colorError && <p className="text-xs text-red-500">{colorError}</p>}
          </div>

          {/* المقاسات */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Ruler size={18} className="text-brand-gold" />
              <h3 className="font-bold text-gray-900">المقاسات</h3>
            </div>

            {sizes.length === 0 ? (
              <p className="text-sm text-gray-400">لا توجد مقاسات مضافة لهذا المنتج بعد</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {sizes.map((size) => {
                  const isDeleting = deletingSizeIds.has(size.id)
                  return (
                    <li
                      key={size.id}
                      className="flex items-center gap-2 border border-gray-200 rounded-full pr-1.5 pl-3 py-1.5 text-sm"
                    >
                      <span className="text-gray-700">{size.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSize(size)}
                        disabled={isDeleting}
                        title="حذف المقاس"
                        className="text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                      >
                        {isDeleting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <form onSubmit={handleAddSize} noValidate className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label htmlFor="size-name" className="block text-xs font-medium text-gray-600 mb-1">
                  اسم المقاس
                </label>
                <input
                  id="size-name"
                  type="text"
                  value={sizeName}
                  onChange={(e) => setSizeName(e.target.value)}
                  placeholder="مثال: M"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={sizeSubmitting}
                className="flex items-center gap-1.5 bg-brand text-white rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {sizeSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                <span>اضافة</span>
              </button>
            </form>
            {sizeError && <p className="text-xs text-red-500">{sizeError}</p>}
          </div>

          {/* التوليفات والمخزون */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Boxes size={18} className="text-brand-gold" />
              <h3 className="font-bold text-gray-900">التوليفات والمخزون</h3>
            </div>

            {colors.length === 0 || sizes.length === 0 ? (
              <p className="text-sm text-gray-400">
                يجب اضافة لون ومقاس واحد على الاقل قبل انشاء توليفات المخزون
              </p>
            ) : (
              <>
                {variants.length === 0 ? (
                  <p className="text-sm text-gray-400">لا توجد توليفات مضافة بعد</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="text-gray-400 text-xs border-b border-gray-100">
                          <th className="text-right font-medium pb-2 pr-2">اللون</th>
                          <th className="text-right font-medium pb-2">المقاس</th>
                          <th className="text-right font-medium pb-2">الكمية المتاحة</th>
                          <th className="text-right font-medium pb-2">الحالة</th>
                          <th className="text-right font-medium pb-2">اجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((variant) => {
                          const isBusy = busyVariantIds.has(variant.id)
                          const draft = stockDrafts[variant.id]
                          const hasDraft = draft !== undefined && Number(draft) !== variant.stockQuantity

                          return (
                            <tr key={variant.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-2.5 pr-2 text-gray-800 whitespace-nowrap">
                                {variant.colorName}
                              </td>
                              <td className="py-2.5 text-gray-800 whitespace-nowrap">
                                {variant.sizeName}
                              </td>
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={draft !== undefined ? draft : variant.stockQuantity}
                                    onChange={(e) => handleStockDraftChange(variant.id, e.target.value)}
                                    className={`w-20 rounded-lg border px-2 py-1.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                                      variant.stockQuantity <= 5
                                        ? 'border-amber-300 text-amber-700'
                                        : 'border-gray-200 focus:border-brand-gold'
                                    }`}
                                  />
                                  {hasDraft && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveStock(variant)}
                                      disabled={isBusy}
                                      className="text-xs font-medium text-brand-gold hover:opacity-80 disabled:opacity-40 transition-opacity whitespace-nowrap"
                                    >
                                      حفظ
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleVariantActive(variant)}
                                  disabled={isBusy}
                                  title={variant.isActive ? 'تعطيل' : 'تفعيل'}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-40 transition-colors"
                                >
                                  {variant.isActive ? (
                                    <ToggleRight size={20} className="text-green-600" />
                                  ) : (
                                    <ToggleLeft size={20} className="text-gray-400" />
                                  )}
                                  <span className={variant.isActive ? 'text-green-600' : 'text-gray-500'}>
                                    {variant.isActive ? 'نشط' : 'غير نشط'}
                                  </span>
                                </button>
                              </td>
                              <td className="py-2.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariant(variant)}
                                  disabled={isBusy}
                                  title="حذف التوليفة"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-40 transition-colors"
                                >
                                  {isBusy ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                  <span>حذف</span>
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <form
                  onSubmit={handleAddVariant}
                  noValidate
                  className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-50"
                >
                  <div className="min-w-[140px]">
                    <label htmlFor="variant-color" className="block text-xs font-medium text-gray-600 mb-1">
                      اللون
                    </label>
                    <select
                      id="variant-color"
                      value={variantColorId}
                      onChange={(e) => setVariantColorId(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                    >
                      <option value="">اختر لونا</option>
                      {colors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-[120px]">
                    <label htmlFor="variant-size" className="block text-xs font-medium text-gray-600 mb-1">
                      المقاس
                    </label>
                    <select
                      id="variant-size"
                      value={variantSizeId}
                      onChange={(e) => setVariantSizeId(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                    >
                      <option value="">اختر مقاسا</option>
                      {sizes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label htmlFor="variant-stock" className="block text-xs font-medium text-gray-600 mb-1">
                      الكمية
                    </label>
                    <input
                      id="variant-stock"
                      type="number"
                      min="0"
                      value={variantStock}
                      onChange={(e) => setVariantStock(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      variantSubmitting ||
                      (variantColorId &&
                        variantSizeId &&
                        existingCombos.has(`${variantColorId}:${variantSizeId}`))
                    }
                    className="flex items-center gap-1.5 bg-brand text-white rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {variantSubmitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Plus size={15} />
                    )}
                    <span>اضافة توليفة</span>
                  </button>
                </form>
                {variantColorId &&
                  variantSizeId &&
                  existingCombos.has(`${variantColorId}:${variantSizeId}`) && (
                    <p className="text-xs text-amber-600">هذه التوليفة موجودة بالفعل بالاسفل</p>
                  )}
                {variantError && <p className="text-xs text-red-500">{variantError}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}