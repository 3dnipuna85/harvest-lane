import * as THREE from 'three';
import { totalItems } from '../../game/economy';
import { ctx } from '../context';
import { Cyl, RB, Tri, part } from '../geometry';
import { BX, BZ } from '../layout';
import { lbl } from '../fx/labels';

export function buildBarn() {
  const g = new THREE.Group();
  g.position.set(BX[0], 0, BZ);
  part(RB(3.0, 1.8, 2.4, 0.14), '#d9483a', g, 0, 0.9, 0);
  for (const s of [-1, 1]) part(RB(1.9, 0.2, 2.8, 0.08), '#7b4a2e', g, s * 0.72, 2.22, 0, { r: [0, 0, -s * 0.68] });
  part(Tri(2.7, 1.0, 2.38), '#d9483a', g, 0, 1.75, 0, { ol: false });
  part(RB(3.1, 0.14, 2.5, 0.06), '#fff7ea', g, 0, 1.78, 0);
  for (const s of [-1, 1]) part(RB(0.14, 1.8, 0.14, 0.05), '#fff7ea', g, s * 1.45, 0.9, 1.15);
  part(RB(1.15, 1.2, 0.1, 0.06), '#9c2e22', g, 0, 0.6, 1.22);
  for (const s of [-1, 1]) part(RB(0.09, 1.45, 0.06, 0.03), '#fff7ea', g, 0, 0.6, 1.28, { r: [0, 0, s * 0.76] });
  part(RB(1.25, 0.1, 0.08, 0.04), '#fff7ea', g, 0, 1.24, 1.26);
  const w = part(Cyl(0.24, 0.24, 0.08, 20), '#fff7ea', g, 0, 2.15, 1.2);
  w.rotation.x = Math.PI / 2;
  part(Cyl(0.17, 0.17, 0.1, 20), '#5b3a26', w, 0, 0.01, 0, { ol: false });
  for (const [x, z] of [[1.85, 1.0], [1.85, 0.25]]) { const h = part(Cyl(0.32, 0.32, 0.55, 18), '#f0cd5f', g, x, 0.33, z); h.rotation.z = Math.PI / 2; }
  part(RB(0.5, 0.5, 0.5, 0.08), '#c98f55', g, -1.9, 0.25, 1.0);
  g.userData = { type: 'bld', id: 'barn' };
  ctx.scene.add(g);
  ctx.pickables.push(g);
  return g;
}

const barnLabelPos = new THREE.Vector3(BX[0], 3.5, BZ);
export function updateBarn() {
  lbl('barn', '📦 ' + totalItems(), barnLabelPos, 'barn');
}
