-- =====================================================================
-- Arabic Underwear E-Commerce — Supabase / PostgreSQL Schema
-- Ready to paste into the Supabase SQL Editor and run top to bottom.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
create type payment_status_enum as enum ('pending', 'paid', 'failed', 'refunded');

create type order_status_enum as enum (
  'جديد',
  'قيد التجهيز',
  'تم الشحن',
  'تم التسليم',
  'ملغي'
);

create type discount_type_enum as enum ('percentage', 'fixed');

create type app_role_enum as enum ('customer', 'admin');

-- ---------------------------------------------------------------------
-- UPDATED_AT TRIGGER FUNCTION (shared by all tables)
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- PROFILES (extends auth.users)
-- =====================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role app_role_enum not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on profiles(role);

create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new auth user is created
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end;
$$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- =====================================================================
-- CATEGORIES (self-referencing for subcategories)
-- =====================================================================
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                 -- e.g. رجالي / نسائي / اولاد / بنات / بوكسرات ...
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references categories(id) on delete cascade,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_categories_parent_id on categories(parent_id);
create index idx_categories_slug on categories(slug);

create trigger trg_categories_updated_at
before update on categories
for each row execute function set_updated_at();

-- =====================================================================
-- PRODUCTS
-- =====================================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  material text,                      -- الخامة
  base_price numeric(10,2) not null check (base_price >= 0),
  sku text not null unique,
  is_bestseller boolean not null default false,
  is_featured boolean not null default false,
  has_discount boolean not null default false,
  discount_price numeric(10,2) check (discount_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_discount_price check (
    not has_discount or (discount_price is not null and discount_price < base_price)
  )
);

create index idx_products_category_id on products(category_id);
create index idx_products_slug on products(slug);
create index idx_products_is_bestseller on products(is_bestseller) where is_bestseller = true;
create index idx_products_is_featured on products(is_featured) where is_featured = true;
create index idx_products_is_active on products(is_active) where is_active = true;

create trigger trg_products_updated_at
before update on products
for each row execute function set_updated_at();

-- =====================================================================
-- PRODUCT COLORS
-- =====================================================================
create table product_colors (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,                 -- اسود / ابيض ...
  hex_code text,                      -- optional swatch color
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, name)
);

create index idx_product_colors_product_id on product_colors(product_id);

create trigger trg_product_colors_updated_at
before update on product_colors
for each row execute function set_updated_at();

-- =====================================================================
-- PRODUCT SIZES
-- =====================================================================
create table product_sizes (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,                 -- M / L / XL ...
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, name)
);

create index idx_product_sizes_product_id on product_sizes(product_id);

create trigger trg_product_sizes_updated_at
before update on product_sizes
for each row execute function set_updated_at();

-- =====================================================================
-- PRODUCT VARIANTS (color + size combination, independent stock)
-- =====================================================================
create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  color_id uuid not null references product_colors(id) on delete cascade,
  size_id uuid not null references product_sizes(id) on delete cascade,
  sku_suffix text,                    -- optional variant-level SKU suffix
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  price_override numeric(10,2) check (price_override >= 0), -- optional per-variant price
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, color_id, size_id)
);

create index idx_product_variants_product_id on product_variants(product_id);
create index idx_product_variants_color_id on product_variants(color_id);
create index idx_product_variants_size_id on product_variants(size_id);
create index idx_product_variants_stock on product_variants(stock_quantity);

create trigger trg_product_variants_updated_at
before update on product_variants
for each row execute function set_updated_at();

-- Guard: color_id and size_id must belong to the same product_id as the variant
create or replace function check_variant_color_size_product()
returns trigger
language plpgsql
as $$
declare
  color_product uuid;
  size_product uuid;
begin
  select product_id into color_product from product_colors where id = new.color_id;
  select product_id into size_product from product_sizes where id = new.size_id;

  if color_product is distinct from new.product_id or size_product is distinct from new.product_id then
    raise exception 'Color and size must belong to the same product as the variant';
  end if;

  return new;
end;
$$;

create trigger trg_check_variant_color_size_product
before insert or update on product_variants
for each row execute function check_variant_color_size_product();

-- =====================================================================
-- PRODUCT IMAGES (per color, gallery switches when color is selected)
-- =====================================================================
create table product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  color_id uuid references product_colors(id) on delete cascade, -- null = general/product-level image
  image_url text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_product_images_product_id on product_images(product_id);
create index idx_product_images_color_id on product_images(color_id);

