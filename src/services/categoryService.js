// Category queries — kept separate from UI components.
// Uses the existing Supabase client and existing schema/RLS only.
// RLS already in place (verified against schema.sql, not modified here):
//   "Anyone can view active categories" — select using (is_active = true or is_admin())
//   "Admins can manage categories"      — for all using (is_admin()) with check (is_admin())
// This already allows an authenticated admin to select/insert/update/delete
// categories (including inactive ones), so no policy changes were needed.

import { supabase } from '../lib/supabaseClient'

/**
 * Fetches all active categories for use in dropdowns (e.g. Add Product form,
 * new-product category selection). Inactive categories are intentionally
 * excluded — this is what keeps them from appearing as options for new
 * products once deactivated.
 * Columns used: categories(id, name, parent_id, sort_order, is_active)
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    parentId: cat.parent_id,
  }))
}

/**
 * Fetches ALL categories (active and inactive) with full columns, for the
 * Admin Categories management page.
 */
export async function getAllCategoriesForAdmin() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, parent_id, sort_order, is_active, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map(mapCategoryRow)
}

/**
 * Fetches a single category by id with full columns. Used by the Edit
 * Product form to still show a product's current category even if it has
 * since been deactivated (so it doesn't silently disappear from the form).
 * @param {string} categoryId
 */
export async function getCategoryById(categoryId) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, parent_id, sort_order, is_active, created_at, updated_at')
    .eq('id', categoryId)
    .single()

  if (error) throw error
  return mapCategoryRow(data)
}

/**
 * Returns a map of category_id -> number of products in that category.
 * Reads only products.category_id (no new columns/tables) and counts
 * client-side, since the Supabase JS client has no simple GROUP BY.
 */
export async function getCategoryProductCounts() {
  const { data, error } = await supabase.from('products').select('category_id')
  if (error) throw error

  const counts = {}
  for (const row of data || []) {
    if (!row.category_id) continue
    counts[row.category_id] = (counts[row.category_id] || 0) + 1
  }
  return counts
}

function mapCategoryRow(cat) {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description || '',
    imageUrl: cat.image_url,
    parentId: cat.parent_id,
    sortOrder: cat.sort_order,
    isActive: cat.is_active,
    createdAt: cat.created_at,
    updatedAt: cat.updated_at,
  }
}

// ---------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------
// categories.slug is NOT NULL + UNIQUE in the existing schema. The admin
// never types it directly — it's generated from the name. Arabic names are
// transliterated letter-by-letter to a readable Latin slug (an approximation:
// Arabic script omits short vowels, so this won't always reproduce a
// "natural" spelling, but it is stable, URL-safe, and unique per category).

const ARABIC_TRANSLITERATION = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ى': 'a', 'ة': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ئ': 'y', 'ؤ': 'w', 'ء': '',
}

function transliterate(text) {
  return text
    .split('')
    .map((ch) => (ch in ARABIC_TRANSLITERATION ? ARABIC_TRANSLITERATION[ch] : ch))
    .join('')
}

function slugifyBase(name) {
  return transliterate(name.trim().toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Generates a unique, URL-friendly slug for a category name, checking
 * against existing category slugs in the database and appending -2, -3...
 * as needed. Excludes the category's own id when editing so a category
 * keeps its slug against itself.
 *
 * @param {string} name
 * @param {string} [excludeCategoryId]
 */
export async function generateUniqueCategorySlug(name, excludeCategoryId) {
  const base = slugifyBase(name) || 'category'
  let candidate = base
  let attempt = 1

  // Small bounded loop — category lists are short, this won't run long.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase.from('categories').select('id').eq('slug', candidate)
    if (excludeCategoryId) query = query.neq('id', excludeCategoryId)

    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await query.maybeSingle()
    if (error) throw error

    if (!data) return candidate

    attempt += 1
    candidate = `${base}-${attempt}`
  }
}

// ---------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------

/**
 * Creates a new category. The slug is generated automatically from the name.
 * @param {{ name: string, description?: string, sortOrder?: number, isActive: boolean }} data
 */
export async function createCategory({ name, description, sortOrder, isActive }) {
  const slug = await generateUniqueCategorySlug(name)

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      sort_order: sortOrder ?? 0,
      is_active: isActive,
    })
    .select()
    .single()

  if (error) throw error
  return mapCategoryRow(data)
}

