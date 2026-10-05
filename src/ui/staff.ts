import { on } from '../game/events';
import { hireStaff, STAFF, STAFF_IDS, TERMS, termCost, timeLeft, type StaffId } from '../game/staff';
import { S } from '../game/state';
import { rotten } from '../game/economy';
import { animalTick, sickCount } from '../game/animals';
import { charImg } from './art';
import { markDirty } from './dirty';
import { coinHTML, fmt } from './format';
import { shakeScene, toast } from './toasts';

/** Helpers-tab cards and messages for the paid farm manager and animal keeper. */

const FACE: Record<StaffId, string> = { manager: 'grocer', keeper: 'grandma', fisher: 'boy-head', shopkeeper: 'baker' };

export const hms = (ms: number) => {
  const m = Math.ceil(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};

export function awayNote(d: { crops: number; products: number; seeds: number; fish?: number; shop?: number }) {
  const bits = [];
  if (d.shop) bits.push(`sold ${fmt(d.shop)} coins of goods at your shop`);
  if (d.fish) bits.push(`caught ${fmt(d.fish)} fish`);
  if (d.crops) bits.push(`harvested ${fmt(d.crops)} crops`);
  if (d.products) bits.push(`collected ${fmt(d.products)} animal goods`);
  return 'Welcome back! While you were away your staff ' + bits.join(', ') + '.' + (d.seeds ? ` Replanting cost ${fmt(d.seeds)} coins.` : '');
}

/** After time away: say what went wrong (rotten crops, sick animals), if anything. */
export function warnTrouble() {
  animalTick();
  const rot = S.plots.filter(p => rotten(p)).length, sick = sickCount();
  const bits: string[] = [];
  if (rot) bits.push(`${rot} plot${rot > 1 ? 's' : ''} of crops rotted (tap to clear)`);
  if (sick) bits.push(`${sick} animal${sick > 1 ? 's' : ''} fell sick from hunger (the vet in town can help)`);
  if (bits.length) setTimeout(() => toast('While you were away, ' + bits.join(' and ') + '.'), 1500);
}

export function staffCard(k: StaffId) {
  const d = STAFF[k], locked = S.level < d.lvl, left = timeLeft(k);
  const buttons = locked ? `<span class="small">Lv ${d.lvl}</span>`
    : TERMS.map(t => `<button class="btn ${left ? 'alt' : 'gold'} term" data-act="staff" data-k="${k}" data-h="${t.h}" data-check="cost:${termCost(k, t.h)}">${left ? '+' : ''}${t.label}<span>${coinHTML}${fmt(termCost(k, t.h))}</span></button>`).join('');
  return `<div class="card staffcard ${locked ? 'lockedcard' : ''}"><div class="top"><div class="big">${charImg(FACE[k])}</div>
    <div class="grow"><div class="ttl">${d.name} ${left ? `<span class="onduty" data-staffleft="${k}">On duty · ${hms(left)} left</span>` : ''}</div>
    <div class="sub">${d.job} Paid up front: ${coinHTML}${fmt(d.perHour(S.level))} an hour.</div></div></div>
    <div class="row terms">${buttons}</div></div>`;
}

/** Helpers tab: every paid staff member, except the shopkeeper until there is a shop to keep. */
export function staffCards() { return STAFF_IDS.filter(k => k !== 'shopkeeper' || S.town.shop).map(staffCard).join(''); }

export function hire(k: StaffId, h: number) {
  const r = hireStaff(k, h);
  if (r.ok) toast(`${STAFF[k].name} is on duty for ${hms(timeLeft(k))}.`);
  else if (r.reason === 'coins') { toast(`You need ${fmt(r.cost!)} coins for that contract.`); shakeScene(); }
  else if (r.reason === 'noshop') toast('Buy your shop in Market Town first.');
  markDirty();
}

on('staffEnding', ({ k, left }) => toast(`Your ${STAFF[k].name.toLowerCase()}’s contract ends in ${hms(left)}. Extend it in ${k === 'shopkeeper' ? 'Helpers or at your shop' : 'Helpers'}.`));
on('staffEnded', ({ k }) => { toast(`Your ${STAFF[k].name.toLowerCase()}’s contract has ended.`); markDirty(); });
on('wagesUnpaid', () => toast('Your farmhands and sellers stopped working: there are no coins for their wages.'));
on('wagesPaid', () => toast('Wages paid. Your helpers are back at work.'));