-- =====================================================================
-- DISCOUNTS (coupon codes)
-- =====================================================================
create table discounts (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  discount_type discount_type_enum not null,
  discount_value numeric(10,2) not null check (discount_value > 0),
  min_order_amount numeric(10,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  usage_limit int,
  times_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_discount_dates check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index idx_discounts_code on discounts(code);
create index idx_discounts_is_active on discounts(is_active) where is_active = true;

create trigger trg_discounts_updated_at
before update on discounts
for each row execute function set_updated_at();

-- =====================================================================
-- ORDERS
-- =====================================================================
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,
  customer_id uuid references profiles(id) on delete set null,

  -- customer info (kept redundantly on the order for guest checkout / historical record)
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  customer_address text not null,
  customer_city text not null,
  customer_governorate text not null,
  order_notes text,

  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount_id uuid references discounts(id) on delete set null,
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  shipping_cost numeric(10,2) not null default 0 check (shipping_cost >= 0),
  total numeric(10,2) not null check (total >= 0),

  payment_status payment_status_enum not null default 'pending',
  order_status order_status_enum not null default 'جديد',

  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,

  stock_decremented boolean not null default false, -- guards against double stock decrement

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_order_number on orders(order_number);
create index idx_orders_payment_status on orders(payment_status);
create index idx_orders_order_status on orders(order_status);
create index idx_orders_stripe_checkout_session_id on orders(stripe_checkout_session_id);
create index idx_orders_stripe_payment_intent_id on orders(stripe_payment_intent_id);
create index idx_orders_created_at on orders(created_at desc);

create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();

-- Auto-generate a human-friendly order_number if not supplied
create or replace function generate_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

create trigger trg_orders_generate_number
before insert on orders
for each row execute function generate_order_number();

-- =====================================================================
-- ORDER ITEMS
-- =====================================================================
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  variant_id uuid not null references product_variants(id) on delete restrict,

  -- snapshot fields (kept even if product/variant later changes)
  product_name text not null,
  color_name text not null,
  size_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity int not null check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),

  created_at timestamptz not null default now()
);

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_product_id on order_items(product_id);
create index idx_order_items_variant_id on order_items(variant_id);

