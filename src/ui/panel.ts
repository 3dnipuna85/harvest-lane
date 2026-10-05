import type { CropId } from '../data/crops';
import { GOODS, ITEMS, ITEM_IDS, type ItemId } from '../data/goods';
import { MAX_FARMHANDS, MAX_MACHINE_LEVEL, MAX_PLOTS, MAX_SELLERS } from '../data/limits';
import { MACHINES, MACHINE_IDS, recipe, type MachineId } from '../data/machines';
import { now } from '../game/clock';
import { farmhandCost, inv, mTime, mUpCost, sellerCost, totalItems } from '../game/economy';
import { canFill, canSkip, orderItems } from '../game/orders';
import { canFillTruck, truckOffer } from '../game/trucks';
import { ANIMALS, ANIMAL_IDS, type AnimalId } from '../data/animals';
import { animalCost, animalState, animalUnlocked } from '../game/animals';
import { save, S, type Order, type Tab } from '../game/state';
import * as act from './actions';
import { charImg, customerFace, iconHTML, uiImg } from './art';
import { $, coinHTML, fmt } from './format';
import { closeOffice, officeOpen, toggleOffice } from './office';

const TABS: [Tab, string, string][] = [['orders', 'Orders', 'book'], ['barn', 'Barn', 'crate'], ['animals', 'Animals', 'cow'], ['machines', 'Machines', 'hammer'], ['helpers', 'Helpers', 'friends']];
let resetArmed = false;
let resetTimer: ReturnType<typeof setTimeout> | undefined;

export function renderTabs() {
  $('tabs').innerHTML = TABS.map(([k, n, ic]) =>
    `<button class="tab ${officeOpen() && S.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}" aria-label="${n}">${uiImg(ic, 'tab-ic')}<span class="tab-name">${n}</span><span class="badge" data-badge="${k}" hidden></span></button>`).join('');
}

function itemRow(k: ItemId) {
  const it = ITEMS[k];
  return `<div class="card"><div class="top"><div class="big">${iconHTML(k)}</div>
    <div class="grow"><div class="ttl">${it.name}</div><div class="sub">${it.sell} coins each</div></div>
    <div class="count" data-count="${k}">0</div>
    <button class="btn alt" data-act="sell" data-k="${k}" data-n="1" data-check="inv:${k}">Sell 1</button>
    <button class="btn gold" data-act="sell" data-k="${k}" data-n="all" data-check="inv:${k}">All</button></div></div>`;
}

/** Changes whenever the panel's structure (not just its numbers) needs rebuilding. */
export function panelSignature() {
  const parts: unknown[] = [S.tab, S.level];
  if (S.tab === 'barn') parts.push(ITEM_IDS.filter(k => inv(k) > 0).join(','));
  if (S.tab === 'orders') parts.push(S.orders.map(o => o.id).join(','), S.truck?.id ?? 0, Math.round(S.rep * 2));
  if (S.tab === 'machines') parts.push(MACHINE_IDS.map(k => { const m = S.machines[k]; return k + m.owned + m.lvl + m.on; }).join(','));
  if (S.tab === 'animals') parts.push(ANIMAL_IDS.map(k => S.animals[k].n).join(','));
  if (S.tab === 'helpers') parts.push(S.farmhands, S.sellers, S.sellCrops, resetArmed);
  return parts.join('|');
}

