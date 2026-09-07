// Product queries — kept separate from UI components.
// Uses the existing Supabase client and existing schema/RLS only (no new tables/columns).

import { supabase } from '../lib/supabaseClient'

// Shared mapping for product_colors joined onto a product listing row —
// used by product-card views so the customer can see color options before
// clicking into the product detail page.
function mapColors(colors) {
  return [...(colors || [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c) => ({ id: c.id, name: c.name, hexCode: c.hex_code }))
}

/**
 * Fetches all products for the Admin Products list, joined with their category
 * name and a representative image (primary image if set, otherwise the first
 * uploaded image).
 *
 * Columns used: products(id, name, base_price, is_active, created_at, category_id),
 * categories(id, name), product_images(product_id, image_url, is_primary, sort_order)
 */
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, name_en, base_price, is_active, is_bestseller, created_at,
       category:categories(id, name),
       images:product_images(image_url, is_primary, sort_order)`
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((product) => {
    const images = product.images || []
    const primary = images.find((img) => img.is_primary)
    const fallback = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
    const image = primary || fallback

    return {
      id: product.id,
      name: product.name,
      nameEn: product.name_en,
      basePrice: product.base_price,
      isActive: product.is_active,
      isBestseller: product.is_bestseller,
      createdAt: product.created_at,
      categoryId: product.category?.id || null,
      categoryName: product.category?.name || '—',
      imageUrl: image?.image_url || null,
    }
  })
}

// products.slug and products.sku are both NOT NULL + UNIQUE in the existing schema,
// but this stage's Add Product form only collects basic info (name/description/price/
// category/status). Both are auto-generated here so the insert satisfies the existing
// schema without requiring the user to enter them or changing the database.

function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-') // unicode-aware: keeps Arabic letters
    .replace(/^-+|-+$/g, '')
}

function randomSuffix(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length)
}

function generateUniqueSlug(name) {
  const base = slugify(name) || 'product'
  return `${base}-${randomSuffix()}`
}

function generateSku() {
  return `SKU-${Date.now().toString(36).toUpperCase()}-${randomSuffix(4).toUpperCase()}`
}

/**
 * Creates a new product with basic information only.
 * Image upload, colors, sizes, material, variants, and inventory are handled in later stages.
 *
 * @param {{ name: string, description?: string, basePrice: number, categoryId: string, isActive: boolean }} productData
 */
export async function createProduct({ name, nameEn, description, basePrice, categoryId, isActive }) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: name.trim(),
      name_en: nameEn?.trim() || null,
      slug: generateUniqueSlug(name),
      description: description?.trim() || null,
      base_price: basePrice,
      category_id: categoryId,
      is_active: isActive,
      sku: generateSku(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetches a single product's basic info (used by the Product Images page
 * header). Does not include images — use getProductImages for those.
 * @param {string} productId
 */
export async function getProduct(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, name_en, base_price, is_active')
    .eq('id', productId)
    .single()

  if (error) throw error

  return {
    id: data.id,
    name: data.name,
    nameEn: data.name_en,
    basePrice: data.base_price,
    isActive: data.is_active,
  }
}

/**
 * Fetches a single product's full editable fields (used by the Edit Product
 * page). slug and sku are intentionally not included here since the edit
 * form never touches them.
 * @param {string} productId
 */
export async function getProductById(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, name_en, description, base_price, category_id, is_active')
    .eq('id', productId)
    .single()

  if (error) throw error

  return {
    id: data.id,
    name: data.name,
    nameEn: data.name_en,
    description: data.description || '',
    basePrice: data.base_price,
    categoryId: data.category_id,
    isActive: data.is_active,
  }
}

/**
 * Updates a product's editable fields only. slug and sku are never touched
 * here, so they remain exactly as they were generated at creation time.
 *
 * @param {string} productId
 * @param {{ name: string, description?: string, basePrice: number, categoryId: string, isActive: boolean }} productData
 */
export async function updateProduct(productId, { name, nameEn, description, basePrice, categoryId, isActive }) {
  const { data, error } = await supabase
    .from('products')
    .update({
      name: name.trim(),
      name_en: nameEn?.trim() || null,
      description: description?.trim() || null,
      base_price: basePrice,
      category_id: categoryId,
      is_active: isActive,
    })
    .eq('id', productId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetches all active products for the customer storefront (homepage,
 * category pages), including category slug and primary image. Only
 * `is_active = true` products are returned via the existing "Anyone can
 * view active products" RLS policy.
 */
export async function getActiveProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, name_en, slug, base_price, has_discount, discount_price, is_bestseller, created_at,
       category:categories(slug),
       images:product_images(image_url, is_primary, sort_order),
       colors:product_colors(id, name, hex_code, sort_order)`
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((product) => {
    const images = product.images || []
    const primary = images.find((img) => img.is_primary)
    const fallback = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
    const image = primary || fallback

    return {
      id: product.id,
      name: product.name,
      nameEn: product.name_en,
      slug: product.slug,
      basePrice: product.base_price,
      hasDiscount: product.has_discount,
      discountPrice: product.discount_price,
      isBestseller: product.is_bestseller,
      createdAt: product.created_at,
      categorySlug: product.category?.slug || null,
      imageUrl: image?.image_url || null,
      colors: mapColors(product.colors),
    }
  })
}

