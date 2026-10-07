/**
 * Rewarded video ads through Google H5 Games Ads (the AdSense "Ad Placement API"). The owner turns ads on and
 * enters their AdSense publisher id on the admin page; until then, ?testads gives a practice ad (a 5-second
 * countdown, no real ad) so the flow can be tried.
 */
import { pauseAudio } from './sound';

interface AdBreak { type: 'reward'; name: string; beforeAd?: () => void; afterAd?: () => void; beforeReward?: (show: () => void) => void; adDismissed?: () => void; adViewed?: () => void; adBreakDone?: (i: { breakStatus: string }) => void }
type W = Window & { adsbygoogle?: unknown[] };

let cfg = { on: false, client: '', test: false };
let loaded = '';

const flag = (k: string, q: string) => {
  try {
    const v = new URLSearchParams(location.search).get(q);
    if (v !== null) localStorage.setItem(k, v === '0' ? '0' : '1');
    return localStorage.getItem(k) === '1';
  } catch { return false; }
};
/** ?testads turns practice ads on for this browser, ?testads=0 turns them off. */
export const practiceAds = () => flag('harvest-lane-testads', 'testads');

const push = (o: unknown) => { const w = window as W; (w.adsbygoogle = w.adsbygoogle || []).push(o); };

export function configureAds(c: { on: boolean; client: string; test: boolean }) {
  cfg = c;
  if (!c.on || !c.client || loaded === c.client) return;
  loaded = c.client;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(c.client);
  s.dataset.adClient = c.client;
  s.dataset.adFrequencyHint = '30s';
  if (c.test) s.dataset.adbreakTest = 'on';
  document.head.appendChild(s);
  push({ preloadAdBreaks: 'on', sound: 'on' });
}

export const adsAvailable = () => practiceAds() || (cfg.on && !!cfg.client);

/** A fake ad for trying the flow: a full-screen 5-second countdown. Closing early gives nothing. */
function practiceAd(): Promise<boolean> {
  return new Promise(done => {
    const el = document.createElement('div');
    el.className = 'adcover';
    el.innerHTML = '<div class="adbox"><b>Practice ad</b><p>A real video ad plays here once ads are approved.</p><div class="adcount">5</div><button class="btn alt">Close</button></div>';
    document.body.appendChild(el);
    let n = 5;
    const tick = setInterval(() => {
      n--;
      el.querySelector('.adcount')!.textContent = n > 0 ? String(n) : '✓';
      if (n <= 0) { clearInterval(tick); finish(true); }
    }, 1000);
    const finish = (ok: boolean) => { clearInterval(tick); el.remove(); pauseAudio(false); done(ok); };
    el.querySelector('button')!.addEventListener('click', () => finish(false));
    pauseAudio(true);
  });
}

/** Show a rewarded ad; resolves true only if it was watched to the end. 'none' when no ad could be found. */
export function showRewarded(name: string): Promise<boolean | 'none'> {
  if (practiceAds()) return practiceAd();
  if (!cfg.on || !cfg.client) return Promise.resolve('none');
  return new Promise(done => {
    let offered = false, viewed = false;
    const b: AdBreak = {
      type: 'reward', name,
      beforeAd: () => pauseAudio(true),
      afterAd: () => pauseAudio(false),
      beforeReward: show => { offered = true; show(); },
      adViewed: () => { viewed = true; },
      adDismissed: () => { viewed = false; },
      adBreakDone: () => { pauseAudio(false); done(offered ? viewed : 'none'); },
    };
    push(b);
  });
}
