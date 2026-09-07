// Product colors / sizes / variants (stock) queries — kept separate from UI components.
// Uses the existing product_colors, product_sizes, and product_variants tables and RLS only
// (no schema changes — see supabase/schema.sql for constraints referenced below).

import { supabase } from '../lib/supabaseClient'

const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(err) {
  return err?.code === UNIQUE_VIOLATION
}

// ---------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------

/**
 * Fetches a product's colors, ordered for display.
 * Columns used: product_colors(id, product_id, name, hex_code, sort_order)
 */
export async function getProductColors(productId) {
  const { data, error } = await supabase
    .from('product_colors')
    .select('id, name, hex_code, sort_order, is_active')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    hexCode: c.hex_code,
    sortOrder: c.sort_order,
    isActive: c.is_active,
  }))
}

/**
 * Fetches active-status flags for a set of colors by id — used by
 * checkout's validateCartForCheckout to check whether a cart line's color
 * has since been marked out of stock, for cart lines that have no specific
 * variant_id (an "unlimited stock" combo — see createVariant/colors docs
 * below).
 * @param {string[]} colorIds
 */
export async function getColorsByIds(colorIds) {
  if (!colorIds || colorIds.length === 0) return []

  const { data, error } = await supabase
    .from('product_colors')
    .select('id, is_active')
    .in('id', colorIds)

  if (error) throw error
  return (data || []).map((c) => ({ id: c.id, isActive: c.is_active }))
}

/**
 * Toggles a color's active status. Unlike a product_variants row (which
 * tracks stock for one specific color+size combination), this applies to
 * the color across EVERY size at once — an admin no longer has to create a
 * zero-stock variant for each of that color's sizes just to mark the whole
 * color unavailable. See ProductPage.jsx (colorAvailable) and
 * orderService.validateCartForCheckout for where this is enforced.
 * @param {string} colorId
 * @param {boolean} isActive
 */
export async function setColorActive(colorId, isActive) {
  const { data, error } = await supabase
    .from('product_colors')
    .update({ is_active: isActive })
    .eq('id', colorId)
    .select('id, is_active')
    .single()

  if (error) throw error
  return { id: data.id, isActive: data.is_active }
}

/**
 * Adds a color to a product. product_colors has a unique(product_id, name)
 * constraint — a duplicate name is surfaced as err.isDuplicate so the UI
 * can show a friendly message instead of a raw Postgres error.
 */
export async function createColor(productId, { name, hexCode }) {
  const { data, error } = await supabase
    .from('product_colors')
    .insert({
      product_id: productId,
      name: name.trim(),
      hex_code: hexCode || null,
    })
    .select()
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      const dup = new Error('Color name already exists for this product')
      dup.isDuplicate = true
      throw dup
    }
    throw error
  }

  return { id: data.id, name: data.name, hexCode: data.hex_code, sortOrder: data.sort_order }
}

/**
 * Deletes a color. product_variants.color_id and product_images.color_id both
 * reference product_colors with ON DELETE CASCADE, so this also removes any
 * variants and color-specific images tied to it — the caller must warn the
 * admin before calling this.
 */
export async function deleteColor(colorId) {
  const { error } = await supabase.from('product_colors').delete().eq('id', colorId)
  if (error) throw error
}

// ---------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------

/**
 * Fetches a product's sizes, ordered for display.
 * Columns used: product_sizes(id, product_id, name, sort_order)
 */
export async function getProductSizes(productId) {
  const { data, error } = await supabase
    .from('product_sizes')
    .select('id, name, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data || []).map((s) => ({ id: s.id, name: s.name, sortOrder: s.sort_order }))
}

/**
 * Adds a size to a product. product_sizes has a unique(product_id, name)
 * constraint — a duplicate name is surfaced as err.isDuplicate.
 */
export async function createSize(productId, { name }) {
  const { data, error } = await supabase
    .from('product_sizes')
    .insert({ product_id: productId, name: name.trim() })
    .select()
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      const dup = new Error('Size name already exists for this product')
      dup.isDuplicate = true
      throw dup
    }
    throw error
  }

  return { id: data.id, name: data.name, sortOrder: data.sort_order }
}

