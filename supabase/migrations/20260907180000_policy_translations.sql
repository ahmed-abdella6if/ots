-- =====================================================================
-- English translations for the store policy pages
-- =====================================================================
-- Run once (already applied via `supabase db push` in this session).
--
-- WHY THIS IS NEEDED
-- -------------------
-- Policy content (payment/shipping/return/privacy) was, by original design,
-- admin-entered business text shown as-is regardless of language (see the
-- "NOT translated" comments in src/pages/Policy*Page.jsx). The store now
-- wants an English version of each policy too, following the same pattern
-- already used for product/category names (name_en, falling back to the
-- Arabic value when empty).
--
-- WHAT THIS DOES
-- --------------
-- Adds four new, nullable text columns to store_settings — one English
-- counterpart per existing policy column. Nothing existing is renamed or
-- removed; the Arabic columns keep meaning exactly what they did before.
-- =====================================================================

alter table store_settings
  add column if not exists payment_policy_en text;

alter table store_settings
  add column if not exists shipping_policy_en text;

alter table store_settings
  add column if not exists return_policy_en text;

alter table store_settings
  add column if not exists privacy_policy_en text;

-- No RLS changes required: store_settings already has "Anyone can view
-- store settings" (select using (true)) and "Admins can update store
-- settings" (update using (is_admin())), which apply at the row level and
-- already cover these new columns.
