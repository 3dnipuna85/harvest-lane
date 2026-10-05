import { S, type Tab } from '../game/state';
import { markDirty } from './dirty';
import { $ } from './format';

/** The Farm Office is a pop-up panel over the full-screen farm, opened from the dock or by tapping a building. */
let open = false;
export const officeOpen = () => open;

const TITLES: Record<Tab, string> = { orders: 'Orders', barn: 'Barn', animals: 'Animals', machines: 'Machines', helpers: 'Helpers' };

function apply() {
  $('office').hidden = !open;
  $('officeTitle').textContent = TITLES[S.tab];
  document.body.classList.toggle('office-open', open);
  markDirty();
}

export function openOffice(t: Tab) { S.tab = t; open = true; apply(); }
export function closeOffice() { open = false; apply(); }
/** Dock button: open that tab, or close the panel if it is already showing. */
export function toggleOffice(t: Tab) { if (open && S.tab === t) closeOffice(); else openOffice(t); }
