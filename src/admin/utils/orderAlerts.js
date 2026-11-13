// New-order alerts for the admin portal: Web Push subscription management
// plus the "cha-ching" sound.
//
// HOW IT FITS TOGETHER
//   - public/sw.js (service worker) receives the server's push, shows the
//     system notification, and messages any open admin page.
//   - This file subscribes the device (stores it in admin_push_subscriptions)
//     and plays the sound when the service worker says a new order arrived.
//   - supabase/functions/notify-new-order sends the push once an order's
//     payment is confirmed.
//
// SOUND LIMITATION: a web push cannot carry a custom sound — when the app
// is closed or in the background the phone plays its own default
// notification sound. The cha-ching plays whenever the admin app is open on
// screen. (It is synthesized with the Web Audio API, so there is no audio
// file to host.)

import { supabase } from '../../lib/supabaseClient'

// Public half of the VAPID key pair — safe to ship in the bundle. The
// private half lives only in the Edge Function secret VAPID_PRIVATE_KEY.
export const VAPID_PUBLIC_KEY =
  'BMNTwNbH_9GsSA7nPHfyW8-bpanVcn_FU7-zbTuoYdORCkj1fAFFYD7yXzdBLYOSVoyE5kw32w4mARvS-cF4rVA'

const SW_URL = '/sw.js'

function urlBase64ToUint8Array(base64) {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// ---------------------------------------------------------------------
// Capability / state
// ---------------------------------------------------------------------

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/**
 * 'unsupported'   – this browser can't do web push
 * 'needs-install' – iPhone/iPad: push only works once the site is added to
 *                   the Home Screen and opened from there
 * 'denied'        – notifications blocked in the phone/browser settings
 * 'off'           – supported, not turned on yet
 * 'on'            – this device is subscribed
 */
export async function getAlertsState() {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'

  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL)
    const sub = await reg?.pushManager.getSubscription()
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export async function registerAlertsWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: '/' })
  } catch (err) {
    console.error('Service worker registration failed:', err.message)
    return null
  }
}

// ---------------------------------------------------------------------
// Subscribe / unsubscribe
// ---------------------------------------------------------------------

/** Must be called from a tap/click (browsers require a gesture to ask). */
export async function enableOrderAlerts(userId) {
  unlockAudio() // the same tap also unlocks sound playback

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    const err = new Error('permission_denied')
    err.code = 'permission_denied'
    throw err
  }

  const reg = await registerAlertsWorker()
  if (!reg) throw new Error('service_worker_failed')
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('admin_push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
}

export async function disableOrderAlerts() {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  const { error } = await supabase.from('admin_push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) console.error('Failed to remove push subscription row:', error.message)
}

// ---------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------

let audioCtx = null

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

/** Call from any user gesture so later (push-triggered) sounds are allowed. */
export function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

// A cash-register "cha-ching": a short metallic "cha" (filtered noise) then
// a bright two-note bell "ching" with inharmonic overtones and a long decay.
export function playChaChing() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const t0 = ctx.currentTime + 0.02
  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  // "cha" — noise burst through a band-pass
  const noiseLen = Math.floor(ctx.sampleRate * 0.09)
  const buf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 3200
  band.Q.value = 1.2
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.0001, t0)
  noiseGain.gain.exponentialRampToValueAtTime(0.7, t0 + 0.008)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09)
  noise.connect(band).connect(noiseGain).connect(master)
  noise.start(t0)

  // "ching" — two bell notes (E7 then G#7) with overtones
  const bell = (freq, start, length) => {
    ;[1, 2.76, 5.4].forEach((ratio, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq * ratio
      const g = ctx.createGain()
      const peak = [0.5, 0.22, 0.1][i]
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(peak, start + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, start + length / (i + 1))
      osc.connect(g).connect(master)
      osc.start(start)
      osc.stop(start + length)
    })
  }
  bell(2637, t0 + 0.11, 1.3)
  bell(3322, t0 + 0.2, 1.6)
}

/**
 * Plays the cha-ching whenever the service worker reports a new-order push
 * while this page is open. Returns a cleanup function.
 */
export function listenForOrderSound() {
  if (!('serviceWorker' in navigator)) return () => {}
  const onMessage = (event) => {
    if (event.data?.type === 'new-order') playChaChing()
  }
  navigator.serviceWorker.addEventListener('message', onMessage)
  return () => navigator.serviceWorker.removeEventListener('message', onMessage)
}
