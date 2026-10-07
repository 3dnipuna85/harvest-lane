import { TIERS, TIER_PAY } from '../data/tiers';
import { ITEMS, type ItemId } from '../data/goods';
import { capped, levelCap, matsShort, nextTier, tierOf, upgradeFarm } from '../game/estate';
import { inv } from '../game/economy';
import { on } from '../game/events';
import { S } from '../game/state';
import { BUILDINGS, BUILDING_IDS, MAX_BUILD, type BuildingId } from '../data/buildings';
import { buildLvl, buildShort, nextStep, upgradeBuilding } from '../game/buildings';
import { iconHTML, uiImg } from './art';
import { markDirty } from './dirty';
import { $, coinHTML, fmt } from './format';
import { fx, shakeScene, toast } from './toasts';

/** The Farm Upgrades panel, the diamond counter, and the toasts for diamonds and the level cap. */

export const gemHTML = () => uiImg('gem', 'coin-dot');
const capTxt = (c: number) => (c === Infinity ? 'no level cap' : `levels up to ${c}`);

export function farmPanel() {
  const t = tierOf(), n = nextTier();
  const ladder = TIERS.map((x, i) => `<div class="tier ${i < S.tier ? 'done' : i === S.tier ? 'cur' : ''}"><b>${x.name}</b><span>${x.cap === Infinity ? 'No cap' : 'Up to Lv ' + x.cap}</span></div>`).join('');
  const next = n ? `<div class="card upgradecard"><div class="top"><div class="big">${uiImg('nav-build')}</div><div class="grow"><div class="ttl">Upgrade to ${n.name}</div>
      <div class="sub">Unlocks ${capTxt(n.cap)}, adds ${n.adds}, and trucks pay ${Math.round(TIER_PAY * 100)}% more. Planks come from the Sawmill and bricks from the Stonecutter.</div></div></div>
      <div class="row costs"><span class="cost ${S.coins >= n.coins ? 'ok' : ''}">${coinHTML}<b data-farmcoins>${fmt(Math.min(S.coins, n.coins))}</b>/${fmt(n.coins)}</span>
      <span class="cost ${S.gems >= n.gems ? 'ok' : ''}">${gemHTML()}<b>${S.gems}</b>/${n.gems}</span>
      ${(Object.entries(n.mats) as [ItemId, number][]).map(([k, q]) => `<span class="cost ${inv(k) >= q ? 'ok' : ''}">${iconHTML(k, 'ic-inline')}<b>${Math.min(inv(k), q)}</b>/${q}</span>`).join('')}
      <button class="btn gold grow-0" data-act="upgradeFarm">Upgrade</button></div></div>`
    : '<div class="empty-note">Your farm is a Grand Estate, the finest in the valley. 🏆</div>';
  const builds = '<div class="secthead">Buildings</div>' + BUILDING_IDS.map(buildCard).join('');
  return `<div class="list"><div class="card"><div class="top"><div class="big">🏡</div><div class="grow"><div class="ttl">${t.name}</div>
      <div class="sub">${capped() ? `<b class="capnote">Level ${S.level} is the top level for a ${t.name}. Upgrade the farm to keep levelling.</b>` : `Your farm allows ${capTxt(levelCap())}.`}</div></div></div></div>
    <div class="tiers">${ladder}</div>
    ${next}
    ${builds}
    <div class="townintro">${gemHTML()} <b>Diamonds</b> are rare. You get one each level-up, sometimes when your shopkeeper makes a sale in town, and sometimes when you load a truck yourself in time for the tip. <button class="btn gold" data-act="tab" data-t="shop">${gemHTML()} Diamond Shop</button></div></div>`;
}

export const farmSignature = () => [BUILDING_IDS.map(k => buildLvl(k) + ':' + buildShort(k).length + ':' + (nextStep(k) ? S.coins >= nextStep(k)!.coins : 0)).join(','), S.tier, S.gems, S.level, capped(), nextTier() ? S.coins >= nextTier()!.coins : 0, matsShort().map(([k]) => k + inv(k)).join(',')].join('|');

const costRow = (coins: number, gems: number, mats: Partial<Record<ItemId, number>>) =>
  `<span class="cost ${S.coins >= coins ? 'ok' : ''}">${coinHTML}<b>${fmt(Math.min(S.coins, coins))}</b>/${fmt(coins)}</span>`
  + (gems ? `<span class="cost ${S.gems >= gems ? 'ok' : ''}">${gemHTML()}<b>${Math.min(S.gems, gems)}</b>/${gems}</span>` : '')
  + (Object.entries(mats) as [ItemId, number][]).map(([k, q]) => `<span class="cost ${inv(k) >= q ? 'ok' : ''}">${iconHTML(k, 'ic-inline')}<b>${Math.min(inv(k), q)}</b>/${q}</span>`).join('');

