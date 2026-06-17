import * as THREE from 'three';
import { Config } from './Config';
import { installDebugApi, type GameDebugApi } from './Debug';
import { Chunk } from '../world/Chunk';
import { BlockId } from '../world/blocks/BlockType';
import { buildChunkMesh } from '../render/ChunkMesher';
import { getMaterials } from '../render/materials';

const SIZE = Config.CHUNK_SIZE;

/**
 * Sprint 1 bootstrap: render a single hand-built chunk (a small grassy hill) as
 * culled opaque/transparent meshes. The fixed-timestep loop and player arrive
 * in later sprints; for now an rAF loop slowly orbits the camera so the
 * screenshot shows the 3D form.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly debug: GameDebugApi;

  private angle = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(Config.SKY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Config.SKY_COLOR);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.6, 1, 0.4);
    this.scene.add(ambient, sun);

    const chunk = this.buildDemoChunk();
    this.addChunkMeshes(chunk);

    this.debug = installDebugApi({
      ready: false,
      webglVersion: this.detectWebglVersion(),
      frameCount: 0,
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** A rounded grassy hill for Sprint 1 visualisation. */
  private buildDemoChunk(): Chunk {
    const chunk = new Chunk(0, 0);
    const cx = (SIZE - 1) / 2;
    const cz = (SIZE - 1) / 2;
    for (let x = 0; x < SIZE; x++) {
      for (let z = 0; z < SIZE; z++) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2;
        const h = 4 + Math.round(4 * Math.exp(-d2 / 28));
        for (let y = 0; y <= h; y++) {
          let id: BlockId;
          if (y === h) id = BlockId.Grass;
          else if (y >= h - 2) id = BlockId.Dirt;
          else id = BlockId.Stone;
          chunk.setBlock(x, y, z, id);
        }
      }
    }
    chunk.generated = true;
    return chunk;
  }

  private addChunkMeshes(chunk: Chunk): void {
    const materials = getMaterials();
    const result = buildChunkMesh((x, y, z) => chunk.getBlock(x, y, z));
    if (result.opaque) {
      chunk.mesh = new THREE.Mesh(result.opaque, materials.opaque);
      this.scene.add(chunk.mesh);
    }
    if (result.transparent) {
      chunk.transparentMesh = new THREE.Mesh(
        result.transparent,
        materials.transparent,
      );
      this.scene.add(chunk.transparentMesh);
    }
    this.pendingChunkStats = result.stats;
  }

  private pendingChunkStats: { faces: number; solidBlocks: number } | null =
    null;

  private detectWebglVersion(): string | null {
    const gl = this.renderer.getContext();
    try {
      return gl.getParameter(gl.VERSION) as string;
    } catch {
      return null;
    }
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    if (this.pendingChunkStats) {
      this.debug.chunkStats = this.pendingChunkStats;
    }
    const center = new THREE.Vector3(SIZE / 2, 5, SIZE / 2);
    const animate = () => {
      requestAnimationFrame(animate);
      this.angle += 0.004;
      const r = SIZE * 1.5;
      this.camera.position.set(
        center.x + Math.cos(this.angle) * r,
        16,
        center.z + Math.sin(this.angle) * r,
      );
      this.camera.lookAt(center);
      this.renderer.render(this.scene, this.camera);
      this.debug.frameCount += 1;
      this.debug.ready = true;
    };
    animate();
  }
}
