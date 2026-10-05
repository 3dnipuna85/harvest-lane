import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { ITEMS } from '../data/goods';
import { SICK_AFTER_MS, animalCost, animalUnlocked, healAll, sickCount, vetCost } from '../game/animals';
import { unitPrice } from '../game/economy';
import { now } from '../game/clock';
import { on } from '../game/events';
import { onDuty, timeLeft } from '../game/staff';
import { S } from '../game/state';
import {
  BOOST_MIN, MAX_PEN, PEN_STEP, SHOP_COST, SHOP_LVL, SHOP_MARKUP, boostCost, boosted, buyBoost, buyPen, buyShop, maxAnimals, penCost, shopItem,
} from '../game/town';
import { enterTown, inTown, leaveTown } from '../scene/mode';
import type { Place } from '../scene/town/town';
import { SERVICES, type ServiceId } from '../scene/town/services';
import { iconHTML, uiImg } from './art';
import { markDirty } from './dirty';
import { $, coinHTML, fmt } from './format';
import { closeOffice, officePlace, openPlace, togglePlace } from './office';
import { hms, staffCard } from './staff';
import { shakeScene, toast } from './toasts';

/** Driving between the farm and Market Town, and the panels for each place in town. */

let busy = false;

/** A short fade with the farm truck's trip, then swap maps. */
function travel(toTown: boolean, then?: Place) {
  if (busy) return;
  if (inTown() === toTown) { if (then) openPlace(then); return; }
  busy = true;
  closeOffice();
  $('hint').classList.add('gone');
  const v = $('travel');
  v.innerHTML = `<div class="trip"><span class="trip-truck">🛻</span><b>${toTown ? 'Driving to Market Town…' : 'Heading home to the farm…'}</b></div>`;
  v.hidden = false;
  v.classList.remove('out');
  setTimeout(() => {
    if (toTown) enterTown(); else leaveTown();
    document.body.classList.toggle('in-town', toTown);
    markDirty();
    v.classList.add('out');
    setTimeout(() => { v.hidden = true; busy = false; if (then) openPlace(then); }, 350);
  }, 650);
}

export const goTown = (then?: Place) => travel(true, then);
export const goFarm = () => travel(false);

/** Tapping one of the town's other services: say what it will do. */
export function serviceInfo(k: string) {
  const v = SERVICES[k as ServiceId];
  if (v) toast(`${v.name}: ${v.soon}`);
}

/** Tapping a building in town. */
export function visitPlace(p: Place) { openPlace(p); }

const DOCK: [Place | 'farm', string, string][] = [['farm', 'Farm', 'nav-plant'], ['market', 'Market', 'paw'], ['store', 'Store', 'gift'], ['vet', 'Vet', 'heart'], ['shop', 'My shop', 'coin']];
export function renderTownDock() {
  const cur = officePlace();
  $('townDock').innerHTML = DOCK.map(([k, n, ic]) =>
    `<button class="tab ${cur === k ? 'on' : ''}" data-act="${k === 'farm' ? 'farm' : 'place'}" data-k="${k}" aria-label="${n}">${uiImg(ic, 'tab-ic')}<span class="tab-name">${n}</span></button>`).join('');
}

