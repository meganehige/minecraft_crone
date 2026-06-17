import { BLOCKS } from './blocks';
import { BlockId, type BlockType } from './BlockType';

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
};
