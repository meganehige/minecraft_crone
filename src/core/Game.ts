import * as THREE from 'three';
import { Config } from './Config';
import { installDebugApi, type GameDebugApi } from './Debug';

/**
 * Sprint 0 bootstrap: a WebGL renderer, a scene with a spinning cube, and the
 * debug API. Later sprints replace the placeholder cube with the voxel world,
 * swap the naive rAF loop for a fixed-timestep loop, and wire in the player.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly debug: GameDebugApi;

  private readonly cube: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(Config.SKY_COLOR);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(Config.SKY_COLOR);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
    this.camera.position.set(0, 0, 4);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(1, 2, 1);
    this.scene.add(ambient, sun);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x6cc24a });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    this.debug = installDebugApi({
      ready: false,
      webglVersion: this.detectWebglVersion(),
      frameCount: 0,
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

  start(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.013;
      this.renderer.render(this.scene, this.camera);
      this.debug.frameCount += 1;
      this.debug.ready = true;
    };
    animate();
  }
}