/**
 * Deletes a size. product_variants.size_id references product_sizes with
 * ON DELETE CASCADE, so this also removes any variants built on it — the
 * caller must warn the admin before calling this.
 */
export async function deleteSize(sizeId) {
  const { error } = await supabase.from('product_sizes').delete().eq('id', sizeId)
  if (error) throw error
}

// ---------------------------------------------------------------------
// Variants (color + size combination, independent stock)
// ---------------------------------------------------------------------

/**
 * Fetches a product's variants joined with their color/size names.
 * Columns used: product_variants(id, color_id, size_id, stock_quantity, is_active),
 * product_colors(name), product_sizes(name)
 */
export async function getProductVariants(productId) {
  const { data, error } = await supabase
    .from('product_variants')
    .select(
      `id, stock_quantity, is_active,
       color:product_colors(id, name),
       size:product_sizes(id, name)`
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map((v) => ({
    id: v.id,
    colorId: v.color?.id || null,
    colorName: v.color?.name || '—',
    sizeId: v.size?.id || null,
    sizeName: v.size?.name || '—',
    stockQuantity: v.stock_quantity,
    isActive: v.is_active,
  }))
}

/**
 * Creates a color+size variant with an initial stock quantity.
 * product_variants has a unique(product_id, color_id, size_id) constraint —
 * a duplicate combination is surfaced as err.isDuplicate. A database trigger
 * also enforces that the color and size both belong to this same product.
 */
export async function createVariant(productId, { colorId, sizeId, stockQuantity }) {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      color_id: colorId,
      size_id: sizeId,
      stock_quantity: stockQuantity,
    })
    .select()
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      const dup = new Error('This color/size combination already exists')
      dup.isDuplicate = true
      throw dup
    }
    throw error
  }

  return { id: data.id, stockQuantity: data.stock_quantity, isActive: data.is_active }
}

/**
 * Updates a variant's stock quantity only.
 */
export async function updateVariantStock(variantId, stockQuantity) {
  const { data, error } = await supabase
    .from('product_variants')
    .update({ stock_quantity: stockQuantity })
    .eq('id', variantId)
    .select()
    .single()

  if (error) throw error
  return { id: data.id, stockQuantity: data.stock_quantity, isActive: data.is_active }
}

/**
 * Toggles a variant's active flag (does not delete it or affect stock).
 */
export async function setVariantActive(variantId, isActive) {
  const { data, error } = await supabase
    .from('product_variants')
    .update({ is_active: isActive })
    .eq('id', variantId)
    .select()
    .single()

  if (error) throw error
  return { id: data.id, stockQuantity: data.stock_quantity, isActive: data.is_active }
}

/**
 * Deletes a single variant (does not affect the parent color or size).
 */
export async function deleteVariant(variantId) {
  const { error } = await supabase.from('product_variants').delete().eq('id', variantId)
  if (error) throw error
}

// ---------------------------------------------------------------------
// Checkout support (Stage 15) — trusted re-read of specific variants by id
// ---------------------------------------------------------------------

/**
 * Fetches specific variants by id, including their live stock, active
 * status, per-variant price override, and parent product id — used by
 * checkout to re-validate cart lines against trusted database values
 * instead of whatever was cached in localStorage.
 * @param {string[]} ids
 */
export async function getVariantsByIds(ids) {
  if (!ids || ids.length === 0) return []

  const { data, error } = await supabase
    .from('product_variants')
    .select(
      `id, product_id, stock_quantity, price_override, is_active,
       color:product_colors(name),
       size:product_sizes(name)`
    )
    .in('id', ids)

  if (error) throw error

  return (data || []).map((v) => ({
    id: v.id,
    productId: v.product_id,
    stockQuantity: v.stock_quantity,
    priceOverride: v.price_override,
    isActive: v.is_active,
    colorName: v.color?.name || null,
    sizeName: v.size?.name || null,
  }))
}