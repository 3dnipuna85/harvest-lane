import { MAX_PLOTS } from '../data/limits';
import { on } from '../game/events';
import { plotCost, xpNeed } from '../game/economy';
import { S } from '../game/state';
import { now } from '../game/clock';
import { canFillTruck } from '../game/trucks';
import { inv } from '../game/economy';
import { iconHTML } from './art';
import type { ItemId } from '../data/goods';
import { markDirty } from './dirty';
import { $, coinHTML, fmt } from './format';
import { celebrateLevel } from './levelup';

export function bindHud() {
  on('earn', () => {
    const p = $('coinPill');
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  });
  on('levelUp', ({ level }) => {
    celebrateLevel(level);
    markDirty();
  });
}

/** Coins, level, XP bar and the "buy another plot" button. Runs every frame; only touches what changed. */
const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let truckHTML = '';

/** Always-visible truck pill: when the next truck comes and what it wants, or how long the waiting one has left. */
function updateTruckPill() {
  const el = $('truckPill'), t = now(), k = S.truck;
  const wants = (k ? k.items : S.nextWants) ?? {};
  const items = (Object.entries(wants) as [ItemId, number][])
    .map(([i, q]) => `<span class="tp-i ${inv(i) >= q ? 'ok' : ''}">${iconHTML(i, 'ic-need')}${q}</span>`).join('');
  const html = k
    ? `<span class="tp-t">🚚 ${clock(k.end - t)}</span>${items}`
    : `<span class="tp-t">🚚 in ${clock(S.nextTruck - t)}</span>${items}`;
  if (html !== truckHTML) { el.innerHTML = html; truckHTML = html; }
  el.hidden = false;
  el.classList.toggle('here', !!k);
  el.classList.toggle('ready', canFillTruck());
  el.classList.toggle('soon', !k && S.nextTruck - t < 10000);
  el.setAttribute('aria-label', k ? 'Truck waiting, open orders' : 'Next truck, open orders');
}

export function updateHud() {
  updateTruckPill();
  $('coins').textContent = fmt(S.coins);
  $('lvl').textContent = String(S.level);
  $('xp').style.width = ((100 * S.xp) / xpNeed(S.level)).toFixed(1) + '%';
  const ex = $('expand') as HTMLButtonElement;
  if (S.plots.length >= MAX_PLOTS) { ex.disabled = true; ex.textContent = 'All land'; }
  else {
    const c = plotCost();
    ex.disabled = S.coins < c;
    const h = '<b>New plot</b><span>' + coinHTML + fmt(c) + '</span>';
    if (ex.innerHTML !== h) ex.innerHTML = h;
  }
}
