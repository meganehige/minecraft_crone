import { BLOCKS } from './blocks';
import { BlockId, type BlockType, type SoundGroup } from './BlockType';

/** Lookup helpers over the static block table. */
export const BlockRegistry = {
  get(id: BlockId): BlockType {
    return BLOCKS[id] ?? BLOCKS[BlockId.Air];
  },
  isAir(id: BlockId): boolean {
    return id === BlockId.Air;
  },
  isSolid(id: BlockId): boolean {
    return BLOCKS[id]?.solid ?? false;
  },
  isTransparent(id: BlockId): boolean {
    return BLOCKS[id]?.transparent ?? true;
  },
  getLightEmission(id: BlockId): number {
    return BLOCKS[id]?.emitsLight ?? 0;
  },
  getHardness(id: BlockId): number {
    return BLOCKS[id]?.hardness ?? 0;
  },
  isBreakable(id: BlockId): boolean {
    return id !== BlockId.Air && (BLOCKS[id]?.hardness ?? -1) >= 0;
  },
  getSoundGroup(id: BlockId): SoundGroup {
    return BLOCKS[id]?.soundGroup ?? 'stone';
  },
  getDrop(id: BlockId): BlockId {
    return BLOCKS[id]?.drops ?? id;
  },
};
