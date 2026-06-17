import { Game } from './core/Game';

const canvas = document.getElementById('app') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('#app canvas not found');
}

const game = new Game(canvas);
game.start();
