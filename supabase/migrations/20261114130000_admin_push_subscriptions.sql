-- =====================================================================
-- Admin push subscriptions (new-order phone notifications)
-- =====================================================================
-- One row per admin device that turned on "order alerts" in the admin
-- portal (a Web Push subscription: endpoint + encryption keys). The
-- notify-new-order Edge Function reads these with the service role and
-- sends a push when an order's payment is confirmed; rows whose push
-- service says the subscription is gone are deleted there.
--
-- RLS: an admin can only see / add / remove THEIR OWN device rows. Nobody
-- else (customers, anon) can touch the table at all.

create table if not exists admin_push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_push_subscriptions_user_id
  on admin_push_subscriptions(user_id);

alter table admin_push_subscriptions enable row level security;

create policy "Admins manage own push subscriptions"
on admin_push_subscriptions for all
using (is_admin() and user_id = auth.uid())
with check (is_admin() and user_id = auth.uid());
