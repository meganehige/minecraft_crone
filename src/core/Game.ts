import * as THREE from 'three';
import { Config } from './Config';
import { installDebugApi, type GameDebugApi } from './Debug';
import { Loop } from './Loop';
import { World } from '../world/World';
import { ChunkManager } from '../world/ChunkManager';
import { Player } from '../player/Player';
import { Controls } from '../player/Controls';
import { TouchControls, isTouchDevice } from '../player/TouchControls';
import { BlockInteraction } from '../interaction/BlockInteraction';
import { installCrosshair } from '../ui/crosshair';
import { Hotbar } from '../ui/hotbar';
import { getMaterials } from '../render/materials';
import type { SaveManager } from '../persistence/SaveManager';

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
  private readonly interaction: BlockInteraction;
  private readonly hotbar: Hotbar;
  private readonly save?: SaveManager;
  private frozen = false;

  // Day/night cycle.
  private daylight = 1;
  private daylightOverride: number | null = null;
  private clock = 0;
  private lastClock = 0;
  private readonly dayColor = new THREE.Color(0x87ceeb);
  private readonly nightColor = new THREE.Color(0x05080f);
  private readonly skyColor = new THREE.Color();
  private sampleCanvas: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement, save?: SaveManager) {
    this.save = save;
    const seed = save?.seed ?? DEFAULT_SEED;
    // preserveDrawingBuffer lets the debug brightness sampler read the frame.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(Config.SKY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Config.SKY_COLOR);
    this.scene.fog = new THREE.Fog(Config.SKY_COLOR, SIZE * 3, SIZE * 5);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    // Lighting is baked into vertex colours by the LightEngine, so no scene
    // lights are needed (materials are MeshBasic).
    this.world = new World(this.scene, seed, save);
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

    this.interaction = new BlockInteraction(this.world, this.player);
    installCrosshair();
    this.hotbar = new Hotbar();
    this.installMouse(canvas);

    if (isTouchDevice()) {
      new TouchControls({
        input: this.controls.input,
        player: this.player,
        onBreak: () => this.interaction.break(),
        onPlace: () => {
          this.interaction.activeBlock = this.hotbar.getActive();
          this.interaction.place();
        },
      });
    }

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
      getBlock: (x, y, z) => this.world.getBlock(x, y, z),
      getLight: (x, y, z) => this.world.getLight(x, y, z),
      setBlock: (x, y, z, id) => this.world.setBlock(x, y, z, id),
      raycast: () => this.interaction.raycast(),
      breakBlock: () => this.interaction.break(),
      placeBlock: () => {
        this.interaction.activeBlock = this.hotbar.getActive();
        return this.interaction.place();
      },
      setActiveBlock: (id) => {
        this.hotbar.setActiveBlock(id);
        this.interaction.activeBlock = id;
      },
      setFrozen: (frozen) => {
        this.frozen = frozen;
      },
      save: () => this.save?.flush() ?? Promise.resolve(),
      setDaylight: (v) => {
        this.daylightOverride = Math.max(0, Math.min(1, v));
      },
      getDaylight: () => this.daylight,
      sampleBrightness: () => this.sampleBrightness(),
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => {
      void this.save?.flush();
    });
  }

  private installMouse(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== canvas) return;
      if (e.button === 0) {
        this.interaction.break();
      } else if (e.button === 2) {
        this.interaction.activeBlock = this.hotbar.getActive();
        this.interaction.place();
      }
    });
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
    if (this.frozen) {
      this.player.prevPos.copy(this.player.pos);
      return;
    }
    this.player.fixedUpdate(dt, this.controls.input, this.world);
  }

  private readonly eye = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  /**
   * Advance the day/night cycle and apply it. Lighting is baked per-mesh, so
   * day/night is applied globally by scaling the material colour (a multiplier
   * over the texture) and lerping the sky/fog colour — no remeshing. Block
   * light would ideally be exempt from dimming; with no emitters yet this is a
   * non-issue (noted for a future shader-based pass).
   */
  private updateDayNight(): void {
    const now = performance.now();
    if (this.lastClock === 0) this.lastClock = now;
    const dt = (now - this.lastClock) / 1000;
    this.lastClock = now;

    if (this.daylightOverride !== null) {
      this.daylight = this.daylightOverride;
    } else {
      const DAY_LENGTH = 120; // seconds per full cycle
      this.clock += dt;
      this.daylight = 0.5 + 0.5 * Math.sin((this.clock / DAY_LENGTH) * Math.PI * 2);
    }

    const floor = 0.18;
    const b = floor + (1 - floor) * this.daylight;
    const materials = getMaterials();
    (materials.opaque as THREE.MeshBasicMaterial).color.setScalar(b);
    (materials.transparent as THREE.MeshBasicMaterial).color.setScalar(b);

    this.skyColor.lerpColors(this.nightColor, this.dayColor, this.daylight);
    (this.scene.background as THREE.Color).copy(this.skyColor);
    if (this.scene.fog) this.scene.fog.color.copy(this.skyColor);
    this.renderer.setClearColor(this.skyColor);
  }

  /** Average framebuffer luminance in [0,1] (used by day/night tests). */
  private sampleBrightness(): number {
    const src = this.renderer.domElement;
    if (!this.sampleCanvas) this.sampleCanvas = document.createElement('canvas');
    const c = this.sampleCanvas;
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
    }
    return sum / (64 * 64) / 255;
  }

  private render(alpha: number): void {
    this.manager.processQueues();
    this.updateDayNight();

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