/**
 * Updates a category's editable fields. The slug is intentionally left
 * untouched to avoid breaking existing category URLs — only name,
 * description, sort_order, and is_active are updated.
 *
 * @param {string} categoryId
 * @param {{ name: string, description?: string, sortOrder?: number, isActive: boolean }} data
 */
export async function updateCategory(categoryId, { name, description, sortOrder, isActive }) {
  const { data, error } = await supabase
    .from('categories')
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      sort_order: sortOrder ?? 0,
      is_active: isActive,
    })
    .eq('id', categoryId)
    .select()
    .single()

  if (error) throw error
  return mapCategoryRow(data)
}

/**
 * STAGE 30 — Sets (or clears) a category's image_url. Separate from
 * updateCategory() so the Categories admin page can upload/replace an image
 * independently of the name/description/sort-order form fields, the same
 * way ProductImages is split out from ProductForm. Reuses the existing
 * `image_url` column on `categories` (already present in schema.sql /
 * getAllCategoriesForAdmin — no migration needed) and the existing
 * `site-assets` storage bucket (see storageService.js — its schema.sql
 * comment already earmarks it for "category images and brand/logo assets").
 * @param {string} categoryId
 * @param {string|null} imageUrl
 */
export async function updateCategoryImage(categoryId, imageUrl) {
  const { data, error } = await supabase
    .from('categories')
    .update({ image_url: imageUrl })
    .eq('id', categoryId)
    .select()
    .single()

  if (error) throw error
  return mapCategoryRow(data)
}

/**
 * Toggles a category's active status without touching any other field.
 * @param {string} categoryId
 * @param {boolean} isActive
 */
export async function toggleCategoryStatus(categoryId, isActive) {
  const { data, error } = await supabase
    .from('categories')
    .update({ is_active: isActive })
    .eq('id', categoryId)
    .select()
    .single()

  if (error) throw error
  return mapCategoryRow(data)
}

/**
 * Deletes a category. The existing products.category_id foreign key is
 * `on delete restrict`, so the database itself refuses this if any product
 * still references the category — that Postgres error (code 23503) is
 * caught and re-thrown as a clear flag the UI can check for, as a safety
 * net behind the product-count check the UI performs before calling this.
 * @param {string} categoryId
 */
export async function deleteCategory(categoryId) {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId)

  if (error) {
    if (error.code === '23503') {
      const restrictedError = new Error('Category has associated products')
      restrictedError.isRestricted = true
      throw restrictedError
    }
    throw error
  }
}
/**
 * Fetches active top-level categories (parent_id is null) for the customer
 * homepage's category cards — e.g. رجالي / نسائي / اولاد / بنات — excluding
 * subcategories, which only appear once a category page is browsed into.
 * Columns used: categories(id, name, slug, description, image_url, sort_order, parent_id, is_active)
 */
export async function getHomepageCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, sort_order')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description || '',
    imageUrl: cat.image_url,
    sortOrder: cat.sort_order,
  }))
}

/**
 * Fetches a single active category by slug, with its active subcategories,
 * for the customer Category page. Returns null when no active category
 * matches the slug (either it doesn't exist or has been deactivated) — the
 * page treats that as a "category not found" state rather than an error.
 * @param {string} slug
 */
export async function getCategoryBySlug(slug) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, parent_id, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data || !data.is_active) return null

  const { data: subData, error: subError } = await supabase
    .from('categories')
    .select('id, name, slug, image_url, sort_order')
    .eq('parent_id', data.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (subError) throw subError

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description || '',
    imageUrl: data.image_url,
    parentId: data.parent_id,
    subcategories: (subData || []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.image_url,
    })),
  }
}