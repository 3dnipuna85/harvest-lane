import type { ItemId } from './goods';

/**
 * Farm technology, bought once each in order from the Farm Upgrades panel: machines that take the slog out of a big
 * farm. They cost coins, building materials and diamonds, and open at higher levels.
 */
export type TechId = 'tractor' | 'harvester' | 'sprinkler' | 'drone' | 'fleet';

export interface Tech { name: string; icon: string; what: string; lvl: number; coins: number; gems: number; mats: Partial<Record<ItemId, number>> }

export const TECH: Record<TechId, Tech> = {
  tractor:   { name: 'Tractor',           icon: '🚜', lvl: 12, coins: 15000,  gems: 5,  mats: { plank: 20 },                 what: 'Plow and sow every empty plot in one go with the 🚜 button.' },
  harvester: { name: 'Combine Harvester', icon: '🌾', lvl: 15, coins: 35000,  gems: 12, mats: { plank: 30, brick: 20 },      what: 'Harvest every ripe plot in one go with the 🌾 button.' },
  sprinkler: { name: 'Sprinklers',        icon: '💦', lvl: 19, coins: 60000,  gems: 20, mats: { plank: 30, brick: 30 },      what: 'Crops grow 15% faster, and dry spells water themselves.' },
  drone:     { name: 'Crop Drone',        icon: '🛸', lvl: 24, coins: 120000, gems: 35, mats: { brick: 40, cheese: 10 },     what: 'Sprays the field so crops grow another 15% faster, and chases crows away by itself.' },
  fleet:     { name: 'Drone Fleet',       icon: '🤖', lvl: 30, coins: 300000, gems: 60, mats: { brick: 60, honey: 15 },      what: 'Drones pick ripe crops and replant your selected seed on their own, with no wages.' },
};

export const TECH_IDS = Object.keys(TECH) as TechId[];
/** Head start each growing-speed tech gives a crop when it is planted (share of its grow time). */
export const TECH_GROW = 0.15;
/** The drone fleet works one plot this often. */
export const FLEET_EVERY_MS = 1500;
