// Supabase Storage helpers for uploading/reading product & category images.
// Uses the existing "product-images" and "site-assets" buckets only (both
// already created by schema.sql) — no bucket creation or policy changes
// happen here.

import { supabase } from '../lib/supabaseClient'

const PRODUCT_IMAGES_BUCKET = 'product-images'
const SITE_ASSETS_BUCKET = 'site-assets'

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeFileName(fileName) {
  // Keeps the extension, strips anything that isn't safe in a storage path
  // (spaces, Arabic text, special chars) so the object key stays predictable.
  const lastDot = fileName.lastIndexOf('.')
  const ext = lastDot !== -1 ? fileName.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return ext ? `image.${ext}` : 'image'
}

/**
 * Uploads a single image file to Supabase Storage under:
 *   product-images/{productId}/{uuid}-{filename}
 *
 * @param {string} productId
 * @param {File} file
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
export async function uploadProductImage(productId, file) {
  const path = `${productId}/${generateId()}-${sanitizeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)

  return { path, publicUrl: data.publicUrl }
}

/**
 * Deletes a file from the product-images bucket given its storage path
 * (e.g. "{productId}/{uuid}-photo.jpg", not the full public URL).
 * @param {string} path
 */
export async function deleteProductImageFile(path) {
  if (!path) return
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path])
  if (error) throw error
}

/**
 * Derives the storage object path from a public URL produced by this bucket,
 * so we can delete the underlying file when a product_images row is removed.
 * @param {string} publicUrl
 * @returns {string|null}
 */
export function getStoragePathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null
  const marker = `/object/public/${PRODUCT_IMAGES_BUCKET}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length))
}

// ---------------------------------------------------------------------
// site-assets bucket — hero images, homepage banners, logo, etc.
// (Same upload/delete pattern as product-images above, different bucket —
// the "site-assets" bucket already exists in schema.sql and was unused
// until this stage.)
// ---------------------------------------------------------------------

/**
 * Uploads a single image file to Supabase Storage under:
 *   site-assets/{folder}/{uuid}-{filename}
 *
 * @param {string} folder e.g. "hero" or "banners"
 * @param {File} file
 * @returns {Promise<{ path: string, publicUrl: string }>}
 */
export async function uploadSiteAsset(folder, file) {
  const path = `${folder}/${generateId()}-${sanitizeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path)

  return { path, publicUrl: data.publicUrl }
}

/**
 * Deletes a file from the site-assets bucket given its storage path.
 * @param {string} path
 */
export async function deleteSiteAssetFile(path) {
  if (!path) return
  const { error } = await supabase.storage.from(SITE_ASSETS_BUCKET).remove([path])
  if (error) throw error
}

/**
 * Derives the storage object path from a site-assets public URL, so a
 * previously uploaded hero/banner image can be deleted when replaced.
 * @param {string} publicUrl
 * @returns {string|null}
 */
export function getSiteAssetPathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null
  const marker = `/object/public/${SITE_ASSETS_BUCKET}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length))
}