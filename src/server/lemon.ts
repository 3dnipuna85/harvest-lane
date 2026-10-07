/**
 * "Connect Lemon Squeezy" for the admin page. With the owner's API key (kept on the server only) we find the
 * store, read its products and fill in each pack's checkout link and price, and create the order webhook with a
 * signing secret we generate, so none of that has to be copied by hand.
 */
import { PACKS } from '../data/store';
import type { GameSettings } from '../data/settings';

const API = 'https://api.lemonsqueezy.com/v1';
export type LsFetch = (url: string, init: RequestInit) => Promise<Response>;

interface LsItem { id: string; attributes: Record<string, unknown> }
export interface LemonReport {
  ok: boolean;
  error?: string;
  store?: string;
  testMode?: boolean;
  products?: { name: string; price: number; pack: string | null; status: string }[];
  webhook?: 'created' | 'exists' | 'failed';
  /** Ids of webhooks we made (so we know their secret). */
  hookIds?: string[];
  missing?: string[];
}

async function ls(key: string, path: string, get: LsFetch, body?: unknown, method?: string) {
  const r = await get(API + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json', authorization: 'Bearer ' + key },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'badkey' : 'ls' + r.status);
  if (r.status === 204) return { data: [] };
  return await r.json() as { data: LsItem[] | LsItem; meta?: Record<string, unknown> };
}

/** Which pack a product is, by the pack's keyword in its name ("Pouch of Diamonds" → pouch). */
export function packFor(name: string) {
  const n = name.toLowerCase();
  return PACKS.find(p => n.includes(p.id) || n.includes(p.name.toLowerCase()))?.id ?? null;
}

export function newSecret() {
  return [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read the store and products and update `s` in place (links and prices). Creates the webhook if the store has
 * none pointing at `hookUrl`, signed with `secret`. A webhook to our URL that we didn't make (`ours` lists the
 * ones we did) has a secret we don't know, so it is replaced.
 */
export async function connectLemon(key: string, s: GameSettings, hookUrl: string, secret: string, ours: string[] = [], get: LsFetch = (u, i) => fetch(u, i)): Promise<LemonReport> {
  try {
    const stores = (await ls(key, '/stores', get)).data as LsItem[];
    if (!stores.length) return { ok: false, error: 'nostore' };
    const store = stores[0];
    const items = (await ls(key, `/products?filter[store_id]=${encodeURIComponent(store.id)}&page[size]=100`, get)).data as LsItem[];
    const products = items.map(p => ({ name: String(p.attributes.name ?? ''), price: Number(p.attributes.price) || 0, url: String(p.attributes.buy_now_url ?? ''), test: !!p.attributes.test_mode, status: String(p.attributes.status ?? '') }));
    // A test-mode key only sees test products; a live key only live ones.
    const testMode = products.length ? products.every(p => p.test) : undefined;
    const report: LemonReport['products'] = [];
    for (const p of products) {
      const pack = p.status === 'published' ? packFor(p.name) : null;
      report.push({ name: p.name, price: p.price, pack, status: p.status });
      if (!pack || !/^https:\/\/[a-z0-9-]+\.lemonsqueezy\.com\//i.test(p.url)) continue;
      const o = (s.packs[pack] ??= {});
      if (p.test) o.testLink = p.url; else o.link = p.url;
      // The product's price is what buyers pay, so the delivery check uses it too.
      if (p.price >= 50) o.usd = p.price / 100;
    }
    if (testMode === true) s.allowTest = true;
    if (testMode === false) s.allowTest = false;
    let webhook: LemonReport['webhook'] = 'failed';
    const hookIds = [...ours];
    try {
      const hooks = ((await ls(key, `/webhooks?filter[store_id]=${encodeURIComponent(store.id)}`, get)).data as LsItem[]).filter(h => h.attributes.url === hookUrl);
      for (const h of hooks.filter(h => !ours.includes(String(h.id)))) await ls(key, '/webhooks/' + h.id, get, undefined, 'DELETE');
      if (hooks.some(h => ours.includes(String(h.id)))) webhook = 'exists';
      else {
        const made = await ls(key, '/webhooks', get, { data: { type: 'webhooks', attributes: { url: hookUrl, events: ['order_created', 'order_refunded'], secret, ...(testMode ? { test_mode: true } : {}) }, relationships: { store: { data: { type: 'stores', id: String(store.id) } } } } });
        hookIds.push(String((made.data as LsItem).id));
        webhook = 'created';
      }
    } catch { /* reported as failed */ }
    const found = new Set(report.map(p => p.pack).filter(Boolean));
    return { ok: true, store: String(store.attributes.name ?? ''), testMode, products: report, webhook, hookIds, missing: PACKS.filter(p => !found.has(p.id)).map(p => p.name) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'failed' };
  }
}
