/**
 * Rewards for watching an ad (players who don't pay can still speed things up). Each reward costs one of the
 * day's ad views; the daily limit is set from the admin page (game/live.ts).
 */
import { CROPS } from '../data/crops';
import { now } from './clock';
import { gainGems } from './estate';
import { emit } from './events';
import { live } from './live';
import { S } from './state';
import { bagCoins, running } from './store';

export type AdReward = 'gems' | 'coins' | 'rush' | 'grow';
export const AD_GEMS = 3;

const today = (t = now()) => new Date(t).toISOString().slice(0, 10);
export const adsUsed = (t = now()) => (S.ads.day === today(t) ? S.ads.n : 0);
export const adsLeft = (t = now()) => Math.max(0, live.adCap - adsUsed(t));
export const adCoins = () => Math.round(bagCoins(0) * 0.6);
export const growing = (t = now()) => S.plots.filter(p => p.crop && t - p.at < CROPS[p.crop].time * 1000).length;

/** Whether a reward would do anything right now. */
export function adUseful(r: AdReward, t = now()) {
  if (r === 'rush') return running().length > 0;
  if (r === 'grow') return growing(t) > 0;
  return true;
}

/** Count one of today's ad views; false if none are left. */
export function useAdView(t = now()) {
  if (adsLeft(t) <= 0) return false;
  S.ads = { day: today(t), n: adsUsed(t) + 1 };
  return true;
}

/** Give the reward for an ad that was watched to the end. */
export function grantAd(r: AdReward, t = now()) {
  if (adsLeft(t) <= 0 || !adUseful(r, t)) return false;
  useAdView(t);
  if (r === 'gems') gainGems(AD_GEMS, 'ad');
  else if (r === 'coins') S.coins += adCoins();
  else if (r === 'rush') for (const k of running()) S.machines[k].job!.end = t;
  else for (const p of S.plots) if (p.crop && t - p.at < CROPS[p.crop].time * 1000) p.at = t - CROPS[p.crop].time * 1000;
  emit('adReward', { r });
  return true;
}
