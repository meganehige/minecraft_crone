import * as THREE from 'three';
import { Config } from './Config';
import { installDebugApi, type GameDebugApi } from './Debug';
import { Loop } from './Loop';
import { World } from '../world/World';
import { ChunkManager } from '../world/ChunkManager';
import { Player } from '../player/Player';
import { Controls } from '../player/Controls';

const SIZE = Config.CHUNK_SIZE;
const DEFAULT_SEED = 'minecraft_crone';

/**
 * Sprint 3 bootstrap: a streaming, procedurally generated multi-chunk world
 * with a first-person player. Generation/meshing are budgeted per frame by the
 * ChunkManager; a 3x3 spawn area is generated up-front so the player has ground.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly debug: GameDebugApi;

  private readonly world: World;
  private readonly manager: ChunkManager;
  private readonly player: Player;
  private readonly controls: Controls;
  private readonly loop: Loop;

  constructor(canvas: HTMLCanvasElement, seed: string | number = DEFAULT_SEED) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(Config.SKY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Config.SKY_COLOR);
    this.scene.fog = new THREE.Fog(Config.SKY_COLOR, SIZE * 3, SIZE * 5);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(0.6, 1, 0.4);
    this.scene.add(ambient, sun);

    this.world = new World(this.scene, seed);
    this.manager = new ChunkManager(this.world);

    // Pre-generate a 3x3 spawn area so the player lands on real ground.
    this.manager.update(0.5, 0.5);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.world.generateChunk(this.world.ensureChunk(dx, dz));
      }
    }
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.world.meshChunk(this.world.ensureChunk(dx, dz));
      }
    }

    const spawnH = this.world.generator.surfaceHeight(0, 0);
    this.player = new Player(new THREE.Vector3(0.5, spawnH + 2, 0.5));
    this.controls = new Controls(canvas, this.player);

    this.loop = new Loop(
      (dt) => this.fixedUpdate(dt),
      (alpha) => this.render(alpha),
    );

    this.debug = installDebugApi({
      ready: false,
      webglVersion: this.detectWebglVersion(),
      frameCount: 0,
      chunkStats: this.world.lastMeshStats,
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
      surfaceHeight: (x, z) => this.world.generator.surfaceHeight(x, z),
      getWorldInfo: () => ({
        seed: this.world.generator.seed,
        loadedChunks: this.world.loadedCount,
        settled: this.manager.isSettled(),
      }),
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
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
    this.manager.update(this.player.pos.x, this.player.pos.z);
    this.player.fixedUpdate(dt, this.controls.input, this.world);
  }

  private readonly eye = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  private render(alpha: number): void {
    this.manager.processQueues();

    const p = this.player;
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
    this.debug.chunkStats = this.world.lastMeshStats;
    this.debug.frameCount += 1;
    this.debug.ready = true;
  }

  start(): void {
    this.loop.start();
  }
}
