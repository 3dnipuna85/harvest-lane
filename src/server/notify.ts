/**
 * Farm alerts while the player is away: "your animals are hungry" and "your crops are ready". The game tells us
 * when each alert is due (POST /api/notify/save); a Cloudflare cron Worker calls /api/notify/run every few minutes
 * and we send whatever is due, by email (Brevo) and as a browser push notification (Web Push with our own VAPID
 * key, made on first use). Limits: one email per kind per day, one push per kind every 3 hours. Every email has an
 * unsubscribe link, and the player can switch either off in the game.
 */
import { json, loadSettings, MAIL_KEY, type Env, type KV } from './payments';
import { sha256, verifyUser, type Fetch } from './admin';

export type Kind = 'sick' | 'rot';
export const KINDS: Kind[] = ['sick', 'rot'];
/** The player counts as playing (no alerts) for this long after the game last checked in. */
export const SEEN_MS = 25 * 60_000;
/** Alerts more than this late are dropped. */
export const STALE_MS = 2 * 3600_000;
export const PUSH_GAP_MS = 3 * 3600_000;
export const VAPID_KEY = 'secret:vapid', UNSUB_KEY = 'secret:unsub', CRON_KEY = 'secret:cron', LAST_RUN = 'notify:last';
const recKey = (uid: string) => 'n:' + uid;
const pushKey = async (endpoint: string) => 'pe:' + (await sha256(endpoint));

export interface Sub { endpoint: string; keys?: Record<string, string> }
export interface Rec {
  email: string; emailOk: boolean; name: string;
  at: Partial<Record<Kind, number>>;
  /** When the game last checked in while open (0 = the player left). */
  seen: number;
  emailOn: boolean; pushOn: boolean; sub?: Sub;
  /** The alert time each kind was last sent for, the day of its last email, and its last push. */
  sent: Partial<Record<Kind, number>>; mailDay: Partial<Record<Kind, string>>; pushAt: Partial<Record<Kind, number>>;
  msg?: { title: string; body: string; at: number };
}

export const TEXT: Record<Kind, { title: string; body: string; subject: string; lead: string }> = {
  sick: { title: '🐔 Your animals are hungry', body: 'Some of your animals will fall sick soon unless they are fed. Tap to feed them.', subject: 'Your farm animals are hungry 🐔', lead: 'Some of your animals have been waiting for food and will fall sick soon. Pop in and feed them before the vet has to come!' },
  rot: { title: '🌾 Your crops are ready', body: 'Ripe crops will start to rot soon. Tap to harvest them.', subject: 'Your crops are ready to harvest 🌾', lead: 'Your crops are ripe. Harvest them soon, because ripe crops left in the field start to rot.' },
};

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (s: string) => new TextEncoder().encode(s);
const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/** A secret made on first use and kept in KV ("secret:" keys never leave the server). */
async function secretFor(kv: KV, key: string) {
  let s = await kv.get(key);
  if (!s) { s = b64u(crypto.getRandomValues(new Uint8Array(24))); await kv.put(key, s); }
  return s;
}

/** Our VAPID key pair for Web Push, made on first use. */
export async function vapid(kv: KV): Promise<{ pub: string; priv: JsonWebKey }> {
  const raw = await kv.get(VAPID_KEY);
  if (raw) return JSON.parse(raw);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const v = { pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer)), priv: await crypto.subtle.exportKey('jwk', kp.privateKey) as JsonWebKey };
  await kv.put(VAPID_KEY, JSON.stringify(v));
  return v;
}

