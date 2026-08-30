// Customer-facing order status timeline (Stage 17) — /account/orders/:id
//
// Only uses statuses that actually exist in order_status_enum (see
// ORDER_STATUS_FLOW / CANCELLED_STATUS, the single shared source in
// admin/pages/Orders.jsx — not redefined here). Handles three cases:
//   1. Normal flow status (جديد / قيد التجهيز / تم الشحن / تم التسليم)
//      -> stepper with completed/current/upcoming steps
//   2. Cancelled (ملغي) -> a distinct cancelled state, not a stepper step
//   3. Anything else (a future/unknown enum value added later without this
//      component being updated) -> falls back to just showing the raw
//      status text so the page never breaks

import { Check, X } from 'lucide-react'
import { ORDER_STATUS_FLOW, CANCELLED_STATUS } from '../admin/pages/Orders'

export default function OrderStatusTimeline({ status }) {
  if (status === CANCELLED_STATUS) {
    return (
      <div className="flex items-center gap-3 bg-red-50 rounded-2xl p-4">
        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
          <X size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-red-700">تم إلغاء الطلب</p>
          <p className="text-xs text-red-500 mt-0.5">لن يتم تجهيز أو شحن هذا الطلب</p>
        </div>
      </div>
    )
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status)

  // Unknown status not in the known flow — don't guess, just show it plainly.
  if (currentIndex === -1) {
    return (
      <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600">
        حالة الطلب الحالية: <span className="font-bold text-gray-900">{status}</span>
      </div>
    )
  }

  return (
    <div dir="rtl" className="bg-white border border-gray-100 rounded-2xl p-5">
      <ol className="flex items-start justify-between">
        {ORDER_STATUS_FLOW.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = index === currentIndex
          const isUpcoming = index > currentIndex

          return (
            <li key={step} className="flex-1 flex flex-col items-center relative">
              {index > 0 && (
                <div
                  className={`absolute top-4 h-0.5 w-full -translate-y-1/2 ${
                    index <= currentIndex ? 'bg-brand-gold' : 'bg-gray-100'
                  }`}
                  style={{ right: '50%' }}
                  aria-hidden="true"
                />
              )}

              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCompleted
                    ? 'bg-brand-gold text-white'
                    : isCurrent
                    ? 'bg-brand-gold text-white ring-4 ring-brand-gold/20'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? <Check size={14} /> : index + 1}
              </div>

              <span
                className={`mt-2 text-[11px] text-center leading-tight ${
                  isUpcoming ? 'text-gray-400' : isCurrent ? 'font-bold text-gray-900' : 'text-gray-600'
                }`}
              >
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}