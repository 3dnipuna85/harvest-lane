/**
 * Real-money packs for the diamond shop. Prices are shown in US dollars. `link` is the checkout page for the pack
 * (a Stripe Payment Link, for example); a pack with no link can't be bought yet, except in test mode.
 */
export interface Pack {
  id: string;
  name: string;
  usd: number;
  gems: number;
  coins?: number;
  /** Minutes of Double XP included. */
  xpMin?: number;
  /** One per farm. */
  once?: boolean;
  tag?: string;
  link?: string;
}

export const PACKS: Pack[] = [
  { id: 'starter', name: 'Starter Pack', usd: 1.99, gems: 120, coins: 5000, xpMin: 60, once: true, tag: 'One time only' },
  { id: 'handful', name: 'Handful of Diamonds', usd: 0.99, gems: 80 },
  { id: 'pouch', name: 'Pouch of Diamonds', usd: 4.99, gems: 450, tag: '+12% extra' },
  { id: 'chest', name: 'Chest of Diamonds', usd: 9.99, gems: 1000, tag: 'Popular' },
  { id: 'vault', name: 'Vault of Diamonds', usd: 19.99, gems: 2200, tag: 'Best value' },
];
