import type { Player } from './Player';
import type { InputState } from './Controls';

const LOOK_SENSITIVITY = 0.006;
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const JOY_DEADZONE = 14;
const JOY_RADIUS = 48;

export interface TouchHooks {
  input: InputState;
  player: Player;
  /** Begin holding the break (mine) button. */
  onBreakStart: () => void;
  /** Release the break (mine) button. */
  onBreakStop: () => void;
  onPlace: () => void;
  /** Open/close the personal inventory (2x2 crafting). */
  onToggleInventory: () => void;
}

/** Should the on-screen touch UI be shown for this device? */
export function isTouchDevice(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('touch') === '1') return true;
  if (params.get('touch') === '0') return false;
  return (
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * On-screen controls for touch devices: a floating joystick (left) for
 * movement, drag-to-look (right), and break/place/jump buttons. Writes into the
 * same InputState / player orientation that the keyboard+mouse controls use, so
 * the rest of the game is unchanged.
 */
export class TouchControls {
  private readonly root: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  private joyId: number | null = null;
  private joyX = 0;
  private joyY = 0;
  private lookId: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private jumpTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly hooks: TouchHooks) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '20',
      touchAction: 'none',
      userSelect: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    this.root.dataset.testid = 'touch-ui';

    // Floating joystick knob (hidden until touched).
    this.knob = document.createElement('div');
    Object.assign(this.knob.style, {
      position: 'fixed',
      width: '56px',
      height: '56px',
      marginLeft: '-28px',
      marginTop: '-28px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.35)',
      border: '2px solid rgba(255,255,255,0.6)',
      pointerEvents: 'none',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    this.knob.dataset.testid = 'touch-joystick';
    this.root.appendChild(this.knob);

    this.root.appendChild(
      this.makeHoldButton(
        'btn-break',
        '⛏',
        '88px',
        () => this.hooks.onBreakStart(),
        () => this.hooks.onBreakStop(),
      ),
    );
    this.root.appendChild(this.makeButton('btn-place', '⬛', '20px', () => this.hooks.onPlace()));
    this.root.appendChild(this.makeJumpButton());
    this.root.appendChild(this.makeInventoryButton());

    document.body.appendChild(this.root);

    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  private makeButton(
    id: string,
    label: string,
    rightOffset: string,
    action: () => void,
  ): HTMLDivElement {
    const b = document.createElement('div');
    b.textContent = label;
    b.dataset.testid = id;
    Object.assign(b.style, {
      position: 'fixed',
      right: rightOffset,
      bottom: '96px',
      width: '60px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.4)',
      border: '2px solid rgba(255,255,255,0.5)',
      color: '#fff',
      touchAction: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      action();
    });
    return b;
  }

  /** A button that fires onDown while pressed and onUp on release. */
  private makeHoldButton(
    id: string,
    label: string,
    rightOffset: string,
    onDown: () => void,
    onUp: () => void,
  ): HTMLDivElement {
    const b = this.makeButton(id, label, rightOffset, () => {});
    // Replace the tap handler set by makeButton with press/release semantics.
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onDown();
    });
    b.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      onUp();
    });
    b.addEventListener('pointerleave', () => onUp());
    b.addEventListener('pointercancel', () => onUp());
    return b;
  }

  private makeJumpButton(): HTMLDivElement {
    const b = document.createElement('div');
    b.textContent = '⤒';
    b.dataset.testid = 'btn-jump';
    Object.assign(b.style, {
      position: 'fixed',
      right: '88px',
      bottom: '168px',
      width: '60px',
      height: '60px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.4)',
      border: '2px solid rgba(255,255,255,0.5)',
      color: '#fff',
      touchAction: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.hooks.input.jump = true;
      if (this.jumpTimer) clearTimeout(this.jumpTimer);
      // Hold long enough that at least one 50ms sim tick observes it.
      this.jumpTimer = setTimeout(() => {
        this.hooks.input.jump = false;
      }, 140);
    });
    return b;
  }

  private makeInventoryButton(): HTMLDivElement {
    const b = document.createElement('div');
    b.textContent = '🎒';
    b.dataset.testid = 'btn-inventory';
    Object.assign(b.style, {
      position: 'fixed',
      right: '16px',
      top: '16px',
      width: '54px',
      height: '54px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.4)',
      border: '2px solid rgba(255,255,255,0.5)',
      color: '#fff',
      touchAction: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.hooks.onToggleInventory();
    });
    return b;
  }

  private onDown(e: PointerEvent): void {
    // Left ~45% of the screen drives the joystick; the rest looks around.
    if (e.clientX < window.innerWidth * 0.45) {
      if (this.joyId !== null) return;
      this.joyId = e.pointerId;
      this.joyX = e.clientX;
      this.joyY = e.clientY;
      this.knob.style.left = `${e.clientX}px`;
      this.knob.style.top = `${e.clientY}px`;
      this.knob.style.display = 'block';
    } else {
      if (this.lookId !== null) return;
      this.lookId = e.pointerId;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    }
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId === this.joyId) {
      const dx = e.clientX - this.joyX;
      const dy = e.clientY - this.joyY;
      this.setMove(dx, dy);
    } else if (e.pointerId === this.lookId) {
      const dx = e.clientX - this.lookX;
      const dy = e.clientY - this.lookY;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      const p = this.hooks.player;
      p.yaw -= dx * LOOK_SENSITIVITY;
      p.pitch -= dy * LOOK_SENSITIVITY;
      p.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.pitch));
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.knob.style.display = 'none';
      this.setMove(0, 0);
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }

  private setMove(dx: number, dy: number): void {
    const input = this.hooks.input;
    const len = Math.hypot(dx, dy);
    if (len < JOY_DEADZONE) {
      input.forward = input.back = input.left = input.right = false;
      return;
    }
    const clamped = Math.min(len, JOY_RADIUS);
    const kx = (dx / len) * clamped;
    const ky = (dy / len) * clamped;
    this.knob.style.left = `${this.joyX + kx}px`;
    this.knob.style.top = `${this.joyY + ky}px`;
    input.forward = dy < -JOY_DEADZONE;
    input.back = dy > JOY_DEADZONE;
    input.left = dx < -JOY_DEADZONE;
    input.right = dx > JOY_DEADZONE;
  }
}
