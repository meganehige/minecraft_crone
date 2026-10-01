import { HOTBAR_SIZE, TOTAL_SLOTS, type Inventory } from '../inventory/Inventory';
import { renderSlot, styleSlot, resolveSlot, type SlotRef } from './slots';

const SLOT = 44;

/**
 * Inventory screen (toggle with E / the touch button): a crafting grid (2x2, or
 * 3x3 at a crafting table) with an output slot, the 27 main slots and the 9
 * hotbar slots. Items show as icons with a count; they move via tap-to-pick /
 * tap-to-place or by dragging from one slot to another (mouse or touch).
 */
export class InventoryScreen {
  private readonly root: HTMLDivElement;
  private readonly craftGrid: HTMLDivElement;
  private readonly outputEl: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly craftEls: HTMLDivElement[] = [];
  private readonly cursorEl: HTMLDivElement;
  private builtCraftSize = 0;
  private open = false;
  private downRef: SlotRef | null = null;

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
      touchAction: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.dataset.testid = 'inventory-screen';

    const craftWrap = document.createElement('div');
    Object.assign(craftWrap.style, {
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
    this.outputEl.style.borderColor = 'rgba(120,200,120,0.8)';
    craftWrap.append(this.craftGrid, arrow, this.outputEl);

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'rgba(40,40,40,0.95)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '12px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.grid = document.createElement('div');
    this.grid.style.display = 'grid';
    this.grid.style.gridTemplateColumns = `repeat(${HOTBAR_SIZE}, ${SLOT}px)`;
    this.grid.style.gap = '4px';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) this.addSlot(i);
    const spacer = document.createElement('div');
    spacer.style.gridColumn = `1 / span ${HOTBAR_SIZE}`;
    spacer.style.height = '8px';
    this.grid.appendChild(spacer);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.addSlot(i);
    panel.appendChild(this.grid);

    this.root.append(craftWrap, panel);

    this.cursorEl = document.createElement('div');
    styleSlot(this.cursorEl, 40);
    Object.assign(this.cursorEl.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: 'none',
      background: 'none',
      display: 'none',
      zIndex: '40',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.appendChild(this.cursorEl);

    // Tap-to-move + drag-to-move via pointer events.
    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    this.root.addEventListener('pointermove', (e) => this.moveCursor(e));

    document.body.appendChild(this.root);
  }

  private addSlot(index: number): void {
    const el = document.createElement('div');
    styleSlot(el);
    el.dataset.slot = String(index);
    this.slotEls[index] = el;
    this.grid.appendChild(el);
  }

  private ensureCraftGrid(): void {
    const size = this.inventory.craftSize;
    if (size === this.builtCraftSize) return;
    this.builtCraftSize = size;
    this.craftGrid.innerHTML = '';
    this.craftEls.length = 0;
    this.craftGrid.style.gridTemplateColumns = `repeat(${size}, ${SLOT}px)`;
    for (let i = 0; i < size * size; i++) {
      const el = document.createElement('div');
      styleSlot(el);
      el.dataset.craft = String(i);
      this.craftEls.push(el);
      this.craftGrid.appendChild(el);
    }
  }

  private actDown(ref: SlotRef): void {
    if (ref.kind === 'inv') this.inventory.clickSlot(ref.index);
    else if (ref.kind === 'craft') this.inventory.clickCraft(ref.index);
    else this.inventory.takeCraftOutput();
  }

  private onDown(e: PointerEvent): void {
    this.moveCursor(e);
    const ref = resolveSlot(e.target);
    this.downRef = ref;
    if (ref) this.actDown(ref);
  }

  private onUp(e: PointerEvent): void {
    if (!this.open || !this.downRef) {
      this.downRef = null;
      return;
    }
    const upEl = document.elementFromPoint(e.clientX, e.clientY);
    const up = resolveSlot(upEl);
    const down = this.downRef;
    this.downRef = null;
    // A drag onto a *different* slot while holding -> place there.
    if (up && this.inventory.cursor && (up.kind !== down.kind || up.index !== down.index)) {
      if (up.kind === 'inv') this.inventory.clickSlot(up.index);
      else if (up.kind === 'craft') this.inventory.clickCraft(up.index);
      // output slots never receive items
    }
  }

  private moveCursor(e: { clientX: number; clientY: number }): void {
    this.cursorEl.style.left = `${e.clientX - 20}px`;
    this.cursorEl.style.top = `${e.clientY - 20}px`;
  }

  isOpen(): boolean {
    return this.open;
  }

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

  refresh(): void {
    this.ensureCraftGrid();
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (this.slotEls[i]) renderSlot(this.slotEls[i]!, this.inventory.slots[i]);
    }
    for (let i = 0; i < this.craftEls.length; i++) {
      renderSlot(this.craftEls[i]!, this.inventory.craftSlots[i] ?? null);
    }
    const out = this.inventory.getCraftOutput();
    renderSlot(this.outputEl, out);

    const c = this.inventory.cursor;
    this.cursorEl.style.display = c ? 'block' : 'none';
    if (c) renderSlot(this.cursorEl, c);
  }
}
