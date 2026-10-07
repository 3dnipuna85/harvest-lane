/**
 * Farm alerts while away (server/notify.ts): the game tells the server when its next alerts are due whenever the
 * player leaves (tab hidden or closed), and checks in every so often while they play so nothing is sent then.
 * Also the player's switches: email (on by default, off any time) and push notifications on this device.
 */
import { alertTimes } from '../game/alerts';
import { visiting } from '../game/state';

type Token = () => Promise<string>;
let token: Token | null = null, cached = '', cachedAt = 0, beat: ReturnType<typeof setInterval> | undefined;
export const prefs = { email: true, emailOk: true, push: false, ready: false };
let changed: (() => void) | null = null;
export const onPrefs = (fn: () => void) => { changed = fn; };

const TOKEN_MS = 20 * 60_000, BEAT_MS = 20 * 60_000;

async function tok() {
  if (!token) return '';
  if (!cached || Date.now() - cachedAt > TOKEN_MS) { try { cached = await token(); cachedAt = Date.now(); } catch { cached = ''; } }
  return cached;
}

async function post(body: Record<string, unknown>, keepalive = false) {
  const k = await tok();
  if (!k) return false;
  try {
    const r = await fetch('/api/notify/save', { method: 'POST', keepalive, headers: { authorization: 'Bearer ' + k, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return false;
    const j = await r.json() as { email: boolean; emailOk: boolean; push: boolean };
    Object.assign(prefs, { email: j.email, emailOk: j.emailOk, push: j.push, ready: true });
    changed?.();
    return true;
  } catch { return false; }
}

const wanted = () => prefs.email || prefs.push;
const checkIn = (away: boolean) => { if (!visiting && (wanted() || !prefs.ready)) post({ at: alertTimes(), away }, away); };
const onVis = () => checkIn(document.visibilityState === 'hidden');
const onHide = () => checkIn(true);

/** Signed in: start checking in. */
export function startNotify(t: Token) {
  stopNotify();
  token = t;
  checkIn(false);
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', onHide);
  beat = setInterval(() => { if (document.visibilityState === 'visible') checkIn(false); }, BEAT_MS);
}

/** Signed out. */
export function stopNotify() {
  token = null; cached = ''; prefs.ready = false;
  document.removeEventListener('visibilitychange', onVis);
  removeEventListener('pagehide', onHide);
  clearInterval(beat);
}

export const setEmail = (on: boolean) => post({ email: on, at: alertTimes() });

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in globalThis && 'Notification' in globalThis;

const keyBytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), c => c.charCodeAt(0));

/** Turn push notifications on or off for this device. Returns why not, if it couldn't. */
export async function setPush(on: boolean): Promise<'ok' | 'denied' | 'unsupported' | 'failed'> {
  if (!pushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsupported';
  if (!on) {
    const sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe().catch(() => false);
    return (await post({ push: false, sub: null })) ? 'ok' : 'failed';
  }
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  try {
    const { key } = await (await fetch('/api/notify/key')).json() as { key: string };
    const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
    return (await post({ push: true, sub: sub.toJSON(), at: alertTimes() })) ? 'ok' : 'failed';
  } catch { return 'failed'; }
}
