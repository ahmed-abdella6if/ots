// حسابي — customer account page (Stage 16): profile info + entry point to
// order history + logout. Reuses the existing AuthContext entirely — no
// separate auth/profile fetching here. Rendered only for authenticated
// users (see ProtectedCustomerRoute wrapping /account/* in App.jsx).
//
// Field sourcing (nothing invented beyond what's actually available):
//   - name / registeredAt : profiles.full_name / profiles.created_at
//     (profiles has no email column — see customerService.js's note — so
//     email can't come from there)
//   - phone               : profiles.phone
//   - email               : the logged-in user's own session (user.email),
//     which supabase-js exposes locally from their own JWT — this is NOT a
//     query against auth.users, just the client's own already-authenticated
//     session object, so it's safe and doesn't require any RLS/schema change.

import { useNavigate } from 'react-router-dom'
import { User, Mail, Phone, CalendarDays, PackageSearch, LogOut, ChevronLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center text-brand-gold shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function AccountPage() {
  const { user, profile, signOut } = useAuth()
  const { t, dir, language } = useLanguage()
  const navigate = useNavigate()

  // STAGE 30 — the date locale now follows the active language (was
  // hardcoded 'ar-EG'), so "member since" reads naturally in English too.
  function formatDate(dateStr) {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      navigate('/')
    }
  }

  const memberSince = formatDate(profile?.created_at)

  return (
    <div dir={dir} className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('account.title')}</h1>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-2">{t('account.myInfo')}</h2>
        <InfoRow icon={User} label={t('account.name')} value={profile?.full_name} />
        <InfoRow icon={Mail} label={t('auth.email')} value={user?.email} />
        <InfoRow icon={Phone} label={t('auth.phone')} value={profile?.phone} />
        {memberSince && <InfoRow icon={CalendarDays} label={t('account.memberSince')} value={memberSince} />}
      </div>

      <button
        onClick={() => navigate('/account/orders')}
        className={`w-full flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-5 mb-4 hover:border-brand-gold/40 transition-colors ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center text-brand-gold shrink-0">
            <PackageSearch size={16} />
          </div>
          <span className="text-sm font-medium text-gray-900">{t('account.myOrders')}</span>
        </div>
        <ChevronLeft size={18} className={`text-gray-300 ${dir === 'ltr' ? 'rotate-180' : ''}`} />
      </button>

      <button
        onClick={handleLogout}
        className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-5 text-red-600 hover:bg-red-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
          <LogOut size={16} />
        </div>
        <span className="text-sm font-medium">{t('nav.logout')}</span>
      </button>
    </div>
  )
}
