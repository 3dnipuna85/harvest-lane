import { isRush, restartTarget, RUSH_RETRY_MS, canDouble, canExtend, doubleGoal, EXTEND_GEMS, extendChallenge, FAILED_GAP_MS, GOAL_ICON, GOAL_TEXT, SKIP_GEMS, skipWait } from '../game/goals';
import { adsLeft, useAdView } from '../game/ads';
import { adsAvailable, watchFor } from './ads';
import { save } from '../game/state';
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
  const ad = adsAvailable() && adsLeft(t) > 0;
  const s = [open, g.lvl, g.list.map(x => x.kind + x.have + x.state + x.until + !!x.dbl).join(','), g.nextTimed, ch.until - t < 60_000, ad, S.gems >= SKIP_GEMS, canExtend(t)].join('|');
  if (s === sig) {
    // Only the countdowns change from second to second: update them in place.
    el.querySelectorAll<HTMLElement>('[data-until]').forEach(e => { e.textContent = mmss(+e.dataset.until! - t); });
    return;
  }
  sig = s;
  const done = g.list.filter(x => x.state === 'done').length;
  const head = `<button class="goalhead" data-goals>${isRush(g.lvl) ? '⚡ Rush level' : '🎯 Level'} ${g.lvl} targets <b>${done}/3</b>${ch.state === 'open' ? ` <span class="timer ${ch.until - t < 60_000 ? 'hurry' : ''}">⏱ <span data-until="${ch.until}">${mmss(ch.until - t)}</span></span>` : ''}<i>${open ? '▴' : '▾'}</i></button>`;
  if (!open) { el.innerHTML = head; return; }
  const rows = g.list.map((x, i) => {
    const timed = i === 2;
    const reward = `${x.gems ? `${gemHTML()}${x.gems} ` : ''}${coinHTML}${fmt(x.coins)}${x.xp ? ` · ${fmt(x.xp)} XP` : ''}`;
    const waiting = timed && x.state !== 'open';
    if (!timed && x.until && x.state !== 'done') {
      // A rush-level target: its own countdown, and a restart when it's missed.
      const note = x.state === 'failed' ? `Missed. Restarts in <span data-until="${x.retryAt}">${mmss((x.retryAt ?? 0) - t)}</span>` : `⏱ <span data-until="${x.until}">${mmss(x.until - t)}</span> left`;
      const acts = x.state === 'failed' ? `<div class="gacts">${ad ? `<button class="btn alt" data-gact="restartad" data-i="${i}">📺 Restart now</button>` : ''}<button class="btn gold" data-gact="restartgem" data-i="${i}" ${S.gems >= SKIP_GEMS ? '' : 'disabled'}>${gemHTML()}${SKIP_GEMS} ${ad ? '' : 'Restart now'}</button></div>` : '';
      return `<div class="goal ${x.state} timed"><span class="gi">${GOAL_ICON[x.kind]}</span><div class="grow">
      <div class="gt">${GOAL_TEXT[x.kind](x.n)}</div>
      <div class="gbar"><i style="width:${(100 * x.have) / x.n}%"></i><span>${x.have}/${x.n}</span></div>
      <div class="gr"><span class="gn">${note}</span><span class="gw">${reward}</span></div>${acts}</div></div>`;
    }
    const note = waiting ? `${x.state === 'failed' ? 'Missed.' : '✓ Done.'} Next in <span data-until="${g.nextTimed}">${mmss(g.nextTimed - t)}</span>`
      : x.state === 'done' ? (x.dbl ? '✓ Done · doubled' : '✓ Done')
      : timed ? `⏱ <span data-until="${x.until}">${mmss(x.until - t)}</span> left` : '';
    // Optional ways forward: start the next challenge now, or double a finished target's reward.
    const acts = waiting
      ? `<div class="gacts">${ad ? `<button class="btn alt" data-gact="skipad">📺 ${x.state === 'failed' ? 'Retry' : 'Next'} now</button>` : ''}<button class="btn gold" data-gact="skipgem" ${S.gems >= SKIP_GEMS ? '' : 'disabled'}>${gemHTML()}${SKIP_GEMS} ${ad ? '' : x.state === 'failed' ? 'Retry now' : 'Next now'}</button></div>`
      : timed && canExtend(t) ? `<div class="gacts">${ad ? '<button class="btn alt" data-gact="extad">📺 +5 min</button>' : ''}<button class="btn gold" data-gact="extgem" ${S.gems >= EXTEND_GEMS ? '' : 'disabled'}>${gemHTML()}${EXTEND_GEMS} +5 min</button></div>`
      : canDouble(i) && ad ? `<div class="gacts"><button class="btn alt" data-gact="double" data-i="${i}">📺 Watch to double it</button></div>` : '';
    return `<div class="goal ${x.state} ${timed ? 'timed' : ''}"><span class="gi">${GOAL_ICON[x.kind]}</span><div class="grow">
      <div class="gt">${timed ? '<b>Challenge:</b> ' : ''}${GOAL_TEXT[x.kind](x.n)}</div>
      <div class="gbar"><i style="width:${(100 * x.have) / x.n}%"></i><span>${x.have}/${x.n}</span></div>
      <div class="gr">${note ? `<span class="gn">${note}</span>` : ''}<span class="gw">${reward}</span></div>${acts}</div></div>`;
  }).join('');
  el.innerHTML = head + rows;
}

export function bindGoalsUI() {
  $('goals').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-gact]');
    if (b && !b.disabled) {
      const a = b.dataset.gact, i = +(b.dataset.i ?? 0);
      if (a === 'skipgem') { if (skipWait('gems')) { toast('A new challenge has started. Go!'); save(); } }
      else if (a === 'skipad') watchFor('next-challenge', () => useAdView() && skipWait('ad'), 'A new challenge has started. Go!', toast).then(() => save());
      else if (a === 'restartgem') { if (restartTarget(i, 'gems')) { toast('Target restarted. Go!'); save(); } }
      else if (a === 'restartad') watchFor('restart-target', () => useAdView() && restartTarget(i, 'ad'), 'Target restarted. Go!', toast).then(() => save());
      else if (a === 'extgem') { if (extendChallenge('gems')) { toast('+5 minutes. You can do it!'); save(); } }
      else if (a === 'extad') watchFor('extend-challenge', () => useAdView() && extendChallenge('ad'), '+5 minutes. You can do it!', toast).then(() => save());
      else if (a === 'double') watchFor('double-target', () => useAdView() && doubleGoal(i), 'Reward doubled! 🎉', toast).then(() => save());
      sig = '';
      return;
    }
    if (!(e.target as Element).closest('[data-goals]')) return;
    open = !open;
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* not saved */ }
    sig = '';
  });
  on('goalDone', ({ kind, n, coins, gems, timed }) => toast(`${timed ? '⏱ Challenge beaten!' : '🎯 Target reached!'} ${GOAL_TEXT[kind](n)}: +${fmt(coins)} coins${gems ? ` and ${gems} diamonds` : ''}.`));
  on('goalFailed', ({ rush }) => rush ? toast(`⏱ Time’s up on a rush target. It restarts in ${Math.round(RUSH_RETRY_MS / 60000)} minutes, or restart it now from the Targets card.`) : toast(`⏱ Time’s up on the challenge. A new one comes in ${Math.round(FAILED_GAP_MS / 60000)} minutes, or start one now from the Targets card.`));
}
