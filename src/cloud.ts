/**
 * Cloud save. The farm always saves to localStorage (game/state.ts); when a remote store is available
 * it is also kept there, so progress survives cleared browser data and follows the player to other
 * devices. Two stores exist:
 * - claude.ai: the artifact's private per-user store (`window.claude`, db + user capabilities);
 * - the public web build: Firebase Auth + Firestore (src/online/), when a Firebase config is set.
 * On connect, whichever save is newer wins.
 */
import { fillOrders } from './game/orders';
import { resetSim } from './game/sim';
import { migrate, setState, S } from './game/state';
import { initScene } from './scene/renderer';
import { markDirty } from './ui/dirty';
import { toast } from './ui/toasts';

/** A place to keep one player's farm as a JSON string. */
export interface Remote {
  load(): Promise<string | null>;
  store(state: string, meta: { saved: number; level: number; coins: number }): Promise<void>;
}

interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface ClaudeRuntime { use(name: string): Promise<unknown> }

let remote: Remote | null = null;
let lastSent = '';
let writing = false;
let lastWrite = 0;
let has3D = false;
let localSaved = 0;

/** Remember what this browser loaded, then connect to claude.ai's store when running there. */
export async function initCloud(local: number, with3D: boolean) {
  localSaved = local; has3D = with3D;
  const claude = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!claude?.use) return false;
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]) as [
      { doc(path: string): DocRef } | null, { id(): Promise<string | null> } | null];
    const id = db && user ? await user.id() : null;
    if (!db || !id) return false;
    const ref = db.doc('data/users/' + id + '/farm');
    await connectRemote({
      async load() { const s = await ref.get(); const b = s.exists ? s.data() : undefined; return b && typeof b.state === 'string' ? b.state : null; },
      store: (state, meta) => ref.set({ state, ...meta }),
    });
    return true;
  } catch { return false; }
}

const key = () => JSON.stringify({ ...S, saved: 0 });

/** Use this store from now on: adopt its farm if newer than the local one, otherwise upload ours. */
export async function connectRemote(r: Remote) {
  remote = r; lastSent = '';
  try {
    const raw = await r.load();
    const cloud = raw ? JSON.parse(raw) : null;
    // A browser that had no farm of its own when the page opened always takes the cloud farm.
    if (cloud && (cloud.saved || 0) > (localSaved ? S.saved : 0)) {
      setState(migrate(cloud));
      fillOrders();
      resetSim();
      if (has3D) initScene();
      markDirty();
      lastSent = key();
      toast('Welcome back. Your farm is loaded.');
    } else await syncCloud(true);
  } catch { /* stay on the local save */ }
}

/** Stop syncing (signed out). The local save keeps working. */
export function disconnectRemote() { remote = null; lastSent = ''; }

/** Push the farm when it changed: at most every 10 seconds, or right away when the page is being hidden. */
export async function syncCloud(force = false) {
  if (!remote || writing) return;
  if (!force && performance.now() - lastWrite < 10000) return;
  // Compare without the save timestamp, so an idle farm is not rewritten every few seconds.
  const k = key();
  if (k === lastSent) return;
  writing = true;
  try {
    await remote.store(JSON.stringify(S), { saved: S.saved, level: S.level, coins: S.coins });
    lastSent = k; lastWrite = performance.now();
  } catch { /* transient; the next sync retries */ } finally { writing = false; }
}
