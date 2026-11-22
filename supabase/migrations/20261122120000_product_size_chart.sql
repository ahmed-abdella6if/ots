-- =====================================================================
-- Per-product size chart
-- =====================================================================
-- products.size_chart_url  : optional custom size-chart image for THIS
--                            product (uploaded by the admin on the
--                            product's Colors & Sizes page; stored in the
--                            product-images bucket).
-- products.hide_size_chart : when true, the product shows no size guide at
--                            all (even if its category has a default one).
--
-- Resolution on the storefront: hide_size_chart -> nothing; else
-- size_chart_url if set; else the category default chart (static images in
-- public/sizing-guides). Existing products are unchanged (NULL / false).
--
-- No RLS changes required: the existing products policies are row-level and
-- already cover the new columns.

alter table products
  add column if not exists size_chart_url text,
  add column if not exists hide_size_chart boolean not null default false;
