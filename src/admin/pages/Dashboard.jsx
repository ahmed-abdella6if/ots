// Admin dashboard — real Supabase data only, no hardcoded stats.
// Each section fetches independently so one failed query doesn't break the rest.

import { useEffect, useState } from 'react'
import { Wallet, ShoppingCart, Package, PackageX, CalendarClock } from 'lucide-react'
import StatCard from '../components/StatCard'
import SalesChart from '../components/SalesChart'
import RecentOrders from '../components/RecentOrders'
import BestSellingProducts from '../components/BestSellingProducts'
import LowStockProducts from '../components/LowStockProducts'
import { formatKWD } from '../../utils/formatPrice'
import {
  getDashboardStats,
  getSalesOverview,
  getRecentOrders,
  getBestSellingProducts,
  getLowStockProducts,
} from '../../services/dashboardService'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)

  const [sales, setSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [salesError, setSalesError] = useState(false)

  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState(false)

  const [bestSellers, setBestSellers] = useState([])
  const [bestSellersLoading, setBestSellersLoading] = useState(true)
  const [bestSellersError, setBestSellersError] = useState(false)

  const [lowStock, setLowStock] = useState([])
  const [lowStockLoading, setLowStockLoading] = useState(true)
  const [lowStockError, setLowStockError] = useState(false)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => {
        console.error('Failed to load dashboard stats:', err.message)
        setStatsError(true)
      })
      .finally(() => setStatsLoading(false))

    getSalesOverview()
      .then(setSales)
      .catch((err) => {
        console.error('Failed to load sales overview:', err.message)
        setSalesError(true)
      })
      .finally(() => setSalesLoading(false))

    getRecentOrders(5)
      .then(setOrders)
      .catch((err) => {
        console.error('Failed to load recent orders:', err.message)
        setOrdersError(true)
      })
      .finally(() => setOrdersLoading(false))

    getBestSellingProducts(5)
      .then(setBestSellers)
      .catch((err) => {
        console.error('Failed to load best sellers:', err.message)
        setBestSellersError(true)
      })
      .finally(() => setBestSellersLoading(false))

    getLowStockProducts()
      .then(setLowStock)
      .catch((err) => {
        console.error('Failed to load low stock products:', err.message)
        setLowStockError(true)
      })
      .finally(() => setLowStockLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          icon={Wallet}
          label="اجمالي المبيعات"
          value={stats ? formatKWD(stats.totalSales) : ''}
          loading={statsLoading}
          error={statsError}
          accent="gold"
        />
        <StatCard
          icon={CalendarClock}
          label="طلبات اليوم"
          value={stats?.todayOrders}
          loading={statsLoading}
          error={statsError}
        />
        <StatCard
          icon={ShoppingCart}
          label="اجمالي الطلبات"
          value={stats?.totalOrders}
          loading={statsLoading}
          error={statsError}
        />
        <StatCard
          icon={Package}
          label="عدد المنتجات"
          value={stats?.totalProducts}
          loading={statsLoading}
          error={statsError}
        />
        <StatCard
          icon={PackageX}
          label="منتجات منخفضة المخزون"
          value={stats?.lowStockCount}
          loading={statsLoading}
          error={statsError}
          accent="danger"
        />
      </div>

      {/* Sales overview */}
      <SalesChart data={sales} loading={salesLoading} error={salesError} />

      {/* Recent orders */}
      <RecentOrders orders={orders} loading={ordersLoading} error={ordersError} />

      {/* Best sellers + low stock side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BestSellingProducts
          products={bestSellers}
          loading={bestSellersLoading}
          error={bestSellersError}
        />
        <LowStockProducts variants={lowStock} loading={lowStockLoading} error={lowStockError} />
      </div>
    </div>
  )
}