function machineCard(k: MachineId) {
  const d = MACHINES[k], m = S.machines[k], g = GOODS[d.out];
  const rec = recipe(k).map(([i, q]) => q + ' ' + iconHTML(i, 'ic-inline')).join(' + ') + ' → ' + iconHTML(d.out, 'ic-inline');
  if (d.lvl > S.level) {
    return `<div class="card lockedcard"><div class="top"><div class="big">${iconHTML(d.out)}</div><div class="grow"><div class="ttl">${d.name}</div><div class="sub">${rec}</div></div><span class="small">Unlocks at Lv ${d.lvl}</span></div></div>`;
  }
  if (!m.owned) {
    return `<div class="card"><div class="top"><div class="big">${iconHTML(d.out)}</div><div class="grow"><div class="ttl">${d.name}</div><div class="sub">${rec} · ${d.time}s · sells for ${g.sell}</div></div>
      <button class="btn gold" data-act="buyM" data-k="${k}" data-check="cost:${d.cost}">${coinHTML}${fmt(d.cost)}</button></div></div>`;
  }
  const up = m.lvl < MAX_MACHINE_LEVEL
    ? `<button class="btn alt" data-act="upM" data-k="${k}" data-check="cost:${mUpCost(k)}">Faster ${coinHTML}${fmt(mUpCost(k))}</button>`
    : '<span class="small">Max speed</span>';
  return `<div class="card"><div class="top"><div class="big">${iconHTML(d.out)}</div><div class="grow"><div class="ttl">${d.name} <span class="small">Lv ${m.lvl}</span></div><div class="sub">${rec} · ${mTime(k).toFixed(1)}s</div></div>
      <label class="toggle"><input type="checkbox" id="on-${k}" data-act="toggleM" data-k="${k}" ${m.on ? 'checked' : ''}>Run</label></div>
      <div class="mbar"><i data-mbar="${k}"></i></div>
      <div class="row"><span class="small grow" data-mstat="${k}"></span>${up}</div></div>`;
}

export function renderPanel() {
  let h = '';
  if (S.tab === 'orders') {
    h = '<div class="list">' + truckCard() + S.orders.map((o, i) => `
      <div class="card"><div class="top"><div class="big">${customerFace(o.who)}</div><div class="grow"><div class="ttl">${o.who}</div><div class="sub">Wants a delivery</div></div>
        <div class="reward">${coinHTML}${fmt(o.coins)} <span class="small">+${o.xp} XP</span></div></div>
        <div class="needs">${orderItems(o).map(([k, q]) => `<span class="need" data-need="${k}" data-q="${q}">${iconHTML(k, 'ic-need')}<span>0/${q}</span></span>`).join('')}</div>${hints(o)}
        <div class="row"><button class="btn" data-act="deliver" data-i="${i}" data-check="order:${i}">Deliver</button>
        <button class="btn alt" data-act="skip" data-i="${i}" data-check="skip">Skip</button><span class="small" data-skipnote></span></div>
      </div>`).join('') + '</div>';
  }
  if (S.tab === 'barn') {
    const ks = ITEM_IDS.filter(k => inv(k) > 0);
    h = ks.length ? '<div class="list">' + ks.map(itemRow).join('') + '</div>'
      : '<div class="empty-note">The barn is empty. Harvest crops and they will show up here.</div>';
  }
  if (S.tab === 'machines') h = '<div class="list">' + MACHINE_IDS.map(machineCard).join('') + '</div>';
  if (S.tab === 'animals') h = `<div class="list">
      <div class="row tend"><span class="small grow">Tap an animal on the farm to feed it, then tap again to collect.</span>
      <button class="btn gold" data-act="tend" data-check="tend">Feed and collect all</button></div>
      ${ANIMAL_IDS.map(animalCard).join('')}</div>`;
  if (S.tab === 'helpers') {
    const fhLock = S.level < 2, slLock = S.level < 3;
    h = `<div class="list">
      <div class="card ${fhLock ? 'lockedcard' : ''}"><div class="top"><div class="big">${charImg('girl-head')}</div><div class="grow"><div class="ttl">Farmhands <span class="small">${S.farmhands}/${MAX_FARMHANDS}</span></div>
        <div class="sub">They walk the field on their own, harvesting ripe plots and replanting with your selected seed.</div></div>
        ${fhLock ? '<span class="small">Lv 2</span>' : S.farmhands >= MAX_FARMHANDS ? '<span class="small">Full crew</span>' : `<button class="btn gold" data-act="hire" data-k="fh" data-check="cost:${farmhandCost()}">Hire ${coinHTML}${fmt(farmhandCost())}</button>`}</div></div>
      <div class="card ${slLock ? 'lockedcard' : ''}"><div class="top"><div class="big">${charImg('baker')}</div><div class="grow"><div class="ttl">Market sellers <span class="small">${S.sellers}/${MAX_SELLERS}</span></div>
        <div class="sub">They stand at the road cart and sell one of your best goods every 2.5s.</div></div>
        ${slLock ? '<span class="small">Lv 3</span>' : S.sellers >= MAX_SELLERS ? '<span class="small">Full stall</span>' : `<button class="btn gold" data-act="hire" data-k="sl" data-check="cost:${sellerCost()}">Hire ${coinHTML}${fmt(sellerCost())}</button>`}</div>
        ${slLock ? '' : `<label class="toggle"><input type="checkbox" id="sellcrops" data-act="sellCrops" ${S.sellCrops ? 'checked' : ''}>Also sell raw crops above 10</label>`}</div>
      <div class="row" style="justify-content:flex-end;margin-top:4px"><button class="btn ${resetArmed ? 'red' : 'alt'}" data-act="reset">${resetArmed ? 'Tap again to wipe this farm' : 'Start a new farm'}</button></div>
    </div>`;
  }
  $('panel').innerHTML = h;
}

