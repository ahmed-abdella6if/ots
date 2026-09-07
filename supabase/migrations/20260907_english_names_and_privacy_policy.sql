-- =====================================================================
-- English names (products/categories) + Privacy Policy
-- =====================================================================
-- NOT executed automatically. Review, then run this file (once) in the
-- Supabase SQL Editor against the existing project database.
--
-- WHY THIS IS NEEDED
-- -------------------
-- The storefront has an AR/EN language switcher, but categories.name and
-- products.name only ever hold the Arabic value — there is no column to
-- store an English name, so switching to English still shows Arabic
-- category/product names everywhere (navbar, category cards, product
-- cards, product page). getLocalizedName() (src/utils/localizedName.js)
-- already expects an optional nameEn field and falls back to the Arabic
-- name when it's missing — this migration is what lets that field
-- actually exist and be filled in per product/category from the Admin
-- panel.
--
-- Also adds store_settings.privacy_policy, alongside the existing
-- payment_policy/shipping_policy/return_policy columns, so a Privacy
-- Policy page can be added the same way the existing policy pages work.
--
-- WHAT THIS DOES
-- --------------
-- Adds three new, nullable text columns. Does NOT touch any existing
-- column or row's data, and does not touch any other table. `add column
-- if not exists` makes this safe to run more than once.
-- =====================================================================

alter table products
  add column if not exists name_en text;

alter table categories
  add column if not exists name_en text;

alter table store_settings
  add column if not exists privacy_policy text;

-- No RLS changes required:
--   products/categories already have "Anyone can view active ..." (select)
--   and "Admins can manage ..." (all) policies, which apply at the row
--   level and already cover this new column.
--   store_settings already has "Anyone can view store settings" (select)
--   and "Admins can update store settings" (update), same reasoning.
