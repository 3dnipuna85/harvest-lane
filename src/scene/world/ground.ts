import * as THREE from 'three';
import { BX, BZ, CARTP, GW, PEN, ROADZ } from '../layout';

type Pt = [number, number];

/** Paint the whole farm floor onto one canvas: grass, dirt paths with pebbles, the tilled field, flowers. */
export function groundTexture() {
  const N = 2048, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!, k = N / GW;
  const P = (wx: number, wz: number): Pt => [(wx + GW / 2) * k, (wz + GW / 2) * k];
  x.fillStyle = '#74c043'; x.fillRect(0, 0, N, N);
  // soft grass blotches
  for (let i = 0; i < 260; i++) {
    const r = (1 + Math.random() * 3) * k, px = Math.random() * N, pz = Math.random() * N;
    const g = x.createRadialGradient(px, pz, 0, px, pz, r);
    const col = Math.random() < 0.5 ? '140,208,80' : '98,174,52';
    g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill();
  }
  // dirt paths (outline, fill, highlight)
  const path = (pts: Pt[], w: number) => {
    for (const [col, ww] of [['#b9864a', w + 0.35], ['#e2b878', w], ['#ebc78e', w * 0.45]] as [string, number][]) {
      x.strokeStyle = col; x.lineWidth = ww * k; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath();
      pts.forEach((p, i) => { const [a, b] = P(...p); i ? x.lineTo(a, b) : x.moveTo(a, b); });
      x.stroke();
    }
  };
  const rr = (x0: number, z0: number, x1: number, z1: number, r: number, fill: string | null, stroke: string | null) => {
    const [a, b] = P(x0, z0), [c2, d] = P(x1, z1);
    x.beginPath();
    if (x.roundRect) x.roundRect(a, b, c2 - a, d - b, r * k); else x.rect(a, b, c2 - a, d - b);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = 0.25 * k; x.stroke(); }
  };
  // tilled field area
  rr(-7.2, -2.1, 7.2, 8.9, 1.1, '#b69466', '#8f6e43');
  rr(-6.9, -1.8, 6.9, 8.6, 0.9, '#c3a273', null);
  path([[-14, ROADZ], [14, ROADZ]], 1.7);
  path([[BX[0], BZ + 1], [BX[0], ROADZ]], 1.2);
  for (let j = 1; j < 6; j++) path([[BX[j], BZ + 1], [BX[j], ROADZ]], 0.8);
  path([[0, ROADZ], [0, -2]], 1.2);
  path([[CARTP.x, ROADZ], [CARTP.x + 3, ROADZ]], 1.7);
  // pen ground
  rr(PEN.x0, PEN.z0, PEN.x1, PEN.z1, 0.8, '#b9a55c', '#957f40');
  // pebbles on paths
  for (let i = 0; i < 180; i++) {
    const wx = -13 + Math.random() * 26, wz = ROADZ + (Math.random() - 0.5) * 1.3, [a, b] = P(wx, wz);
    x.fillStyle = Math.random() < 0.5 ? '#d2ae75' : '#f6e4bd';
    x.beginPath(); x.ellipse(a, b, (0.06 + Math.random() * 0.08) * k, (0.04 + Math.random() * 0.05) * k, 0, 0, 7); x.fill();
  }
  // grass tufts and tiny flowers
  for (let i = 0; i < 2200; i++) {
    const px = Math.random() * N, pz = Math.random() * N, wx = px / k - GW / 2, wz = pz / k - GW / 2;
    if (wx > -7.4 && wx < 7.4 && wz > -2.3 && wz < 9.1) continue;
    if (Math.abs(wz - ROADZ) < 1.2) continue;
    x.strokeStyle = 'rgba(70,140,40,.55)'; x.lineWidth = 2.2;
    x.beginPath();
    x.moveTo(px - 4, pz); x.lineTo(px - 1, pz - 8);
    x.moveTo(px, pz); x.lineTo(px + 2, pz - 9);
    x.moveTo(px + 4, pz); x.lineTo(px + 6, pz - 6);
    x.stroke();
  }
  const fc = ['#ffffff', '#ffe066', '#ff9fc4', '#c8a6ff'];
  for (let i = 0; i < 260; i++) {
    const px = Math.random() * N, pz = Math.random() * N, wx = px / k - GW / 2, wz = pz / k - GW / 2;
    if ((wx > -7.6 && wx < 7.6 && wz > -2.5 && wz < 9.3) || Math.abs(wz - ROADZ) < 1.3) continue;
    x.fillStyle = fc[i % 4];
    for (let a = 0; a < 5; a++) { x.beginPath(); x.arc(px + Math.cos(a * 1.26) * 4, pz + Math.sin(a * 1.26) * 4, 3.4, 0, 7); x.fill(); }
    x.fillStyle = '#f2b318'; x.beginPath(); x.arc(px, pz, 2.6, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
