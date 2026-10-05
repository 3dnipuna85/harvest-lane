import { getPlayer } from './ai';
import { billboard, screenDir, setFrame, type Billboard } from './sprites';

/** The farmer's dog: trots after the player and sits beside them when they stop. */
let dog: { x: number; z: number; phase: number; flip: boolean; v: Billboard } | null = null;

export function initDog() {
  const p = getPlayer();
  dog = { x: p.x - 0.8, z: p.z + 0.5, phase: 0, flip: false, v: billboard('dog', 0.8, 0.3) };
}

export function updateDog(dt: number, t: number) {
  if (!dog) return;
  const p = getPlayer();
  // a spot beside and a little behind the farmer
  const tx = p.x - 0.75 * Math.sin(p.face) - 0.45 * Math.cos(p.face), tz = p.z - 0.75 * Math.cos(p.face) + 0.45 * Math.sin(p.face);
  const dx = tx - dog.x, dz = tz - dog.z, d = Math.hypot(dx, dz);
  const moving = d > 0.25;
  if (moving) {
    const sp = Math.min(d, Math.max(2.5, d * 3) * dt);
    dog.x += (dx / d) * sp; dog.z += (dz / d) * sp;
    dog.phase += dt * 16;
    const sd = screenDir(dx, dz);
    if (Math.abs(sd.x) > 0.02) dog.flip = sd.x < 0;
  }
  dog.v.root.position.set(dog.x, 0, dog.z);
  const hop = moving ? Math.abs(Math.sin(dog.phase)) * 0.12 : 0;
  const wag = moving ? 0 : Math.sin(t * 9) * 0.02;
  setFrame(dog.v, 'dog', dog.flip, 1 + wag, 1 - wag, hop);
}
