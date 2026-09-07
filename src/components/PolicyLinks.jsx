// Homepage section linking to the store's policy pages.

import { Link } from 'react-router-dom'
import { CreditCard, Truck, RefreshCcw, ShieldCheck, ChevronLeft } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

const POLICIES = [
  { to: '/policies/payment', labelKey: 'footer.paymentPolicy', icon: CreditCard },
  { to: '/policies/shipping', labelKey: 'footer.shippingPolicy', icon: Truck },
  { to: '/policies/returns', labelKey: 'footer.returnsPolicy', icon: RefreshCcw },
  { to: '/policies/privacy', labelKey: 'footer.privacyPolicy', icon: ShieldCheck },
]

export default function PolicyLinks() {
  const { t } = useLanguage()
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {POLICIES.map(({ to, labelKey, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 hover:border-brand-gold/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center text-brand shrink-0">
                <Icon size={18} />
              </span>
              <span className="text-sm font-medium text-gray-800">{t(labelKey)}</span>
            </div>
            <ChevronLeft size={16} className="text-gray-300" />
          </Link>
        ))}
      </div>
    </section>
  )
}