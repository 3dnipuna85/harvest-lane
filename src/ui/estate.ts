import { TIERS, TIER_PAY } from '../data/tiers';
import { capped, levelCap, nextTier, tierOf, upgradeFarm } from '../game/estate';
import { on } from '../game/events';
import { S } from '../game/state';
import { uiImg } from './art';
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
      <div class="sub">Unlocks ${capTxt(n.cap)}, adds ${n.adds}, and trucks pay ${Math.round(TIER_PAY * 100)}% more.</div></div></div>
      <div class="row costs"><span class="cost ${S.coins >= n.coins ? 'ok' : ''}">${coinHTML}<b data-farmcoins>${fmt(Math.min(S.coins, n.coins))}</b>/${fmt(n.coins)}</span>
      <span class="cost ${S.gems >= n.gems ? 'ok' : ''}">${gemHTML()}<b>${S.gems}</b>/${n.gems}</span>
      <button class="btn gold grow-0" data-act="upgradeFarm">Upgrade</button></div></div>`
    : '<div class="empty-note">Your farm is a Grand Estate, the finest in the valley. 🏆</div>';
  return `<div class="list"><div class="card"><div class="top"><div class="big">🏡</div><div class="grow"><div class="ttl">${t.name}</div>
      <div class="sub">${capped() ? `<b class="capnote">Level ${S.level} is the top level for a ${t.name}. Upgrade the farm to keep levelling.</b>` : `Your farm allows ${capTxt(levelCap())}.`}</div></div></div></div>
    <div class="tiers">${ladder}</div>
    ${next}
    <div class="townintro">${gemHTML()} <b>Diamonds</b> are rare. You get one each level-up, sometimes when your shopkeeper makes a sale in town, and sometimes when you load a truck yourself in time for the tip.</div></div>`;
}

export const farmSignature = () => [S.tier, S.gems, S.level, capped(), nextTier() ? S.coins >= nextTier()!.coins : 0].join('|');

export function farmAction(a: string) {
  if (a !== 'upgradeFarm') return false;
  const n = nextTier(), r = upgradeFarm();
  if (r.ok) return true;
  if (r.reason === 'coins' && n) toast(`Save ${fmt(n.coins - S.coins)} more coins for the upgrade.`);
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
