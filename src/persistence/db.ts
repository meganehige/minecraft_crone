import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'minecraft_crone';
const VERSION = 1;

export const META_STORE = 'meta';
export const EDITS_STORE = 'edits';

/** Open (and migrate) the game database. */
export function openGameDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(EDITS_STORE)) {
        db.createObjectStore(EDITS_STORE);
      }
    },
  });
}