-- =====================================================================
-- STORE SETTINGS (single row table)
-- =====================================================================
create table store_settings (
  id int primary key default 1,
  brand_name text not null default '',
  logo_url text,
  contact_email text,
  contact_phone text,
  whatsapp_number text,
  social_links jsonb not null default '{}'::jsonb, -- { "instagram": "...", "facebook": "...", "tiktok": "..." }
  payment_policy text,
  shipping_policy text,
  return_policy text,
  about_us text,
  default_shipping_cost numeric(10,2) not null default 0,
  -- STAGE 21: free-shipping rule. When free_shipping_enabled is true and an
  -- order's pre-discount subtotal >= free_shipping_min_order_amount,
  -- shipping is 0; otherwise default_shipping_cost applies. See
  -- src/services/orderService.js (calculateShippingCost) for the single
  -- trusted calculation path.
  free_shipping_enabled boolean not null default false,
  free_shipping_min_order_amount numeric(10,2) not null default 0
    check (free_shipping_min_order_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_store_settings_single_row check (id = 1)
);

create trigger trg_store_settings_updated_at
before update on store_settings
for each row execute function set_updated_at();

insert into store_settings (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- HOMEPAGE CONTENT (single row table)
-- =====================================================================
create table homepage_content (
  id int primary key default 1,
  hero_image_url text,
  hero_title text,
  hero_message text,
  hero_cta_text text,
  hero_cta_link text,
  featured_product_ids uuid[] not null default '{}',
  banners jsonb not null default '[]'::jsonb, -- [{ "image_url": "...", "link": "...", "title": "..." }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_homepage_content_single_row check (id = 1)
);

create trigger trg_homepage_content_updated_at
before update on homepage_content
for each row execute function set_updated_at();

insert into homepage_content (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- SAFE STOCK FUNCTIONS
-- (handle concurrent orders correctly using row locking)
-- =====================================================================

-- Checks availability for a single variant without locking (used for UI display)
create or replace function get_variant_stock(p_variant_id uuid)
returns int
language sql
stable
as $$
  select stock_quantity from product_variants where id = p_variant_id;
$$;

-- Decrements stock for an order's items atomically and safely.
-- Locks each variant row (FOR UPDATE) to prevent race conditions between concurrent orders.
-- Raises an exception (rolling back the whole transaction) if any variant has insufficient stock.
-- This must only ever be called from a trusted server-side context (Edge Function) after
-- a Stripe webhook confirms payment — never directly from the frontend.
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
    select variant_id, quantity from order_items where order_id = p_order_id
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

-- Restocks an order's items (e.g. on cancellation/refund). Also idempotent via stock_decremented flag.
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
    select variant_id, quantity from order_items where order_id = p_order_id
  loop
    update product_variants
    set stock_quantity = stock_quantity + item.quantity
    where id = item.variant_id;
  end loop;

  update orders set stock_decremented = false where id = p_order_id;
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------- profiles --------------------------------
alter table profiles enable row level security;

create policy "Users can view own profile"
on profiles for select
using (auth.uid() = id or is_admin());

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can view all profiles"
on profiles for select
using (is_admin());

-- ---------------------------- categories --------------------------------
alter table categories enable row level security;

create policy "Anyone can view active categories"
on categories for select
using (is_active = true or is_admin());

create policy "Admins can manage categories"
on categories for all
using (is_admin())
with check (is_admin());

-- ---------------------------- products --------------------------------
alter table products enable row level security;

create policy "Anyone can view active products"
on products for select
using (is_active = true or is_admin());

create policy "Admins can manage products"
on products for all
using (is_admin())
with check (is_admin());

-- ---------------------------- product_colors --------------------------------
alter table product_colors enable row level security;

create policy "Anyone can view product colors"
on product_colors for select
using (true);

create policy "Admins can manage product colors"
on product_colors for all
using (is_admin())
with check (is_admin());

-- ---------------------------- product_sizes --------------------------------
alter table product_sizes enable row level security;

create policy "Anyone can view product sizes"
on product_sizes for select
using (true);

create policy "Admins can manage product sizes"
on product_sizes for all
using (is_admin())
with check (is_admin());

-- ---------------------------- product_variants --------------------------------
alter table product_variants enable row level security;

create policy "Anyone can view active product variants"
on product_variants for select
using (is_active = true or is_admin());

create policy "Admins can manage product variants"
on product_variants for all
using (is_admin())
with check (is_admin());

-- ---------------------------- product_images --------------------------------
alter table product_images enable row level security;

create policy "Anyone can view product images"
on product_images for select
using (true);

create policy "Admins can manage product images"
on product_images for all
using (is_admin())
with check (is_admin());

-- ---------------------------- discounts --------------------------------
alter table discounts enable row level security;

create policy "Anyone can view active discounts (for validation)"
on discounts for select
using (is_active = true or is_admin());

create policy "Admins can manage discounts"
on discounts for all
using (is_admin())
with check (is_admin());

-- ---------------------------- orders --------------------------------
alter table orders enable row level security;

create policy "Customers can view own orders"
on orders for select
using (auth.uid() = customer_id or is_admin());

create policy "Customers can create own orders"
on orders for insert
with check (auth.uid() = customer_id or customer_id is null);

create policy "Admins can manage all orders"
on orders for all
using (is_admin())
with check (is_admin());

-- Note: payment_status/order_status updates after Stripe confirmation are performed
-- server-side (Edge Function using the service role key), which bypasses RLS by design.

-- ---------------------------- order_items --------------------------------
alter table order_items enable row level security;

create policy "Customers can view own order items"
on order_items for select
using (
  is_admin()
  or exists (
    select 1 from orders o where o.id = order_items.order_id and o.customer_id = auth.uid()
  )
);

create policy "Customers can create own order items"
on order_items for insert
with check (
  exists (
    select 1 from orders o
    where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or o.customer_id is null)
  )
);

create policy "Admins can manage order items"
on order_items for all
using (is_admin())
with check (is_admin());

-- ---------------------------- store_settings --------------------------------
alter table store_settings enable row level security;

create policy "Anyone can view store settings"
on store_settings for select
using (true);

create policy "Admins can update store settings"
on store_settings for update
using (is_admin())
with check (is_admin());

-- ---------------------------- homepage_content --------------------------------
alter table homepage_content enable row level security;

create policy "Anyone can view homepage content"
on homepage_content for select
using (true);

create policy "Admins can update homepage content"
on homepage_content for update
using (is_admin())
with check (is_admin());

-- =====================================================================
-- STORAGE: product images bucket + policies
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public can view product images"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "Admins can upload product images"
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and is_admin()
);

create policy "Admins can update product images"
on storage.objects for update
using (bucket_id = 'product-images' and is_admin())
with check (bucket_id = 'product-images' and is_admin());

create policy "Admins can delete product images"
on storage.objects for delete
using (bucket_id = 'product-images' and is_admin());

-- Also a bucket for category images and brand/logo assets
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create policy "Public can view site assets"
on storage.objects for select
using (bucket_id = 'site-assets');

create policy "Admins can manage site assets"
on storage.objects for all
using (bucket_id = 'site-assets' and is_admin())
with check (bucket_id = 'site-assets' and is_admin());

-- =====================================================================
-- END OF SCHEMA
-- =====================================================================
