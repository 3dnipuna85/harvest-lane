/**
 * The admin page's server side (/api/admin) and the public settings feed (/api/settings).
 * The admin signs in with Google (Firebase Auth) in the browser; every request carries the Firebase ID token,
 * which we check here against Google's public keys. Only emails listed in the ADMIN_EMAILS Cloudflare variable
 * get in. Secrets typed into the admin page are stored under "secret:" keys and are never sent back out.
 */
import { cleanSettings } from '../data/settings';
import { notifyStatus } from './notify';
import { connectLemon, newSecret, type LemonReport, type LsFetch } from './lemon';
import { json, loadSettings, MAIL_KEY, SETTINGS_KEY, WEBHOOK_SECRET_KEY, webhookSecret, type Env, type Order } from './payments';

/** The game's Firebase project (public: it is in every copy of the game's code). */
const FIREBASE_PROJECT = 'harvest-lane-b6dcd';
/** The owner's sign-in email, as a SHA-256 hash so the address itself isn't published. Always an admin. */
export const OWNER_HASHES = ['2b577e1006a97c329ebe9d9dbfb6858cdc0a32d14a79bc266140bbc099d023e6'];
export const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
interface Jwk { kid: string; n: string; e: string; kty: string }
let keyCache: { at: number; keys: Jwk[] } | null = null;
/** For tests. */
export const forgetKeys = () => { keyCache = null; };
export type Fetch = (url: string) => Promise<{ json(): Promise<unknown> }>;

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const part = (s: string) => JSON.parse(new TextDecoder().decode(b64(s)));

async function googleKeys(get: Fetch, fresh = false) {
  if ((fresh && Date.now() - (keyCache?.at ?? 0) > 60_000) || !keyCache || Date.now() - keyCache.at > 3600_000) keyCache = { at: Date.now(), keys: ((await (await get(JWKS)).json()) as { keys: Jwk[] }).keys };
  return keyCache.keys;
}

export interface SignedIn { uid: string; email: string; emailVerified: boolean; name: string }

/** Who sent this request, from the Firebase ID token in its Authorization header (checked against Google's keys). */
export async function verifyUser(req: Request, env: Env, get: Fetch = u => fetch(u)): Promise<SignedIn | { error: string; status: number }> {
  const project = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || FIREBASE_PROJECT;
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [h, p, sig] = tok.split('.');
  if (!h || !p || !sig) return { error: 'signin', status: 401 };
  try {
    const head = part(h), claims = part(p), now = Date.now() / 1000;
    if (head.alg !== 'RS256') return { error: 'signin', status: 401 };
    // Google rotates its keys; an unknown key id means our copy is old.
    const jwk = (await googleKeys(get)).find(k => k.kid === head.kid) ?? (await googleKeys(get, true)).find(k => k.kid === head.kid);
    if (!jwk) return { error: 'signin', status: 401 };
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(sig), new TextEncoder().encode(h + '.' + p));
    if (!ok || claims.aud !== project || claims.iss !== 'https://securetoken.google.com/' + project || !(claims.exp > now) || !(claims.iat < now + 300) || !claims.sub) return { error: 'signin', status: 401 };
    return { uid: String(claims.sub), email: String(claims.email || '').toLowerCase(), emailVerified: !!claims.email_verified, name: String(claims.name || '') };
  } catch { return { error: 'signin', status: 401 }; }
}

/** The signed-in admin's email, or why not. */
export async function verifyAdmin(req: Request, env: Env, get: Fetch = u => fetch(u)): Promise<{ email: string } | { error: string; status: number }> {
  const u = await verifyUser(req, env, get);
  if ('error' in u) return u;
  // More admins can be added with the optional ADMIN_EMAILS Cloudflare variable (comma separated).
  const admins = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!u.emailVerified || !(admins.includes(u.email) || OWNER_HASHES.includes(await sha256(u.email)))) return { error: 'notadmin', status: 403 };
  return { email: u.email };
}

