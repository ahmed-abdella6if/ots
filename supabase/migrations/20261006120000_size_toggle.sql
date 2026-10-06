-- =====================================================================
-- Per-size out-of-stock toggle
-- =====================================================================
-- Mirrors the per-color toggle (20260907143000_unlimited_stock_and_color_toggle.sql).
--
-- product_sizes gets an `is_active` flag (default true, so every existing
-- size keeps behaving exactly as before). When an admin turns a size off it
-- becomes unavailable for every color, without touching any product_variants
-- rows — the storefront shows it faded with a slash and checkout rejects it.
--
-- No RLS changes required: "Anyone can view product sizes" and
-- "Admins can manage product sizes" already apply at the row level.

alter table product_sizes
  add column if not exists is_active boolean not null default true;
