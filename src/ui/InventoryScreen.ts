import { HOTBAR_SIZE, TOTAL_SLOTS, type Inventory } from '../inventory/Inventory';
import { ItemRegistry } from '../inventory/items';

const SLOT = '44px';

function styleSlot(el: HTMLElement): void {
  Object.assign(el.style, {
    width: SLOT,
    height: SLOT,
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
}

/**
 * Inventory screen (toggle with E): a crafting grid (2x2, or 3x3 at a crafting
 * table) with an output slot, the 27 main slots, and the 9 hotbar slots. Items
 * move via the inventory cursor stack (click to pick up / drop / craft).
 */
export class InventoryScreen {
  private readonly root: HTMLDivElement;
  private readonly craftWrap: HTMLDivElement;
  private readonly craftGrid: HTMLDivElement;
  private readonly outputEl: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly craftEls: HTMLDivElement[] = [];
  private readonly cursorEl: HTMLDivElement;
  private builtCraftSize = 0;
  private open = false;

  constructor(private readonly inventory: Inventory) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      background: 'rgba(0,0,0,0.55)',
      zIndex: '30',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.dataset.testid = 'inventory-screen';

    // Crafting area: grid + arrow + output.
    this.craftWrap = document.createElement('div');
    Object.assign(this.craftWrap.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'rgba(40,40,40,0.95)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '12px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.craftGrid = document.createElement('div');
    this.craftGrid.style.display = 'grid';
    this.craftGrid.style.gap = '4px';
    const arrow = document.createElement('div');
    arrow.textContent = '→';
    arrow.style.color = '#fff';
    arrow.style.fontSize = '20px';
    this.outputEl = document.createElement('div');
    styleSlot(this.outputEl);
    this.outputEl.dataset.testid = 'craft-output';
    this.outputEl.style.borderColor = 'rgba(120,200,120,0.7)';
    this.outputEl.addEventListener('click', () => this.inventory.takeCraftOutput());
    this.craftWrap.append(this.craftGrid, arrow, this.outputEl);

    // Main + hotbar panel.
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'rgba(40,40,40,0.95)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '12px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.grid = document.createElement('div');
    this.grid.style.display = 'grid';
    this.grid.style.gridTemplateColumns = `repeat(${HOTBAR_SIZE}, ${SLOT})`;
    this.grid.style.gap = '4px';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) this.addSlot(i);
    const spacer = document.createElement('div');
    spacer.style.gridColumn = `1 / span ${HOTBAR_SIZE}`;
    spacer.style.height = '8px';
    this.grid.appendChild(spacer);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.addSlot(i);
    panel.appendChild(this.grid);

    this.root.append(this.craftWrap, panel);

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
    const trackCursor = (e: { clientX: number; clientY: number }) => {
      this.cursorEl.style.left = `${e.clientX + 10}px`;
      this.cursorEl.style.top = `${e.clientY + 10}px`;
    };
    this.root.addEventListener('mousemove', trackCursor);
    this.root.addEventListener('pointerdown', trackCursor); // touch taps
    this.root.addEventListener('pointermove', trackCursor);

    document.body.appendChild(this.root);
  }

  private addSlot(index: number): void {
    const el = document.createElement('div');
    styleSlot(el);
    el.dataset.slot = String(index);
    el.addEventListener('click', () => this.inventory.clickSlot(index));
    this.slotEls[index] = el;
    this.grid.appendChild(el);
  }

  private ensureCraftGrid(): void {
    const size = this.inventory.craftSize;
    if (size === this.builtCraftSize) return;
    this.builtCraftSize = size;
    this.craftGrid.innerHTML = '';
    this.craftEls.length = 0;
    this.craftGrid.style.gridTemplateColumns = `repeat(${size}, ${SLOT})`;
    for (let i = 0; i < size * size; i++) {
      const el = document.createElement('div');
      styleSlot(el);
      el.dataset.craft = String(i);
      el.addEventListener('click', () => this.inventory.clickCraft(i));
      this.craftEls.push(el);
      this.craftGrid.appendChild(el);
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Open with a given grid size (2 = inventory, 3 = crafting table). */
  toggle(size: 2 | 3 = 2): void {
    this.open = !this.open;
    if (this.open) this.inventory.setCraftSize(size);
    this.root.style.display = this.open ? 'flex' : 'none';
    if (!this.open) {
      this.inventory.clearCraft();
      if (this.inventory.cursor) {
        this.inventory.add(this.inventory.cursor.item, this.inventory.cursor.count);
        this.inventory.cursor = null;
      }
    }
    this.refresh();
  }

  private label(item: number, count: number): string {
    return `${ItemRegistry.name(item)}\n${count}`;
  }

  refresh(): void {
    this.ensureCraftGrid();
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const el = this.slotEls[i];
      if (!el) continue;
      const s = this.inventory.slots[i];
      el.textContent = s ? this.label(s.item, s.count) : '';
    }
    for (let i = 0; i < this.craftEls.length; i++) {
      const s = this.inventory.craftSlots[i];
      this.craftEls[i]!.textContent = s ? this.label(s.item, s.count) : '';
    }
    const out = this.inventory.getCraftOutput();
    this.outputEl.textContent = out ? this.label(out.item, out.count) : '';

    const c = this.inventory.cursor;
    this.cursorEl.style.display = c ? 'block' : 'none';
    if (c) this.cursorEl.textContent = this.label(c.item, c.count);
  }
}
