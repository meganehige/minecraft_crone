import type { IDBPDatabase } from 'idb';
import { chunkKey } from '../math/coords';
import type { Chunk } from '../world/Chunk';
import { EDITS_STORE, META_STORE, openGameDB } from './db';

const META_KEY = 'world';
const FLUSH_DELAY = 400;

type EditMap = Map<number, number>; // localIndex -> blockId
type StoredEdits = [number, number][];

/**
 * Persists the world seed and per-chunk EDIT DIFFS (only blocks the player has
 * changed from the generated baseline) to IndexedDB. Terrain is regenerated
 * deterministically from the seed and these diffs are overlaid on top, so saves
 * stay tiny.
 */
export class SaveManager {
  readonly seed: string | number;

  private readonly edits = new Map<string, EditMap>();
  private readonly dirtyKeys = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private readonly db: IDBPDatabase,
    seed: string | number,
    edits: Map<string, EditMap>,
  ) {
    this.seed = seed;
    for (const [k, m] of edits) this.edits.set(k, m);
  }

  static async open(defaultSeed: string | number): Promise<SaveManager> {
    const db = await openGameDB();

    const meta = (await db.get(META_STORE, META_KEY)) as
      | { seed: string | number }
      | undefined;
    const seed = meta?.seed ?? defaultSeed;
    if (!meta) await db.put(META_STORE, { seed }, META_KEY);

    const keys = (await db.getAllKeys(EDITS_STORE)) as string[];
    const values = (await db.getAll(EDITS_STORE)) as StoredEdits[];
    const edits = new Map<string, EditMap>();
    keys.forEach((k, i) => {
      edits.set(k, new Map(values[i]));
    });

    return new SaveManager(db, seed, edits);
  }

  /** Overlay saved edits onto a freshly generated chunk. */
  applyEdits(chunk: Chunk): void {
    const m = this.edits.get(chunkKey(chunk.cx, chunk.cz));
    if (!m) return;
    for (const [idx, id] of m) {
      chunk.blocks[idx] = id;
    }
    chunk.dirty = true;
    chunk.lit = false;
  }

  /** Record a player edit (diff) and schedule a debounced write. */
  recordEdit(cx: number, cz: number, localIndex: number, id: number): void {
    const key = chunkKey(cx, cz);
    let m = this.edits.get(key);
    if (!m) {
      m = new Map();
      this.edits.set(key, m);
    }
    m.set(localIndex, id);
    this.dirtyKeys.add(key);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_DELAY);
  }

  /** Write all pending chunk edit-diffs to IndexedDB. */
  async flush(): Promise<void> {
    if (this.dirtyKeys.size === 0) return;
    const keys = [...this.dirtyKeys];
    this.dirtyKeys.clear();
    const tx = this.db.transaction(EDITS_STORE, 'readwrite');
    for (const key of keys) {
      const m = this.edits.get(key);
      if (m) await tx.store.put([...m.entries()] as StoredEdits, key);
    }
    await tx.done;
  }
}
