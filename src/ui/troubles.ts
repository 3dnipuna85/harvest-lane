import { CROPS } from '../data/crops';
import { now } from '../game/clock';
import { on } from '../game/events';
import { S, visiting } from '../game/state';
import { FOX_HP, FOX_MS, waterAll, waterAllCost } from '../game/troubles';
import { focusOn } from '../scene/camera';
import { plotPos, PEN } from '../scene/layout';
import { inTown } from '../scene/mode';
import { $, coinHTML, fmt } from './format';
import { shakeScene, toast } from './toasts';
import { setRain } from './sound';

/** The banner that says what trouble is hitting the farm, how long it lasts, and what to do about it. */

const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
let sig = '';

let raining = false;
export function updateTroubles() {
  const r = S.trouble?.kind === 'rain' && !visiting;
  if (r !== raining && setRain(r)) raining = r;
  const el = $('trouble'), tr = S.trouble;
  el.hidden = !tr || visiting;
  document.body.classList.toggle('has-trouble', !el.hidden);
  if (!tr || visiting) { sig = ''; return; }
  $('hint').classList.add('gone');
  const t = now();
  const s = tr.kind + (tr.kind === 'dry' ? S.coins >= waterAllCost() : '') + (tr.hp ?? '') + (tr.crows?.length ?? '');
  if (s !== sig) {
    sig = s;
    el.className = 'trouble ' + tr.kind;
    el.innerHTML = tr.kind === 'rain' ? '🌧️ <b>Heavy rain</b> <span data-left></span><br>Crops grow slowly and ripe crops rot 3× faster. Harvest them now!'
      : tr.kind === 'dry' && S.tech.includes('sprinkler') ? `☀️ <b>Dry spell</b> <span data-left></span><br>💦 Your sprinklers are keeping every crop watered.`
      : tr.kind === 'crows' && S.tech.includes('drone') ? `🐦 <b>Crows!</b><br>🛸 Your crop drone is chasing them off.`
      : tr.kind === 'dry' ? `☀️ <b>Dry spell</b> <span data-left></span><br>Thirsty crops stop growing. Tap the 💧 plots to water them. <button class="btn gold" data-act="waterAll" ${S.coins >= waterAllCost() ? '' : 'disabled'}>Water all ${coinHTML}${fmt(waterAllCost())}</button>`
      : tr.kind === 'crows' ? `🐦 <b>Crows!</b> ${tr.crows!.length} left<br>They’re eating your crops. Tap each crow to shoo it away! <button class="btn alt" data-act="lookTrouble">📍 Show me</button>`
      : `🦊 <b>A fox!</b> <span data-left></span><br>It’s sneaking up to the hen house. Tap it ${tr.hp ?? FOX_HP} more time${(tr.hp ?? FOX_HP) > 1 ? 's' : ''} before it steals eggs and milk! <button class="btn alt" data-act="lookTrouble">📍 Show me</button>`;
  }
  const left = el.querySelector<HTMLElement>('[data-left]');
  if (left) left.textContent = mmss((tr.kind === 'fox' ? tr.start + FOX_MS : tr.end) - t);
}

export function bindTroubles() {
  $('trouble').addEventListener('click', e => {
    if ((e.target as Element).closest('[data-act="lookTrouble"]')) { e.stopPropagation(); look(); return; }
    if (!(e.target as Element).closest('[data-act="waterAll"]')) return;
    e.stopPropagation();
    const r = waterAll();
    if (r.ok) toast(`💦 Every plot is watered (${fmt(r.cost)} coins).`);
    else { toast(`You need ${fmt(r.cost)} coins to water everything. Tap plots to water them free.`); shakeScene(); }
  });
  let eaten: string[] = [];
  on('troubleStart', ({ kind }) => { eaten = []; if ((kind === 'crows' && !S.tech.includes('drone')) || kind === 'fox') { shakeScene(); if (!inTown()) look(); } });
  on('cropEaten', ({ crop }) => eaten.push(CROPS[crop].name.toLowerCase()));
  on('troubleEnd', ({ kind }) => {
    if (kind === 'rain') toast('🌤️ The rain has stopped.');
    else if (kind === 'dry') toast('🌧️ A little rain at last. The dry spell is over.');
    else if (kind === 'crows' && eaten.length) toast(`The crows ate ${eaten.length} plot${eaten.length > 1 ? 's' : ''} of crops (${[...new Set(eaten)].join(', ')}). Shoo them faster next time!`);
  });
  on('troubleBeaten', ({ kind }) => toast(kind === 'fox' ? '🦊 The fox ran off with nothing. Well done!' : '🐦 You chased every crow away!'));
  on('foxStole', ({ egg, milk }) => toast(egg || milk ? `🦊 The fox got away with ${[egg ? `${egg} eggs` : '', milk ? `${milk} milk` : ''].filter(Boolean).join(' and ')}!` : '🦊 The fox found nothing to steal and ran off.'));
}

/** Point the camera at the crows or the fox. */
function look() {
  const tr = S.trouble;
  if (tr?.kind === 'fox') focusOn(PEN.x0, PEN.z1 + 2);
  else if (tr?.kind === 'crows' && tr.crows!.length) { const q = plotPos(tr.crows![0].i); focusOn(q.x, q.z); }
}