/** Player actions on town buttons (called from the panel's click handler). */
export function townAction(a: string, k: string) {
  if (a === 'place') { togglePlace(k as Place); return true; }
  if (a === 'farm') { goFarm(); return true; }
  if (a === 'town') { goTown(); return true; }
  if (a === 'goMarket') { goTown('market'); return true; }
  if (a === 'goVet') { goTown('vet'); return true; }
  if (a === 'heal') {
    const r = healAll();
    if (r.healed) toast(`The vet treated ${r.healed} animal${r.healed > 1 ? 's' : ''} for ${fmt(r.paid)} coins. Keep them fed!`);
    else { toast('Not enough coins for the vet yet.'); shakeScene(); }
    return true;
  }
  if (a === 'buyPen') {
    const r = buyPen();
    if (r.ok) toast(`Bigger pens built! Room for ${PEN_STEP} more of every animal.`);
    else if (r.reason === 'coins') { toast('Not enough coins yet'); shakeScene(); }
    return true;
  }
  if (a === 'boost') {
    const r = buyBoost();
    if (r.ok) toast(`Fertilizer spread! Crops you plant in the next ${hms(S.boost - now())} grow 25% faster.`);
    else { toast('Not enough coins yet'); shakeScene(); }
    return true;
  }
  if (a === 'buyShop') {
    const r = buyShop();
    if (r.ok) toast('The shop is yours! Hire a shopkeeper to open it.');
    else if (r.reason === 'locked') toast(`You can buy a shop at level ${SHOP_LVL}.`);
    else if (r.reason === 'coins') { toast(`Save ${fmt(SHOP_COST - S.coins)} more coins to buy the shop.`); shakeScene(); }
    return true;
  }
  return false;
}

/** Changes whenever a town panel's structure needs rebuilding. */
export function townSignature(p: Place) {
  return [p, S.level, sickCount(), ANIMAL_IDS.map(k => S.animals[k].n).join(','), S.town.pen, S.town.shop, boosted(), timeLeft('shopkeeper') > 0, shopItem() ?? ''].join('|');
}

function marketCard(k: AnimalId) {
  const a = ANIMALS[k], n = S.animals[k].n, max = maxAnimals(k);
  const what = `Eats ${a.feedQty} ${iconHTML(a.feed, 'ic-inline')} → ${iconHTML(a.product, 'ic-inline')} ${ITEMS[a.product].name}, sells for ${ITEMS[a.product].sell}`;
  const btn = !animalUnlocked(k) ? `<span class="small">Lv ${a.lvl}</span>`
    : n >= max ? `<span class="small">${S.town.pen < MAX_PEN ? 'Pen full' : 'Full'}</span>`
    : `<button class="btn gold" data-act="buyA" data-k="${k}" data-check="cost:${animalCost(k)}">Buy ${coinHTML}${fmt(animalCost(k))}</button>`;
  return `<div class="card ${animalUnlocked(k) ? '' : 'lockedcard'}"><div class="top"><div class="big animal-ic">${a.icon}</div>
    <div class="grow"><div class="ttl">${a.plural} <span class="small">${n}/${max} on your farm</span></div><div class="sub">${what}</div></div>${btn}</div></div>`;
}

function marketPanel() {
  const pen = S.town.pen >= MAX_PEN ? '<span class="small">Biggest pens</span>'
    : `<button class="btn gold" data-act="buyPen" data-check="cost:${penCost()}">${coinHTML}${fmt(penCost())}</button>`;
  return `<div class="list"><div class="townintro">Animals bought here are trucked straight to your farm.</div>
    ${ANIMAL_IDS.map(marketCard).join('')}
    <div class="card"><div class="top"><div class="big">${uiImg('hammer')}</div><div class="grow"><div class="ttl">Bigger pens <span class="small">${S.town.pen}/${MAX_PEN}</span></div>
      <div class="sub">Room for ${PEN_STEP} more of every animal on your farm.</div></div>${pen}</div></div></div>`;
}

function storePanel() {
  const on = boosted();
  return `<div class="list"><div class="townintro">Farm supplies for a faster harvest.</div>
    <div class="card"><div class="top"><div class="big animal-ic">🌱</div><div class="grow"><div class="ttl">Fertilizer ${on ? '<span class="onduty" data-boostleft></span>' : ''}</div>
      <div class="sub">Every crop you or your helpers plant in the next ${BOOST_MIN} minutes grows 25% faster. Buying more adds another ${BOOST_MIN} minutes.</div></div>
      <button class="btn gold" data-act="boost" data-check="cost:${boostCost()}">${on ? '+' + BOOST_MIN + 'm ' : ''}${coinHTML}${fmt(boostCost())}</button></div></div></div>`;
}