/** The signed VAPID header for one push service. */
export async function vapidAuth(v: { pub: string; priv: JsonWebKey }, endpoint: string, contact: string, t = Date.now()) {
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(t / 1000) + 12 * 3600, sub: contact })));
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(head + '.' + body)));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pub}`;
}

async function unsubSig(kv: KV, uid: string) {
  const k = await crypto.subtle.importKey('raw', enc(await secretFor(kv, UNSUB_KEY)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc(uid)))).slice(0, 32);
}

/** When the next alert for this player is due (for the KV listing), or 0 for none. */
export function nextDue(r: Rec) {
  let due = Infinity;
  for (const k of KINDS) {
    const at = r.at[k];
    if (!at || r.sent[k] === at) continue;
    if (!(r.emailOn && r.emailOk) && !(r.pushOn && r.sub)) continue;
    due = Math.min(due, at);
  }
  if (due === Infinity) return 0;
  return r.seen ? Math.max(due, r.seen + SEEN_MS) : due;
}

const blank = (): Rec => ({ email: '', emailOk: false, name: '', at: {}, seen: 0, emailOn: true, pushOn: false, sent: {}, mailDay: {}, pushAt: {} });
async function load(kv: KV, uid: string): Promise<Rec> {
  const raw = await kv.get(recKey(uid));
  try { return raw ? { ...blank(), ...JSON.parse(raw) } : blank(); } catch { return blank(); }
}
const store = (kv: KV, uid: string, r: Rec) => kv.put(recKey(uid), JSON.stringify(r), { metadata: { due: nextDue(r) } });

/** POST /api/notify/save {at?, away?, email?, push?, sub?}: the game checks in. Returns the player's switches. */
export async function handleSave(req: Request, env: Env, get?: Fetch, t = Date.now()) {
  const me = await verifyUser(req, env, get);
  if ('error' in me) return json({ error: me.error }, me.status);
  const kv = env.PURCHASES;
  if (!kv) return json({ error: 'nokv' }, 503);
  let b: { at?: Record<string, unknown>; away?: unknown; email?: unknown; push?: unknown; sub?: unknown } = {};
  try { b = await req.json(); } catch { /* empty body: just a check-in */ }
  const r = await load(kv, me.uid);
  r.email = me.email; r.emailOk = !!me.email && me.emailVerified; r.name = me.name;
  if (b.at && typeof b.at === 'object') {
    r.at = {};
    for (const k of KINDS) { const v = Number(b.at[k]); if (Number.isFinite(v) && v > t - 86400_000 && v < t + 7 * 86400_000) r.at[k] = Math.round(v); }
  }
  r.seen = b.away ? 0 : t;
  if (typeof b.email === 'boolean') r.emailOn = b.email;
  if (typeof b.push === 'boolean') r.pushOn = b.push;
  if (b.sub === null && r.sub) { await kv.delete?.(await pushKey(r.sub.endpoint)); delete r.sub; }
  else if (b.sub && typeof b.sub === 'object' && typeof (b.sub as Sub).endpoint === 'string' && /^https:\/\//.test((b.sub as Sub).endpoint) && (b.sub as Sub).endpoint.length < 1000) {
    r.sub = { endpoint: (b.sub as Sub).endpoint };
    await kv.put(await pushKey(r.sub.endpoint), me.uid, { expirationTtl: 90 * 86400 });
  }
  await store(kv, me.uid, r);
  return json({ email: r.emailOn, emailOk: r.emailOk, push: r.pushOn && !!r.sub });
}

/** GET /api/notify/key: the public VAPID key the browser subscribes with. */
export async function handleKey(env: Env) {
  if (!env.PURCHASES) return json({ error: 'nokv' }, 503);
  return json({ key: (await vapid(env.PURCHASES)).pub });
}

/** POST /api/notify/msg {endpoint}: the service worker asks what its (empty) push was about. */
export async function handleMsg(req: Request, env: Env, t = Date.now()) {
  const kv = env.PURCHASES;
  const fallback = { title: 'Harvest Lane', body: 'Your farm needs you! 🌾' };
  if (!kv) return json(fallback);
  let endpoint = '';
  try { endpoint = String((await req.json() as { endpoint?: unknown }).endpoint || ''); } catch { /* fallback */ }
  const uid = endpoint ? await kv.get(await pushKey(endpoint)) : null;
  const m = uid ? (await load(kv, uid)).msg : undefined;
  return json(m && t - m.at < 3600_000 ? { title: m.title, body: m.body } : fallback);
}

const page = (title: string, text: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font-family:Arial,sans-serif;background:#f4efe2;color:#3b2a1a;display:grid;place-items:center;min-height:90vh;margin:0;padding:16px">
<div style="max-width:420px;background:#fffdf7;border:1px solid #e4d8bf;border-radius:16px;padding:24px"><h1 style="font-size:22px;margin:0 0 10px">🌾 ${title}</h1><p style="line-height:1.5;margin:0 0 16px">${text}</p><a href="/" style="color:#3d7a1f;font-weight:bold">Back to Harvest Lane</a></div></body>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });

/** GET /api/notify/unsub?u=&s=: the unsubscribe link in every alert email. */
export async function handleUnsub(req: Request, env: Env) {
  const kv = env.PURCHASES, q = new URL(req.url).searchParams, uid = q.get('u') || '';
  if (!kv || !uid || q.get('s') !== await unsubSig(kv, uid)) return page('Link not valid', 'This unsubscribe link is broken or old. You can turn farm emails off in the game: tap your name, then Notifications.');
  const r = await load(kv, uid);
  r.emailOn = false;
  await store(kv, uid, r);
  return page('You’re unsubscribed', 'You won’t get any more farm emails from Harvest Lane. You can turn them back on any time in the game: tap your name, then Notifications.');
}

export function alertEmail(kind: Kind, name: string, play: string, unsub: string) {
  const x = TEXT[kind], esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const hi = name ? `Hi ${esc(name.split(/\s/)[0])},` : 'Hi farmer,';
  const html = `<!doctype html><html><body style="margin:0;background:#f4efe2;font-family:Arial,Helvetica,sans-serif;color:#3b2a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf7;border-radius:16px;overflow:hidden;border:1px solid #e4d8bf">
