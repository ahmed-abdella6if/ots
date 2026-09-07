// Admin — manage a single product's images (upload, preview, primary, delete, reorder).
//
// STAGE 31 — images are now grouped by color when the product has colors
// (product_images.color_id, present in the schema since Stage 8/9 — no
// migration needed here, see productImageService.js). Each color gets its
// own upload dropzone + gallery grid, so the admin always knows exactly
// which color an image belongs to. Products with NO colors defined render
// exactly the same single flat gallery as before this stage (colorId
// always null on upload) — zero behavior change for that case.
//
// "Primary" stays a single, product-wide flag (used by ProductCard/order
// thumbnails elsewhere, which don't do color selection — see Stage 31
// brief section 11) — any image in any color group can be set as the
// product's primary image, same mechanism as before.
//
// Reorder (move up/down) is scoped to WITHIN a color group: sort_order
// only needs to be meaningful among images of the same color, since the
// customer Product page already filters by color_id before sorting (see
// ProductPage.jsx's `displayImages` — untouched by this stage). Two
// different colors' images can freely share sort_order values.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { getProductColors } from '../../services/productVariantService'
import {
  getProductImages,
  addProductImage,
  deleteProductImage,
  setPrimaryImage,
  updateImageOrder,
} from '../../services/productImageService'
import { useLanguage } from '../../hooks/useLanguage'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const GENERAL_KEY = '__general__'

