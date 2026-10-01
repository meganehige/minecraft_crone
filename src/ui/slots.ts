import { ATLAS_COLS, ATLAS_ROWS } from '../render/atlas';
import { getMaterials } from '../render/materials';
import { ItemRegistry } from '../inventory/items';
import type { ItemStack } from '../inventory/Inventory';

let atlasUrl: string | null = null;
function url(): string {
  if (!atlasUrl) atlasUrl = getMaterials().atlasCanvas.toDataURL();
  return atlasUrl;
}

/** Show an item's atlas tile as a background image on an element (or clear it). */
export function styleIcon(el: HTMLElement, itemId: number | null): void {
  if (itemId === null) {
    el.style.backgroundImage = 'none';
    return;
  }
  const tile = ItemRegistry.tile(itemId);
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  el.style.backgroundImage = `url(${url()})`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.imageRendering = 'pixelated';
  // Each tile scaled to fill the element; percentage sprite-sheet positioning.
  el.style.backgroundSize = `${ATLAS_COLS * 100}% ${ATLAS_ROWS * 100}%`;
  el.style.backgroundPosition = `${(col / (ATLAS_COLS - 1)) * 100}% ${
    (row / (ATLAS_ROWS - 1)) * 100
  }%`;
}

/** Base styling for an inventory/craft slot. */
export function styleSlot(el: HTMLElement, px = 44): void {
  Object.assign(el.style, {
    position: 'relative',
    width: `${px}px`,
    height: `${px}px`,
    boxSizing: 'border-box',
    display: 'block',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#fff',
    textAlign: 'right',
    textShadow: '0 1px 2px #000, 0 0 2px #000',
    lineHeight: `${px - 4}px`,
    paddingRight: '3px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
}

/** Render a stack into a slot: icon background + count (and a durability bar). */
export function renderSlot(el: HTMLElement, stack: ItemStack | null): void {
  styleIcon(el, stack ? stack.item : null);
  el.textContent = stack && stack.count > 1 ? String(stack.count) : '';

  // Durability bar for damaged tools.
  let bar = el.querySelector<HTMLDivElement>('.dura');
  const tool = stack ? ItemRegistry.tool(stack.item) : undefined;
  if (stack && tool && stack.durability !== undefined) {
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'dura';
      Object.assign(bar.style, {
        position: 'absolute',
        left: '3px',
        right: '3px',
        bottom: '3px',
        height: '3px',
        background: 'rgba(0,0,0,0.6)',
      } satisfies Partial<CSSStyleDeclaration>);
      const fill = document.createElement('div');
      fill.style.height = '100%';
      bar.appendChild(fill);
      el.appendChild(bar);
    }
    const frac = stack.durability / tool.maxDurability;
    const fill = bar.firstChild as HTMLDivElement;
    fill.style.width = `${Math.round(frac * 100)}%`;
    fill.style.background = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffc107' : '#f44336';
    bar.style.display = 'block';
  } else if (bar) {
    bar.style.display = 'none';
  }
}

/** The item under the pointer, resolved to a slot descriptor (for drag-move). */
export interface SlotRef {
  kind: 'inv' | 'craft' | 'output';
  index: number;
}

export function resolveSlot(target: EventTarget | null): SlotRef | null {
  let el = target as HTMLElement | null;
  while (el) {
    if (el.dataset?.slot !== undefined) {
      return { kind: 'inv', index: Number(el.dataset.slot) };
    }
    if (el.dataset?.craft !== undefined) {
      return { kind: 'craft', index: Number(el.dataset.craft) };
    }
    if (el.dataset?.testid === 'craft-output') return { kind: 'output', index: 0 };
    el = el.parentElement;
  }
  return null;
}
