import * as THREE from 'three';
import type { MiningTarget } from '../interaction/Mining';

const STAGES = 10;
const TEX_PX = 16;

/** Deterministic PRNG so the crack pattern is stable per stage. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCrackTexture(stage: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_PX;
  canvas.height = TEX_PX;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, TEX_PX, TEX_PX);

  // More, longer cracks as the stage progresses.
  const rng = mulberry32(1234);
  const lines = 1 + stage; // 1..10
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i < lines; i++) {
    let x = Math.floor(rng() * TEX_PX);
    let y = Math.floor(rng() * TEX_PX);
    const segments = 2 + Math.floor(rng() * (2 + stage));
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segments; s++) {
      x += Math.floor(rng() * 7) - 3;
      y += Math.floor(rng() * 7) - 3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * Translucent overlay box rendered on the block currently being mined, showing
 * the destroy-stage cracks (0..9). Hidden when not mining.
 */
export class BreakOverlay {
  private readonly mesh: THREE.Mesh;
  private readonly materials: THREE.MeshBasicMaterial[];

  constructor(scene: THREE.Scene) {
    this.materials = [];
    for (let s = 0; s < STAGES; s++) {
      this.materials.push(
        new THREE.MeshBasicMaterial({
          map: buildCrackTexture(s),
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
    }
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.mesh = new THREE.Mesh(geo, this.materials[0]);
    this.mesh.visible = false;
    this.mesh.renderOrder = 999;
    scene.add(this.mesh);
  }

  update(target: MiningTarget | null, stage: number): void {
    if (!target || stage < 0) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mesh.material = this.materials[Math.min(STAGES - 1, stage)]!;
    this.mesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
  }
}
