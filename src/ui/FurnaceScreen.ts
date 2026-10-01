import { HOTBAR_SIZE, TOTAL_SLOTS, type Inventory, type ItemStack } from '../inventory/Inventory';
import { COOK_TICKS, type FurnaceState } from '../crafting/Furnace';
import { renderSlot, styleSlot } from './slots';

const SLOT = '44px';

/**
 * Furnace screen: input / fuel / output slots with a smelt-progress bar, plus
 * the player inventory below for moving items. Bound to a FurnaceState; items
 * move via the shared inventory cursor.
 */
export class FurnaceScreen {
  private readonly root: HTMLDivElement;
  private readonly inputEl: HTMLDivElement;
  private readonly fuelEl: HTMLDivElement;
  private readonly outputEl: HTMLDivElement;
  private readonly progressEl: HTMLDivElement;
  private readonly invGrid: HTMLDivElement;
  private readonly slotEls: HTMLDivElement[] = [];
  private readonly cursorEl: HTMLDivElement;
  private state: FurnaceState | null = null;

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
    this.root.dataset.testid = 'furnace-screen';

    const top = document.createElement('div');
    Object.assign(top.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: 'rgba(40,40,40,0.95)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '12px',
    } satisfies Partial<CSSStyleDeclaration>);

    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '14px';
    this.inputEl = this.makeSlot('furnace-input', () => this.clickInput());
    this.fuelEl = this.makeSlot('furnace-fuel', () => this.clickFuel());
    col.append(this.inputEl, this.fuelEl);

    this.progressEl = document.createElement('div');
    Object.assign(this.progressEl.style, {
      width: '40px',
      height: '6px',
      background: 'rgba(255,255,255,0.2)',
    } satisfies Partial<CSSStyleDeclaration>);
    const bar = document.createElement('div');
    bar.style.height = '100%';
    bar.style.width = '0%';
    bar.style.background = '#e0a030';
    this.progressEl.appendChild(bar);

    this.outputEl = this.makeSlot('furnace-output', () => this.clickOutput());
    this.outputEl.style.borderColor = 'rgba(120,200,120,0.7)';

    top.append(col, this.progressEl, this.outputEl);

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'rgba(40,40,40,0.95)',
      border: '2px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '12px',
    } satisfies Partial<CSSStyleDeclaration>);
    this.invGrid = document.createElement('div');
    this.invGrid.style.display = 'grid';
    this.invGrid.style.gridTemplateColumns = `repeat(${HOTBAR_SIZE}, ${SLOT})`;
    this.invGrid.style.gap = '4px';
    for (let i = HOTBAR_SIZE; i < TOTAL_SLOTS; i++) this.addInvSlot(i);
    const spacer = document.createElement('div');
    spacer.style.gridColumn = `1 / span ${HOTBAR_SIZE}`;
    spacer.style.height = '8px';
    this.invGrid.appendChild(spacer);
    for (let i = 0; i < HOTBAR_SIZE; i++) this.addInvSlot(i);
    panel.appendChild(this.invGrid);

    this.root.append(top, panel);

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
    this.root.addEventListener('pointerdown', trackCursor);
    this.root.addEventListener('pointermove', trackCursor);

    document.body.appendChild(this.root);
  }

  private makeSlot(testid: string, onClick: () => void): HTMLDivElement {
    const el = document.createElement('div');
    styleSlot(el);
    el.dataset.testid = testid;
    el.addEventListener('click', onClick);
    return el;
  }

  private addInvSlot(index: number): void {
    const el = document.createElement('div');
    styleSlot(el);
    el.addEventListener('click', () => this.inventory.clickSlot(index));
    this.slotEls[index] = el;
    this.invGrid.appendChild(el);
  }

  isOpen(): boolean {
    return this.state !== null;
  }

  open(state: FurnaceState): void {
    this.state = state;
    this.root.style.display = 'flex';
    this.refresh();
  }

  close(): void {
    this.state = null;
    this.root.style.display = 'none';
    if (this.inventory.cursor) {
      this.inventory.add(this.inventory.cursor.item, this.inventory.cursor.count);
      this.inventory.cursor = null;
    }
  }

  // Standard pick/drop/swap of a single slot against the cursor.
  private clickStack(get: () => ItemStack | null, set: (s: ItemStack | null) => void): void {
    const slot = get();
    const cur = this.inventory.cursor;
    if (cur === null) {
      if (slot) {
        this.inventory.cursor = slot;
        set(null);
      }
    } else if (!slot) {
      set(cur);
      this.inventory.cursor = null;
    } else if (slot.item === cur.item) {
      slot.count += cur.count;
      this.inventory.cursor = null;
    } else {
      set(cur);
      this.inventory.cursor = slot;
    }
    this.refreshAll();
  }

  private clickInput(): void {
    if (!this.state) return;
    const s = this.state;
    this.clickStack(() => s.input, (v) => (s.input = v));
  }
  private clickFuel(): void {
    if (!this.state) return;
    const s = this.state;
    this.clickStack(() => s.fuel, (v) => (s.fuel = v));
  }
  private clickOutput(): void {
    const s = this.state;
    if (!s || !s.output) return;
    const out = s.output;
    const cur = this.inventory.cursor;
    if (cur === null) {
      this.inventory.cursor = out;
      s.output = null;
    } else if (cur.item === out.item) {
      cur.count += out.count;
      s.output = null;
    }
    this.refreshAll();
  }

  private refreshAll(): void {
    this.refresh();
  }

  refresh(): void {
    if (this.state) {
      renderSlot(this.inputEl, this.state.input);
      renderSlot(this.fuelEl, this.state.fuel);
      renderSlot(this.outputEl, this.state.output);
      const bar = this.progressEl.firstChild as HTMLDivElement;
      bar.style.width = `${Math.round((this.state.cook / COOK_TICKS) * 100)}%`;
    }
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const el = this.slotEls[i];
      if (el) renderSlot(el, this.inventory.slots[i]);
    }
    const c = this.inventory.cursor;
    this.cursorEl.style.display = c ? 'block' : 'none';
    if (c) renderSlot(this.cursorEl, c);
  }
}
