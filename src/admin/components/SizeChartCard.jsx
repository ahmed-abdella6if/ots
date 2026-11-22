// Admin — per-product size chart. Lives on the product's Colors & Sizes page.
//
// Three choices, each saved immediately (independent of the main product form):
//   - default : no custom chart; the storefront shows the category's built-in
//               chart (men / women / boys / girls), if the category has one
//   - custom  : an image the admin uploads for this product only
//   - none    : this product shows no size guide at all
//
// Images go to the existing product-images bucket via storageService; the
// replaced/removed file is deleted so storage doesn't pile up.

import { useRef, useState } from 'react'
import { Ruler, Loader2, UploadCloud } from 'lucide-react'
import { setProductSizeChart } from '../../services/productService'
import {
  uploadProductImage,
  deleteProductImageFile,
  getStoragePathFromPublicUrl,
} from '../../services/storageService'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const OPTIONS = [
  { value: 'default', label: 'الافتراضي حسب القسم', hint: 'يظهر دليل المقاسات الخاص بالقسم (رجالي / نسائي / اولاد / بنات) ان وجد' },
  { value: 'custom', label: 'صورة خاصة بهذا المنتج', hint: 'ارفع جدول مقاسات مخصص لهذا المنتج فقط' },
  { value: 'none', label: 'بدون دليل مقاسات', hint: 'لن يظهر زر دليل المقاسات لهذا المنتج' },
]

function modeOf(product) {
  if (product.hideSizeChart) return 'none'
  if (product.sizeChartUrl) return 'custom'
  return 'default'
}

export default function SizeChartCard({ product, onProductChange, onSuccess, onError }) {
  const [mode, setMode] = useState(modeOf(product))
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef(null)

  // Best-effort cleanup of a replaced/removed chart file — never blocks the
  // save itself (an orphaned file isn't user-visible).
  async function removeOldFile(url) {
    const path = getStoragePathFromPublicUrl(url)
    if (!path) return
    try {
      await deleteProductImageFile(path)
    } catch (err) {
      console.error('Failed to delete old size chart file:', err.message)
    }
  }

  async function save(next, successMessage) {
    setBusy(true)
    try {
      await setProductSizeChart(product.id, next)
      onProductChange({ ...product, ...next })
      onSuccess(successMessage)
      return true
    } catch (err) {
      console.error('Failed to save size chart:', err.message)
      onError('تعذر حفظ دليل المقاسات')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleModeChange(next) {
    if (busy || next === mode) return
    const previousUrl = product.sizeChartUrl

    if (next === 'custom') {
      // Nothing to save until an image is uploaded; if one already exists
      // (mode was switched away and back) it was cleared, so just prompt.
      setMode('custom')
      return
    }

    const ok = await save(
      { sizeChartUrl: null, hideSizeChart: next === 'none' },
      next === 'none' ? 'تم اخفاء دليل المقاسات لهذا المنتج' : 'تم استخدام دليل المقاسات الافتراضي للقسم'
    )
    if (ok) {
      setMode(next)
      if (previousUrl) removeOldFile(previousUrl)
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError('نوع الملف غير مدعوم، استخدم JPG او PNG او WEBP')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      onError('حجم الصورة اكبر من 5 ميجابايت')
      return
    }

    const previousUrl = product.sizeChartUrl
    setBusy(true)
    let uploaded = null
    try {
      uploaded = await uploadProductImage(product.id, file)
    } catch (err) {
      console.error('Size chart upload failed:', err.message)
      onError('تعذر رفع الصورة')
      setBusy(false)
      return
    }

    const ok = await save({ sizeChartUrl: uploaded.publicUrl, hideSizeChart: false }, 'تم حفظ دليل المقاسات')
    if (ok) {
      setMode('custom')
      if (previousUrl) removeOldFile(previousUrl)
    } else {
      // The row wasn't updated, so don't leave the new file orphaned.
      removeOldFile(uploaded.publicUrl)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Ruler size={18} className="text-brand-gold" />
        <h3 className="font-bold text-gray-900">دليل المقاسات (جدول المقاسات)</h3>
      </div>

      <div className="space-y-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
              mode === opt.value ? 'border-brand-gold bg-brand-light/40' : 'border-gray-200 hover:bg-gray-50'
            } ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="size-chart-mode"
              value={opt.value}
              checked={mode === opt.value}
              disabled={busy}
              onChange={() => handleModeChange(opt.value)}
              className="mt-1 accent-brand-gold"
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">{opt.label}</span>
              <span className="block text-xs text-gray-400 mt-0.5">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="space-y-3">
          {product.sizeChartUrl && (
            <img
              src={product.sizeChartUrl}
              alt="دليل المقاسات"
              className="max-h-72 w-auto rounded-xl border border-gray-100"
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 bg-brand text-white rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
            <span>{product.sizeChartUrl ? 'استبدال الصورة' : 'رفع صورة جدول المقاسات'}</span>
          </button>
          {!product.sizeChartUrl && (
            <p className="text-xs text-amber-700">
              لم يتم رفع صورة بعد — حتى ترفع صورة سيظهر الدليل الافتراضي للقسم.
            </p>
          )}
          <p className="text-xs text-gray-400">JPG او PNG او WEBP، حتى 5 ميجابايت.</p>
        </div>
      )}
    </div>
  )
}
