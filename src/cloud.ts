/**
 * Cloud save for the hosted build. On claude.ai the page can keep each player's farm in the artifact's
 * private per-user store, so progress survives cleared browser data and follows the player to other
 * devices. Anywhere else (dev server, a plain static host) `window.claude` is missing and only the
 * localStorage save in game/state.ts is used.
 */
import { fillOrders } from './game/orders';
import { resetSim } from './game/sim';
import { migrate, setState, S } from './game/state';
import { initScene } from './scene/renderer';
import { markDirty } from './ui/dirty';
import { toast } from './ui/toasts';

interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface ClaudeRuntime { use(name: string): Promise<unknown> }

let ref: DocRef | null = null;
let lastSent = '';
let writing = false;
let lastWrite = 0;

/**
 * Connect, then adopt the cloud farm if it is newer than what this browser loaded.
 * `localSaved` is the saved time of the local farm, or 0 when this browser had none.
 */
export async function initCloud(localSaved: number, has3D: boolean) {
  const claude = (globalThis as { claude?: ClaudeRuntime }).claude;
  if (!claude?.use) return;
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]) as [
      { doc(path: string): DocRef } | null, { id(): Promise<string | null> } | null];
    const id = db && user ? await user.id() : null;
    if (!db || !id) return;
    ref = db.doc('data/users/' + id + '/farm');
    const snap = await ref.get();
    const body = snap.exists ? snap.data() : undefined;
    const cloud = body && typeof body.state === 'string' ? JSON.parse(body.state) : null;
    if (cloud && (cloud.saved || 0) > localSaved) {
      setState(migrate(cloud));
      fillOrders();
      resetSim();
      if (has3D) initScene();
      markDirty();
      lastSent = JSON.stringify({ ...S, saved: 0 });
      toast('Welcome back. Your farm is loaded.');
    } else {
      await syncCloud(true);
    }
  } catch { ref = null; /* stay on the local save */ }
}

/** Push the farm when it changed: at most every 10 seconds, or right away when the page is being hidden. */
export async function syncCloud(force = false) {
  if (!ref || writing) return;
  if (!force && performance.now() - lastWrite < 10000) return;
  // Compare without the save timestamp, so an idle farm is not rewritten every few seconds.
  const key = JSON.stringify({ ...S, saved: 0 });
  if (key === lastSent) return;
  const state = JSON.stringify(S);
  writing = true;
  try {
    await ref.set({ state, saved: S.saved, level: S.level, coins: S.coins });
    lastSent = key; lastWrite = performance.now();
  } catch { /* transient; the next sync retries */ } finally { writing = false; }
}
