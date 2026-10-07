import { updateTroubles } from './troubles';
import { updateGoals } from './goals';
import { updateGems } from './estate';
import { updateTechBtns } from './tech';
import { on } from '../game/events';
import { matsOk, nextParcel, plotCost, plotLvl, plotMats, plotSlot, xpNeed } from '../game/economy';
import { S } from '../game/state';
import { live } from '../game/live';
import { now } from '../game/clock';
import { canFillTruck } from '../game/trucks';
import { inv } from '../game/economy';
import { iconHTML, matsHTML } from './art';
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
  updateGoals();
  updateTroubles();
  updateGems();
  updateTechBtns();
  updateTruckPill();
  $('coins').textContent = fmt(S.coins);
  $('lvl').textContent = String(S.level);
  $('xp').style.width = ((100 * S.xp) / xpNeed(S.level)).toFixed(1) + '%';
  document.querySelector('.lvlpill')?.classList.toggle('xp2', S.xpBoost > Date.now() || live.xpEventUntil > Date.now());
  const ex = $('expand') as HTMLButtonElement;
  const slot = plotSlot();
  if (!slot) {
    // The home field is full: the button becomes a savings goal for the next parcel of land.
    const p = nextParcel();
    ex.classList.toggle('land', !!p);
    if (!p) { ex.disabled = true; ex.textContent = 'All land'; }
    else {
      ex.disabled = false;
      const pct = Math.min(100, (S.coins / p.cost) * 100).toFixed(0);
      const h = `<b>${p.name}</b><span>${coinHTML}${fmt(p.cost)}${matsHTML(p.mats, inv)}</span><i class="save"><i style="width:${pct}%"></i></i>`;
      if (ex.innerHTML !== h) ex.innerHTML = h;
      ex.classList.toggle('ready', S.coins >= p.cost && S.level >= p.lvl && matsOk(p.mats));
    }
  } else {
    const c = plotCost(), need = plotLvl();
    ex.classList.remove('land', 'ready');
    ex.disabled = S.coins < c || S.level < need;
    const h = (slot === 'river' ? '<b>Riverside plot</b>' : '<b>New plot</b>') + (S.level < need ? `<span>🔒 Lv ${need}</span>` : '<span>' + coinHTML + fmt(c) + matsHTML(plotMats(), inv) + '</span>');
    if (ex.innerHTML !== h) ex.innerHTML = h;
  }
}
