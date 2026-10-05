import { labelCamera } from './fx/labels';
import { applyTownCam, buildTown, town } from './town/town';

/** Which map is on screen: the farm, or Market Town. */
let away = false;
export const inTown = () => away;

export function enterTown() {
  buildTown();
  away = true;
  labelCamera(town.camera);
  applyTownCam();
}

export function leaveTown() {
  away = false;
  labelCamera(null);
}
