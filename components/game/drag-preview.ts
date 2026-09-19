/** The board target whose ring the dragged piece overlaps most; touching counts.
 *  A box the size of the piece is centred on the pointer and compared with every
 *  allowed target's ring area (its box grown by the ring's outset). */
export function dropTargetNear(x: number, y: number, size = 64): HTMLElement | null {
  const half = size / 2;
  let best: HTMLElement | null = null, bestArea = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-drop]')) {
    if (el.dataset.drop === 'hand' || el.dataset.dropAllowed === 'false') continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const gx = r.width * 0.08, gy = r.height * 0.05;
    const w = Math.min(x + half, r.right + gx) - Math.max(x - half, r.left - gx);
    const h = Math.min(y + half, r.bottom + gy) - Math.max(y - half, r.top - gy);
    if (w <= 0 || h <= 0) continue;
    const area = w * h;
    if (area > bestArea) { bestArea = area; best = el; }
  }
  return best;
}

/** Transient drag decoration; it never changes the game or the saved hand order. */
export function beginDragPreview(source: HTMLElement) {
  const hand = source.closest<HTMLElement>('[data-drop="hand"]');
  const cards = hand
    ? Array.from(hand.querySelectorAll<HTMLElement>(':scope > [data-card-id]'))
    : [];
  const from = cards.indexOf(source);
  const bounds = cards.map((el) => el.getBoundingClientRect());
  const stride = (i: number) =>
    bounds[i + 1]
      ? bounds[i + 1].left - bounds[i].left
      : i > 0
        ? bounds[i].left - bounds[i - 1].left
        : (bounds[i]?.width ?? 50);
  const startScroll = hand?.scrollLeft ?? 0;
  let before: number | null | undefined;
  let target: HTMLElement | null = null;
  function clearMarks() {
    for (const card of cards) {
      card.style.removeProperty('--reorder-shift');
      card.classList.remove('insertion-before');
    }
    hand?.classList.remove('insertion-at-end');
    target?.classList.remove('drag-target');
    target = null;
  }
  return {
    move(x: number, y: number) {
      clearMarks();
      before = undefined;
      const box = hand?.getBoundingClientRect();
      if (
        hand &&
        box &&
        x >= box.left &&
        x <= box.right &&
        y >= box.top &&
        y <= box.bottom
      ) {
        const scroll = hand.scrollLeft - startScroll;
        const insertion = cards.findIndex(
          (_, i) =>
            i !== from &&
            x <
              bounds[i].left -
                scroll +
                Math.min(bounds[i].width, stride(i)) / 2,
        );
        const destination = insertion < 0 ? cards.length : insertion;
        before = insertion < 0 ? null : Number(cards[insertion].dataset.cardId);
        const space = stride(from);
        cards.forEach((card, i) => {
          const shift =
            i >= destination && i < from
              ? space
              : i > from && i < destination
                ? -space
                : 0;
          card.style.setProperty('--reorder-shift', `${shift}px`);
        });
        if (insertion < 0) hand.classList.add('insertion-at-end');
        else cards[insertion].classList.add('insertion-before');
      } else {
        target = dropTargetNear(x, y, Math.max(bounds[from]?.width ?? 0, source.getBoundingClientRect().width, 48));
        target?.classList.add('drag-target');
      }
    },
    get before() {
      return before;
    },
    clear: clearMarks,
  };
}
