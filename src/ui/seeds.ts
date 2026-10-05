import { CROPS, CROP_IDS } from '../data/crops';
import { S } from '../game/state';
import { iconHTML } from './art';
import { $, coinHTML } from './format';

export function renderSeeds() {
  $('seeds').innerHTML = CROP_IDS.map(k => {
    const c = CROPS[k], lock = c.lvl > S.level;
    return `<button class="seed ${S.sel === k ? 'sel' : ''} ${lock ? 'locked' : ''}" data-act="seed" data-k="${k}" ${lock ? 'disabled' : ''} aria-pressed="${S.sel === k}">
      ${iconHTML(k, 'ic')}${lock ? `<span>Lv ${c.lvl}</span>` : `<span class="c">${coinHTML}${c.seed}</span><span>${c.time}s</span>`}</button>`;
  }).join('');
}
