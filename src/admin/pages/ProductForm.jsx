// Add/Edit Product page — basic product info + image management.
// Create mode:  /admin/products/new        (no :id param)
// Edit mode:    /admin/products/:id/edit   (:id param present)
// Colors, sizes, material, and variants are separate later stages.
//
// Image flow (both modes): newly selected files are only staged locally
// (previewed via object URLs). Nothing is uploaded to Storage until the
// product row has been created/updated successfully. In edit mode, deletions
// of existing images are also staged (marked, not executed) until the
// product update succeeds. Upload/delete/primary logic itself lives in
// productImageService.js / storageService.js — not duplicated here.

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, AlertCircle, UploadCloud, X, Star, ImageOff, RotateCcw } from 'lucide-react'
import { createProduct, getProductById, updateProduct } from '../../services/productService'
import { getCategories, getCategoryById } from '../../services/categoryService'
import {
  getProductImages,
  addProductImage,
  deleteProductImage,
  setPrimaryImage,
} from '../../services/productImageService'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function generateStagedId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export default function ProductForm() {
  const navigate = useNavigate()
  const { id: productId } = useParams()
  const isEditMode = Boolean(productId)

  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Edit mode: loading the product itself + its existing images
  const [productLoading, setProductLoading] = useState(isEditMode)
  const [productLoadError, setProductLoadError] = useState(false)

  // Existing images (edit mode only): [{ id, imageUrl, isPrimary, sortOrder }]
  const [existingImages, setExistingImages] = useState([])
  // Ids of existing images marked for deletion — actually deleted only after
  // the product update succeeds.
  const [pendingDeleteIds, setPendingDeleteIds] = useState(new Set())

  // Newly staged images (both modes): [{ id, file, previewUrl }]
  const [stagedImages, setStagedImages] = useState([])
  const [imageSelectError, setImageSelectError] = useState('')

  // Unified primary choice across existing + staged images:
  // { type: 'existing' | 'staged', id: string } | null
  const [primaryChoice, setPrimaryChoice] = useState(null)

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [imageWarning, setImageWarning] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load categories (both modes)
  useEffect(() => {
    let isMounted = true

    getCategories()
      .then((data) => {
        if (isMounted) setCategories(data)
      })
      .catch((err) => {
        console.error('Failed to load categories:', err.message)
        if (isMounted) setCategoriesError(true)
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Edit mode: load the product + its existing images
  useEffect(() => {
    if (!isEditMode) return
    let isMounted = true

    setProductLoading(true)
    setProductLoadError(false)

    Promise.all([getProductById(productId), getProductImages(productId)])
      .then(([product, images]) => {
        if (!isMounted) return
        setName(product.name)
        setDescription(product.description)
        setPrice(String(product.basePrice))
        setCategoryId(product.categoryId || '')
        setIsActive(product.isActive)
        setExistingImages(images)

        const primary = images.find((img) => img.isPrimary)
        if (primary) {
          setPrimaryChoice({ type: 'existing', id: primary.id })
        } else if (images.length > 0) {
          setPrimaryChoice({ type: 'existing', id: images[0].id })
        }
      })
      .catch((err) => {
        console.error('Failed to load product:', err.message)
        if (isMounted) setProductLoadError(true)
      })
      .finally(() => {
        if (isMounted) setProductLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isEditMode, productId])

  // Edit mode: if the product's current category has since been deactivated,
  // it won't be in the active-only `categories` list from getCategories().
  // Fetch and append it so the dropdown still shows the product's real
  // category instead of silently dropping it.
  useEffect(() => {
    if (!isEditMode || categoriesLoading || productLoading || !categoryId) return
    if (categories.some((c) => c.id === categoryId)) return

    let isMounted = true
    getCategoryById(categoryId)
      .then((cat) => {
        if (!isMounted) return
        setCategories((prev) =>
          prev.some((c) => c.id === cat.id)
            ? prev
            : [...prev, { id: cat.id, name: `${cat.name} (غير نشط)`, parentId: cat.parentId }]
        )
      })
      .catch((err) => {
        console.error('Failed to load product category:', err.message)
      })

    return () => {
      isMounted = false
    }
  }, [isEditMode, categoriesLoading, productLoading, categoryId, categories])

  // Revoke staged-image object URLs on unmount to avoid leaking memory
  useEffect(() => {
    return () => {
      stagedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validateImageFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name}: نوع الملف غير مدعوم (JPG, PNG, WEBP فقط)`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: حجم الملف اكبر من 5 ميجابايت`
    }
    return null
  }

  // Picks a fallback primary when the current primaryChoice is no longer
  // valid (its existing image got marked for deletion, or it was removed).
  function pickFallbackPrimary(images, deleteIds, staged) {
    const remainingExisting = images.filter((img) => !deleteIds.has(img.id))
    if (remainingExisting.length > 0) return { type: 'existing', id: remainingExisting[0].id }
    if (staged.length > 0) return { type: 'staged', id: staged[0].id }
    return null
  }

  function handleImagesSelected(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    const errors = []
    const accepted = []

    for (const file of files) {
      const err = validateImageFile(file)
      if (err) errors.push(err)
      else accepted.push(file)
    }

    setImageSelectError(errors.join(' — '))

    if (accepted.length === 0) return

    const newStaged = accepted.map((file) => ({
      id: generateStagedId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    setStagedImages((prev) => {
      const next = [...prev, ...newStaged]
      if (!primaryChoice && next.length > 0) {
        setPrimaryChoice({ type: 'staged', id: next[0].id })
      }
      return next
    })
  }

  function handleImageInputChange(e) {
    handleImagesSelected(e.target.files)
    e.target.value = ''
  }

  function handleRemoveStagedImage(id) {
    setStagedImages((prev) => {
      const removed = prev.find((img) => img.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      const next = prev.filter((img) => img.id !== id)

      if (primaryChoice?.type === 'staged' && primaryChoice.id === id) {
        setPrimaryChoice(pickFallbackPrimary(existingImages, pendingDeleteIds, next))
      }
      return next
    })
  }

  function handleToggleDeleteExisting(id) {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)

      if (next.has(id) && primaryChoice?.type === 'existing' && primaryChoice.id === id) {
        setPrimaryChoice(pickFallbackPrimary(existingImages, next, stagedImages))
      }
      return next
    })
  }

  function handleSetPrimary(type, id) {
    setPrimaryChoice({ type, id })
  }

  function validate() {
    const errors = {}

    if (!name.trim()) {
      errors.name = 'اسم المنتج مطلوب'
    }

    if (!price.trim()) {
      errors.price = 'السعر مطلوب'
    } else if (Number.isNaN(Number(price)) || Number(price) <= 0) {
      errors.price = 'السعر يجب ان يكون رقما صحيحا'
    }

    if (!categoryId) {
      errors.categoryId = 'يجب اختيار التصنيف'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleCreateSubmit() {
    let createdProduct
    try {
      createdProduct = await createProduct({
        name,
        description,
        basePrice: Number(price),
        categoryId,
        isActive,
      })
    } catch (err) {
      console.error('Failed to create product:', err.message)
      setSubmitError('حدث خطا اثناء اضافة المنتج')
      setSubmitting(false)
      return
    }

    if (stagedImages.length > 0) {
      const failedUploads = []
      let sortOrder = 0

      for (const staged of stagedImages) {
        const isPrimary = primaryChoice?.type === 'staged' && primaryChoice.id === staged.id
        try {
          // eslint-disable-next-line no-await-in-loop
          await addProductImage(createdProduct.id, staged.file, sortOrder, isPrimary)
          sortOrder += 1
        } catch (err) {
          console.error('Failed to upload staged image:', staged.file.name, err.message)
          failedUploads.push(staged.file.name)
        }
      }

      if (failedUploads.length > 0) {
        navigate('/admin/products', {
          state: {
            successMessage: 'تمت اضافة المنتج بنجاح، لكن تعذر رفع بعض الصور',
            imageWarning: `الصور التي فشل رفعها: ${failedUploads.join('، ')}. يمكنك اضافتها من صفحة ادارة صور المنتج.`,
          },
        })
        return
      }
    }

    navigate('/admin/products', { state: { successMessage: 'تمت اضافة المنتج بنجاح' } })
  }

  async function handleEditSubmit() {
    try {
      await updateProduct(productId, {
        name,
        description,
        basePrice: Number(price),
        categoryId,
        isActive,
      })
    } catch (err) {
      console.error('Failed to update product:', err.message)
      setSubmitError('تعذر حفظ التعديلات')
      setSubmitting(false)
      return
    }

    // Product update succeeded — now apply staged image changes. None of
    // these failing should roll back the product changes above.
    const imageErrors = []

    // 1) Delete existing images explicitly marked for deletion
    const imagesToDelete = existingImages.filter((img) => pendingDeleteIds.has(img.id))
    for (const img of imagesToDelete) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await deleteProductImage({ ...img, productId })
      } catch (err) {
        console.error('Failed to delete image:', img.id, err.message)
        imageErrors.push('تعذر حذف احدى الصور')
      }
    }

    // 2) Upload newly staged images
    const remainingExisting = existingImages.filter((img) => !pendingDeleteIds.has(img.id))
    let nextSortOrder =
      remainingExisting.length > 0 ? Math.max(...remainingExisting.map((i) => i.sortOrder)) + 1 : 0

    // Map staged local id -> real uploaded image id, needed to resolve the
    // primary choice if it points at a staged image.
    const stagedIdToRealId = {}
    const failedUploads = []

    for (const staged of stagedImages) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const uploaded = await addProductImage(productId, staged.file, nextSortOrder, false)
        stagedIdToRealId[staged.id] = uploaded.id
        nextSortOrder += 1
      } catch (err) {
        console.error('Failed to upload staged image:', staged.file.name, err.message)
        failedUploads.push(staged.file.name)
      }
    }

    if (failedUploads.length > 0) {
      imageErrors.push(`تعذر رفع الصور التالية: ${failedUploads.join('، ')}`)
    }

    // 3) Apply the resolved primary image, if the choice still points at
    // something that actually exists after deletions/uploads.
    let finalPrimaryId = null
    if (primaryChoice?.type === 'existing' && !pendingDeleteIds.has(primaryChoice.id)) {
      finalPrimaryId = primaryChoice.id
    } else if (primaryChoice?.type === 'staged' && stagedIdToRealId[primaryChoice.id]) {
      finalPrimaryId = stagedIdToRealId[primaryChoice.id]
    }

    if (finalPrimaryId) {
      try {
        await setPrimaryImage(finalPrimaryId, productId)
      } catch (err) {
        console.error('Failed to set primary image:', err.message)
        imageErrors.push('تعذر تحديد الصورة الرئيسية')
      }
    }

    if (imageErrors.length > 0) {
      navigate('/admin/products', {
        state: {
          successMessage: 'تم حفظ التعديلات بنجاح',
          imageWarning: `تم تحديث المنتج ولكن تعذر رفع بعض الصور — ${imageErrors.join(' / ')}`,
        },
      })
      return
    }

    navigate('/admin/products', { state: { successMessage: 'تم حفظ التعديلات بنجاح' } })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    setImageWarning('')

    if (!validate()) return

    setSubmitting(true)

    if (isEditMode) {
      await handleEditSubmit()
    } else {
      await handleCreateSubmit()
    }
  }

  function handleCancel() {
    navigate('/admin/products')
  }

  const pageTitle = isEditMode ? 'تعديل المنتج' : 'اضافة منتج'
  const pageSubtitle = isEditMode
    ? 'تعديل معلومات المنتج وادارة صوره'
    : 'ادخل المعلومات الاساسية للمنتج ويمكن رفع الصور الان او لاحقا من صفحة ادارة الصور.'

  if (isEditMode && productLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-6 w-40 rounded bg-gray-100 animate-pulse" />
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    )
  }

  if (isEditMode && productLoadError) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-red-500 py-10 text-center">حدث خطا اثناء تحميل المنتج</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">{pageTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">{pageSubtitle}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* معلومات المنتج */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-900">معلومات المنتج</h3>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              اسم المنتج
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.name ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="مثال: طقم نسائي قطن"
            />
            {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
              الوصف
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-none"
              placeholder="وصف مختصر للمنتج (اختياري)"
            />
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1.5">
              السعر (د.ك)
            </label>
            <input
              id="price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                fieldErrors.price ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
              }`}
              placeholder="0.00"
            />
            {fieldErrors.price && <p className="text-xs text-red-500 mt-1">{fieldErrors.price}</p>}
          </div>
        </div>

        {/* التصنيف */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-gray-900">التصنيف</h3>

          {categoriesLoading ? (
            <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
          ) : categoriesError ? (
            <p className="text-sm text-red-500">تعذر تحميل التصنيفات، حاول تحديث الصفحة</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-400">
              لا توجد تصنيفات متاحة حاليا. يجب اضافة تصنيف واحد على الاقل قبل اضافة منتج.
            </p>
          ) : (
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1.5">
                اختيار التصنيف
              </label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none bg-white transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.categoryId ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
              >
                <option value="">اختر تصنيفا</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.categoryId}</p>
              )}
            </div>
          )}
        </div>

        {/* صور المنتج */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900">صور المنتج</h3>
            <p className="text-xs text-gray-400 mt-1">
              اختياري — يمكن رفع الصور الان او لاحقا من صفحة ادارة صور المنتج
            </p>
          </div>

          {imageSelectError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{imageSelectError}</span>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-brand-gold/60 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageInputChange}
              disabled={submitting}
              className="hidden"
              id="product-images-input"
            />
            <label
              htmlFor="product-images-input"
              className={`flex flex-col items-center gap-2 ${
                submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <UploadCloud size={24} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                اضغط لاختيار الصور او اسحبها هنا
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG, WEBP — حتى 5 ميجابايت لكل صورة
              </span>
            </label>
          </div>

          {/* Existing images (edit mode only) */}
          {isEditMode && existingImages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">الصور الحالية</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {existingImages.map((img) => {
                  const isPendingDelete = pendingDeleteIds.has(img.id)
                  const isPrimary = primaryChoice?.type === 'existing' && primaryChoice.id === img.id

                  return (
                    <div
                      key={img.id}
                      className={`relative aspect-square rounded-xl overflow-hidden border bg-gray-50 ${
                        isPendingDelete ? 'border-red-200 opacity-50' : 'border-gray-100'
                      }`}
                    >
                      <img
                        src={img.imageUrl}
                        alt="صورة المنتج"
                        className="w-full h-full object-cover"
                      />

                      {isPrimary && !isPendingDelete && (
                        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-brand-gold text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                          <Star size={9} fill="currentColor" />
                          <span>رئيسية</span>
                        </span>
                      )}

                      {isPendingDelete ? (
                        <button
                          type="button"
                          onClick={() => handleToggleDeleteExisting(img.id)}
                          disabled={submitting}
                          title="التراجع عن الحذف"
                          className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 bg-white/90 text-gray-700 text-[10px] font-medium py-1 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                        >
                          <RotateCcw size={10} />
                          <span>التراجع</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleDeleteExisting(img.id)}
                            disabled={submitting}
                            title="حذف الصورة"
                            className="absolute top-1.5 left-1.5 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-50 transition-colors"
                          >
                            <X size={12} />
                          </button>
                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary('existing', img.id)}
                              disabled={submitting}
                              title="تحديد كصورة رئيسية"
                              className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-center gap-1 bg-white/90 text-gray-700 text-[10px] font-medium py-1 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                            >
                              <Star size={10} />
                              <span>تحديد كرئيسية</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Newly staged images */}
          {stagedImages.length > 0 && (
            <div>
              {isEditMode && <p className="text-xs font-medium text-gray-500 mb-2">صور جديدة</p>}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {stagedImages.map((img) => {
                  const isPrimary = primaryChoice?.type === 'staged' && primaryChoice.id === img.id
                  return (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 bg-gray-50"
                    >
                      <img
                        src={img.previewUrl}
                        alt="معاينة الصورة"
                        className="w-full h-full object-cover"
                      />

                      {isPrimary && (
                        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-brand-gold text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
                          <Star size={9} fill="currentColor" />
                          <span>رئيسية</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveStagedImage(img.id)}
                        disabled={submitting}
                        title="ازالة الصورة"
                        className="absolute top-1.5 left-1.5 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-50 transition-colors"
                      >
                        <X size={12} />
                      </button>

                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary('staged', img.id)}
                          disabled={submitting}
                          title="تحديد كصورة رئيسية"
                          className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-center gap-1 bg-white/90 text-gray-700 text-[10px] font-medium py-1 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
                        >
                          <Star size={10} />
                          <span>تحديد كرئيسية</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {stagedImages.length === 0 && existingImages.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <ImageOff size={14} />
              <span>لم يتم اختيار اي صور بعد</span>
            </div>
          )}

          {imageWarning && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{imageWarning}</span>
            </div>
          )}
        </div>

        {/* الحالة */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-gray-900">الحالة</h3>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="isActive"
                checked={isActive === true}
                onChange={() => setIsActive(true)}
                className="accent-brand"
              />
              نشط
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="isActive"
                checked={isActive === false}
                onChange={() => setIsActive(false)}
                className="accent-brand"
              />
              غير نشط
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
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
              <span>{isEditMode ? 'حفظ التعديلات' : 'حفظ المنتج'}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}