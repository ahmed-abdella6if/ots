// Protects /account/* routes — uses the existing AuthContext (useAuth),
// same pattern as ProtectedAdminRoute.jsx but only requires an
// authenticated session (any role), not is_admin().
// - loading: show a loading state (keeps the account nav from flashing)
// - not authenticated: redirect to /login, remembering where they were
//   headed via router state — LoginPage already reads
//   location.state?.from?.pathname and redirects back there after a
//   successful login for non-admin users (see LoginPage.jsx), so no
//   changes were needed there for this stage.
// - authenticated: render the nested /account routes

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedCustomerRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div dir="rtl" className="min-h-[50vh] flex items-center justify-center">
        <p className="text-gray-500">...جاري التحقق من الحساب</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
