import * as THREE from 'three';
import { MAX_PLOTS } from '../data/limits';
import { LAND, PARCEL_COLS, PARCEL_PLOTS } from '../data/land';

/** Plot spacing and plot size, in world units. */
export const PITCH = 2.65;
export const PSZ = 2.2;
/** Plots fill a 5-wide grid in the home field; plots past that sit in the land parcels east and west. */
export function plotPos(i: number) {
  if (i < MAX_PLOTS) return { x: ((i % 5) - 2) * PITCH, z: -0.5 + Math.floor(i / 5) * PITCH };
  const k = Math.floor((i - MAX_PLOTS) / PARCEL_PLOTS), j = (i - MAX_PLOTS) % PARCEL_PLOTS;
  return parcelPlot(k, j);
}
/** Plot j of land parcel k. Columns sit on the same PITCH grid as the home field, so the walking paths line up. */
export function parcelPlot(k: number, j: number) {
  const side = LAND[k]?.side ?? 1;
  return { x: side * (6 + (j % PARCEL_COLS)) * PITCH, z: -0.5 + Math.floor(j / PARCEL_COLS) * PITCH };
}
/** Centre and half-size of land parcel k's field. */
export function parcelBox(k: number) {
  const side = LAND[k]?.side ?? 1;
  return { x: side * 7 * PITCH, z: -0.5 + 1.5 * PITCH, hw: 1.5 * PITCH + 0.35, hd: 2 * PITCH + 0.35 };
}
/** Building x positions: the barn first, then one per workshop in MACHINE_IDS order. */
export const BX = [-7.8, -4.2, -1.2, 1.8, 4.8, 7.8];
export const BZ = -6.6;
export const ROADZ = -3.5;
/** The market cart stands on the grass north of the road, so trucks can pass. */
export const CARTP = { x: 10.6, z: -5.3 };
export const PEN = { x0: -11.2, x1: -7.8, z0: 0.2, z1: 4.6 };
/** Ground texture size in world units. */
export const GW = 48;
export const barnDoor = () => new THREE.Vector3(BX[0], 0.8, BZ + 1.6);
/** The river runs along the south edge of the farm, beyond the fence. riverZ is its centre line. */
export const riverZ = (x: number) => 13.7 + 0.5 * Math.sin(x * 0.22 + 0.9);
export const RIVER_HW = 1.6;
/** A wooden fishing dock through a gate in the south fence, in line with a path between plot columns. */
export const DOCK = { x: -PITCH / 2, z0: 10.9, z1: 13.5 };
/** Where the farmer stands to fish, and where the bobber floats. */
export const FISH_SPOT = { x: DOCK.x, z: 13.2 };
export const BOBBER = { x: DOCK.x + 0.15, z: 15.0 };
