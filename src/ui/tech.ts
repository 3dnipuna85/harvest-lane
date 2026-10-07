import { TECH, TECH_IDS, type TechId } from '../data/tech';
import { ITEMS, type ItemId } from '../data/goods';
import { CROPS } from '../data/crops';
import { inv, ripe } from '../game/economy';
import { buyTech, harvestAll, hasTech, nextTech, sowAll, techShort } from '../game/tech';
import { S, visiting } from '../game/state';
import { $, coinHTML, fmt } from './format';
import { gemHTML } from './estate';
import { iconHTML } from './art';
import { shakeScene, toast } from './toasts';

/** Farm machines in the Farm Upgrades panel, and the 🚜 / 🌾 buttons beside the zoom controls. */

const costRow = (k: TechId) => {
  const d = TECH[k];
  return `<span class="cost ${S.coins >= d.coins ? 'ok' : ''}">${coinHTML}<b>${fmt(Math.min(S.coins, d.coins))}</b>/${fmt(d.coins)}</span>`
    + `<span class="cost ${S.gems >= d.gems ? 'ok' : ''}">${gemHTML()}<b>${Math.min(S.gems, d.gems)}</b>/${d.gems}</span>`
    + (Object.entries(d.mats) as [ItemId, number][]).map(([i, q]) => `<span class="cost ${inv(i) >= q ? 'ok' : ''}">${iconHTML(i, 'ic-inline')}<b>${Math.min(inv(i), q)}</b>/${q}</span>`).join('');
};

function techCard(k: TechId) {
  const d = TECH[k], head = `<div class="top"><div class="big animal-ic">${d.icon}</div><div class="grow"><div class="ttl">${d.name}${hasTech(k) ? ' <span class="small owned">✓ Yours</span>' : ''}</div><div class="sub">${d.what}</div></div></div>`;
  if (hasTech(k)) return `<div class="card">${head}</div>`;
  if (nextTech() !== k) return `<div class="card lockedcard">${head}<div class="row"><span class="small grow">Buy the ${TECH[nextTech()!].name.toLowerCase()} first.</span><span class="small">Lv ${d.lvl}</span></div></div>`;
  if (S.level < d.lvl) return `<div class="card lockedcard">${head}<div class="row"><span class="small grow">New farming technology.</span><span class="small">Lv ${d.lvl}</span></div></div>`;
  return `<div class="card upgradecard">${head}<div class="row costs">${costRow(k)}<button class="btn gold grow-0" data-act="tech" data-k="${k}">Buy</button></div></div>`;
}

export const techCards = () => '<div class="secthead">Farm machines</div>' + TECH_IDS.map(techCard).join('');
export const techSignature = () => [S.tech.join(','), nextTech() ? S.coins >= TECH[nextTech()!].coins : 0, nextTech() ? techShort(nextTech()!).length : 0].join(';');

export function techAction(a: string, k: string) {
  if (a === 'tech') {
    const id = k as TechId, d = TECH[id], r = buyTech(id);
    if (r.ok) { toast(`${d.icon} Your ${d.name.toLowerCase()} has arrived! ${d.what}`, 'lv'); return true; }
    if (r.reason === 'locked') toast(`The ${d.name.toLowerCase()} is sold from level ${r.lvl}.`);
    else if (r.reason === 'coins') toast(`Save ${fmt(d.coins - S.coins)} more coins for the ${d.name.toLowerCase()}.`);
    else if (r.reason === 'gems') toast(`You need ${d.gems - S.gems} more diamonds for the ${d.name.toLowerCase()}.`);
    else if (r.reason === 'mats') toast('You need more materials: ' + techShort(id).map(([i, q]) => `${q - inv(i)} ${ITEMS[i].name.toLowerCase()}`).join(', ') + '.');
    shakeScene();
    return true;
  }
  if (a === 'sowAll') {
    const n = sowAll();
    if (n) toast(`🚜 The tractor sowed ${n} plot${n > 1 ? 's' : ''} of ${CROPS[S.sel].name.toLowerCase()}.`);
    else if (S.plots.every(p => p.crop)) toast('Every plot is already planted.');
    else toast(`You need ${CROPS[S.sel].seed} coins a plot for ${CROPS[S.sel].name.toLowerCase()} seeds.`);
    return true;
  }
  if (a === 'reapAll') {
    const n = harvestAll();
    toast(n ? `🌾 The combine harvested ${n} crop${n > 1 ? 's' : ''}.` : 'Nothing is ripe yet.');
    return true;
  }
  return false;
}

let shown = '';
/** Show the machine buttons the player owns; light them up when there is work for them. */
export function updateTechBtns() {
  const sow = hasTech('tractor') && !visiting, reap = hasTech('harvester') && !visiting;
  const work = (sow ? (S.plots.some(p => !p.crop) ? 's' : '-') : '') + (reap ? (S.plots.some(p => p.crop && ripe(p)) ? 'r' : '-') : '');
  const k = +sow + ':' + +reap + work;
  if (k === shown) return;
  shown = k;
  const a = $('sowAll') as HTMLButtonElement, b = $('reapAll') as HTMLButtonElement;
  a.hidden = !sow; b.hidden = !reap;
  a.classList.toggle('ready', work.includes('s'));
  b.classList.toggle('ready', work.includes('r'));
}