/**
 * Fetches active products by id, preserving the order of the input array
 * (Supabase's .in() does not guarantee row order). Used by the customer
 * homepage's "Featured Products" section, which is admin-curated as an
 * ordered array (homepage_content.featured_product_ids), and by the Admin
 * Homepage Management page to show the currently-picked featured products.
 * Ids that no longer match an active product (e.g. deactivated/deleted
 * since being featured) are silently skipped.
 * @param {string[]} ids
 */
export async function getProductsByIds(ids) {
  if (!ids || ids.length === 0) return []

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, name_en, slug, base_price, has_discount, discount_price, is_bestseller, created_at, is_active,
       category:categories(slug),
       images:product_images(image_url, is_primary, sort_order),
       colors:product_colors(id, name, hex_code, sort_order)`
    )
    .in('id', ids)

  if (error) throw error

  const byId = new Map(
    (data || []).map((product) => {
      const images = product.images || []
      const primary = images.find((img) => img.is_primary)
      const fallback = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
      const image = primary || fallback

      return [
        product.id,
        {
          id: product.id,
          name: product.name,
          nameEn: product.name_en,
          slug: product.slug,
          basePrice: product.base_price,
          hasDiscount: product.has_discount,
          discountPrice: product.discount_price,
          isBestseller: product.is_bestseller,
          isActive: product.is_active,
          createdAt: product.created_at,
          categorySlug: product.category?.slug || null,
          imageUrl: image?.image_url || null,
          colors: mapColors(product.colors),
        },
      ]
    })
  )

  // Preserve input order; drop ids that no longer resolve to a product.
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

/**
 * Fetches active products belonging to a single category, for the customer
 * Category page. Same shape/mapping as getActiveProducts. Only
 * `is_active = true` products are returned via the existing "Anyone can
 * view active products" RLS policy.
 * @param {string} categoryId
 */
export async function getProductsByCategoryId(categoryId) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, name_en, slug, base_price, has_discount, discount_price, is_bestseller, created_at,
       category:categories(slug),
       images:product_images(image_url, is_primary, sort_order),
       colors:product_colors(id, name, hex_code, sort_order)`
    )
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((product) => {
    const images = product.images || []
    const primary = images.find((img) => img.is_primary)
    const fallback = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
    const image = primary || fallback

    return {
      id: product.id,
      name: product.name,
      nameEn: product.name_en,
      slug: product.slug,
      basePrice: product.base_price,
      hasDiscount: product.has_discount,
      discountPrice: product.discount_price,
      isBestseller: product.is_bestseller,
      createdAt: product.created_at,
      categorySlug: product.category?.slug || null,
      imageUrl: image?.image_url || null,
      colors: mapColors(product.colors),
    }
  })
}

/**
 * Fetches a single active product's full detail — images (all, including
 * per-color gallery images), colors, sizes, and variants (stock,
 * per-variant price override) — in one query, for the customer Product
 * page. Reuses the existing product_colors/product_sizes/product_variants
 * structure from Stage 8; no separate variant system.
 *
 * Returns null when no active product matches the slug (either it doesn't
 * exist or has been deactivated) — the page treats that as a "product not
 * found" state. Inactive variants are filtered out client-side, same as
 * the "Anyone can view active product variants" RLS policy would apply for
 * a non-admin session.
 * @param {string} slug
 */
export async function getProductBySlug(slug) {
  const { data, error } = await supabase
    .from('products')
    .select(
      `id, name, name_en, slug, description, material, base_price, has_discount, discount_price,
       is_bestseller, is_active,
       category:categories(id, name, name_en, slug),
       images:product_images(id, image_url, color_id, sort_order, is_primary),
       colors:product_colors(id, name, hex_code, sort_order, is_active),
       sizes:product_sizes(id, name, sort_order),
       variants:product_variants(id, color_id, size_id, stock_quantity, price_override, is_active)`
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.is_active) return null

  const images = [...(data.images || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const colors = [...(data.colors || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const sizes = [...(data.sizes || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const variants = (data.variants || []).filter((v) => v.is_active)

  return {
    id: data.id,
    name: data.name,
    nameEn: data.name_en,
    slug: data.slug,
    description: data.description || '',
    material: data.material || '',
    basePrice: data.base_price,
    hasDiscount: data.has_discount,
    discountPrice: data.discount_price,
    isBestseller: data.is_bestseller,
    category: data.category
      ? { id: data.category.id, name: data.category.name, nameEn: data.category.name_en, slug: data.category.slug }
      : null,
    images: images.map((img) => ({
      id: img.id,
      imageUrl: img.image_url,
      colorId: img.color_id,
      isPrimary: img.is_primary,
    })),
    colors: colors.map((c) => ({ id: c.id, name: c.name, hexCode: c.hex_code, isActive: c.is_active })),
    sizes: sizes.map((s) => ({ id: s.id, name: s.name })),
    variants: variants.map((v) => ({
      id: v.id,
      colorId: v.color_id,
      sizeId: v.size_id,
      stockQuantity: v.stock_quantity,
      priceOverride: v.price_override,
    })),
  }
}

/**
 * Toggles a product's is_bestseller flag (shown on the customer homepage's
 * "الاكثر مبيعا" section). Does not touch any other field.
 * @param {string} productId
 * @param {boolean} isBestseller
 */
export async function toggleProductBestseller(productId, isBestseller) {
  const { data, error } = await supabase
    .from('products')
    .update({ is_bestseller: isBestseller })
    .eq('id', productId)
    .select('id, is_bestseller')
    .single()

  if (error) throw error
  return { id: data.id, isBestseller: data.is_bestseller }
}