import * as THREE from 'three';

/** Ink colour for outlines. */
export const INK = '#4a2e1a';

/** 4-step cel-shading ramp. */
export const toonGrad = (() => {
  const d = new Uint8Array([110, 185, 240, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const MC: Record<string, THREE.MeshToonMaterial> = {};
/** Cached cel-shaded material. */
export function T(color: string, extra?: THREE.MeshToonMaterialParameters): THREE.MeshToonMaterial {
  const k = color + (extra ? JSON.stringify(extra) : '');
  return MC[k] || (MC[k] = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toonGrad }, extra || {})));
}

const OLM: Record<number, THREE.MeshBasicMaterial> = {};
/** Inverted-hull outline: back faces pushed out along their normals by t in the vertex shader. */
export function olMat(t: number): THREE.MeshBasicMaterial {
  return OLM[t] || (OLM[t] = (() => {
    const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * ' + t.toFixed(3) + ';');
    };
    m.customProgramCacheKey = () => 'ol' + t;
    return m;
  })());
}

/** Fresh (uncached) material for particles whose opacity fades individually. */
export function puffMat(color: string, op: number) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, transparent: true, opacity: op, depthWrite: false });
}
