/**
 * Svelte action: press feedback for cards.
 * Immediate scale-down on pointerdown, spring-back on release.
 */

export interface PressConfig {
  scale: number;       // scale on press (default 0.97)
  brightness: number;  // brightness filter on press (default 0.98)
  duration: number;    // spring-back duration ms (default 250)
}

const DEFAULT: PressConfig = { scale: 0.97, brightness: 0.98, duration: 250 };

export function pressAction(node: HTMLElement, config: Partial<PressConfig> = {}) {
  const cfg = { ...DEFAULT, ...config };
  let pressed = false;

  function onDown(e: PointerEvent) {
    if ((e.target as HTMLElement)?.closest('button, a')) return;
    pressed = true;
    // Immediate — 1 frame, no transition
    node.style.transition = 'none';
    node.style.transform = `scale(${cfg.scale})`;
    node.style.filter = `brightness(${cfg.brightness})`;
    // Restore transition after 1 frame
    requestAnimationFrame(() => {
      node.style.transition = `transform ${cfg.duration}ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)), filter ${cfg.duration}ms var(--ease-out-cubic, ease-out)`;
    });
  }

  function onUp() {
    if (!pressed) return;
    pressed = false;
    node.style.transform = '';
    node.style.filter = '';
  }

  function onCancel() {
    onUp();
  }

  function onLeave() {
    onUp();
  }

  node.addEventListener('pointerdown', onDown);
  node.addEventListener('pointerup', onUp);
  node.addEventListener('pointercancel', onCancel);
  node.addEventListener('pointerleave', onLeave);

  return {
    destroy() {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointerup', onUp);
      node.removeEventListener('pointercancel', onCancel);
      node.removeEventListener('pointerleave', onLeave);
    },
  };
}
