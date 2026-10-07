/**
 * Server side of real-money packs, shared by the Cloudflare Pages Functions in functions/api/ (and the tests).
 * Lemon Squeezy calls the webhook when an order is paid; we keep the order in Cloudflare KV under the buyer id the
 * game put in the checkout link, and the game collects it from /api/claim. No secret ever reaches the browser:
 * the webhook signing secret lives only in the Cloudflare environment (LS_WEBHOOK_SECRET).
 */
import { PACKS } from '../data/store';

/** The bits of a Cloudflare KV namespace we use. */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(o: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}
export interface Env { PURCHASES?: KV; LS_WEBHOOK_SECRET?: string }

/** One paid order waiting in KV. */
export interface Order { id: string; pack: string; at: number; claimed?: number; refunded?: number }

/** Buyer ids are random UUIDs made by the game; anything else is refused. */
export const okBuyer = (b: unknown): b is string => typeof b === 'string' && /^[a-f0-9-]{32,40}$/.test(b);
const key = (buyer: string, id: string) => `o:${buyer}:${id}`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function hmacHex(secret: string, body: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body)));
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}
/** Compare without leaking how many characters matched. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const signBody = hmacHex;

/** GET /api/ls-webhook: says whether the server is set up, without revealing anything. */
export const webhookHealth = (env: Env) => json({ ok: !!(env.PURCHASES && env.LS_WEBHOOK_SECRET), store: !!env.PURCHASES, secret: !!env.LS_WEBHOOK_SECRET });

/** POST /api/ls-webhook: a signed event from Lemon Squeezy. */
export async function handleWebhook(req: Request, env: Env) {
  if (!env.PURCHASES || !env.LS_WEBHOOK_SECRET) return json({ error: 'not set up' }, 500);
  const body = await req.text();
  const sig = (req.headers.get('x-signature') || '').toLowerCase();
  if (!sig || !same(sig, await hmacHex(env.LS_WEBHOOK_SECRET, body))) return json({ error: 'bad signature' }, 401);
  let ev: { meta?: { event_name?: string; test_mode?: boolean; custom_data?: Record<string, unknown> }; data?: { id?: string; attributes?: Record<string, unknown> } };
  try { ev = JSON.parse(body); } catch { return json({ error: 'bad json' }, 400); }
  const name = ev.meta?.event_name, cd = ev.meta?.custom_data ?? {}, a = ev.data?.attributes ?? {}, id = String(ev.data?.id ?? '');
  const buyer = cd.buyer, pack = PACKS.find(p => p.id === cd.pack);
  // Orders made outside the game (no buyer or pack) are fine, there is just nothing to deliver.
  if (!okBuyer(buyer) || !pack || !id) return json({ ignored: true });
  const k = key(buyer, id), old = await env.PURCHASES.get(k);
  if (name === 'order_created') {
    if (a.status !== 'paid') return json({ ignored: 'status' });
    // The price paid before tax must cover the pack, so a cheap product can't be relabelled as the Vault.
    if (Number(a.subtotal_usd) < Math.round(pack.usd * 100) - 1) return json({ ignored: 'price' });
    if (old) return json({ ok: true, again: true });
    const o: Order = { id, pack: pack.id, at: Date.now() };
    await env.PURCHASES.put(k, JSON.stringify(o));
    return json({ ok: true });
  }
  if (name === 'order_refunded' && old) {
    const o: Order = JSON.parse(old);
    o.refunded = Date.now();
    await env.PURCHASES.put(k, JSON.stringify(o));
    return json({ ok: true });
  }
  return json({ ignored: name });
}

/** POST /api/claim {buyer}: hand over this buyer's paid, uncollected orders and mark them collected. */
export async function handleClaim(req: Request, env: Env) {
  if (!env.PURCHASES) return json({ orders: [] });
  let buyer: unknown;
  try { buyer = (await req.json() as { buyer?: unknown }).buyer; } catch { /* handled below */ }
  if (!okBuyer(buyer)) return json({ error: 'bad buyer' }, 400);
  const out: { id: string; pack: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PURCHASES.list({ prefix: `o:${buyer}:`, cursor });
    for (const { name } of page.keys) {
      const raw = await env.PURCHASES.get(name);
      if (!raw) continue;
      const o: Order = JSON.parse(raw);
      if (o.claimed || o.refunded) continue;
      o.claimed = Date.now();
      await env.PURCHASES.put(name, JSON.stringify(o));
      out.push({ id: o.id, pack: o.pack });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json({ orders: out });
}
