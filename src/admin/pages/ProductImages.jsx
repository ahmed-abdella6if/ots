// Admin — manage a single product's images (upload, preview, primary, delete, reorder).
// Colors are a later stage: every image is added with color_id = null.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ImageOff,
  Loader2,
  Star,
  Trash2,
  UploadCloud,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { getProduct } from '../../services/productService'
import {
  getProductImages,
  addProductImage,
  deleteProductImage,
  setPrimaryImage,
  updateImageOrder,
} from '../../services/productImageService'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function ProductImages() {
  const { id: productId } = useParams()
  const fileInputRef = useRef(null)

  const [product, setProduct] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState([])
  const [successMessage, setSuccessMessage] = useState('')

  // Per-image busy state (delete / set-primary / reorder), keyed by image id
  const [busyImageIds, setBusyImageIds] = useState(new Set())

  const setImageBusy = useCallback((id, isBusy) => {
    setBusyImageIds((prev) => {
      const next = new Set(prev)
      if (isBusy) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [productData, imagesData] = await Promise.all([
        getProduct(productId),
        getProductImages(productId),
      ])
      setProduct(productData)
      setImages(imagesData)
    } catch (err) {
      console.error('Failed to load product images:', err.message)
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

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name}: نوع الملف غير مدعوم (JPG, PNG, WEBP فقط)`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: حجم الملف اكبر من 5 ميجابايت`
    }
    return null
  }

  async function handleFilesSelected(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    const errors = []
    const validFiles = []
    for (const file of files) {
      const err = validateFile(file)
      if (err) errors.push(err)
      else validFiles.push(file)
    }
    setUploadErrors(errors)

    if (validFiles.length === 0) return

    setUploading(true)
    let currentSortOrder = images.length > 0 ? Math.max(...images.map((i) => i.sortOrder)) + 1 : 0
    const hasExistingImages = images.length > 0
    const uploaded = []
    const failed = []

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const isFirstImageOverall = !hasExistingImages && uploaded.length === 0
      try {
        // eslint-disable-next-line no-await-in-loop
        const newImage = await addProductImage(productId, file, currentSortOrder, isFirstImageOverall)
        uploaded.push(newImage)
        currentSortOrder += 1
      } catch (err) {
        console.error('Failed to upload image:', file.name, err.message)
        failed.push(`${file.name}: تعذر رفع الصورة`)
      }
    }

    if (uploaded.length > 0) {
      setImages((prev) => [...prev, ...uploaded].sort((a, b) => a.sortOrder - b.sortOrder))
      setSuccessMessage(
        uploaded.length === 1 ? 'تم رفع الصورة بنجاح' : `تم رفع ${uploaded.length} صور بنجاح`
      )
    }
    if (failed.length > 0) {
      setUploadErrors((prev) => [...prev, ...failed])
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileInputChange(e) {
    handleFilesSelected(e.target.files)
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFilesSelected(e.dataTransfer.files)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  async function handleDelete(image) {
    if (!window.confirm('هل تريد حذف هذه الصورة؟')) return

    setImageBusy(image.id, true)
    try {
      await deleteProductImage(image)
      // Reload from the server so primary re-assignment (if this was the
      // primary image) is reflected correctly.
      const refreshed = await getProductImages(productId)
      setImages(refreshed)
      setSuccessMessage('تم حذف الصورة')
    } catch (err) {
      console.error('Failed to delete image:', err.message)
      setUploadErrors([`تعذر حذف الصورة: ${image.imageUrl}`])
    } finally {
      setImageBusy(image.id, false)
    }
  }

  async function handleSetPrimary(image) {
    if (image.isPrimary) return

    setImageBusy(image.id, true)
    try {
      await setPrimaryImage(image.id, productId)
      setImages((prev) =>
        prev.map((img) => ({ ...img, isPrimary: img.id === image.id }))
      )
      setSuccessMessage('تم تحديد الصورة الرئيسية')
    } catch (err) {
      console.error('Failed to set primary image:', err.message)
      setUploadErrors(['تعذر تحديد الصورة الرئيسية'])
    } finally {
      setImageBusy(image.id, false)
    }
  }

  async function handleMove(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= images.length) return

    const reordered = [...images]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    // Reassign sort_order sequentially based on new array position
    const withNewOrder = reordered.map((img, i) => ({ ...img, sortOrder: i }))

    setImages(withNewOrder)
    setImageBusy(moved.id, true)
    try {
      await updateImageOrder(withNewOrder.map((img) => ({ id: img.id, sortOrder: img.sortOrder })))
    } catch (err) {
      console.error('Failed to reorder images:', err.message)
      setUploadErrors(['تعذر حفظ الترتيب الجديد'])
      loadData() // fall back to server state on failure
    } finally {
      setImageBusy(moved.id, false)
    }
  }

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
          صور المنتج {product ? `— ${product.name}` : ''}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          رفع وادارة صور المنتج. يمكن تحديد الصورة الرئيسية وترتيب الصور.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-500 py-10 text-center">
          حدث خطا اثناء تحميل بيانات المنتج
        </p>
      ) : (
        <div className="space-y-6">
          {successMessage && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {uploadErrors.length > 0 && (
            <div className="space-y-1.5">
              {uploadErrors.map((msg, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Upload dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-6 sm:p-8 text-center hover:border-brand-gold/60 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileInputChange}
              disabled={uploading}
              className="hidden"
              id="image-upload-input"
            />
            <label
              htmlFor="image-upload-input"
              className={`flex flex-col items-center gap-2 ${
                uploading ? 'cursor-wait opacity-60' : 'cursor-pointer'
              }`}
            >
              {uploading ? (
                <Loader2 size={28} className="text-brand-gold animate-spin" />
              ) : (
                <UploadCloud size={28} className="text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-700">
                {uploading ? '...جاري الرفع' : 'اضغط لاختيار الصور او اسحبها هنا'}
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG, WEBP — حتى 5 ميجابايت لكل صورة
              </span>
            </label>
          </div>

          {/* Images grid */}
          {images.length === 0 ? (
            <div className="py-10 text-center">
              <ImageOff size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">لا توجد صور مضافة لهذا المنتج بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((image, index) => {
                const isBusy = busyImageIds.has(image.id)
                return (
                  <div
                    key={image.id}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="aspect-square bg-gray-50 relative">
                      <img
                        src={image.imageUrl}
                        alt="صورة المنتج"
                        className="w-full h-full object-cover"
                      />
                      {image.isPrimary && (
                        <span className="absolute top-2 right-2 flex items-center gap-1 bg-brand-gold text-white text-xs font-medium px-2 py-1 rounded-full">
                          <Star size={11} fill="currentColor" />
                          <span>رئيسية</span>
                        </span>
                      )}
                      {isBusy && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                          <Loader2 size={20} className="animate-spin text-gray-500" />
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(index, -1)}
                          disabled={isBusy || index === 0}
                          title="تحريك للاعلى"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, 1)}
                          disabled={isBusy || index === images.length - 1}
                          title="تحريك للاسفل"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(image)}
                          disabled={isBusy || image.isPrimary}
                          title="تحديد كصورة رئيسية"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Star size={15} className={image.isPrimary ? 'fill-brand-gold text-brand-gold' : ''} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(image)}
                          disabled={isBusy}
                          title="حذف الصورة"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}