/** Where to get an item, for any non-crop need the barn has none of. */
function whereFrom(k: ItemId) {
  const a = ANIMAL_IDS.find(id => ANIMALS[id].product === k);
  if (a) return `${iconHTML(k, 'ic-inline')} ${ITEMS[k].name} comes from the ${ANIMALS[a].name.toLowerCase()}: tap it on the farm to feed it ${ANIMALS[a].feedQty} ${iconHTML(ANIMALS[a].feed, 'ic-inline')}, then tap again to collect.`;
  if (k === 'fish' || k === 'crab' || k === 'goldfish') return `${iconHTML(k, 'ic-inline')} ${ITEMS[k].name} is caught in the river: tap 🎣, wait for the splash, then tap fast.`;
  const m = MACHINE_IDS.find(id => MACHINES[id].out === k);
  if (m) return `${iconHTML(k, 'ic-inline')} ${ITEMS[k].name} is made in the ${MACHINES[m].name}.`;
  return '';
}
const hints = (o: Order) => {
  const h = orderItems(o).filter(([k]) => inv(k) === 0).map(([k]) => whereFrom(k)).filter(Boolean);
  return h.length ? `<div class="wherefrom">${h.join('<br>')}</div>` : '';
};

const stars = () => '★★★★★'.slice(0, Math.round(S.rep)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(S.rep));

function truckCard() {
  const k = S.truck;
  if (!k) return `<div class="card truckcard idle"><div class="top"><div class="big">🚚</div><div class="grow"><div class="ttl">Truck buyers</div>
    <div class="sub"><b data-tnext>Next truck soon</b>. Trucks pay extra and tip you for fast loading, but they won't wait forever.</div></div>
    <span class="rep" title="Buyer reputation">${stars()}</span></div></div>`;
  return `<div class="card truckcard"><div class="top"><div class="big">🚚</div><div class="grow"><div class="ttl">${k.who} <span class="small">is waiting at the gate</span></div>
      <div class="sub"><span class="rep">${stars()}</span> Load before the timer runs out or they leave.</div></div>
      <div class="reward">${coinHTML}<span data-tpay>${fmt(k.coins)}</span> <span class="small">+${k.xp} XP</span></div></div>
    <div class="tbar big"><i data-tbar></i></div>
    <div class="needs">${orderItems(k).map(([i, q]) => `<span class="need" data-need="${i}" data-q="${q}">${iconHTML(i, 'ic-need')}<span>0/${q}</span></span>`).join('')}</div>${hints(k)}
    <div class="row"><button class="btn gold" data-act="truck" data-check="truck">Load truck</button><span class="small grow" data-tnote></span></div>
  </div>`;
}

