import { ITEMS, type ItemId } from '../data/goods';

/** Painted sprites in public/ui/, cut from assets/elements/. Items without art fall back to their emoji. */
export const ART: Partial<Record<ItemId, string>> = {
  wheat: 'wheat', corn: 'corn', carrot: 'carrot', tomato: 'tomato', strawberry: 'strawberry', milk: 'milk',
  log: 'log', stone: 'stone', brick: 'brick', cheese: 'cheese', honey: 'honey',
};

export const artUrl = (name: string) => `${import.meta.env.BASE_URL}ui/${name}.webp`;
/** A painted character or prop sprite in public/chars/. */
export const charUrl = (name: string) => `${import.meta.env.BASE_URL}chars/${name}.webp`;
export const itemArt = (k: ItemId) => (ART[k] ? artUrl(ART[k]!) : null);

/** An item's icon as HTML: the painted sprite if there is one, otherwise the emoji. */
export function iconHTML(k: ItemId, cls = 'ic-img') {
  const url = itemArt(k);
  return url ? `<img class="${cls}" src="${url}" alt="${ITEMS[k].name}" draggable="false">` : `<span class="${cls} ic-emoji">${ITEMS[k].icon}</span>`;
}

/** Portrait for each delivery customer, from the townsfolk on the character sheet. */
const FACES = ['grandma', 'oldfarmer', 'baker', 'grocer', 'kid', 'girl-head', 'boy-head'];
const FACE_OF: Record<string, string> = {
  'Rosa’s Diner': 'girl-head', 'Maple Street Market': 'grocer', 'The Corner Bakery': 'baker',
  'Uncle Teo': 'oldfarmer', 'School Canteen': 'kid', 'Harbor Café': 'boy-head', 'Mrs. Pell': 'grandma',
  'Night Market Stall': 'grocer', 'Hilltop Hotel': 'baker', 'Sunday Picnic Club': 'kid',
};
export function customerFace(who: string) {
  if (FACE_OF[who]) return `<img class="face" src="${charUrl(FACE_OF[who])}" alt="" draggable="false">`;
  let h = 2166136261;
  for (const ch of who) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `<img class="face" src="${charUrl(FACES[h % FACES.length])}" alt="" draggable="false">`;
}
export const charImg = (name: string, cls = 'face') => `<img class="${cls}" src="${charUrl(name)}" alt="" draggable="false">`;

export const uiImg = (name: string, cls = 'ic-img') => `<img class="${cls}" src="${artUrl(name)}" alt="" draggable="false">`;

/** Building materials as small icons with amounts; red where the barn is short. */
export function matsHTML(m: Partial<Record<ItemId, number>>, have: (k: ItemId) => number) {
  return (Object.entries(m) as [ItemId, number][]).map(([k, q]) => `<span class="mat ${have(k) >= q ? '' : 'short'}">${iconHTML(k, 'ic-inline')}${q}</span>`).join('');
}
/** "12 planks, 4 bricks": what's still missing. */
export function matsShortText(m: Partial<Record<ItemId, number>>, have: (k: ItemId) => number) {
  return (Object.entries(m) as [ItemId, number][]).filter(([k, q]) => have(k) < q).map(([k, q]) => `${q - have(k)} ${ITEMS[k].name.toLowerCase()}`).join(', ');
}
