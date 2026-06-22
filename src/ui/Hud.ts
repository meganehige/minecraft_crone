import { MAX_HEALTH, MAX_HUNGER } from '../player/Survival';

/** Heart + hunger bars shown above the hotbar (hidden in creative). */
export class Hud {
  private readonly el: HTMLDivElement;
  private readonly heartsEl: HTMLDivElement;
  private readonly hungerEl: HTMLDivElement;
  private lastHealth = -1;
  private lastHunger = -1;
  private lastCreative: boolean | null = null;

  constructor() {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      left: '50%',
      bottom: '70px',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      width: '420px',
      pointerEvents: 'none',
      zIndex: '10',
      fontFamily: 'monospace',
      fontSize: '16px',
      textShadow: '0 1px 2px #000',
    } satisfies Partial<CSSStyleDeclaration>);

    this.heartsEl = document.createElement('div');
    this.hungerEl = document.createElement('div');
    this.hungerEl.style.textAlign = 'right';
    this.el.append(this.heartsEl, this.hungerEl);
    document.body.appendChild(this.el);
  }

  update(health: number, hunger: number, creative: boolean): void {
    if (
      health === this.lastHealth &&
      hunger === this.lastHunger &&
      creative === this.lastCreative
    ) {
      return;
    }
    this.lastHealth = health;
    this.lastHunger = hunger;
    this.lastCreative = creative;

    this.el.style.display = creative ? 'none' : 'flex';
    if (creative) return;

    this.heartsEl.textContent = bar(health, MAX_HEALTH, '♥', '#ff5555'); // hearts
    this.hungerEl.textContent = bar(hunger, MAX_HUNGER, '◆', '#cc9955'); // hunger
  }
}

/** Render N/2 filled symbols out of max/2 (each symbol = 2 points). */
function bar(value: number, max: number, _symbol: string, _color: string): string {
  const full = Math.round(value / 2);
  const total = max / 2;
  let s = '';
  for (let i = 0; i < total; i++) s += i < full ? '█' : '░';
  return s;
}
