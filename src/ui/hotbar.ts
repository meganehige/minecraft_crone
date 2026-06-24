import { HOTBAR_SIZE, type Inventory } from '../inventory/Inventory';
import { type ItemId } from '../inventory/items';
import { renderSlot } from './slots';

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
        position: 'relative',
        width: '46px',
        height: '46px',
        fontSize: '11px',
        color: '#fff',
        textAlign: 'right',
        lineHeight: '42px',
        paddingRight: '3px',
        boxSizing: 'border-box',
        textShadow: '0 1px 2px #000, 0 0 2px #000',
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

  getActive(): ItemId | null {
    return this.inventory.getSelectedItem();
  }

  setActiveBlock(id: ItemId): void {
    this.inventory.selectItem(id);
  }

  refresh(): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = this.slotEls[i]!;
      renderSlot(el, this.inventory.slots[i]);
      el.style.borderColor =
        i === this.inventory.selected ? '#ffffff' : 'rgba(255,255,255,0.25)';
    }
  }
}
