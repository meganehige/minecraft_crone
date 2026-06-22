import { BLOCKS } from '../world/blocks/blocks';
import { HOTBAR_SIZE, TOTAL_SLOTS, type Inventory } from '../inventory/Inventory';

/**
 * Full inventory screen (toggle with E). Lays out the 27 main slots above the 9
 * hotbar slots and supports click-to-move via the inventory cursor stack.
 */
export class InventoryScreen {
  private readonly root: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly cursorEl: HTMLDivElement;
  private open = false;

  constructor(private readonly inventory: Inventory) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
      zIndex: '30',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.dataset.testid = 'inventory-screen';

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'rgba(40,40,40,0.95)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '12px',
    } satisfies Partial<CSSStyleDeclaration>);

    this.grid = document.createElement('div');
    Object.assign(this.grid.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(${HOTBAR_SIZE}, 44px)`,
      gap: '4px',
    } satisfies Partial<CSSStyleDeclaration>);

    // Main slots (rows) first, then a gap, then the hotbar row.
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) this.addSlot(i);
    const spacer = document.createElement('div');
    spacer.style.gridColumn = `1 / span ${HOTBAR_SIZE}`;
    spacer.style.height = '8px';
    this.grid.appendChild(spacer);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.addSlot(i);

    panel.appendChild(this.grid);
    this.root.appendChild(panel);

    // Cursor stack follows the mouse.
    this.cursorEl = document.createElement('div');
    Object.assign(this.cursorEl.style, {
      position: 'fixed',
      pointerEvents: 'none',
      fontSize: '9px',
      fontFamily: 'monospace',
      color: '#fff',
      textShadow: '0 1px 2px #000',
      background: 'rgba(0,0,0,0.6)',
      padding: '2px 4px',
      borderRadius: '3px',
      display: 'none',
      whiteSpace: 'pre',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.appendChild(this.cursorEl);
    this.root.addEventListener('mousemove', (e) => {
      this.cursorEl.style.left = `${e.clientX + 10}px`;
      this.cursorEl.style.top = `${e.clientY + 10}px`;
    });

    document.body.appendChild(this.root);
  }

  private addSlot(index: number): void {
    const el = document.createElement('div');
    el.dataset.slot = String(index);
    Object.assign(el.style, {
      width: '44px',
      height: '44px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#fff',
      textShadow: '0 1px 2px #000',
      background: 'rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.2)',
      whiteSpace: 'pre',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    el.addEventListener('click', () => {
      this.inventory.clickSlot(index);
    });
    this.slotEls[index] = el;
    this.grid.appendChild(el);
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    this.open = !this.open;
    this.root.style.display = this.open ? 'flex' : 'none';
    if (!this.open && this.inventory.cursor) {
      // Return the cursor stack to the inventory when closing.
      this.inventory.add(this.inventory.cursor.item, this.inventory.cursor.count);
      this.inventory.cursor = null;
    }
    this.refresh();
  }

  refresh(): void {
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const el = this.slotEls[i];
      if (!el) continue;
      const s = this.inventory.slots[i];
      el.textContent = s ? `${BLOCKS[s.item]!.name}\n${s.count}` : '';
    }
    const c = this.inventory.cursor;
    this.cursorEl.style.display = c ? 'block' : 'none';
    if (c) this.cursorEl.textContent = `${BLOCKS[c.item]!.name}\n${c.count}`;
  }
}
