import { MAX_PLOTS } from '../data/limits';
import { on } from '../game/events';
import { plotCost, xpNeed } from '../game/economy';
import { S } from '../game/state';
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
export function updateHud() {
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