/** GET /api/settings: what every player's game reads. Nothing secret is in it. */
export async function publicSettings(env: Env) {
  const s = await loadSettings(env);
  return new Response(JSON.stringify(s), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } });
}

async function recentOrders(env: Env, max = 1000) {
  if (!env.PURCHASES) return [];
  const out: (Order & { buyer: string })[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PURCHASES.list({ prefix: 'o:', cursor });
    for (const { name } of page.keys) {
      const raw = await env.PURCHASES.get(name);
      if (raw) out.push({ ...JSON.parse(raw), buyer: name.split(':')[1] });
    }
    cursor = page.list_complete || out.length > 500 ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => b.at - a.at).slice(0, max);
}

const LS_KEY = 'secret:ls_api', LS_HOOKS = 'ls:hooks';

/** GET/POST /api/admin. */
export async function handleAdmin(req: Request, env: Env, get?: Fetch, lsFetch?: LsFetch) {
  const who = await verifyAdmin(req, env, get);
  if ('error' in who) return json({ error: who.error }, who.status);
  if (!env.PURCHASES) return json({ error: 'nokv' }, 503);
  let lemon: LemonReport | undefined;
  if (req.method === 'POST') {
    let body: { settings?: unknown; webhookSecret?: string; lsApiKey?: string; lsSync?: boolean; brevoKey?: string };
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    if (body.settings !== undefined) {
      const s = cleanSettings(body.settings);
      s.updatedAt = Date.now();
      await env.PURCHASES.put(SETTINGS_KEY, JSON.stringify(s));
    }
    if (typeof body.webhookSecret === 'string' && body.webhookSecret.trim().length >= 16) await env.PURCHASES.put(WEBHOOK_SECRET_KEY, body.webhookSecret.trim());
    if (typeof body.brevoKey === 'string' && body.brevoKey.trim().length >= 20) await env.PURCHASES.put(MAIL_KEY, body.brevoKey.trim());
    const newKey = typeof body.lsApiKey === 'string' && body.lsApiKey.trim().length > 20 ? body.lsApiKey.trim() : '';
    if (newKey || body.lsSync) {
      const key = newKey || await env.PURCHASES.get(LS_KEY);
      if (!key) lemon = { ok: false, error: 'nokey' };
      else {
        let secret = await webhookSecret(env);
        if (!secret) { secret = newSecret(); await env.PURCHASES.put(WEBHOOK_SECRET_KEY, secret); }
        const s = await loadSettings(env);
        let ours: string[] = [];
        try { ours = JSON.parse(await env.PURCHASES.get(LS_HOOKS) || '[]'); } catch { /* none yet */ }
        lemon = await connectLemon(key, s, new URL(req.url).origin + '/api/ls-webhook', secret, ours, lsFetch);
        // Keep the key only once Lemon Squeezy has accepted it.
        if (lemon.ok) {
          if (newKey) await env.PURCHASES.put(LS_KEY, newKey);
          const clean = cleanSettings(s);
          clean.updatedAt = Date.now();
          await env.PURCHASES.put(SETTINGS_KEY, JSON.stringify(clean));
          await env.PURCHASES.put(LS_HOOKS, JSON.stringify(lemon.hookIds ?? []));
        }
        delete lemon.hookIds;
      }
    }
  }
  return json({
    email: who.email,
    settings: await loadSettings(env),
    secrets: { webhook: !!(await webhookSecret(env)), webhookFromCloudflare: !!env.LS_WEBHOOK_SECRET, lsApi: !!(await env.PURCHASES.get(LS_KEY)), mail: !!(await env.PURCHASES.get(MAIL_KEY)) },
    lemon,
    testFromCloudflare: env.LS_ALLOW_TEST === '1',
    orders: await recentOrders(env),
    notify: await notifyStatus(env.PURCHASES),
  });
}
