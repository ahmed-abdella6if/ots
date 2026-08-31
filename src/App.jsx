// Root application component
// React Router setup: customer routes + protected /admin/* routes, RTL throughout

import { Routes, Route } from 'react-router-dom'

import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'
import ProtectedCustomerRoute from './components/ProtectedCustomerRoute'

// Customer pages
import HomePage from './pages/HomePage'
import CategoryPage from './pages/CategoryPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import OrderPaymentPage from './pages/OrderPaymentPage'
import OrderPaymentReturnPage from './pages/OrderPaymentReturnPage'
import AccountPage from './pages/AccountPage'
import MyOrdersPage from './pages/MyOrdersPage'
import MyOrderDetailPage from './pages/MyOrderDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PolicyPaymentPage from './pages/PolicyPaymentPage'
import PolicyShippingPage from './pages/PolicyShippingPage'
import PolicyReturnsPage from './pages/PolicyReturnsPage'
import NotFoundPage from './pages/NotFoundPage'

// Admin pages
import Dashboard from './admin/pages/Dashboard'
import Products from './admin/pages/Products'
import ProductForm from './admin/pages/ProductForm'
import ProductImages from './admin/pages/ProductImages'
import ProductVariants from './admin/pages/ProductVariants'
import Categories from './admin/pages/Categories'
import Orders from './admin/pages/Orders'
import OrderDetail from './admin/pages/OrderDetail'
import Customers from './admin/pages/Customers'
import Discounts from './admin/pages/Discounts'
import HomepageManagement from './admin/pages/HomepageManagement'
import Settings from './admin/pages/Settings'

export default function App() {
  return (
    <Routes>
      {/* Customer site */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />
        <Route path="/order-payment/:orderId" element={<OrderPaymentPage />} />
        <Route path="/order-payment/:orderId/return" element={<OrderPaymentReturnPage />} />
        <Route element={<ProtectedCustomerRoute />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/orders" element={<MyOrdersPage />} />
          <Route path="/account/orders/:id" element={<MyOrderDetailPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/policies/payment" element={<PolicyPaymentPage />} />
        <Route path="/policies/shipping" element={<PolicyShippingPage />} />
        <Route path="/policies/returns" element={<PolicyReturnsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Admin portal — protected, admin role required */}
      <Route path="/admin" element={<ProtectedAdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="products/:id/images" element={<ProductImages />} />
          <Route path="products/:id/variants" element={<ProductVariants />} />
          <Route path="categories" element={<Categories />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="discounts" element={<Discounts />} />
          <Route path="homepage" element={<HomepageManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}