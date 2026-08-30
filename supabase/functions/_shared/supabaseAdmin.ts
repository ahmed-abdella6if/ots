// Shared Supabase client helpers for Edge Functions.
//
// - adminClient(): uses the SERVICE_ROLE key (set automatically by Supabase
//   for Edge Functions as SUPABASE_SERVICE_ROLE_KEY) — bypasses RLS, same
//   trust model already described in supabase/schema.sql for
//   Stripe-webhook-style server-side updates. Only ever used inside these
//   Edge Functions, never sent to the browser.
// - getCallerUserId(): reads the customer's own JWT (forwarded from the
//   frontend's normal authenticated Supabase session) to identify who is
//   calling, WITHOUT granting that identity any elevated DB access. Guest
//   checkouts simply won't have a valid JWT, and that's fine — see each
//   function's ownership check.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service role environment is not configured')
  }
  return createClient(url, serviceRoleKey)
}

export async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return null

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) return null
  return data.user.id
}
