import * as THREE from 'three';
import { charUrl } from '../../ui/art';
import { ctx } from '../context';

/** Width / height of each painted sprite in public/chars/ (cut from assets/elements). */
export const ASPECT: Record<string, number> = {
  'baker': 0.660,
  'barrel-tomato': 0.957,
  'boy-back': 0.551,
  'boy-head': 1.044,
  'boy-idle': 0.617,
  'boy-walk': 0.652,
  'boy-water': 0.719,
  'boy-wave': 0.602,
  'chick': 0.742,
  'chick2': 0.820,
  'cow-front': 0.699,
  'cow-side': 1.109,
  'crate-carrot': 1.219,
  'crate-corn': 1.109,
  'crate-tomato': 1.051,
  'dog': 0.887,
  'girl-back': 0.547,
  'girl-head': 0.994,
  'girl-idle': 0.648,
  'girl-walk': 0.695,
  'girl-water': 0.770,
  'girl-wave': 0.617,
  'grandma': 0.719,
  'grocer': 0.750,
  'hen-front': 0.715,
  'hen-peck': 0.992,
  'hen-walk': 0.949,
  'kid': 0.598,
  'oldfarmer': 0.715,
  'pig': 0.969,
  'scarecrow': 0.832,
  'sheep': 1.078,
  'stall-boy': 0.969,
  'stall-girl': 0.934,
};
/**
 * The main character's 8-frame animations: pulling up a crop and planting (assets/elements/main character),
 * and walking in four directions (assets/elements/walking main character). Each set shares one canvas so
 * its frames line up, and all sets are cut at the same character scale.
 */
export const FARMER_FRAMES = 8;
const FARMER_ASPECT: Record<string, number> = { pull: 0.813, plant: 0.813, down: 0.624, up: 0.621, left: 0.623, right: 0.656 };
for (const [anim, a] of Object.entries(FARMER_ASPECT)) for (let i = 0; i < FARMER_FRAMES; i++) ASPECT[`farmer-${anim}-${i}`] = a;

const loader = new THREE.TextureLoader();
const TEX: Record<string, THREE.Texture> = {};
const tex = (name: string) => TEX[name] || (TEX[name] = loader.load(charUrl(name)));
/** Load a set of frames up front so an animation never flashes an empty frame the first time it plays. */
export const preloadFrames = (names: string[]) => names.forEach(tex);

const shadowGeo = new THREE.CircleGeometry(1, 20);
const shadowMat = new THREE.MeshBasicMaterial({ color: '#2f4a1a', transparent: true, opacity: 0.28, depthWrite: false });

/**
 * A painted character standing on the ground. The camera never rotates, so a camera-facing sprite reads
 * exactly like a 2D isometric game; facing left is a horizontal flip.
 */
export interface Billboard {
  root: THREE.Group;
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  h: number;
  frame: string;
}

export function billboard(frame: string, h: number, shadowR: number): Billboard {
  const root = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(frame), transparent: true, alphaTest: 0.35 }));
  sprite.center.set(0.5, 0.02);
  root.add(sprite);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(shadowR, shadowR * 0.75, 1);
  root.add(shadow);
  ctx.scene.add(root);
  const b = { root, sprite, shadow, h, frame: '' };
  setFrame(b, frame, false);
  return b;
}

/** Show a frame, optionally mirrored, with squash/stretch (sx, sy) and a lift off the ground. */
export function setFrame(b: Billboard, frame: string, flip: boolean, sx = 1, sy = 1, lift = 0) {
  if (b.frame !== frame) { (b.sprite.material as THREE.SpriteMaterial).map = tex(frame); b.frame = frame; }
  const w = b.h * (ASPECT[frame] ?? 1);
  b.sprite.scale.set(w * sx * (flip ? -1 : 1), b.h * sy, 1);
  b.sprite.position.y = lift;
}

export function removeBillboard(b: Billboard) { ctx.scene.remove(b.root); }

/** Screen-space direction of a ground move for the fixed (24, 21, 24) camera: x > 0 is right, toward > 0 is down-screen. */
export const screenDir = (dx: number, dz: number) => ({ x: dx - dz, toward: dx + dz });
