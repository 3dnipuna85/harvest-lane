import { MAX_PLOTS } from '../data/limits';
import { on } from '../game/events';
import { plotCost, xpNeed } from '../game/economy';
import { S } from '../game/state';
import { markDirty } from './dirty';
import { $, coinHTML, fmt } from './format';
import { toast } from './toasts';

export function bindHud() {
  on('earn', () => {
    const p = $('coinPill');
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  });
  on('levelUp', ({ level, unlocked }) => {
    toast('Level ' + level + '!' + (unlocked.length ? ' Unlocked: ' + unlocked.join(', ') : ''), 'lv');
    markDirty();
  });
}

/** Coins, level, XP bar and the "buy another plot" button. Runs every frame; only touches what changed. */
export function updateHud() {
  $('coins').textContent = fmt(S.coins);
  $('lvl').textContent = 'Lv ' + S.level;
  $('xp').style.width = ((100 * S.xp) / xpNeed(S.level)).toFixed(1) + '%';
  const ex = $('expand') as HTMLButtonElement;
  if (S.plots.length >= MAX_PLOTS) { ex.disabled = true; ex.textContent = 'All land owned'; }
  else {
    const c = plotCost();
    ex.disabled = S.coins < c;
    const h = 'Buy another plot ' + coinHTML + fmt(c);
    if (ex.innerHTML !== h) ex.innerHTML = h;
  }
}
