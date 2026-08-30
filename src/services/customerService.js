// Customer queries for the Admin Portal — kept separate from UI components.
// Uses the existing Supabase client, existing schema, and existing RLS only
// (no schema changes). RLS already in place (verified against schema.sql):
//   "Admins can view all profiles" — profiles: select using (is_admin())
//   "Admins can manage all orders" — orders:   for all using (is_admin())
// This already allows an authenticated admin to select all profiles and
// orders, so no policy changes were needed for this stage.
//
// IMPORTANT DESIGN NOTE — there is no dedicated "customers" table, and this
// store supports guest checkout (orders.customer_id is nullable). A
// "customer" here is therefore derived from two existing sources:
//   1. profiles with role = 'customer' — registered accounts
//   2. orders with customer_id = null  — guest checkouts, grouped by their
//      redundant customer_email / customer_phone fields (which the schema's
//      own comment says are "kept redundantly on the order for guest
//      checkout / historical record" — this is exactly that use case)
// Also note: profiles has no email column (email lives in auth.users, which
// isn't queryable via the client). A registered customer's email is instead
// sourced from their most recent order's customer_email, same as it's
// captured at checkout. If a registered customer has never ordered, their
// email is unknown and shown as "—" — a genuine limitation of the existing
// schema, not something this code can invent.

import { supabase } from '../lib/supabaseClient'
import { getOrdersByCustomerId, getOrdersByGuestContact } from './orderService'

/**
 * Fetches the full customer list for the Admin Customers page: every
 * registered customer (profiles.role = 'customer') merged with their order
 * stats, plus every distinct guest checkout grouped by email/phone.
 */
export async function getCustomers() {
  const [profilesRes, ordersRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone, created_at').eq('role', 'customer'),
    supabase.from('orders').select('customer_id, customer_name, customer_phone, customer_email, total, payment_status, created_at'),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (ordersRes.error) throw ordersRes.error

  const profileMap = new Map()
  for (const p of profilesRes.data || []) {
    profileMap.set(p.id, {
      id: `reg~${p.id}`,
      isRegistered: true,
      name: p.full_name || '—',
      phone: p.phone || '—',
      email: null, // filled from their most recent order below, if any
      registeredAt: p.created_at,
      orderCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
    })
  }

  const guestMap = new Map()

  for (const o of ordersRes.data || []) {
    if (o.customer_id && profileMap.has(o.customer_id)) {
      const c = profileMap.get(o.customer_id)
      c.orderCount += 1
      if (o.payment_status === 'paid') c.totalSpent += Number(o.total)
      if (!c.email && o.customer_email) c.email = o.customer_email
      if (!c.lastOrderAt || new Date(o.created_at) > new Date(c.lastOrderAt)) c.lastOrderAt = o.created_at
      continue
    }

    if (!o.customer_id) {
      const rawContact = o.customer_email || o.customer_phone
      const key = rawContact?.trim().toLowerCase()
      if (!key) continue

      if (!guestMap.has(key)) {
        guestMap.set(key, {
          id: `guest~${encodeURIComponent(rawContact)}`,
          isRegistered: false,
          name: o.customer_name,
          phone: o.customer_phone || '—',
          email: o.customer_email || null,
          registeredAt: null,
          orderCount: 0,
          totalSpent: 0,
          lastOrderAt: null,
        })
      }

      const c = guestMap.get(key)
      c.orderCount += 1
      if (o.payment_status === 'paid') c.totalSpent += Number(o.total)
      if (!c.lastOrderAt || new Date(o.created_at) > new Date(c.lastOrderAt)) c.lastOrderAt = o.created_at
    }
    // Orders whose customer_id is set but doesn't match any role='customer'
    // profile (e.g. an admin test order) are intentionally skipped — they
    // aren't a "customer" in the admin-facing sense of this page.
  }

  const all = [...profileMap.values(), ...guestMap.values()]

  all.sort((a, b) => {
    const aDate = a.lastOrderAt || a.registeredAt
    const bDate = b.lastOrderAt || b.registeredAt
    return new Date(bDate || 0) - new Date(aDate || 0)
  })

  return all
}

/**
 * Fetches a single customer's full detail (info + order history) for the
 * Customer Detail page. `id` is the same composite id produced by
 * getCustomers(): "reg~<profileId>" for registered customers or
 * "guest~<encoded contact>" for guest checkouts.
 * @param {string} id
 */
export async function getCustomerDetail(id) {
  if (id.startsWith('reg~')) {
    const profileId = id.slice('reg~'.length)

    const [profileRes, orders] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, created_at').eq('id', profileId).single(),
      getOrdersByCustomerId(profileId),
    ])

    if (profileRes.error) throw profileRes.error
    const profile = profileRes.data

    let email = null
    if (orders.length > 0) {
      const { data: emailRow, error: emailErr } = await supabase
        .from('orders')
        .select('customer_email')
        .eq('customer_id', profileId)
        .not('customer_email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (emailErr) throw emailErr
      email = emailRow?.customer_email || null
    }

    const totalSpent = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + Number(o.total), 0)

    return {
      id,
      isRegistered: true,
      name: profile.full_name || '—',
      phone: profile.phone || '—',
      email,
      registeredAt: profile.created_at,
      orderCount: orders.length,
      totalSpent,
      orders,
    }
  }

  if (id.startsWith('guest~')) {
    const contactValue = id.slice('guest~'.length)

    const [orders, contactRes] = await Promise.all([
      getOrdersByGuestContact(contactValue),
      supabase
        .from('orders')
        .select('customer_name, customer_phone, customer_email')
        .is('customer_id', null)
        .or(`customer_email.eq.${contactValue},customer_phone.eq.${contactValue}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (contactRes.error) throw contactRes.error

    if (orders.length === 0 && !contactRes.data) {
      const notFoundErr = new Error('Customer not found')
      notFoundErr.notFound = true
      throw notFoundErr
    }

    const totalSpent = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + Number(o.total), 0)

    return {
      id,
      isRegistered: false,
      name: contactRes.data?.customer_name || '—',
      phone: contactRes.data?.customer_phone || '—',
      email: contactRes.data?.customer_email || null,
      registeredAt: null,
      orderCount: orders.length,
      totalSpent,
      orders,
    }
  }

  throw new Error('Invalid customer id')
}