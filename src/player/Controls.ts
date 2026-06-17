import type { Player } from './Player';

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.01;

/**
 * Keyboard + pointer-lock mouse input. Writes movement intent into a shared
 * `InputState` and updates the player's yaw/pitch. Headless tests bypass this
 * by mutating `input` / yaw / pitch directly via the debug API.
 */
export class Controls {
  readonly input: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly player: Player,
  ) {
    canvas.addEventListener('click', () => {
      void canvas.requestPointerLock?.();
    });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  private get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.locked) return;
    this.player.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.player.pitch -= e.movementY * MOUSE_SENSITIVITY;
    this.player.pitch = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, this.player.pitch),
    );
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    switch (e.code) {
      case 'KeyW':
        this.input.forward = down;
        break;
      case 'KeyS':
        this.input.back = down;
        break;
      case 'KeyA':
        this.input.left = down;
        break;
      case 'KeyD':
        this.input.right = down;
        break;
      case 'Space':
        this.input.jump = down;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.sprint = down;
        break;
      default:
        return;
    }
  }
}
