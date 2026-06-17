import { TICK_DT } from './Config';

/** Largest frame delta we integrate, to avoid the spiral of death. */
const MAX_FRAME_DT = 0.25;

/**
 * Fixed-timestep simulation with a variable-rate render, plus an interpolation
 * factor (alpha) for smooth motion between ticks (Gaffer's "Fix Your Timestep").
 */
export class Loop {
  private last = 0;
  private accumulator = 0;
  private running = false;

  constructor(
    private readonly fixedUpdate: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      requestAnimationFrame(frame);
      let frameDt = (now - this.last) / 1000;
      this.last = now;
      if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;
      this.accumulator += frameDt;
      while (this.accumulator >= TICK_DT) {
        this.fixedUpdate(TICK_DT);
        this.accumulator -= TICK_DT;
      }
      this.render(this.accumulator / TICK_DT);
    };
    requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
  }
}