function animalCard(k: AnimalId) {
  const a = ANIMALS[k], h = S.animals[k];
  const what = `Eats ${a.feedQty} ${iconHTML(a.feed, 'ic-inline')} → ${iconHTML(a.product, 'ic-inline')} ${ITEMS[a.product].name} every ${a.time}s · sells for ${ITEMS[a.product].sell}`;
  if (!animalUnlocked(k)) {
    return `<div class="card lockedcard"><div class="top"><div class="big animal-ic">${a.icon}</div><div class="grow"><div class="ttl">${a.plural}</div><div class="sub">${what}</div></div><span class="small">Unlocks at Lv ${a.lvl}</span></div></div>`;
  }
  const buy = h.n >= a.max ? '<span class="small">Full</span>'
    : `<button class="btn gold" data-act="buyA" data-k="${k}" data-check="cost:${animalCost(k)}">Buy ${coinHTML}${fmt(animalCost(k))}</button>`;
  return `<div class="card"><div class="top"><div class="big animal-ic">${a.icon}</div><div class="grow"><div class="ttl">${a.plural} <span class="small">${h.n}/${a.max}</span></div>
    <div class="sub">${what}</div><div class="sub" data-astat="${k}"></div></div>${buy}</div></div>`;
}

function setBadge(k: Tab, n: number) {
  const b = document.querySelector<HTMLElement>(`[data-badge="${k}"]`);
  if (!b) return;
  b.hidden = !n;
  b.textContent = n > 99 ? '99+' : String(n);
}

/** Per-frame value updates for whatever the panel currently shows. */
export function updatePanel() {
  const t = now();
  document.querySelectorAll<HTMLElement>('[data-count]').forEach(e => { e.textContent = String(inv(e.dataset.count as ItemId)); });
  document.querySelectorAll<HTMLElement>('[data-need]').forEach(e => {
    const k = e.dataset.need as ItemId, q = +e.dataset.q!, have = Math.min(inv(k), q);
    e.lastChild!.textContent = have + '/' + q;
    e.classList.toggle('ok', have >= q);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-check]').forEach(b => {
    const [kind, arg] = b.dataset.check!.split(':');
    let ok = true;
    if (kind === 'cost') ok = S.coins >= +arg;
    else if (kind === 'inv') ok = inv(arg as ItemId) > 0;
    else if (kind === 'order') ok = !!S.orders[+arg] && canFill(S.orders[+arg]);
    else if (kind === 'skip') ok = canSkip();
    else if (kind === 'truck') ok = canFillTruck();
    else if (kind === 'tend') ok = ANIMAL_IDS.some(k => animalUnlocked(k) && S.animals[k].ready.some((_, i) => { const st = animalState(k, i); return st === 'ready' || (st === 'hungry' && inv(ANIMALS[k].feed) >= ANIMALS[k].feedQty); }));
    b.disabled = !ok;
  });
  const sn = t < S.skipUntil ? 'Next skip in ' + Math.ceil((S.skipUntil - t) / 1000) + 's' : '';
  document.querySelectorAll<HTMLElement>('[data-skipnote]').forEach(e => { e.textContent = sn; });
  document.querySelectorAll<HTMLElement>('[data-mbar]').forEach(e => {
    const m = S.machines[e.dataset.mbar as MachineId];
    e.style.width = m.job ? (100 * Math.min(1, (t - m.job.start) / (m.job.end - m.job.start))).toFixed(1) + '%' : '0%';
  });
  document.querySelectorAll<HTMLElement>('[data-mstat]').forEach(e => {
    const k = e.dataset.mstat as MachineId, m = S.machines[k], d = MACHINES[k];
    e.textContent = m.job ? 'Making ' + GOODS[d.out].name.toLowerCase() + '…'
      : !m.on ? 'Paused'
      : 'Waiting for ' + recipe(k).filter(([i, q]) => inv(i) < q).map(([i]) => ITEMS[i].name.toLowerCase()).join(' and ');
  });
  const k = S.truck;
  const nextIn = Math.max(0, Math.ceil((S.nextTruck - t) / 1000));
  document.querySelectorAll<HTMLElement>('[data-tnext]').forEach(e => {
    e.textContent = nextIn > 0 ? 'Next truck in ' + Math.floor(nextIn / 60) + ':' + String(nextIn % 60).padStart(2, '0') : 'A truck is pulling up';
  });
  if (k) {
    const left = Math.max(0, k.end - t), frac = left / (k.end - k.arrive), { tip } = truckOffer(t);
    document.querySelectorAll<HTMLElement>('[data-tbar]').forEach(e => { e.style.width = (frac * 100).toFixed(1) + '%'; e.parentElement!.classList.toggle('low', frac < 0.25); });
    document.querySelectorAll<HTMLElement>('[data-tnote]').forEach(e => {
      e.textContent = Math.ceil(left / 1000) + 's left' + (tip ? ' · +' + fmt(tip) + ' tip if you load now' : '');
    });
  }
  document.querySelectorAll<HTMLElement>('[data-astat]').forEach(e => {
    const k = e.dataset.astat as AnimalId, n = S.animals[k].n;
    let ready = 0, busy = 0;
    for (let i = 0; i < n; i++) { const st = animalState(k, i); if (st === 'ready') ready++; else if (st === 'busy') busy++; }
    e.textContent = n ? `${ready} ready · ${busy} working · ${n - ready - busy} hungry` : 'None yet';
  });
  setBadge('animals', ANIMAL_IDS.reduce((a, k) => a + (animalUnlocked(k) ? S.animals[k].ready.filter((_, i) => animalState(k, i) === 'ready').length : 0), 0));
  setBadge('orders', S.orders.filter(canFill).length + (canFillTruck() ? 1 : 0));
  setBadge('barn', totalItems());
  setBadge('machines', MACHINE_IDS.filter(k => S.machines[k].owned && S.machines[k].job).length);
}

