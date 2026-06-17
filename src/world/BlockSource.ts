import { BlockRegistry } from './blocks/BlockRegistry';
import { BlockId } from './blocks/BlockType';

/** Anything that can answer "what block is at this world coordinate?". */
export interface BlockSource {
  getBlock(wx: number, wy: number, wz: number): BlockId;
}

export function isSolidAt(
  src: BlockSource,
  wx: number,
  wy: number,
  wz: number,
): boolean {
  return BlockRegistry.isSolid(src.getBlock(wx, wy, wz));
}
