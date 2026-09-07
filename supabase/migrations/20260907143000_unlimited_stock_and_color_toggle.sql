-- =====================================================================
-- Unlimited stock for un-configured color/size combos + per-color toggle
-- =====================================================================
-- Run once in the Supabase SQL Editor (or via `supabase db push`).
--
-- WHY THIS IS NEEDED
-- -------------------
-- Until now, a product with colors+sizes but no product_variants row for a
-- given color+size combination was BLOCKED at checkout: order_items.variant_id
-- was NOT NULL, so createOrder() had to reject any cart line with no
-- matching variant (see the "VARIANT_REQUIRED" / "known schema limitation"
-- notes in src/services/orderService.js). In practice this forced an admin
-- to create a توليفة (variant) for every single color+size pair just to make
-- a product purchasable at all, even when they never intended to track
-- stock that granularly.
--
-- The requested behavior: a color+size combination with NO variant row is
-- simply unlimited stock (always purchasable) — variants become an opt-in
-- way to cap/track stock for specific combos, not a requirement. Marking an
-- entire color out of stock (regardless of size) is now a one-click toggle
-- on the color itself, instead of having to create a zero-stock variant for
-- every one of that color's sizes.
--
-- WHAT THIS DOES
-- --------------
-- 1. product_colors gets an `is_active` flag (default true, so every
--    existing color keeps behaving exactly as before). When an admin turns
--    a color off, it becomes unavailable for every size, without touching
--    any product_variants rows.
-- 2. order_items.variant_id becomes nullable, so an order line for an
--    "unlimited stock" combo (no matching product_variants row) can be
--    inserted with variant_id = null instead of being rejected.
-- 3. decrement_stock_for_order() / restock_for_order() are updated to skip
--    order_items with variant_id is null — there is no stock to touch for
--    an unlimited line. Every other line (variant_id set) behaves exactly
--    as before, with the same row-locking/insufficient-stock safety.
-- =====================================================================

alter table product_colors
  add column if not exists is_active boolean not null default true;

alter table order_items
  alter column variant_id drop not null;

create or replace function decrement_stock_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  current_stock int;
  already_done boolean;
begin
  select stock_decremented into already_done from orders where id = p_order_id for update;

  if already_done is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  if already_done then
    -- Idempotency guard: stock already decremented for this order, do nothing.
    return;
  end if;

  for item in
    select variant_id, quantity from order_items
    where order_id = p_order_id and variant_id is not null
  loop
    select stock_quantity into current_stock
    from product_variants
    where id = item.variant_id
    for update;

    if current_stock is null then
      raise exception 'Variant % not found', item.variant_id;
    end if;

    if current_stock < item.quantity then
      raise exception 'Insufficient stock for variant %: have %, need %',
        item.variant_id, current_stock, item.quantity;
    end if;

    update product_variants
    set stock_quantity = stock_quantity - item.quantity
    where id = item.variant_id;
  end loop;

  update orders set stock_decremented = true where id = p_order_id;
end;
$$;

create or replace function restock_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  was_decremented boolean;
begin
  select stock_decremented into was_decremented from orders where id = p_order_id for update;

  if was_decremented is null then
    raise exception 'Order % not found', p_order_id;
  end if;

  if not was_decremented then
    return; -- nothing to restock
  end if;

  for item in
    select variant_id, quantity from order_items
    where order_id = p_order_id and variant_id is not null
  loop
    update product_variants
    set stock_quantity = stock_quantity + item.quantity
    where id = item.variant_id;
  end loop;

  update orders set stock_decremented = false where id = p_order_id;
end;
$$;

-- No RLS changes required: product_colors already has "Anyone can view
-- product colors" (select using (true)) and "Admins can manage product
-- colors" (all using/with check is_admin()), which apply at the row level
-- and already cover the new is_active column.
