import { formatNumber } from '../../../lib/games/relic/engine.ts';

/**
 * Sales above the floor, in the page: the amount pops up over the till and
 * drifts away. Sales close together on one till share a label, so a busy
 * floor stays calm and cheap.
 */
export class SaleFx {
  private labels = new Map<
    string,
    { el: HTMLElement; value: number; at: number; anim?: Animation }
  >();

  private layer: HTMLElement;
  private reduced: boolean;
  constructor(layer: HTMLElement, reduced: boolean) {
    this.layer = layer;
    this.reduced = reduced;
  }

  sale(key: string, x: number, y: number, value: number) {
    const box = this.layer.getBoundingClientRect();
    const lx = x - box.left,
      ly = y - box.top;
    // Zoom can put tills outside the canvas. Their sales still count, but
    // page overlays must not escape the scene or create a page scrollbar.
    if (lx < 0 || ly < 0 || lx > box.width || ly > box.height) return;
    this.label(key, lx, ly, value, performance.now());
  }

  private label(key: string, x: number, y: number, value: number, now: number) {
    const open = this.labels.get(key);
    if (open && now - open.at < 700) {
      open.value += value;
      open.el.textContent = `+${formatNumber(open.value)}`;
      return;
    }
    const el = this.layer.ownerDocument.createElement('b');
    el.className = 'rs-sale-label';
    el.textContent = `+${formatNumber(value)}`;
    this.layer.append(el);
    const entry = { el, value, at: now } as {
      el: HTMLElement;
      value: number;
      at: number;
      anim?: Animation;
    };
    this.labels.set(key, entry);
    const anim = el.animate(
      this.reduced
        ? [
            {
              transform: `translate(${x}px, ${y - 30}px) translate(-50%, -50%)`,
              opacity: 0,
            },
            {
              transform: `translate(${x}px, ${y - 30}px) translate(-50%, -50%)`,
              opacity: 1,
              offset: 0.2,
            },
            {
              transform: `translate(${x}px, ${y - 30}px) translate(-50%, -50%)`,
              opacity: 0,
            },
          ]
        : [
            {
              transform: `translate(${x}px, ${y - 10}px) translate(-50%, -50%) scale(0.7)`,
              opacity: 0,
            },
            {
              transform: `translate(${x}px, ${y - 26}px) translate(-50%, -50%) scale(1.08)`,
              opacity: 1,
              offset: 0.18,
            },
            {
              transform: `translate(${x}px, ${y - 40}px) translate(-50%, -50%) scale(1)`,
              opacity: 1,
              offset: 0.7,
            },
            {
              transform: `translate(${x}px, ${y - 48}px) translate(-50%, -50%) scale(0.95)`,
              opacity: 0,
            },
          ],
      { duration: 1300, easing: 'ease-out' },
    );
    entry.anim = anim;
    anim.onfinish = anim.oncancel = () => {
      el.remove();
      if (this.labels.get(key) === entry) this.labels.delete(key);
    };
  }

  /** Clear old screen anchors when the camera moves or the world closes. */
  clear() {
    for (const l of this.labels.values()) l.anim?.cancel();
    this.labels.clear();
    this.layer.replaceChildren();
  }

  dispose() {
    this.clear();
  }
}
