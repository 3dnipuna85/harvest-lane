import { sfxCoin } from './sound';
import { deliverContract } from '../game/contracts';
import { QUARRY_LVL, WOODS_LVL, chopTree, mineRock } from '../game/resources';
import { MACHINES, type MachineId } from '../data/machines';
import * as eco from '../game/economy';
import { deliver as deliverOrder, fillOrders, skip as skipOrder } from '../game/orders';
import { resetSim } from '../game/sim';
import { fresh, setState, S } from '../game/state';
import { deliverTruck } from '../game/trucks';
import { ANIMALS, type AnimalId } from '../data/animals';
import { buyAnimal as buyA, tapAnimal as tapA, tendAll as tendA } from '../game/animals';
import { CROPS } from '../data/crops';
import { initScene } from '../scene/renderer';
import { focusOn } from '../scene/camera';
import { parcelBox } from '../scene/layout';
import { markDirty } from './dirty';
import { fmt } from './format';
import { fx, shakeScene, toast } from './toasts';

/** Player-facing wrappers: run the game action, then give feedback. */

export function buyPlot() {
  const r = eco.buyPlot();
  if (r.ok) toast('New plot ready to plant');
  else if (r.reason === 'coins') { toast('A new plot costs ' + fmt(r.cost!) + ' coins'); shakeScene(); }
}

/** Buy the next land parcel, or say what is still needed and show where it is. */
export function buyLand() {
  const p = eco.nextParcel();
  if (!p) return;
  const r = eco.buyLand();
  if (r.ok) { toast(p.name + ' is yours! 12 new plots are ready to plant.'); return; }
  const b = parcelBox(S.land);
  focusOn(b.x, b.z);
  if (r.reason === 'field') toast('Fill your home field with plots first, then you can buy ' + p.name + '.');
  else if (r.reason === 'locked') toast(p.name + ' opens at level ' + r.lvl + '.');
  else if (r.reason === 'coins') { toast('Save ' + fmt(r.cost! - S.coins) + ' more coins to buy ' + p.name + '.'); shakeScene(); }
}

export function sell(k: Parameters<typeof eco.sell>[0], n: number, x: number, y: number) {
  const g = eco.sell(k, n);
  if (g) { fx(x, y, '+' + fmt(g), 'gold'); sfxCoin(); }
}

export function deliver(i: number, x: number, y: number) {
  const o = deliverOrder(i);
  if (!o) return;
  fx(x, y, '+' + fmt(o.coins) + ' coins', 'gold');
  toast(o.who + ' paid ' + fmt(o.coins) + ' coins');
}

/** Load the waiting truck if the barn has everything. Returns false if it could not. */
export function loadTruck(_x: number, _y: number) {
  const r = deliverTruck();
  if (!r) {
    if (S.truck) toast('Not enough in the barn yet for ' + S.truck.who);
    return false;
  }
  toast(r.who + ' paid ' + fmt(r.coins + r.tip) + ' coins' + (r.tip ? ', including a ' + fmt(r.tip) + ' tip!' : ''));
  return true;
}

export function chop(i: number) {
  const r = chopTree(i);
  if (r === 'locked') toast(`The Woods open at level ${WOODS_LVL}.`);
  else if (r === 'regrowing') toast('Just a stump for now. It grows back soon.');
  return r;
}

export function mine(i: number) {
  const r = mineRock(i);
  if (r === 'locked') toast(`The Quarry opens at level ${QUARRY_LVL}.`);
  else if (r === 'regrowing') toast('Only rubble here. A new rock is being dug out.');
  return r;
}

export function loadContract() {
  const c = S.contract;
  if (!c) return false;
  if (!deliverContract()) { toast('Not enough goods in the barn yet for the contract.'); return false; }
  toast(`Contract done! ${fmt(c.coins)} coins and ${c.gems} diamond${c.gems > 1 ? 's' : ''}.`);
  return true;
}

export function tapAnimal(k: AnimalId, i: number) {
  const r = tapA(k, i), a = ANIMALS[k];
  if (r === 'nofeed') toast(`${a.plural} eat ${a.feedQty} ${CROPS[a.feed].name.toLowerCase()}. Grow some first!`);
  else if (r === 'locked') toast(`${a.plural} unlock at level ${a.lvl}`);
  else if (r === 'sick') toast(`This ${a.name.toLowerCase()} is sick from going hungry too long. Take it to the Vet Clinic in town.`);
}

export function buyAnimal(k: AnimalId) {
  const r = buyA(k);
  if (r.ok) toast(`New ${ANIMALS[k].name.toLowerCase()} on the farm!`);
  else if (r.reason === 'coins') { toast('Not enough coins yet'); shakeScene(); }
}

export function tendAll() {
  const { got, fed } = tendA();
  toast(got || fed ? `Collected ${got}, fed ${fed}` : 'Nothing to do right now. Grow more feed!');
}

export const skip = (i: number) => skipOrder(i);

export function buyMachine(k: MachineId) {
  if (eco.buyMachine(k).ok) toast(MACHINES[k].name + ' built. It runs on its own when ingredients are in the barn.');
}

export function upgradeMachine(k: MachineId, x: number, y: number) {
  if (eco.upgradeMachine(k).ok) fx(x, y, 'Faster!', 'green');
}

export function hire(kind: 'farmhand' | 'seller') {
  if (!eco.hire(kind).ok) return;
  toast(kind === 'farmhand' ? 'Farmhand hired. Watch them head out to the field.' : 'Seller hired. They are at the cart by the road.');
}

export function newFarm() {
  setState(fresh());
  fillOrders();
  resetSim();
  initScene();
  markDirty();
  toast('Fresh farm. Good luck!');
}
