import { BLOCKS } from '../world/blocks/blocks';
import type { BlockId } from '../world/blocks/BlockType';
import { HOTBAR_SIZE, type Inventory } from '../inventory/Inventory';

/** Hotbar view bound to the inventory's first 9 slots (keys 1..9). */
export class Hotbar {
  private readonly el: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];

  constructor(private readonly inventory: Inventory) {
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

    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      Object.assign(slot.style, {
        width: '46px',
        height: '46px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        color: '#fff',
        textShadow: '0 1px 2px #000',
        background: 'rgba(0,0,0,0.35)',
        border: '2px solid rgba(255,255,255,0.25)',
        borderRadius: '4px',
        fontFamily: 'monospace',
      } satisfies Partial<CSSStyleDeclaration>);
      this.slotEls.push(slot);
      this.el.appendChild(slot);
    }

    document.body.appendChild(this.el);
    this.refresh();

    window.addEventListener('keydown', (e) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= HOTBAR_SIZE) {
        this.inventory.select(n - 1);
      }
    });
  }

  getActive(): BlockId | null {
    return this.inventory.getSelectedItem();
  }

  setActiveBlock(id: BlockId): void {
    this.inventory.selectItem(id);
  }

  refresh(): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this.slotEls[i]!;
      const stack = this.inventory.slots[i];
      el.textContent = stack
        ? `${BLOCKS[stack.item]!.name}\n${stack.count}`
        : '';
      el.style.whiteSpace = 'pre';
      el.style.borderColor =
        i === this.inventory.selected ? '#ffffff' : 'rgba(255,255,255,0.25)';
    }
  }
}
