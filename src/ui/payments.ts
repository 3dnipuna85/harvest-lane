/**
 * Browser side of real-money packs. Each browser gets a random buyer id; the checkout link carries it to Lemon
 * Squeezy, the webhook (functions/api/ls-webhook.ts) files the paid order under it, and we collect it from
 * /api/claim. Collected order ids are kept in the save so the same order never pays out twice.
 */
import { PACKS, type Pack } from '../data/store';
import { grantPack } from '../game/store';
import { S, visiting } from '../game/state';
import { gemHTML } from './estate';
import { markDirty } from './dirty';
import { toast } from './toasts';

const BUYER = 'harvest-lane-buyer', PENDING = 'harvest-lane-checkout';
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } };

export function buyerId() {
  let b = get(BUYER);
  if (!b || !/^[a-f0-9-]{32,40}$/.test(b)) {
    b = crypto.randomUUID?.() ?? [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
    set(BUYER, b);
  }
  return b;
}

/** ?testpay switches this browser to Lemon Squeezy's test checkouts (fake cards); ?testpay=0 switches back. */
export function testPay() {
  try {
    const q = new URLSearchParams(location.search).get('testpay');
    if (q !== null) localStorage.setItem('harvest-lane-testpay', q === '0' ? '0' : '1');
    return localStorage.getItem('harvest-lane-testpay') === '1';
  } catch { return false; }
}
/** The checkout this browser should use for a pack, if any. */
export const packLink = (p: Pack) => (testPay() ? p.testLink : p.link) || '';
const anyLink = () => PACKS.some(p => packLink(p));

/** The pack's checkout page, tagged with who is buying and which pack. */
export function checkoutUrl(p: Pack) {
  const link = packLink(p);
  if (!link) return '';
  const q = `checkout[custom][buyer]=${encodeURIComponent(buyerId())}&checkout[custom][pack]=${encodeURIComponent(p.id)}`;
  return link + (link.includes('?') ? '&' : '?') + q;
}

/** The player opened a checkout: look for the payment for a while, whenever they come back. */
export function markCheckout() { set(PENDING, String(Date.now())); }
const pendingFor = () => Date.now() - (+(get(PENDING) || 0));

let busy = false;
export async function claimPacks() {
  if (busy || visiting || !anyLink()) return 0;
  busy = true;
  try {
    const r = await fetch('/api/claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buyer: buyerId() }) });
    if (!r.ok) return 0;
    const { orders } = await r.json() as { orders?: { id: string; pack: string }[] };
    let n = 0;
    for (const o of orders ?? []) {
      if (S.paid.includes(o.id)) continue;
      const p = PACKS.find(x => x.id === o.pack);
      if (!p) continue;
      S.paid.push(o.id);
      grantPack(p.id, undefined, true);
      toast(`Thank you! ${p.name} arrived: ${gemHTML()}${p.gems.toLocaleString()} diamonds.`);
      n++;
    }
    if (n) { set(PENDING, null); markDirty(); }
    return n;
  } catch { return 0; } finally { busy = false; }
}

/** Opening the shop checks too, at most every 20 seconds. */
let lastLook = 0;
export function claimSoon() { if (Date.now() - lastLook > 20_000) { lastLook = Date.now(); claimPacks(); } }

/** Collect on start, when the tab comes back after a checkout, and every few seconds for a while after one. */
export function bindPayments() {
  if (!anyLink()) return;
  if (/[?&]paid=/.test(location.search)) { markCheckout(); history.replaceState(null, '', location.pathname); }
  setTimeout(claimPacks, 3000);
  addEventListener('visibilitychange', () => { if (!document.hidden && pendingFor() < 30 * 60_000) claimPacks(); });
  setInterval(() => { if (pendingFor() < 10 * 60_000) claimPacks(); }, 6000);
}
