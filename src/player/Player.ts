import { Vector3 } from 'three';
import type { BlockSource } from '../world/BlockSource';
import { moveAndCollide } from '../physics/Collision';
import type { InputState } from './Controls';

const WALK_SPEED = 4.3; // blocks/s
const SPRINT_SPEED = 5.6;
const GRAVITY = 24; // blocks/s^2
const JUMP_SPEED = 8.4; // ~1.25 block jump
const TERMINAL = 60;

/** Player physics body. Position is the feet-centre. */
export class Player {
  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  readonly vel = new Vector3();
  onGround = false;

  yaw = 0;
  pitch = 0;

  readonly half = 0.3;
  readonly height = 1.8;
  readonly eyeHeight = 1.62;

  /** Distance fallen so far this descent (blocks). */
  fallDistance = 0;
  /** Fall distance captured on the tick the player landed (0 otherwise). */
  justLanded = 0;
  /** Whether movement input was applied this tick (for exhaustion). */
  movedThisTick = false;
  jumpedThisTick = false;

  constructor(spawn: Vector3) {
    this.pos.copy(spawn);
    this.prevPos.copy(spawn);
  }

  /** Horizontal forward/right unit vectors derived from yaw. */
  private basis(): { fx: number; fz: number; rx: number; rz: number } {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    return { fx, fz, rx, rz };
  }

  fixedUpdate(dt: number, input: InputState, src: BlockSource): void {
    this.prevPos.copy(this.pos);

    const { fx, fz, rx, rz } = this.basis();
    let wx = 0;
    let wz = 0;
    if (input.forward) {
      wx += fx;
      wz += fz;
    }
    if (input.back) {
      wx -= fx;
      wz -= fz;
    }
    if (input.right) {
      wx += rx;
      wz += rz;
    }
    if (input.left) {
      wx -= rx;
      wz -= rz;
    }

    const len = Math.hypot(wx, wz);
    this.movedThisTick = len > 0;
    const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    if (len > 0) {
      this.vel.x = (wx / len) * speed;
      this.vel.z = (wz / len) * speed;
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    // Gravity.
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -TERMINAL) this.vel.y = -TERMINAL;

    // Jump (only when grounded).
    this.jumpedThisTick = false;
    if (input.jump && this.onGround) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
      this.jumpedThisTick = true;
    }

    this.onGround = moveAndCollide(
      src,
      this.pos,
      this.vel,
      this.half,
      this.height,
      dt,
    );

    // Track fall distance and capture it on landing.
    this.justLanded = 0;
    if (this.onGround) {
      this.justLanded = this.fallDistance;
      this.fallDistance = 0;
    } else if (this.pos.y < this.prevPos.y) {
      this.fallDistance += this.prevPos.y - this.pos.y;
    }
  }
}
