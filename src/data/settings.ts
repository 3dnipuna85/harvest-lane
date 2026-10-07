/**
 * Game settings the owner changes from the admin page (/admin) without a code change. They are kept on the server
 * (Cloudflare KV, key "settings"), served to everyone from /api/settings, and contain nothing secret: secret keys
 * are stored separately and never leave the server.
 */
import { PACKS, type Pack } from './store';

/** What the admin can change about one diamond pack. */
export interface PackSettings { usd?: number; gems?: number; link?: string; testLink?: string; off?: boolean }

export interface GameSettings {
  packs: Record<string, PackSettings>;
  /** Accept Lemon Squeezy test-mode orders (fake cards). Off once the store is live. */
  allowTest: boolean;
  /** Shown on the store info pages for buyers to write to. */
  supportEmail: string;
  /** A message every player sees once when they open the game (empty = none). */
  news: string;
  /** Everyone earns Double XP until this time (ms; 0 = no event). */
  xpEventUntil: number;
  /** Rewarded ads (Google H5 Games Ads): on/off, the AdSense publisher id (public), Google's test ads, and how many a player may watch a day. */
  adsOn: boolean;
  adClient: string;
  adsTest: boolean;
  adCap: number;
  /** Short ads between levels, and the fewest minutes between two of them. */
  adBreaks: boolean;
  adBreakMin: number;
  /** The verified sender address for invite emails (Brevo). */
  mailFrom: string;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: GameSettings = { packs: {}, allowTest: false, supportEmail: '', news: '', xpEventUntil: 0, adsOn: false, adClient: '', adsTest: false, adCap: 10, adBreaks: true, adBreakMin: 3, mailFrom: '', updatedAt: 0 };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
/** Checkout links must be Lemon Squeezy pages. */
const lsLink = (v: unknown) => { const s = str(v, 300); return /^https:\/\/[a-z0-9-]+\.lemonsqueezy\.com\/[^\s"'<>]+$/i.test(s) ? s : ''; };

/** Keep only known, sensible values, so a bad save can't break the game. */
export function cleanSettings(raw: unknown): GameSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rp = (r.packs && typeof r.packs === 'object' ? r.packs : {}) as Record<string, Record<string, unknown>>;
  const packs: Record<string, PackSettings> = {};
  for (const p of PACKS) {
    const o = rp[p.id];
    if (!o || typeof o !== 'object') continue;
    const s: PackSettings = {};
    const usd = num(o.usd, 0.5, 500), gems = num(o.gems, 1, 1_000_000);
    if (usd !== undefined) s.usd = Math.round(usd * 100) / 100;
    if (gems !== undefined) s.gems = Math.round(gems);
    if (lsLink(o.link)) s.link = lsLink(o.link);
    if (lsLink(o.testLink)) s.testLink = lsLink(o.testLink);
    if (o.off === true) s.off = true;
    packs[p.id] = s;
  }
  const email = str(r.supportEmail, 120);
  return {
    packs,
    allowTest: r.allowTest === true,
    supportEmail: /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(email) ? email : '',
    news: str(r.news, 280),
    xpEventUntil: num(r.xpEventUntil, 0, 4e12) ?? 0,
    adsOn: r.adsOn === true,
    adClient: /^ca-pub-\d{10,20}$/.test(str(r.adClient, 40)) ? str(r.adClient, 40) : '',
    adsTest: r.adsTest === true,
    adCap: Math.round(num(r.adCap, 0, 50) ?? 10),
    adBreaks: r.adBreaks !== false,
    adBreakMin: Math.round(num(r.adBreakMin, 1, 120) ?? 3),
    mailFrom: (() => { const m = str(r.mailFrom, 120); return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(m) ? m : ''; })(),
    updatedAt: num(r.updatedAt, 0, 4e12) ?? 0,
  };
}

/** The packs as players see them: the built-in list with the admin's changes on top. Packs switched off are left out. */
export function livePacks(s: GameSettings, base: Pack[] = PACKS): Pack[] {
  return base.filter(p => !s.packs[p.id]?.off).map(p => {
    const o = s.packs[p.id] ?? {};
    return { ...p, usd: o.usd ?? p.usd, gems: o.gems ?? p.gems, link: o.link || p.link, testLink: o.testLink || p.testLink };
  });
}