<tr><td style="background:#5aa832;padding:22px 24px;color:#fff;font-size:24px;font-weight:bold">🌾 Harvest Lane</td></tr>
<tr><td style="padding:24px"><p style="font-size:18px;margin:0 0 12px">${hi}</p>
<p style="margin:0 0 22px;line-height:1.5">${x.lead}</p>
<p style="margin:0 0 22px"><a href="${esc(play)}" style="background:#e2a31f;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">Go to my farm</a></p>
<p style="margin:0;font-size:12px;color:#7a6650;line-height:1.5">You get at most one of these a day. <a href="${esc(unsub)}" style="color:#7a6650">Unsubscribe</a>, or turn emails off in the game under your name → Notifications.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: x.subject, html, text: `${hi}\n\n${x.lead}\n\nGo to my farm: ${play}\n\nUnsubscribe: ${unsub}` };
}

export type Send = (url: string, init: RequestInit) => Promise<Response>;

/** GET /api/notify/run?k=: called by the cron Worker. Sends every alert that is due. */
export async function handleRun(req: Request, env: Env, send: Send = (u, i) => fetch(u, i), t = Date.now()) {
  const kv = env.PURCHASES;
  if (!kv) return json({ error: 'nokv' }, 503);
  if (new URL(req.url).searchParams.get('k') !== await kv.get(CRON_KEY)) return json({ error: 'key' }, 403);
  const origin = new URL(req.url).origin, st = await loadSettings(env), mailKey = await kv.get(MAIL_KEY);
  const contact = st.supportEmail ? 'mailto:' + st.supportEmail : origin;
  let v: Awaited<ReturnType<typeof vapid>> | null = null;
  let emails = 0, pushes = 0, cursor: string | undefined;
  do {
    const pg = await kv.list({ prefix: 'n:', cursor });
    for (const { name, metadata } of pg.keys) {
      const due = (metadata as { due?: number } | undefined)?.due || 0;
      if (!due || due > t) continue;
      const uid = name.slice(2), r = await load(kv, uid);
      for (const k of KINDS) {
        const at = r.at[k];
        if (!at || r.sent[k] === at || at > t || (r.seen && t - r.seen < SEEN_MS)) continue;
        r.sent[k] = at;
        if (t - at > STALE_MS) continue;
        r.msg = { title: TEXT[k].title, body: TEXT[k].body, at: t };
        if (r.emailOn && r.emailOk && mailKey && st.mailFrom && r.mailDay[k] !== day(t)) {
          const unsub = `${origin}/api/notify/unsub?u=${encodeURIComponent(uid)}&s=${await unsubSig(kv, uid)}`;
          const m = alertEmail(k, r.name, origin + '/', unsub);
          const res = await send('https://api.brevo.com/v3/smtp/email', {
            method: 'POST', headers: { 'api-key': mailKey, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ sender: { name: 'Harvest Lane', email: st.mailFrom }, to: [{ email: r.email }], subject: m.subject, htmlContent: m.html, textContent: m.text, tags: ['alert-' + k], headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }),
          });
          if (res.ok) { r.mailDay[k] = day(t); emails++; }
        }
        if (r.pushOn && r.sub && t - (r.pushAt[k] || 0) >= PUSH_GAP_MS) {
          v ??= await vapid(kv);
          const res = await send(r.sub.endpoint, { method: 'POST', headers: { TTL: '7200', Urgency: 'normal', Authorization: await vapidAuth(v, r.sub.endpoint, contact, t), 'Content-Length': '0' } });
          if (res.status === 404 || res.status === 410) { await kv.delete?.(await pushKey(r.sub.endpoint)); delete r.sub; }
          else if (res.ok) { r.pushAt[k] = t; pushes++; }
        }
      }
      await store(kv, uid, r);
    }
    cursor = pg.list_complete ? undefined : pg.cursor;
  } while (cursor);
  // Remember the last run (at most once an hour, to spare KV writes) so the admin page can show the timer works.
  const last = +(await kv.get(LAST_RUN) || 0);
  if (t - last > 3600_000 || emails || pushes) await kv.put(LAST_RUN, String(t));
  return json({ ok: true, emails, pushes });
}

/** For the admin page: the cron key (made on first use) and when the timer last ran. */
export async function notifyStatus(kv: KV) {
  return { cronKey: await secretFor(kv, CRON_KEY), lastRun: +(await kv.get(LAST_RUN) || 0) };
}
