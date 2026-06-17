import * as THREE from 'three';
import { Config } from './Config';
import { installDebugApi, type GameDebugApi } from './Debug';
import { Loop } from './Loop';
import { Chunk } from '../world/Chunk';
import { BlockId } from '../world/blocks/BlockType';
import type { BlockSource } from '../world/BlockSource';
import { buildChunkMesh } from '../render/ChunkMesher';
import { getMaterials } from '../render/materials';
import { Player } from '../player/Player';
import { Controls } from '../player/Controls';

const SIZE = Config.CHUNK_SIZE;

/**
 * Sprint 2 bootstrap: a single demo chunk plus a first-person player with
 * gravity, jumping and AABB collision, driven by a fixed-timestep loop with
 * interpolated rendering.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly debug: GameDebugApi;

  private readonly chunk: Chunk;
  private readonly source: BlockSource;
  private readonly player: Player;
  private readonly controls: Controls;
  private readonly loop: Loop;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(Config.SKY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Config.SKY_COLOR);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.6, 1, 0.4);
    this.scene.add(ambient, sun);

    this.chunk = this.buildDemoChunk();
    // Single chunk at origin: world coords equal chunk-local coords.
    this.source = { getBlock: (x, y, z) => this.chunk.getBlock(x, y, z) };
    const chunkStats = this.addChunkMeshes(this.chunk);

    this.player = new Player(new THREE.Vector3(SIZE / 2, 14, SIZE / 2));
    this.controls = new Controls(canvas, this.player);

    this.loop = new Loop(
      (dt) => this.fixedUpdate(dt),
      (alpha) => this.render(alpha),
    );

    this.debug = installDebugApi({
      ready: false,
      webglVersion: this.detectWebglVersion(),
      frameCount: 0,
      chunkStats,
      input: this.controls.input,
      setView: (yaw, pitch) => {
        this.player.yaw = yaw;
        this.player.pitch = pitch;
      },
      teleport: (x, y, z) => {
        this.player.pos.set(x, y, z);
        this.player.prevPos.set(x, y, z);
        this.player.vel.set(0, 0, 0);
      },
      getPlayer: () => ({
        x: this.player.pos.x,
        y: this.player.pos.y,
        z: this.player.pos.z,
        vx: this.player.vel.x,
        vy: this.player.vel.y,
        vz: this.player.vel.z,
        onGround: this.player.onGround,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
      }),
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

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

  private addChunkMeshes(chunk: Chunk): { faces: number; solidBlocks: number } {
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
    return result.stats;
  }

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

  private fixedUpdate(dt: number): void {
    this.player.fixedUpdate(dt, this.controls.input, this.source);
  }

  private readonly eye = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  private render(alpha: number): void {
    const p = this.player;
    // Interpolate feet position between the previous and current tick.
    this.eye.set(
      THREE.MathUtils.lerp(p.prevPos.x, p.pos.x, alpha),
      THREE.MathUtils.lerp(p.prevPos.y, p.pos.y, alpha) + p.eyeHeight,
      THREE.MathUtils.lerp(p.prevPos.z, p.pos.z, alpha),
    );
    const cp = Math.cos(p.pitch);
    const dirX = -Math.sin(p.yaw) * cp;
    const dirY = Math.sin(p.pitch);
    const dirZ = -Math.cos(p.yaw) * cp;
    this.camera.position.copy(this.eye);
    this.lookAt.set(this.eye.x + dirX, this.eye.y + dirY, this.eye.z + dirZ);
    this.camera.lookAt(this.lookAt);

    this.renderer.render(this.scene, this.camera);
    this.debug.frameCount += 1;
    this.debug.ready = true;
  }

  start(): void {
    this.loop.start();
  }
}
