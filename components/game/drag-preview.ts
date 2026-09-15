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
        target =
          document
            .elementsFromPoint(x, y)
            .map((el) => el.closest<HTMLElement>('[data-drop]'))
            .find((el) => el && el.dataset.drop !== 'hand' && el.dataset.dropAllowed !== 'false') ?? null;
        target?.classList.add('drag-target');
      }
    },
    get before() {
      return before;
    },
    clear: clearMarks,
  };
}
