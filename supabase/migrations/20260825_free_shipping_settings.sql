-- =====================================================================
-- STAGE 21 — Free Shipping Rules
-- =====================================================================
-- NOT executed automatically. Review, then run this file (once) in the
-- Supabase SQL Editor against the existing project database.
--
-- WHY THIS IS NEEDED
-- -------------------
-- store_settings currently has default_shipping_cost (a single flat
-- shipping amount) but no way to express "free shipping above X KWD".
-- Stage 21 adds a configurable free-shipping rule (enabled flag +
-- minimum-subtotal threshold), which belongs on store_settings alongside
-- default_shipping_cost — the same single-row settings table already used
-- by the Admin Settings page and read by checkout.
--
-- WHAT THIS DOES
-- --------------
-- Adds two new, nullable-safe columns to store_settings with safe
-- defaults (free shipping OFF, threshold 0), plus a non-negative check
-- constraint on the threshold. It does NOT touch any existing column,
-- any existing row's data, or any other table (orders, order_items,
-- products, etc. are all untouched). `add column ... if not exists` and
-- guarded constraint creation make this safe to run more than once.
-- =====================================================================

alter table store_settings
  add column if not exists free_shipping_enabled boolean not null default false;

alter table store_settings
  add column if not exists free_shipping_min_order_amount numeric(10,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_store_settings_free_shipping_min_non_negative'
  ) then
    alter table store_settings
      add constraint chk_store_settings_free_shipping_min_non_negative
      check (free_shipping_min_order_amount >= 0);
  end if;
end $$;

-- No RLS changes required: store_settings already has
--   "Anyone can view store settings"   (select using (true))
--   "Admins can update store settings" (update using (is_admin()))
-- which apply at the row level and already cover these two new columns.
