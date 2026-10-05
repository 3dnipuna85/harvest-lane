import { resetFishing } from '../game/fishing';
import { resetSim } from '../game/sim';
import { migrate, save, setState, setVisiting, S, visiting, type State } from '../game/state';
import { initScene } from '../scene/renderer';
import { markDirty } from './dirty';
import { closeOffice } from './office';

/** Look around a friend's farm: their saved copy is shown read-only, then the player's own farm comes back untouched. */

let home: State | null = null;
let bar: HTMLElement | null = null;

export function visitFarm(raw: string, name: string, level: number) {
  let friend: State;
  try { friend = migrate(JSON.parse(raw)); } catch { return false; }
  if (!visiting) { save(); home = S; }
  closeOffice();
  // A friend's buyer can't be served from here, and their line isn't in the water.
  friend.truck = null;
  setState(friend);
  setVisiting(true);
  resetFishing();
  initScene();
  markDirty();
  document.body.classList.add('visiting');
  bar?.remove();
  bar = document.createElement('div');
  bar.className = 'visitbar';
  bar.innerHTML = '<span class="v-who">Visiting <b></b>’s farm <i>Lv ' + level + '</i></span><button class="btn gold">🏠 Back home</button>';
  bar.querySelector('b')!.textContent = name;
  bar.querySelector('button')!.addEventListener('click', goHome);
  document.body.appendChild(bar);
  return true;
}

export function goHome() {
  if (!home) return;
  setState(home);
  home = null;
  setVisiting(false);
  resetSim();
  resetFishing();
  initScene();
  markDirty();
  document.body.classList.remove('visiting');
  bar?.remove(); bar = null;
}
