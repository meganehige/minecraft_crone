import { Config } from '../core/Config';

const S = Config.CHUNK_SIZE;

/** World coordinate -> chunk index along one axis. */
export function worldToChunk(w: number): number {
  return Math.floor(w / S);
}

/** World coordinate -> local [0,SIZE) coordinate, correct for negatives. */
export function worldToLocal(w: number): number {
  return ((Math.floor(w) % S) + S) % S;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}