/** One delegated click handler for every [data-act] control outside the 3D view. */
export function bindPanelInput() {
  document.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('[data-act]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    const a = b.dataset.act, k = b.dataset.k!, i = +b.dataset.i!;
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top;
    if (a === 'seed') S.sel = k as CropId;
    else if (a === 'expand') { if (S.plots.length >= MAX_PLOTS) act.buyLand(); else act.buyPlot(); }
    else if (a === 'tab') toggleOffice(b.dataset.t as Tab);
    else if (a === 'close') closeOffice();
    else if (a === 'sell') act.sell(k as ItemId, b.dataset.n === 'all' ? inv(k as ItemId) : 1, cx, cy);
    else if (a === 'deliver') act.deliver(i, cx, cy);
    else if (a === 'skip') act.skip(i);
    else if (a === 'truck') act.loadTruck(cx, cy);
    else if (a === 'buyA') act.buyAnimal(k as AnimalId);
    else if (a === 'tend') act.tendAll();
    else if (a === 'buyM') act.buyMachine(k as MachineId);
    else if (a === 'upM') act.upgradeMachine(k as MachineId, cx, cy);
    else if (a === 'toggleM') { S.machines[k as MachineId].on = (b as HTMLInputElement).checked; save(); return; }
    else if (a === 'sellCrops') { S.sellCrops = (b as HTMLInputElement).checked; save(); return; }
    else if (a === 'hire') act.hire(k === 'fh' ? 'farmhand' : 'seller');
    else if (a === 'reset') {
      if (!resetArmed) {
        resetArmed = true;
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => { resetArmed = false; }, 4000);
      } else { resetArmed = false; act.newFarm(); }
    }
    save();
  });
}
