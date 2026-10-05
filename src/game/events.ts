import type { CropId } from '../data/crops';
import type { GoodId, ItemId } from '../data/goods';
import type { MachineId } from '../data/machines';

/** Everything the game logic announces. The scene and UI listen; game/ never touches them directly. */
export interface GameEvents {
  levelUp: { level: number; unlocked: string[] };
  earn: { amount: number };
  plant: { i: number; crop: CropId };
  harvest: { i: number; crop: CropId; n: number };
  machineDone: { id: MachineId; out: GoodId };
  sellerSale: { item: ItemId; coins: number };
  truckArrive: { who: string };
  truckDone: { who: string; coins: number; tip: number };
  truckMissed: { who: string; coins: number };
}

type Handler<K extends keyof GameEvents> = (e: GameEvents[K]) => void;
const handlers: { [K in keyof GameEvents]?: Handler<K>[] } = {};

export function on<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
  const list = (handlers[type] ??= []) as Handler<K>[];
  list.push(fn);
  return () => { list.splice(list.indexOf(fn), 1); };
}

export function emit<K extends keyof GameEvents>(type: K, e: GameEvents[K]): void {
  for (const fn of (handlers[type] ?? []) as Handler<K>[]) fn(e);
}
