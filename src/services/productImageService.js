// product_images row queries — kept separate from UI components.
// Uses the existing product_images table and RLS only (no schema changes).
// color_id is always null at this stage (colors are a later stage).

import { supabase } from '../lib/supabaseClient'
import { uploadProductImage, deleteProductImageFile, getStoragePathFromPublicUrl } from './storageService'

/**
 * Fetches all images for a product, ordered by sort_order.
 * @param {string} productId
 */
export async function getProductImages(productId) {
  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, color_id, image_url, sort_order, is_primary, created_at')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((img) => ({
    id: img.id,
    productId: img.product_id,
    colorId: img.color_id,
    imageUrl: img.image_url,
    sortOrder: img.sort_order,
    isPrimary: img.is_primary,
    createdAt: img.created_at,
  }))
}

/**
 * Uploads a file to Storage and inserts the matching product_images row.
 * The first image ever added to a product is automatically set as primary.
 *
 * @param {string} productId
 * @param {File} file
 * @param {number} nextSortOrder
 * @param {boolean} isFirstImage
 */
export async function addProductImage(productId, file, nextSortOrder, isFirstImage) {
  const { publicUrl } = await uploadProductImage(productId, file)

  const { data, error } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      color_id: null,
      image_url: publicUrl,
      sort_order: nextSortOrder,
      is_primary: isFirstImage,
    })
    .select()
    .single()

  if (error) {
    // Roll back the uploaded file if the DB insert fails, so we don't leave orphans.
    await deleteProductImageFile(getStoragePathFromPublicUrl(publicUrl)).catch(() => {})
    throw error
  }

  return {
    id: data.id,
    productId: data.product_id,
    colorId: data.color_id,
    imageUrl: data.image_url,
    sortOrder: data.sort_order,
    isPrimary: data.is_primary,
    createdAt: data.created_at,
  }
}

/**
 * Deletes a product image: removes the DB row and the underlying storage file.
 * If the deleted image was primary and other images remain, promotes the next
 * one (lowest sort_order) to primary.
 *
 * @param {{ id: string, imageUrl: string, isPrimary: boolean, productId: string }} image
 */
export async function deleteProductImage(image) {
  const { error } = await supabase.from('product_images').delete().eq('id', image.id)
  if (error) throw error

  await deleteProductImageFile(getStoragePathFromPublicUrl(image.imageUrl)).catch((err) => {
    // DB row is already gone; log but don't fail the whole operation over an
    // orphaned storage file (safe to clean up later, isn't user-visible).
    console.error('Failed to delete storage file for image:', err.message)
  })

  if (image.isPrimary) {
    const remaining = await getProductImages(image.productId)
    if (remaining.length > 0) {
      await setPrimaryImage(remaining[0].id, image.productId)
    }
  }
}

/**
 * Sets one image as primary and unsets is_primary on all other images of
 * the same product (two writes — no DB-level transaction available from
 * the client, but each write is scoped and idempotent if retried).
 *
 * @param {string} imageId
 * @param {string} productId
 */
export async function setPrimaryImage(imageId, productId) {
  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .neq('id', imageId)

  if (clearError) throw clearError

  const { error: setError } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId)

  if (setError) throw setError
}

/**
 * Persists a new image order after a move-up/move-down reorder.
 * @param {{ id: string, sortOrder: number }[]} orderedImages
 */
export async function updateImageOrder(orderedImages) {
  const results = await Promise.all(
    orderedImages.map((img) =>
      supabase.from('product_images').update({ sort_order: img.sortOrder }).eq('id', img.id)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}