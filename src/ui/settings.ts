/**
 * Fetches the owner's game settings from /api/settings (set on the admin page, /admin) and applies them:
 * pack prices, diamonds and checkout links, a news message, and Double XP events.
 */
import { PACKS, type Pack } from '../data/store';
import { cleanSettings, livePacks } from '../data/settings';
import { live } from '../game/live';
import { markDirty } from './dirty';
import { toast } from './toasts';
import { configureAds } from './ads';

const BASE: Pack[] = PACKS.map(p => ({ ...p }));
const SEEN = 'harvest-lane-news';

export async function loadSettings() {
  try {
    const r = await fetch('/api/settings', { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return;
    const s = cleanSettings(await r.json());
    PACKS.splice(0, PACKS.length, ...livePacks(s, BASE));
    live.xpEventUntil = s.xpEventUntil;
    live.adCap = s.adCap;
    live.rushEvery = s.rushEvery;
    live.rushMin = s.rushMin;
    configureAds({ on: s.adsOn, client: s.adClient, test: s.adsTest, breaks: s.adBreaks, breakMin: s.adBreakMin });
    let seen = '';
    try { seen = localStorage.getItem(SEEN) || ''; } catch { /* private mode */ }
    if (s.news && s.news !== seen) {
      toast('📣 ' + s.news.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!)));
      try { localStorage.setItem(SEEN, s.news); } catch { /* private mode */ }
    }
    if (s.xpEventUntil > Date.now() && !sessionStorage.getItem('xpev')) {
      toast('⭐ Double XP event is on for everyone!');
      try { sessionStorage.setItem('xpev', '1'); } catch { /* private mode */ }
    }
    markDirty();
  } catch { /* offline or no server: keep the built-in settings */ }
}

export function bindSettings() {
  setTimeout(loadSettings, 1500);
  setInterval(loadSettings, 10 * 60_000);
}
