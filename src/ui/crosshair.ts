/** Fixed crosshair overlay at screen centre. */
export function installCrosshair(): void {
  const el = document.createElement('div');
  el.id = 'crosshair';
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    top: '50%',
    width: '20px',
    height: '20px',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: '10',
  } satisfies Partial<CSSStyleDeclaration>);
  el.innerHTML = `
    <div style="position:absolute;left:9px;top:2px;width:2px;height:16px;background:rgba(255,255,255,0.85);"></div>
    <div style="position:absolute;left:2px;top:9px;width:16px;height:2px;background:rgba(255,255,255,0.85);"></div>
  `;
  document.body.appendChild(el);
}
