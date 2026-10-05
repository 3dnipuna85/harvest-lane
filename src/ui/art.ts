import { ITEMS, type ItemId } from '../data/goods';

/** Painted sprites in public/ui/, cut from assets/elements/. Items without art fall back to their emoji. */
export const ART: Partial<Record<ItemId, string>> = {
  wheat: 'wheat', corn: 'corn', carrot: 'carrot', tomato: 'tomato', strawberry: 'strawberry',
};

export const artUrl = (name: string) => `/ui/${name}.webp`;
export const itemArt = (k: ItemId) => (ART[k] ? artUrl(ART[k]!) : null);

/** An item's icon as HTML: the painted sprite if there is one, otherwise the emoji. */
export function iconHTML(k: ItemId, cls = 'ic-img') {
  const url = itemArt(k);
  return url ? `<img class="${cls}" src="${url}" alt="${ITEMS[k].name}" draggable="false">` : `<span class="${cls} ic-emoji">${ITEMS[k].icon}</span>`;
}

export const uiImg = (name: string, cls = 'ic-img') => `<img class="${cls}" src="${artUrl(name)}" alt="" draggable="false">`;