function buildCard(k: BuildingId) {
  const b = BUILDINGS[k], l = buildLvl(k), n = nextStep(k);
  const pips = Array.from({ length: MAX_BUILD }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
  const head = `<div class="top"><div class="big animal-ic">${b.icon}</div><div class="grow"><div class="ttl">${b.name} <span class="pips">${pips}</span></div><div class="sub">${b.perk}</div></div></div>`;
  if (!n) return `<div class="card">${head}<div class="row"><span class="small grow">Fully upgraded.</span></div></div>`;
  if (S.level < n.lvl) return `<div class="card lockedcard">${head}<div class="row"><span class="small grow">Next: ${n.adds}.</span><span class="small">Lv ${n.lvl}</span></div></div>`;
  return `<div class="card upgradecard">${head}<div class="row"><span class="small grow">Next: ${n.adds}.</span></div>
    <div class="row costs">${costRow(n.coins, n.gems, n.mats)}<button class="btn gold grow-0" data-act="build" data-k="${k}">Upgrade</button></div></div>`;
}

export function farmAction(a: string, k = '') {
  if (a === 'build') {
    const id = k as BuildingId, n = nextStep(id), r = upgradeBuilding(id);
    if (r.ok) { toast(`🔨 ${BUILDINGS[id].name} upgraded! ${n!.adds[0].toUpperCase() + n!.adds.slice(1)} is ready.`, 'lv'); return true; }
    if (r.reason === 'locked') toast(`That upgrade opens at level ${r.lvl}.`);
    else if (r.reason === 'coins' && n) toast(`Save ${fmt(n.coins - S.coins)} more coins for this upgrade.`);
    else if (r.reason === 'gems' && n) toast(`You need ${n.gems - S.gems} more diamonds for this upgrade.`);
    else if (r.reason === 'mats') toast('You need more building materials: ' + buildShort(id).map(([i, q]) => `${q - inv(i)} ${ITEMS[i].name.toLowerCase()}`).join(', ') + '.');
    shakeScene();
    return true;
  }
  if (a !== 'upgradeFarm') return false;
  const n = nextTier(), r = upgradeFarm();
  if (r.ok) return true;
  if (r.reason === 'coins' && n) toast(`Save ${fmt(n.coins - S.coins)} more coins for the upgrade.`);
  else if (r.reason === 'mats' && n) toast('You need more building materials: ' + matsShort().map(([k, q]) => `${q - inv(k)} ${ITEMS[k].name.toLowerCase()}`).join(', ') + '.');
  else if (r.reason === 'gems' && n) toast(`You need ${n.gems - S.gems} more diamonds. Shop sales and fast truck loads find them.`);
  shakeScene();
  return true;
}

let gemsShown = -1, capWas = false;
export function updateGems() {
  if (S.gems !== gemsShown) { $('gems').textContent = fmt(S.gems); gemsShown = S.gems; }
  const c = capped() && S.xp >= 1;
  if (c !== capWas) { document.querySelector('.lvlpill')!.classList.toggle('capped', c); capWas = c; }
}

let capToastAt = 0;
export function bindEstate() {
  on('gems', ({ n, why }) => {
    const r = $('gemPill').getBoundingClientRect();
    fx(r.left + r.width / 2, r.bottom + 8, `+${n} ${gemHTML()}`, 'gemfx');
    if (why === 'cave') toast(`${gemHTML()} You found a diamond inside the crystal!`);
    if (why === 'truck' || why === 'shop') toast(`${gemHTML()} You found a diamond${why === 'shop' ? ' in the shop till' : ' in the truck driver’s tip'}!`);
    markDirty();
  });
  on('levelCapped', ({ level }) => {
    if (performance.now() - capToastAt < 120_000) return;
    capToastAt = performance.now();
    toast(`Level ${level} is the top for a ${tierOf().name}. Tap ${gemHTML()} to upgrade your farm.`);
  });
  on('farmUpgrade', ({ tier }) => {
    toast(`🎉 Your farm is now a ${TIERS[tier].name}! ${TIERS[tier].cap === Infinity ? 'No more level cap.' : 'You can reach level ' + TIERS[tier].cap + '.'}`, 'lv');
    markDirty();
  });
}
