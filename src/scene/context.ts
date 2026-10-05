import type * as THREE from 'three';

/** Shared handles for the 3D view. Filled in by setup3D() and initScene(). */
export const ctx = {
  ok3d: true,
  renderer: null as unknown as THREE.WebGLRenderer,
  scene: null as unknown as THREE.Scene,
  camera: null as unknown as THREE.OrthographicCamera,
  cvs: null as unknown as HTMLCanvasElement,
  wrap: null as unknown as HTMLElement,
  overlay: null as unknown as HTMLElement,
  /** Objects the pointer can tap. Each has userData.type somewhere up its parent chain. */
  pickables: [] as THREE.Object3D[],
  /** Canvas size in CSS pixels. */
  CW: 600,
  CH: 400,
};
