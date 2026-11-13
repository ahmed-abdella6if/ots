// Admin header control for new-order phone alerts: turn notifications on/off
// for THIS device and test the cha-ching sound. See utils/orderAlerts.js.

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2, Volume2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getAlertsState,
  enableOrderAlerts,
  disableOrderAlerts,
  playChaChing,
  unlockAudio,
} from '../utils/orderAlerts'

const HINTS = {
  'needs-install':
    'على الايفون: افتح الموقع في Safari ثم زر المشاركة ثم "اضافة الى الشاشة الرئيسية"، وبعدها افتح الاختصار من الشاشة الرئيسية وفعّل التنبيهات من هناك.',
  unsupported: 'هذا المتصفح لا يدعم التنبيهات. جرب Chrome على الاندرويد او Safari على الايفون (iOS 16.4 او اعلى).',
  denied: 'التنبيهات محظورة لهذا الموقع. فعّلها من اعدادات الهاتف او المتصفح ثم حاول مرة اخرى.',
}

export default function OrderAlertsButton() {
  const { user } = useAuth()
  const [state, setState] = useState(null) // null while checking
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = useCallback(() => getAlertsState().then(setState), [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleClick() {
    unlockAudio()
    setMessage('')

    if (state === 'needs-install' || state === 'unsupported' || state === 'denied') {
      setMessage(HINTS[state])
      return
    }

    setBusy(true)
    try {
      if (state === 'on') {
        await disableOrderAlerts()
      } else {
        await enableOrderAlerts(user.id)
        playChaChing() // confirms sound works, and the tap unlocked audio
      }
    } catch (err) {
      console.error('Order alerts toggle failed:', err.message)
      setMessage(
        err.code === 'permission_denied'
          ? HINTS.denied
          : 'تعذر تغيير حالة التنبيهات، حاول مرة اخرى'
      )
    } finally {
      setBusy(false)
      refresh()
    }
  }

  if (state === null) return null

  const on = state === 'on'
  const Icon = busy ? Loader2 : on ? BellRing : state === 'denied' ? BellOff : Bell

  return (
    <div className="relative flex items-center gap-1">
      {on && (
        <button
          type="button"
          onClick={() => {
            unlockAudio()
            playChaChing()
          }}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          title="تجربة الصوت"
          aria-label="تجربة الصوت"
        >
          <Volume2 size={18} />
        </button>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
          on ? 'text-green-700 bg-green-50 hover:bg-green-100' : 'text-gray-600 hover:bg-gray-100'
        }`}
        title={on ? 'ايقاف تنبيهات الطلبات على هذا الجهاز' : 'تفعيل تنبيهات الطلبات على هذا الجهاز'}
      >
        <Icon size={16} className={busy ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">{on ? 'التنبيهات مفعلة' : 'تفعيل التنبيهات'}</span>
      </button>

      {message && (
        <div
          role="status"
          onClick={() => setMessage('')}
          className="absolute top-full mt-2 left-0 z-50 w-72 max-w-[85vw] rounded-xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg"
        >
          {message}
        </div>
      )}
    </div>
  )
}