export default function ProductImages() {
  const { id: productId } = useParams()
  const { t, dir } = useLanguage()

  const [product, setProduct] = useState(null)
  const [colors, setColors] = useState([])
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [uploadErrors, setUploadErrors] = useState([])
  const [successMessage, setSuccessMessage] = useState('')

  // Per-group upload state (keyed by colorId, or GENERAL_KEY) so uploading
  // to one color doesn't disable the others' dropzones.
  const [uploadingGroups, setUploadingGroups] = useState(new Set())
  // Per-image busy state (delete / set-primary / reorder), keyed by image id
  const [busyImageIds, setBusyImageIds] = useState(new Set())

  const setGroupUploading = useCallback((key, isUploading) => {
    setUploadingGroups((prev) => {
      const next = new Set(prev)
      if (isUploading) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

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
      const [productData, colorsData, imagesData] = await Promise.all([
        getProduct(productId),
        getProductColors(productId),
        getProductImages(productId),
      ])
      setProduct(productData)
      setColors(colorsData)
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

  const hasColors = colors.length > 0

  // Group images by color_id (null -> "general" bucket). Each group is its
  // own independently-sorted array — see the reorder note above for why
  // that's safe even though sort_order isn't globally unique.
  const imagesByGroup = useMemo(() => {
    const map = new Map()
    for (const img of images) {
      const key = img.colorId || GENERAL_KEY
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(img)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [images])

  const generalImages = imagesByGroup.get(GENERAL_KEY) || []

  function validateFile(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name}: ${t('adminImages.invalidType')}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: ${t('adminImages.tooLarge')}`
    }
    return null
  }

  // colorId is null for the "no colors on this product" case and for the
  // legacy general-images fallback section (which doesn't offer uploads —
  // see the JSX below).
  async function handleFilesSelected(fileList, colorId, groupKey) {
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

    setGroupUploading(groupKey, true)

    // "First image overall" (product-wide, across all colors) still
    // becomes primary automatically, same as before this stage.
    const hasExistingImages = images.length > 0
    // Sort order is scoped to this color's own existing images.
    const groupImages = imagesByGroup.get(groupKey) || []
    let currentSortOrder = groupImages.length > 0 ? Math.max(...groupImages.map((i) => i.sortOrder)) + 1 : 0

    const uploaded = []
    const failed = []

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const isFirstImageOverall = !hasExistingImages && uploaded.length === 0
      try {
        // eslint-disable-next-line no-await-in-loop
        const newImage = await addProductImage(productId, file, currentSortOrder, isFirstImageOverall, colorId)
        uploaded.push(newImage)
        currentSortOrder += 1
      } catch (err) {
        console.error('Failed to upload image:', file.name, err.message)
        failed.push(`${file.name}: ${t('adminImages.uploadFailed')}`)
      }
    }

    if (uploaded.length > 0) {
      setImages((prev) => [...prev, ...uploaded])
      setSuccessMessage(
        uploaded.length === 1 ? t('adminImages.uploadedOne') : t('adminImages.uploadedMany', { count: uploaded.length })
      )
    }
    if (failed.length > 0) {
      setUploadErrors((prev) => [...prev, ...failed])
    }

    setGroupUploading(groupKey, false)
  }

  async function handleDelete(image) {
    if (!window.confirm(t('adminImages.confirmDelete'))) return

    setImageBusy(image.id, true)
    try {
      await deleteProductImage(image)
      // Reload from the server so primary re-assignment (if this was the
      // primary image) is reflected correctly.
      const refreshed = await getProductImages(productId)
      setImages(refreshed)
      setSuccessMessage(t('adminImages.deleted'))
    } catch (err) {
      console.error('Failed to delete image:', err.message)
      setUploadErrors([`${t('adminImages.deleteFailed')}: ${image.imageUrl}`])
    } finally {
      setImageBusy(image.id, false)
    }
  }

  async function handleSetPrimary(image) {
    if (image.isPrimary) return

    setImageBusy(image.id, true)
    try {
      await setPrimaryImage(image.id, productId)
      setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === image.id })))
      setSuccessMessage(t('adminImages.primarySet'))
    } catch (err) {
      console.error('Failed to set primary image:', err.message)
      setUploadErrors([t('adminImages.primaryFailed')])
    } finally {
      setImageBusy(image.id, false)
    }
  }

  // Reorders WITHIN one color group only — `groupImages` is that group's
  // own sorted array, `index` is the position within it.
  async function handleMove(groupImages, index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= groupImages.length) return

    const reordered = [...groupImages]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    const withNewOrder = reordered.map((img, i) => ({ ...img, sortOrder: i }))
    const idToNewOrder = new Map(withNewOrder.map((img) => [img.id, img.sortOrder]))

    setImages((prev) => prev.map((img) => (idToNewOrder.has(img.id) ? { ...img, sortOrder: idToNewOrder.get(img.id) } : img)))
    setImageBusy(moved.id, true)
    try {
      await updateImageOrder(withNewOrder.map((img) => ({ id: img.id, sortOrder: img.sortOrder })))
    } catch (err) {
      console.error('Failed to reorder images:', err.message)
      setUploadErrors([t('adminImages.reorderFailed')])
      loadData() // fall back to server state on failure
    } finally {
      setImageBusy(moved.id, false)
    }
  }

  // ---------------------------------------------------------------------
  // Reusable group renderer — one color's (or the general/no-colors) upload
  // dropzone + image grid. Rendering this the same way for every group
  // (including the "no colors on this product" case) keeps the UI
  // consistent instead of maintaining two separate layouts.
  // ---------------------------------------------------------------------
  function renderGroup({ key, title, hexCode, colorIdForUpload, allowUpload, images: groupImages, emptyHint }) {
    const isUploading = uploadingGroups.has(key)

    return (
      <div key={key} className="space-y-3">
        {title && (
          <div className="flex items-center gap-2">
            {hexCode && (
              <span
                className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: hexCode }}
              />
            )}
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          </div>
        )}

        {allowUpload && (
          <div
            onDrop={(e) => {
              e.preventDefault()
              handleFilesSelected(e.dataTransfer.files, colorIdForUpload, key)
            }}
            onDragOver={(e) => e.preventDefault()}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-5 sm:p-6 text-center hover:border-brand-gold/60 transition-colors"
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                handleFilesSelected(e.target.files, colorIdForUpload, key)
                e.target.value = ''
              }}
              disabled={isUploading}
              className="hidden"
              id={`image-upload-${key}`}
            />
            <label
              htmlFor={`image-upload-${key}`}
              className={`flex flex-col items-center gap-2 ${isUploading ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
            >
              {isUploading ? (
                <Loader2 size={24} className="text-brand-gold animate-spin" />
              ) : (
                <UploadCloud size={24} className="text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-700">
                {isUploading ? t('adminImages.uploading') : t('adminImages.dropHint')}
              </span>
              <span className="text-xs text-gray-400">{t('adminImages.sizeHint')}</span>
            </label>
          </div>
        )}

        {groupImages.length === 0 ? (
          <div className="py-6 text-center bg-gray-50/60 rounded-2xl">
            <ImageOff size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-400 text-xs">{emptyHint}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {groupImages.map((image, index) => {
              const isBusy = busyImageIds.has(image.id)
              return (
                <div
                  key={image.id}
                  className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="aspect-square bg-gray-50 relative">
                    <img src={image.imageUrl} alt={title || ''} className="w-full h-full object-cover" />
                    {image.isPrimary && (
                      <span className={`absolute top-2 ${dir === 'rtl' ? 'right-2' : 'left-2'} flex items-center gap-1 bg-brand-gold text-white text-xs font-medium px-2 py-1 rounded-full`}>
                        <Star size={11} fill="currentColor" />
                        <span>{t('adminImages.primary')}</span>
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
                        onClick={() => handleMove(groupImages, index, -1)}
                        disabled={isBusy || index === 0}
                        title={t('adminImages.moveUp')}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(groupImages, index, 1)}
                        disabled={isBusy || index === groupImages.length - 1}
                        title={t('adminImages.moveDown')}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(image)}
                        disabled={isBusy || image.isPrimary}
                        title={t('adminImages.setPrimary')}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Star size={15} className={image.isPrimary ? 'fill-brand-gold text-brand-gold' : ''} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(image)}
                        disabled={isBusy}
                        title={t('adminImages.deleteImage')}
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
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowRight size={16} className={dir === 'ltr' ? 'rotate-180' : ''} />
          <span>{t('adminImages.backToProducts')}</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900">
          {t('adminImages.pageTitle')} {product ? `— ${product.nameAr || product.nameEn || product.name}` : ''}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {hasColors ? t('adminImages.pageHintWithColors') : t('adminImages.pageHintNoColors')}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-500 py-10 text-center">{t('adminImages.loadError')}</p>
      ) : (
        <div className="space-y-8">
          {successMessage && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {uploadErrors.length > 0 && (
            <div className="space-y-1.5">
              {uploadErrors.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {hasColors ? (
            <>
              {colors.map((color) =>
                renderGroup({
                  key: color.id,
                  title: `${t('adminImages.colorImages')} — ${color.name}`,
                  hexCode: color.hexCode,
                  colorIdForUpload: color.id,
                  allowUpload: true,
                  images: imagesByGroup.get(color.id) || [],
                  emptyHint: t('adminImages.noImagesYet'),
                })
              )}

              {/* STAGE 31 (section 9) — legacy color_id=null images kept
                  visible (not silently hidden) so nothing looks lost, but
                  no new uploads go here once the product has colors — new
                  images should be assigned to a color going forward. */}
              {generalImages.length > 0 &&
                renderGroup({
                  key: GENERAL_KEY,
                  title: t('adminImages.generalImages'),
                  hexCode: null,
                  colorIdForUpload: null,
                  allowUpload: false,
                  images: generalImages,
                  emptyHint: '',
                })}
              {generalImages.length > 0 && (
                <p className="text-xs text-gray-400 -mt-6">{t('adminImages.generalImagesHint')}</p>
              )}
            </>
          ) : (
            // No colors on this product — identical single flat gallery to
            // before this stage (colorId stays null on upload).
            renderGroup({
              key: GENERAL_KEY,
              title: null,
              hexCode: null,
              colorIdForUpload: null,
              allowUpload: true,
              images: generalImages,
              emptyHint: t('adminImages.noImagesYetProduct'),
            })
          )}
        </div>
      )}
    </div>
  )
}