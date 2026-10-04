import { formatNumber } from '../../../lib/games/relic/engine.ts';

/**
 * Sales above the floor, in the page: a gold coin arcs from the till to the
 * purse, which gives a little bump as it lands, and the amount rises over
 * the till. Sales close together on one till share a label, and only a few
 * coins fly at once, so a busy floor stays calm and cheap.
 */
export class SaleFx {
  private coins = new Set<Animation>();
  private labels = new Map<
    string,
    { el: HTMLElement; value: number; at: number; anim?: Animation }
  >();
  private lastCoin = new Map<string, number>();

  private layer: HTMLElement;
  private reduced: boolean;
  constructor(layer: HTMLElement, reduced: boolean) {
    this.layer = layer;
    this.reduced = reduced;
  }

  private purse() {
    return this.layer.ownerDocument.querySelector<HTMLElement>('.rs-wallet');
  }

  sale(key: string, x: number, y: number, value: number) {
    const box = this.layer.getBoundingClientRect(),
      now = performance.now();
    const lx = x - box.left,
      ly = y - box.top;
    // Zoom can put tills outside the canvas. Their sales still count, but
    // page overlays must not escape the scene or create a page scrollbar.
    if (lx < 0 || ly < 0 || lx > box.width || ly > box.height) return;
    this.label(key, lx, ly, value, now);
    if (this.reduced) return;
    if (now - (this.lastCoin.get(key) ?? 0) < 380 || this.coins.size >= 8)
      return;
    this.lastCoin.set(key, now);
    const purse = this.purse();
    if (!purse) return;
    const target = purse.getBoundingClientRect();
    const tx = target.left + Math.min(28, target.width / 2) - box.left,
      ty = target.top + target.height / 2 - box.top;
    const coin = this.layer.ownerDocument.createElement('i');
    coin.className = 'rs-fly-coin';
    this.layer.append(coin);
    // A lifted arc: up and out first, then into the purse.
    const mx = lx + (tx - lx) * 0.35 + (Math.random() - 0.5) * 40,
      my = Math.min(ly, ty) - 60 - Math.random() * 40;
    const anim = coin.animate(
      [
        { transform: `translate(${lx}px, ${ly}px) scale(0.6)`, opacity: 0 },
        {
          transform: `translate(${lx}px, ${ly - 26}px) scale(1.1)`,
          opacity: 1,
          offset: 0.12,
        },
        {
          transform: `translate(${mx}px, ${my}px) scale(1)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${tx}px, ${ty}px) scale(0.7)`, opacity: 0.9 },
      ],
      {
        duration: 900 + Math.random() * 200,
        easing: 'cubic-bezier(.45,.05,.6,1)',
      },
    );
    this.coins.add(anim);
    const remove = () => {
      coin.remove();
      this.coins.delete(anim);
    };
    anim.oncancel = remove;
    anim.onfinish = () => {
      remove();
      purse.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.06)' },
          { transform: 'scale(1)' },
        ],
        { duration: 220, easing: 'ease-out' },
      );
    };
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
    for (const coin of this.coins) coin.cancel();
    this.coins.clear();
    for (const l of this.labels.values()) l.anim?.cancel();
    this.labels.clear();
    this.layer.replaceChildren();
  }

  dispose() {
    this.clear();
  }
}
