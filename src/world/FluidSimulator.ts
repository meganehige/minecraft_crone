import { BlockRegistry } from './blocks/BlockRegistry';
import { BlockId } from './blocks/BlockType';
import type { World } from './World';

const SIDES: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * A fill-only fluid flow: water/lava spread downward into air and outward along
 * supported surfaces up to a max distance (water 7, lava 3). Cells not tracked
 * in the level map are sources (level 0). Draining when a source is removed is
 * not simulated (a deliberate v1 simplification).
 */
export class FluidSimulator {
  private readonly queue: number[] = [];
  private readonly pending = new Set<string>();
  /** Flow level per flowing cell; absent = source (level 0). */
  private readonly level = new Map<string, number>();

  constructor(private readonly world: World) {}

  private getLevel(x: number, y: number, z: number): number {
    return this.level.get(`${x},${y},${z}`) ?? 0;
  }

  /** Mark a fluid cell, or fluid neighbours of a newly-air cell, to flow. */
  mark(x: number, y: number, z: number): void {
    const here = this.world.getBlock(x, y, z) as BlockId;
    if (BlockRegistry.isFluid(here)) {
      this.enqueue(x, y, z);
      return;
    }
    if (here === BlockId.Air) {
      // A neighbouring fluid may now flow into this gap.
      this.enqueueIfFluid(x + 1, y, z);
      this.enqueueIfFluid(x - 1, y, z);
      this.enqueueIfFluid(x, y + 1, z);
      this.enqueueIfFluid(x, y, z + 1);
      this.enqueueIfFluid(x, y, z - 1);
    }
  }

  private enqueueIfFluid(x: number, y: number, z: number): void {
    if (BlockRegistry.isFluid(this.world.getBlock(x, y, z) as BlockId)) {
      this.enqueue(x, y, z);
    }
  }

  private enqueue(x: number, y: number, z: number): void {
    const key = `${x},${y},${z}`;
    if (this.pending.has(key)) return;
    this.pending.add(key);
    this.queue.push(x, y, z);
  }

  private place(x: number, y: number, z: number, id: BlockId, level: number): void {
    this.level.set(`${x},${y},${z}`, level);
    // Derived flow; not persisted as a save edit. Triggers onBlockChange.
    this.world.setBlock(x, y, z, id, false);
  }

  tick(budget = 256): void {
    let n = 0;
    while (this.queue.length > 0 && n < budget) {
      const x = this.queue.shift()!;
      const y = this.queue.shift()!;
      const z = this.queue.shift()!;
      this.pending.delete(`${x},${y},${z}`);
      n++;

      const id = this.world.getBlock(x, y, z) as BlockId;
      if (!BlockRegistry.isFluid(id)) continue;
      const lvl = this.getLevel(x, y, z);

      // Flow straight down into air (carries the same level).
      if (this.world.getBlock(x, y - 1, z) === BlockId.Air) {
        this.place(x, y - 1, z, id, lvl);
        continue;
      }

      // Otherwise spread horizontally if there is room and support below.
      if (lvl >= BlockRegistry.getMaxSpread(id)) continue;
      for (const [dx, dz] of SIDES) {
        const nx = x + dx;
        const nz = z + dz;
        if (this.world.getBlock(nx, y, nz) !== BlockId.Air) continue;
        const supported =
          this.world.getBlock(nx, y - 1, nz) !== BlockId.Air; // ground or fluid below
        if (!supported) continue;
        this.place(nx, y, nz, id, lvl + 1);
      }
    }
  }
}
