import type { CropId } from '../data/crops';
import type { GoodId, ItemId, ProductId } from '../data/goods';
import type { MachineId } from '../data/machines';
import type { AnimalId } from '../data/animals';

/** Everything the game logic announces. The scene and UI listen; game/ never touches them directly. */
export interface GameEvents {
  levelUp: { level: number; unlocked: string[] };
  animalSick: { kind: AnimalId; i: number };
  cropRotted: { i: number; crop: CropId };
  earn: { amount: number };
  gems: { n: number; why: string };
  farmUpgrade: { tier: number };
  /** XP is full but the farm tier caps the level. */
  levelCapped: { level: number };
  plant: { i: number; crop: CropId };
  harvest: { i: number; crop: CropId; n: number };
  machineDone: { id: MachineId; out: GoodId };
  sellerSale: { item: ItemId; coins: number };
  animalFed: { kind: AnimalId; i: number };
  animalCollect: { kind: AnimalId; i: number; product: ProductId };
  fishCast: Record<string, never>;
  fishBite: Record<string, never>;
  fishCaught: { kind: ProductId; byPlayer: boolean };
  /** The fish got away: reeled in too early, or too late after the bite. */
  fishMissed: { early: boolean };
  landBought: { k: number };
  shopSale: { item: ItemId; coins: number };
  staffEnding: { k: 'manager' | 'keeper' | 'fisher' | 'shopkeeper'; left: number };
  wagesUnpaid: Record<string, never>;
  wagesPaid: Record<string, never>;
  staffEnded: { k: 'manager' | 'keeper' | 'fisher' | 'shopkeeper' };
  truckArrive: { who: string };
  contractArrive: { who: string };
  contractDone: { coins: number; gems: number };
  contractMissed: { coins: number };
  truckDone: { who: string; coins: number; tip: number; items: ItemId[] };
  truckMissed: { who: string; coins: number; fee: number };
}

type Handler<K extends keyof GameEvents> = (e: GameEvents[K]) => void;
const handlers: { [K in keyof GameEvents]?: Handler<K>[] } = {};

export function on<K extends keyof GameEvents>(type: K, fn: Handler<K>): () => void {
  const list = (handlers[type] ??= []) as Handler<K>[];
  list.push(fn);
  return () => { list.splice(list.indexOf(fn), 1); };
}

let muted = false;
/** Silence events while replaying time away (catch-up), so nothing animates or celebrates for it. */
export function muteEvents(on: boolean) { muted = on; }

export function emit<K extends keyof GameEvents>(type: K, e: GameEvents[K]): void {
  if (muted) return;
  for (const fn of (handlers[type] ?? []) as Handler<K>[]) fn(e);
}
