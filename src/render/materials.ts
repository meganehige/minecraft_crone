import * as THREE from 'three';
import {
  ATLAS_COLS,
  ATLAS_H,
  ATLAS_W,
  TILE_PX,
  Tile,
} from './atlas';

/** Tiny deterministic PRNG so procedural tiles look the same every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];

function shade([r, g, b]: RGB, f: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function tileOrigin(index: number): [number, number] {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  return [col * TILE_PX, row * TILE_PX];
}

/** Fill a tile with a base colour plus per-pixel speckle for texture. */
function paintNoise(
  ctx: CanvasRenderingContext2D,
  index: number,
  base: RGB,
  jitter: number,
  seed: number,
): void {
  const [ox, oy] = tileOrigin(index);
  const rng = mulberry32(seed);
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const f = 1 - jitter / 2 + rng() * jitter;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function buildAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  paintNoise(ctx, Tile.GrassTop, [99, 178, 74], 0.18, 1);
  paintNoise(ctx, Tile.Dirt, [134, 96, 67], 0.22, 2);
  paintNoise(ctx, Tile.Stone, [128, 128, 128], 0.22, 3);
  paintNoise(ctx, Tile.Sand, [219, 205, 148], 0.16, 4);
  paintNoise(ctx, Tile.Water, [60, 120, 200], 0.12, 5);
  paintNoise(ctx, Tile.WoodTop, [160, 124, 80], 0.18, 6);
  paintNoise(ctx, Tile.WoodSide, [110, 82, 52], 0.2, 7);
  paintNoise(ctx, Tile.Leaves, [70, 140, 60], 0.28, 8);

  // Grass side: dirt with a green top band.
  paintNoise(ctx, Tile.GrassSide, [134, 96, 67], 0.22, 9);
  {
    const [ox, oy] = tileOrigin(Tile.GrassSide);
    const rng = mulberry32(99);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const f = 0.9 + rng() * 0.2;
        ctx.fillStyle = shade([99, 178, 74], f);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  // Wood top: a couple of concentric rings.
  {
    const [ox, oy] = tileOrigin(Tile.WoodTop);
    ctx.strokeStyle = shade([110, 82, 52], 1);
    for (const r of [3, 6]) {
      ctx.beginPath();
      ctx.arc(ox + 8, oy + 8, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // --- Sprint 11 tiles ---
  paintNoise(ctx, Tile.Planks, [170, 130, 80], 0.12, 21);
  paintNoise(ctx, Tile.Cobblestone, [120, 120, 122], 0.32, 22);
  paintNoise(ctx, Tile.CraftingTable, [150, 110, 70], 0.16, 23);
  paintNoise(ctx, Tile.Furnace, [110, 110, 112], 0.22, 24);
  paintNoise(ctx, Tile.Stick, [90, 130, 60], 1.0, 25); // mostly transparent-ish bg via grass
  paintNoise(ctx, Tile.Coal, [40, 40, 40], 0.4, 26);
  paintNoise(ctx, Tile.IronIngot, [200, 200, 205], 0.1, 27);
  paintNoise(ctx, Tile.RawIron, [200, 160, 140], 0.18, 28);

  // Planks: horizontal plank seams.
  {
    const [ox, oy] = tileOrigin(Tile.Planks);
    ctx.strokeStyle = shade([120, 90, 55], 1);
    for (const y of [4, 8, 12]) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y + 0.5);
      ctx.lineTo(ox + TILE_PX, oy + y + 0.5);
      ctx.stroke();
    }
  }
  // Crafting table: a grid pattern on top.
  {
    const [ox, oy] = tileOrigin(Tile.CraftingTable);
    ctx.strokeStyle = shade([90, 60, 35], 1);
    for (const d of [5, 10]) {
      ctx.beginPath();
      ctx.moveTo(ox + d + 0.5, oy);
      ctx.lineTo(ox + d + 0.5, oy + TILE_PX);
      ctx.moveTo(ox, oy + d + 0.5);
      ctx.lineTo(ox + TILE_PX, oy + d + 0.5);
      ctx.stroke();
    }
  }
  // Furnace: a dark front opening.
  {
    const [ox, oy] = tileOrigin(Tile.Furnace);
    ctx.fillStyle = 'rgb(30,30,32)';
    ctx.fillRect(ox + 4, oy + 7, 8, 6);
  }
  // Stick: a single diagonal brown bar.
  {
    const [ox, oy] = tileOrigin(Tile.Stick);
    ctx.fillStyle = 'rgb(120,85,45)';
    for (let i = 3; i < 13; i++) ctx.fillRect(ox + i, oy + (15 - i), 2, 2);
  }

  paintNoise(ctx, Tile.Lava, [210, 90, 20], 0.3, 31);
  paintNoise(ctx, Tile.Gravel, [110, 105, 100], 0.4, 32);

  // Tool icons: a stick handle plus a head shape.
  const drawHandle = (ox: number, oy: number) => {
    ctx.fillStyle = 'rgb(120,85,45)';
    for (let i = 4; i < 14; i++) ctx.fillRect(ox + i, oy + (15 - i), 2, 2);
  };
  {
    const [ox, oy] = tileOrigin(Tile.Pickaxe);
    drawHandle(ox, oy);
    ctx.strokeStyle = 'rgb(180,180,185)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox + 3, oy + 5);
    ctx.quadraticCurveTo(ox + 8, oy + 1, ox + 13, oy + 5);
    ctx.stroke();
  }
  {
    const [ox, oy] = tileOrigin(Tile.Axe);
    drawHandle(ox, oy);
    ctx.fillStyle = 'rgb(180,180,185)';
    ctx.fillRect(ox + 8, oy + 2, 5, 6);
  }
  {
    const [ox, oy] = tileOrigin(Tile.Shovel);
    drawHandle(ox, oy);
    ctx.fillStyle = 'rgb(180,180,185)';
    ctx.fillRect(ox + 9, oy + 2, 4, 4);
  }

  return canvas;
}

export interface Materials {
  texture: THREE.Texture;
  opaque: THREE.Material;
  transparent: THREE.Material;
  /** The procedurally-built atlas canvas (used for HTML item icons). */
  atlasCanvas: HTMLCanvasElement;
}

let cached: Materials | null = null;

export function getMaterials(): Materials {
  if (cached) return cached;

  const atlasCanvas = buildAtlasCanvas();
  const texture = new THREE.CanvasTexture(atlasCanvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  // Lighting is baked into vertex colours (Minecraft-style), so MeshBasic is
  // used and scene lights are ignored.
  const opaque = new THREE.MeshBasicMaterial({ map: texture, vertexColors: true });
  const transparent = new THREE.MeshBasicMaterial({
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  cached = { texture, opaque, transparent, atlasCanvas };
  return cached;
}
