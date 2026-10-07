import { GOAL_ICON, GOAL_TEXT, TIMED_GAP_MS } from '../game/goals';
import { now } from '../game/clock';
import { on } from '../game/events';
import { S, visiting } from '../game/state';
import { gemHTML } from './estate';
import { $, coinHTML, fmt } from './format';
import { toast } from './toasts';

/** The Targets card under the level pill: this level's two targets and the timed challenge with its countdown. */

const KEY = 'harvest-lane-goals-open';
let open = (() => { try { const v = localStorage.getItem(KEY); return v ? v === '1' : innerWidth >= 700; } catch { return true; } })();
let sig = '';

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function updateGoals() {
  const el = $('goals'), g = S.goals;
  el.hidden = !g || visiting;
  if (!g || visiting) return;
  const t = now(), ch = g.list[2];
  const s = [open, g.lvl, g.list.map(x => x.kind + x.have + x.state + x.until).join(','), g.nextTimed, ch.until - t < 60_000].join('|');
  if (s === sig) {
    // Only the countdowns change from second to second: update them in place.
    el.querySelectorAll<HTMLElement>('[data-until]').forEach(e => { e.textContent = mmss(+e.dataset.until! - t); });
    return;
  }
  sig = s;
  const done = g.list.filter(x => x.state === 'done').length;
  const head = `<button class="goalhead" data-goals>🎯 Level ${g.lvl} targets <b>${done}/3</b>${ch.state === 'open' ? ` <span class="timer ${ch.until - t < 60_000 ? 'hurry' : ''}">⏱ <span data-until="${ch.until}">${mmss(ch.until - t)}</span></span>` : ''}<i>${open ? '▴' : '▾'}</i></button>`;
  if (!open) { el.innerHTML = head; return; }
  const rows = g.list.map((x, i) => {
    const timed = i === 2;
    const reward = `${x.gems ? `${gemHTML()}${x.gems} ` : ''}${coinHTML}${fmt(x.coins)}${x.xp ? ` · ${fmt(x.xp)} XP` : ''}`;
    const note = x.state === 'done' ? '✓ Done'
      : x.state === 'failed' ? `Missed. New challenge in <span data-until="${g.nextTimed}">${mmss(g.nextTimed - t)}</span>`
      : timed ? `⏱ <span data-until="${x.until}">${mmss(x.until - t)}</span> left` : '';
    return `<div class="goal ${x.state} ${timed ? 'timed' : ''}"><span class="gi">${GOAL_ICON[x.kind]}</span><div class="grow">
      <div class="gt">${timed ? '<b>Challenge:</b> ' : ''}${GOAL_TEXT[x.kind](x.n)}</div>
      <div class="gbar"><i style="width:${(100 * x.have) / x.n}%"></i><span>${x.have}/${x.n}</span></div>
      <div class="gr">${note ? `<span class="gn">${note}</span>` : ''}<span class="gw">${reward}</span></div></div></div>`;
  }).join('');
  el.innerHTML = head + rows;
}

export function bindGoalsUI() {
  $('goals').addEventListener('click', e => {
    if (!(e.target as Element).closest('[data-goals]')) return;
    open = !open;
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* not saved */ }
    sig = '';
  });
  on('goalDone', ({ kind, n, coins, gems, timed }) => toast(`${timed ? '⏱ Challenge beaten!' : '🎯 Target reached!'} ${GOAL_TEXT[kind](n)}: +${fmt(coins)} coins${gems ? ` and ${gems} diamonds` : ''}.`));
  on('goalFailed', () => toast(`⏱ Time’s up on the challenge. A new one comes in ${Math.round(TIMED_GAP_MS / 60000)} minutes.`));
}
