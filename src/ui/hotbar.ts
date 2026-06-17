import { BlockId } from '../world/blocks/BlockType';
import { BLOCKS } from '../world/blocks/blocks';

const SLOTS: BlockId[] = [
  BlockId.Stone,
  BlockId.Dirt,
  BlockId.Grass,
  BlockId.Sand,
  BlockId.Wood,
  BlockId.Leaves,
  BlockId.Water,
];

/** Simple block-type selector bound to number keys 1..7. */
export class Hotbar {
  private active = 0;
  private readonly el: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];

  constructor() {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      left: '50%',
      bottom: '16px',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '4px',
      zIndex: '10',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    SLOTS.forEach((id, i) => {
      const slot = document.createElement('div');
      Object.assign(slot.style, {
        width: '46px',
        height: '46px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontSize: '10px',
        color: '#fff',
        textShadow: '0 1px 2px #000',
        background: 'rgba(0,0,0,0.35)',
        border: '2px solid rgba(255,255,255,0.25)',
        borderRadius: '4px',
        fontFamily: 'monospace',
      } satisfies Partial<CSSStyleDeclaration>);
      slot.textContent = `${i + 1} ${BLOCKS[id]!.name}`;
      this.slotEls.push(slot);
      this.el.appendChild(slot);
    });

    document.body.appendChild(this.el);
    this.refresh();

    window.addEventListener('keydown', (e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= SLOTS.length) {
        this.setActive(n - 1);
      }
    });
  }

  getActive(): BlockId {
    return SLOTS[this.active]!;
  }

  setActive(index: number): void {
    if (index < 0 || index >= SLOTS.length) return;
    this.active = index;
    this.refresh();
  }

  /** Select by block id (used by the debug API). */
  setActiveBlock(id: BlockId): void {
    const i = SLOTS.indexOf(id);
    if (i >= 0) this.setActive(i);
  }

  private refresh(): void {
    this.slotEls.forEach((el, i) => {
      el.style.borderColor =
        i === this.active ? '#ffffff' : 'rgba(255,255,255,0.25)';
    });
  }
}
