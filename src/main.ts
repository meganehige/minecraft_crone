import { Game } from './core/Game';
import { SaveManager } from './persistence/SaveManager';

const DEFAULT_SEED = 'minecraft_crone';

async function main(): Promise<void> {
  const canvas = document.getElementById('app') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('#app canvas not found');
  }

  let save: SaveManager | undefined;
  try {
    save = await SaveManager.open(DEFAULT_SEED);
  } catch (err) {
    // Persistence is best-effort; run without saving if IndexedDB is unavailable.
    console.warn('save disabled:', err);
  }
  const game = new Game(canvas, save);
  game.start();
}

void main();
