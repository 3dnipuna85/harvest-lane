import * as THREE from 'three';
import { BX, BZ, CARTP, GW, PEN, ROADZ } from '../layout';

type Pt = [number, number];

/** Paint the whole farm floor onto one canvas: grass, dirt paths with pebbles, the tilled field, flowers. */
export function groundTexture() {
  const N = 2048, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!, k = N / GW;
  const P = (wx: number, wz: number): Pt => [(wx + GW / 2) * k, (wz + GW / 2) * k];
  x.fillStyle = '#6fc23f'; x.fillRect(0, 0, N, N);
  // soft grass blotches
  for (let i = 0; i < 260; i++) {
    const r = (1 + Math.random() * 3) * k, px = Math.random() * N, pz = Math.random() * N;
    const g = x.createRadialGradient(px, pz, 0, px, pz, r);
    const col = ['150,214,84', '96,178,50', '120,200,64'][Math.floor(Math.random() * 3)];
    g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(px, pz, r, 0, 7); x.fill();
  }
  // cobblestone paths: a sandy bed with an edge, then rounded stones laid along it
  const STONES = ['#f1e0b4', '#e8d19f', '#f6e8c6', '#dfc590', '#ecd8a8'];
  const path = (pts: Pt[], w: number) => {
    for (const [col, ww] of [['#b48c55', w + 0.3], ['#dcc28e', w]] as [string, number][]) {
      x.strokeStyle = col; x.lineWidth = ww * k; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath();
      pts.forEach((p, i) => { const [a, b] = P(...p); i ? x.lineTo(a, b) : x.moveTo(a, b); });
      x.stroke();
    }
    const S = 0.36;
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], L = Math.hypot(x1 - x0, z1 - z0);
      const ux = (x1 - x0) / L, uz = (z1 - z0) / L, nx = -uz, nz = ux;
      for (let d = 0; d <= L; d += S) for (let o = -w / 2 + S / 2; o <= w / 2 - S / 2 + 1e-6; o += S) {
        const jitter = (Math.random() - 0.5) * 0.08, row = Math.round(d / S) % 2 ? S / 2 : 0;
        const off = o + (Math.abs(o + row) <= w / 2 - S / 2 ? row : 0);
        const [a, b] = P(x0 + ux * (d + jitter) + nx * off, z0 + uz * (d + jitter) + nz * off);
        const rw = (S * 0.44 + Math.random() * 0.04) * k, rh = (S * 0.4 + Math.random() * 0.04) * k;
        x.fillStyle = STONES[Math.floor(Math.random() * STONES.length)];
        x.strokeStyle = '#b8935c'; x.lineWidth = 1.6;
        x.beginPath(); x.ellipse(a, b, rw, rh, Math.random() * 3, 0, 7); x.fill(); x.stroke();
      }
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
  rr(-7.2, -2.1, 7.2, 8.9, 1.1, '#7f9a3c', '#5f7a2a');
  rr(-6.9, -1.8, 6.9, 8.6, 0.9, '#8fb04a', null);
  path([[-14, ROADZ], [14, ROADZ]], 1.7);
  path([[BX[0], BZ + 1], [BX[0], ROADZ]], 1.2);
  for (let j = 1; j < 6; j++) path([[BX[j], BZ + 1], [BX[j], ROADZ]], 0.8);
  path([[0, ROADZ], [0, -2]], 1.2);
  path([[CARTP.x, ROADZ], [CARTP.x + 3, ROADZ]], 1.7);
  // pen ground
  rr(PEN.x0, PEN.z0, PEN.x1, PEN.z1, 0.8, '#b9a55c', '#957f40');
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
  const fc = ['#ffffff', '#ffe066', '#ff8fbf', '#c8a6ff', '#ff6b5e'];
  for (let i = 0; i < 520; i++) {
    const px = Math.random() * N, pz = Math.random() * N, wx = px / k - GW / 2, wz = pz / k - GW / 2;
    if ((wx > -7.6 && wx < 7.6 && wz > -2.5 && wz < 9.3) || Math.abs(wz - ROADZ) < 1.3) continue;
    x.fillStyle = fc[i % 5];
    for (let a = 0; a < 5; a++) { x.beginPath(); x.arc(px + Math.cos(a * 1.26) * 4, pz + Math.sin(a * 1.26) * 4, 3.4, 0, 7); x.fill(); }
    x.fillStyle = '#f2b318'; x.beginPath(); x.arc(px, pz, 2.6, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}