function shopPanel() {
  if (!S.town.shop) {
    const locked = S.level < SHOP_LVL;
    return `<div class="list"><div class="card ${locked ? 'lockedcard' : ''}"><div class="top"><div class="big animal-ic">🏪</div><div class="grow"><div class="ttl">A shop of your own</div>
      <div class="sub">Town shoppers pay ${Math.round((SHOP_MARKUP - 1) * 100)}% more than the farm gate. Hire a shopkeeper and they sell your goods and animal products while you farm, even while you’re away. Trucks come first: the shop never sells what a truck is waiting for.</div></div></div>
      <div class="row" style="justify-content:flex-end">${locked ? `<span class="small">Opens at level ${SHOP_LVL}</span>` : `<button class="btn gold" data-act="buyShop" data-check="cost:${SHOP_COST}">Buy the shop ${coinHTML}${fmt(SHOP_COST)}</button>`}</div></div>
      ${locked ? '' : `<div class="townintro">${S.coins >= SHOP_COST ? 'You have enough coins!' : `Save ${fmt(SHOP_COST - S.coins)} more coins.`}</div>`}</div>`;
  }
  const k = shopItem(), open = onDuty('shopkeeper');
  const next = k ? `Next up: ${iconHTML(k, 'ic-inline')} ${ITEMS[k].name} for ${coinHTML}${fmt(Math.round(unitPrice(k) * SHOP_MARKUP))}`
    : 'The shelves are empty. Make goods in your machines or collect animal products.';
  return `<div class="list"><div class="card"><div class="top"><div class="big animal-ic">🏪</div><div class="grow"><div class="ttl">Your Shop <span class="small">${open ? 'Open' : 'Closed'}</span></div>
      <div class="sub">${open ? next : 'Hire a shopkeeper to open up.'}</div><div class="sub">Earned so far: ${coinHTML}<b data-shopearned>${fmt(S.stats.shop || 0)}</b></div></div></div></div>
    ${staffCard('shopkeeper')}</div>`;
}

function vetPanel() {
  const sick = ANIMAL_IDS.filter(k => sickCount(k) > 0);
  const total = sick.reduce((c, k) => c + sickCount(k) * vetCost(k), 0);
  const rows = sick.map(k => `<div class="card"><div class="top"><div class="big animal-ic">${ANIMALS[k].icon}</div><div class="grow"><div class="ttl">${sickCount(k)} sick ${(sickCount(k) > 1 ? ANIMALS[k].plural : ANIMALS[k].name).toLowerCase()}</div>
      <div class="sub">${coinHTML}${fmt(vetCost(k))} each to treat</div></div></div></div>`).join('');
  return `<div class="list"><div class="townintro">Animals left hungry for ${SICK_AFTER_MS / 60000} minutes fall sick. Sick animals stop producing and won’t eat until the vet treats them. An animal keeper keeps them fed while you’re away.</div>
    ${sick.length ? rows + `<div class="row" style="justify-content:flex-end"><button class="btn gold" data-act="heal" data-check="cost:${Math.min(...sick.map(vetCost))}">Treat all ${coinHTML}${fmt(total)}</button></div>`
      : '<div class="empty-note">All your animals are healthy. 🐄</div>'}</div>`;
}

export function townPanel(p: Place) {
  return p === 'market' ? marketPanel() : p === 'store' ? storePanel() : p === 'vet' ? vetPanel() : shopPanel();
}

export function updateTownPanel() {
  document.querySelectorAll<HTMLElement>('[data-boostleft]').forEach(e => { e.textContent = 'On · ' + hms(Math.max(0, S.boost - now())) + ' left'; });
  document.querySelectorAll<HTMLElement>('[data-shopearned]').forEach(e => { e.textContent = fmt(S.stats.shop || 0); });
}

on('staffEnded', ({ k }) => { if (k === 'shopkeeper') markDirty(); });
