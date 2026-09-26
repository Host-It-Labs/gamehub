/** Short, opt-in motion without replacing game DOM or changing authored transforms. */
const selector = '[data-game-motion]';
const timing = { duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)' };

export function createGameMotionController(root: HTMLElement) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakMap<HTMLElement, string>();
  const running = new Map<HTMLElement, Animation>();
  let phase: string | number | undefined;
  let disposed = false;

  function cancel() {
    for (const animation of running.values()) animation.cancel();
    running.clear();
  }

  function animate(element: HTMLElement, changed: boolean, delay = 0) {
    if (disposed || preference.matches || document.hidden || !element.animate) return;
    const kind = element.dataset.gameMotion;
    running.get(element)?.cancel();
    const style = getComputedStyle(element);
    // A stage fades in place: moving a board would move its drop targets and canvas.
    const opacity = Number.isFinite(Number(style.opacity)) ? Number(style.opacity) : 1;
    const frames: Keyframe[] = kind === 'stage'
      ? [{ opacity: opacity * .78 }, { opacity }]
      : kind === 'change' || changed
        ? [{ opacity: opacity * .55 }, { opacity }]
        : [{ opacity: 0, translate: '0 5px' }, { opacity, translate: style.translate }];
    const animation = element.animate(frames, {
      ...timing,
      duration: kind === 'result' ? 320 : timing.duration,
      delay,
      fill: 'backwards',
    });
    running.set(element, animation);
    void animation.finished.then(() => {
      if (running.get(element) === animation) running.delete(element);
    }, () => {
      if (running.get(element) === animation) running.delete(element);
    });
  }

  function visit(elements: Iterable<HTMLElement>) {
    let entrance = 0;
    for (const element of elements) {
      if (!root.contains(element)) continue;
      if (!element.matches(selector)) {
        seen.delete(element);
        running.get(element)?.cancel();
        running.delete(element);
        continue;
      }
      const key = `${element.dataset.gameMotion}:${element.dataset.gameMotionKey ?? ''}`;
      const previous = seen.get(element);
      if (previous === key) continue;
      seen.set(element, key);
      animate(element, previous !== undefined, previous === undefined ? Math.min(entrance++ * 18, 126) : 0);
    }
  }

  function elementsWithin(element: HTMLElement) {
    return [
      ...(element.matches(selector) ? [element] : []),
      ...element.querySelectorAll<HTMLElement>(selector),
    ];
  }

  const observer = new MutationObserver((records) => {
    const changed = new Set<HTMLElement>();
    for (const record of records) {
      if (record.type === 'attributes') changed.add(record.target as HTMLElement);
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement)
          for (const element of elementsWithin(node)) changed.add(element);
      }
    }
    visit(changed);
    for (const [element, animation] of running) {
      if (!root.contains(element)) {
        animation.cancel();
        running.delete(element);
      }
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-game-motion-key', 'data-game-motion'],
  });
  const reduce = () => { if (preference.matches) cancel(); };
  preference.addEventListener('change', reduce);
  root.setAttribute('data-game-motion-root', '');

  return {
    update(nextPhase: string | number) {
      const elements = elementsWithin(root);
      // Only existing stages refresh. Newly mounted content gets its entrance once.
      if (phase !== undefined && phase !== nextPhase) {
        for (const element of elements) {
          if (element.dataset.gameMotion === 'stage' && seen.has(element)) animate(element, true);
        }
      }
      phase = nextPhase;
      visit(elements);
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      preference.removeEventListener('change', reduce);
      root.removeAttribute('data-game-motion-root');
      cancel();
    },
  };
}
