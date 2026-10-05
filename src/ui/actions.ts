import { MACHINES, type MachineId } from '../data/machines';
import * as eco from '../game/economy';
import { deliver as deliverOrder, fillOrders, skip as skipOrder } from '../game/orders';
import { resetSim } from '../game/sim';
import { fresh, setState, S } from '../game/state';
import { deliverTruck } from '../game/trucks';
import { initScene } from '../scene/renderer';
import { markDirty } from './dirty';
import { fmt } from './format';
import { fx, shakeScene, toast } from './toasts';

/** Player-facing wrappers: run the game action, then give feedback. */

export function buyPlot() {
  const r = eco.buyPlot();
  if (r.ok) toast('New plot ready to plant');
  else if (r.reason === 'coins') { toast('A new plot costs ' + fmt(r.cost!) + ' coins'); shakeScene(); }
}

export function sell(k: Parameters<typeof eco.sell>[0], n: number, x: number, y: number) {
  const g = eco.sell(k, n);
  if (g) fx(x, y, '+' + fmt(g), 'gold');
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
