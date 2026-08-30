// Store settings + homepage content queries — kept separate from UI components.
// Uses the existing Supabase client and existing schema/RLS only (no schema
// changes made from this file's code).
// RLS already in place (verified against schema.sql, not modified here):
//   "Anyone can view store settings"       — store_settings: select using (true)
//   "Anyone can view homepage content"     — homepage_content: select using (true)
//   "Admins can update store settings"     — store_settings: update using (is_admin())
//   "Admins can update homepage content"   — homepage_content: update using (is_admin())
// Both tables are single-row (id = 1) by design (see chk_*_single_row constraints),
// and both are publicly readable, so the customer storefront can read them directly.
//
// STAGE 21: store_settings gained two new columns (free_shipping_enabled,
// free_shipping_min_order_amount) via supabase/migrations/
// 20260825_free_shipping_settings.sql. Row-level RLS already covers them
// (policies apply per-row, not per-column) — no RLS changes were needed.

import { supabase } from '../lib/supabaseClient'

const STORE_SETTINGS_COLUMNS =
  'brand_name, logo_url, contact_email, contact_phone, whatsapp_number, social_links, payment_policy, shipping_policy, return_policy, about_us, default_shipping_cost, free_shipping_enabled, free_shipping_min_order_amount'

function mapStoreSettingsRow(data) {
  return {
    brandName: data.brand_name || '',
    logoUrl: data.logo_url,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    whatsappNumber: data.whatsapp_number,
    socialLinks: data.social_links || {},
    paymentPolicy: data.payment_policy,
    shippingPolicy: data.shipping_policy,
    returnPolicy: data.return_policy,
    aboutUs: data.about_us,
    defaultShippingCost: data.default_shipping_cost,
    // STAGE 21 — free shipping rule (see supabase/migrations/20260825_free_shipping_settings.sql)
    freeShippingEnabled: data.free_shipping_enabled ?? false,
    freeShippingMinOrderAmount: data.free_shipping_min_order_amount ?? 0,
  }
}

/**
 * Fetches the single store_settings row (brand name, logo, contact info,
 * WhatsApp, social links, policies, about text, default shipping cost,
 * free-shipping rule). Returns null if the row is somehow missing (it's
 * seeded by schema.sql, so this should not normally happen).
 */
export async function getStoreSettings() {
  const { data, error } = await supabase
    .from('store_settings')
    .select(STORE_SETTINGS_COLUMNS)
    .eq('id', 1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapStoreSettingsRow(data)
}

/**
 * Updates the single store_settings row. Only columns that already exist on
 * store_settings are written here — see schema.sql. Requires admin (RLS:
 * "Admins can update store settings").
 *
 * @param {{ brandName: string, logoUrl?: string|null, contactEmail?: string|null,
 *   contactPhone?: string|null, whatsappNumber?: string|null, socialLinks?: object,
 *   paymentPolicy?: string|null, shippingPolicy?: string|null, returnPolicy?: string|null,
 *   aboutUs?: string|null, defaultShippingCost?: number,
 *   freeShippingEnabled?: boolean, freeShippingMinOrderAmount?: number }} data
 */
export async function updateStoreSettings({
  brandName,
  logoUrl,
  contactEmail,
  contactPhone,
  whatsappNumber,
  socialLinks,
  paymentPolicy,
  shippingPolicy,
  returnPolicy,
  aboutUs,
  defaultShippingCost,
  freeShippingEnabled,
  freeShippingMinOrderAmount,
}) {
  const { data, error } = await supabase
    .from('store_settings')
    .update({
      brand_name: brandName.trim(),
      logo_url: logoUrl || null,
      contact_email: contactEmail?.trim() || null,
      contact_phone: contactPhone?.trim() || null,
      whatsapp_number: whatsappNumber?.trim() || null,
      social_links: socialLinks || {},
      payment_policy: paymentPolicy?.trim() || null,
      shipping_policy: shippingPolicy?.trim() || null,
      return_policy: returnPolicy?.trim() || null,
      about_us: aboutUs?.trim() || null,
      default_shipping_cost: defaultShippingCost ?? 0,
      free_shipping_enabled: freeShippingEnabled ?? false,
      free_shipping_min_order_amount: freeShippingMinOrderAmount ?? 0,
    })
    .eq('id', 1)
    .select(STORE_SETTINGS_COLUMNS)
    .single()

  if (error) throw error

  return mapStoreSettingsRow(data)
}

/**
 * Fetches the single homepage_content row (hero content, featured product
 * ids, promotional banners). Returns null if missing.
 */
export async function getHomepageContent() {
  const { data, error } = await supabase
    .from('homepage_content')
    .select('hero_image_url, hero_title, hero_message, hero_cta_text, hero_cta_link, featured_product_ids, banners')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    heroImageUrl: data.hero_image_url,
    heroTitle: data.hero_title,
    heroMessage: data.hero_message,
    heroCtaText: data.hero_cta_text,
    heroCtaLink: data.hero_cta_link,
    featuredProductIds: data.featured_product_ids || [],
    banners: data.banners || [],
  }
}

/**
 * Updates the single homepage_content row. Only the fields passed are sent —
 * callers build the full object explicitly (hero fields, featuredProductIds,
 * banners) since this always replaces the whole row's editable columns.
 * Requires admin (RLS: "Admins can update homepage content").
 *
 * @param {{ heroImageUrl?: string|null, heroTitle?: string|null, heroMessage?: string|null,
 *   heroCtaText?: string|null, heroCtaLink?: string|null,
 *   featuredProductIds?: string[], banners?: Array<{image_url: string, link: string, title: string}> }} data
 */
export async function updateHomepageContent({
  heroImageUrl,
  heroTitle,
  heroMessage,
  heroCtaText,
  heroCtaLink,
  featuredProductIds,
  banners,
}) {
  const { data, error } = await supabase
    .from('homepage_content')
    .update({
      hero_image_url: heroImageUrl || null,
      hero_title: heroTitle || null,
      hero_message: heroMessage || null,
      hero_cta_text: heroCtaText || null,
      hero_cta_link: heroCtaLink || null,
      featured_product_ids: featuredProductIds || [],
      banners: banners || [],
    })
    .eq('id', 1)
    .select(
      'hero_image_url, hero_title, hero_message, hero_cta_text, hero_cta_link, featured_product_ids, banners'
    )
    .single()

  if (error) throw error

  return {
    heroImageUrl: data.hero_image_url,
    heroTitle: data.hero_title,
    heroMessage: data.hero_message,
    heroCtaText: data.hero_cta_text,
    heroCtaLink: data.hero_cta_link,
    featuredProductIds: data.featured_product_ids || [],
    banners: data.banners || [],
  }
}