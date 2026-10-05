import { S, type Tab } from '../game/state';
import type { Place } from '../scene/town/town';
import { markDirty } from './dirty';
import { $ } from './format';

/**
 * The Farm Office is a pop-up panel over the full-screen farm, opened from the dock or by tapping a building.
 * In Market Town the same panel shows whichever shop the player walked into.
 */
let open = false;
let place: Place | null = null;
export const officeOpen = () => open;
/** The town building the panel is showing, or null for a farm tab. */
export const officePlace = () => (open ? place : null);

const TITLES: Record<Tab, string> = { orders: 'Orders', barn: 'Barn', animals: 'Animals', machines: 'Machines', helpers: 'Helpers', farm: 'Farm Upgrades' };
const PLACES: Record<Place, string> = { market: 'Animal Market', store: 'General Store', shop: 'Your Shop', vet: 'Vet Clinic' };

function apply() {
  $('office').hidden = !open;
  $('officeTitle').textContent = place ? PLACES[place] : TITLES[S.tab];
  document.body.classList.toggle('office-open', open);
  markDirty();
}

export function openOffice(t: Tab) { S.tab = t; place = null; open = true; apply(); }
export function openPlace(p: Place) { place = p; open = true; apply(); }
export function closeOffice() { open = false; place = null; apply(); }
/** Dock button: open that tab, or close the panel if it is already showing. */
export function toggleOffice(t: Tab) { if (open && !place && S.tab === t) closeOffice(); else openOffice(t); }
export function togglePlace(p: Place) { if (open && place === p) closeOffice(); else openPlace(p); }
