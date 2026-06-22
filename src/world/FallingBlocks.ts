import { BlockRegistry } from './blocks/BlockRegistry';
import { BlockId } from './blocks/BlockType';
import type { World } from './World';

/**
 * Makes gravity blocks (sand, gravel) fall when unsupported. Cells are checked
 * lazily: World reports block changes, and an unsupported gravity block is moved
 * down one cell per tick (which re-triggers checks until it settles).
 */
export class FallingBlocks {
  private readonly queue: number[] = [];
  private readonly pending = new Set<string>();

  constructor(private readonly world: World) {}

  /** Queue a cell (and the one above) for a support check. */
  mark(x: number, y: number, z: number): void {
    this.enqueue(x, y, z);
    this.enqueue(x, y + 1, z); // the block above may now be unsupported
  }

  private enqueue(x: number, y: number, z: number): void {
    const key = `${x},${y},${z}`;
    if (this.pending.has(key)) return;
    this.pending.add(key);
    this.queue.push(x, y, z);
  }

  tick(budget = 128): void {
    let n = 0;
    while (this.queue.length > 0 && n < budget) {
      const x = this.queue.shift()!;
      const y = this.queue.shift()!;
      const z = this.queue.shift()!;
      this.pending.delete(`${x},${y},${z}`);
      n++;

      const id = this.world.getBlock(x, y, z) as BlockId;
      if (!BlockRegistry.isGravity(id)) continue;
      if (this.world.getBlock(x, y - 1, z) === BlockId.Air) {
        // Fall one cell; setBlock re-marks neighbours so it keeps falling.
        // Not recorded as a save edit (derived motion).
        this.world.setBlock(x, y, z, BlockId.Air, false);
        this.world.setBlock(x, y - 1, z, id, false);
      }
    }
  }
}
