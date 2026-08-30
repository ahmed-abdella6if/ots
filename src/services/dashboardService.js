// Dashboard data queries — kept separate from UI components.
// All functions talk to Supabase using the existing authenticated client.
// RLS already restricts these tables to admins (see supabase/schema.sql), so no
// service-role key or special access path is used here.

import { supabase } from '../lib/supabaseClient'

// Easy to change in one place later (e.g. move to store_settings if it should be admin-configurable)
export const LOW_STOCK_THRESHOLD = 5

// Number of days shown in the sales overview chart
const SALES_OVERVIEW_DAYS = 7

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function daysAgoISO(days) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1)) // include today as one of the `days`
  return d.toISOString()
}

function dateKey(isoString) {
  return new Date(isoString).toISOString().slice(0, 10) // YYYY-MM-DD
}

/**
 * Top-level stat cards: total paid sales, today's orders, total orders,
 * total products, and low-stock variant count.
 */
export async function getDashboardStats() {
  const [salesRes, todayOrdersRes, totalOrdersRes, totalProductsRes, lowStockRes] =
    await Promise.all([
      supabase.from('orders').select('total').eq('payment_status', 'paid'),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfTodayISO()),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase
        .from('product_variants')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .lte('stock_quantity', LOW_STOCK_THRESHOLD),
    ])

  if (salesRes.error) throw salesRes.error
  if (todayOrdersRes.error) throw todayOrdersRes.error
  if (totalOrdersRes.error) throw totalOrdersRes.error
  if (totalProductsRes.error) throw totalProductsRes.error
  if (lowStockRes.error) throw lowStockRes.error

  const totalSales = (salesRes.data || []).reduce((sum, o) => sum + Number(o.total || 0), 0)

  return {
    totalSales,
    todayOrders: todayOrdersRes.count ?? 0,
    totalOrders: totalOrdersRes.count ?? 0,
    totalProducts: totalProductsRes.count ?? 0,
    lowStockCount: lowStockRes.count ?? 0,
  }
}

/**
 * Sales over the last N days (default 7): [{ date, orders, sales }]
 * `orders` = orders created that day (any status)
 * `sales`  = sum of `total` for orders paid that day
 */
export async function getSalesOverview(days = SALES_OVERVIEW_DAYS) {
  const since = daysAgoISO(days)

  const { data, error } = await supabase
    .from('orders')
    .select('created_at, total, payment_status')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) throw error

  // Build a map for every day in the range so days with no orders still show up
  const buckets = {}
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (days - 1 - i))
    const key = d.toISOString().slice(0, 10)
    buckets[key] = { date: key, orders: 0, sales: 0 }
  }

  for (const order of data || []) {
    const key = dateKey(order.created_at)
    if (!buckets[key]) continue // outside range due to timezone edge, ignore
    buckets[key].orders += 1
    if (order.payment_status === 'paid') {
      buckets[key].sales += Number(order.total || 0)
    }
  }

  return Object.values(buckets)
}

/**
 * Latest N orders for the dashboard preview table.
 */
export async function getRecentOrders(limit = 5) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, total, payment_status, order_status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * Best-selling products by quantity sold, based on paid orders only.
 * Aggregated client-side since it spans order_items -> orders -> products.
 */
export async function getBestSellingProducts(limit = 5) {
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, product_name, quantity, line_total, orders!inner(payment_status)')
    .eq('orders.payment_status', 'paid')

  if (error) throw error

  const totalsByProduct = new Map()
  for (const item of data || []) {
    const key = item.product_id
    const existing = totalsByProduct.get(key) || {
      productId: key,
      name: item.product_name,
      quantitySold: 0,
      totalSales: 0,
    }
    existing.quantitySold += item.quantity
    existing.totalSales += Number(item.line_total || 0)
    totalsByProduct.set(key, existing)
  }

  const ranked = Array.from(totalsByProduct.values())
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit)

  if (ranked.length === 0) return []

  // Fetch a primary image per product for display
  const productIds = ranked.map((p) => p.productId)
  const { data: images, error: imagesError } = await supabase
    .from('product_images')
    .select('product_id, image_url, is_primary')
    .in('product_id', productIds)

  if (imagesError) throw imagesError

  const imageByProduct = new Map()
  for (const img of images || []) {
    const current = imageByProduct.get(img.product_id)
    if (!current || img.is_primary) {
      imageByProduct.set(img.product_id, img.image_url)
    }
  }

  return ranked.map((p) => ({
    ...p,
    imageUrl: imageByProduct.get(p.productId) || null,
  }))
}

/**
 * Product variants at or below the low-stock threshold.
 */
export async function getLowStockProducts(threshold = LOW_STOCK_THRESHOLD, limit = 10) {
  const { data, error } = await supabase
    .from('product_variants')
    .select(
      'id, stock_quantity, product:products(name), color:product_colors(name), size:product_sizes(name)'
    )
    .eq('is_active', true)
    .lte('stock_quantity', threshold)
    .order('stock_quantity', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (data || []).map((v) => ({
    id: v.id,
    productName: v.product?.name || '—',
    colorName: v.color?.name || '—',
    sizeName: v.size?.name || '—',
    stockQuantity: v.stock_quantity,
  }))
}
