import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './styles.css';

import { initCloud, syncCloud } from './cloud';
import { onlineEnabled } from './online/config';
import { now } from './game/clock';
import { fillOrders } from './game/orders';
import { sim } from './game/sim';
import { load, migrate, save, setState, S } from './game/state';
import { bindInput } from './input/pointer';
import { resize } from './scene/camera';
import { initScene, renderScene, setup3D } from './scene/renderer';
import { takeDirty } from './ui/dirty';
import { $ } from './ui/format';
import { bindHud, updateHud } from './ui/hud';
import { bindPanelInput, panelSignature, renderPanel, renderTabs, updatePanel } from './ui/panel';
import { renderSeeds } from './ui/seeds';
import { toast } from './ui/toasts';

let seedSig = '', panelSig = '', lastT = 0;

function frame(ts: number) {
  const dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000));
  lastT = ts;
  sim(dt);
  renderScene(dt, ts / 1000);
  const dirty = takeDirty();
  const ss = S.sel + S.level + S.tab;
  if (ss !== seedSig || dirty) { renderSeeds(); renderTabs(); seedSig = ss; }
  const ps = panelSignature();
  if (ps !== panelSig || dirty) { renderPanel(); panelSig = ps; }
  updateHud();
  updatePanel();
  requestAnimationFrame(frame);
}

function start() {
  const local = load() as { saved?: number } | null;
  setState(migrate(local));
  fillOrders();
  bindHud();
  bindPanelInput();
  // The Farm Office pop-up sits just above the dock, whatever height the dock wraps to.
  const dock = document.querySelector<HTMLElement>('.dock')!;
  new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', dock.offsetHeight + 'px')).observe(dock);
  const has3D = setup3D($('sceneWrap'), $('overlay'));
  if (has3D) {
    bindInput();
    initScene();
    resize();
  }
  // claude.ai keeps saves in the artifact's store; the public build signs in with Firebase when configured.
  initCloud(local?.saved || 0, has3D).then(onClaude => { if (!onClaude && onlineEnabled && !('claude' in globalThis)) import('./online/login').then(m => m.initOnline()); });
  const away = (now() - (S.saved || now())) / 1000;
  if (away > 60 && S.plots.some(p => p.crop)) toast('Welcome back. Your crops kept growing while you were away.');
  setInterval(() => { save(); syncCloud(); }, 5000);
  addEventListener('visibilitychange', () => { if (document.hidden) { save(); syncCloud(true); } });
  addEventListener('pagehide', () => { save(); syncCloud(true); });
  requestAnimationFrame(ts => { lastT = ts; frame(ts); });
}

start();

// Offline support: only in production builds, so the dev server always serves fresh code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}); });
}
