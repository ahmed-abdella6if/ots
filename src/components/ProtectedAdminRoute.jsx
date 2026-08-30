// Protects /admin/* routes — uses the existing AuthContext (useAuth)
// - loading: show a loading state
// - not authenticated: redirect to /login
// - authenticated but not admin: redirect to customer homepage
// - admin: render the nested admin routes

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedAdminRoute() {
  const { user, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">...جاري التحقق من الصلاحيات</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
