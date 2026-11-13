-- =====================================================================
-- Optional customer birthday on orders (for special birthday discounts)
-- =====================================================================
-- Nullable, collected at checkout as "تاريخ الميلاد (اختياري)". Stored on
-- the order as a snapshot like the other customer_* columns, and shown to
-- admins on the order detail page. Existing orders stay NULL.
--
-- No RLS changes required: the existing orders policies are row-level and
-- already cover the new column.

alter table orders
  add column if not exists customer_birthday date;
