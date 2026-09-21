'use client';
import { useEffect, useRef } from 'react';

let boardGuardSequence = 0;

/** Keep a same-URL history entry above the board so device Back asks first. */
export function useBoardLeave(active: boolean, requestLeave: () => void) {
  const request = useRef(requestLeave);
  const allowed = useRef(false);
  useEffect(() => {
    request.current = requestLeave;
  }, [requestLeave]);
  useEffect(() => {
    if (!active) return;
    allowed.current = false;
    // A history marker is not a security token; work on LAN HTTP too.
    const marker = `board-${Date.now()}-${++boardGuardSequence}`;
    if (history.state?.boardGuard)
      history.replaceState(
        { ...history.state, boardGuard: marker },
        '',
        location.href,
      );
    else
      history.pushState(
        { ...history.state, boardGuard: marker },
        '',
        location.href,
      );
    function back() {
      if (allowed.current) return;
      history.pushState(
        { ...history.state, boardGuard: marker },
        '',
        location.href,
      );
      request.current();
    }
    function unload(event: BeforeUnloadEvent) {
      if (allowed.current) return;
      event.preventDefault();
      // Legacy browsers need returnValue in addition to preventDefault.
      // eslint-disable-next-line typescript/no-deprecated
      event.returnValue = '';
    }
    function link(event: MouseEvent) {
      const anchor = (event.target as Element)?.closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.href === location.href
      )
        return;
      if (
        !window.confirm(
          'Leave the board? Other players may still be waiting for you.',
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      } else allowed.current = true;
    }
    window.addEventListener('popstate', back);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', link, true);
    return () => {
      window.removeEventListener('popstate', back);
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', link, true);
      if (history.state?.boardGuard === marker) {
        const state = { ...history.state, boardGuard: 'inactive' };
        history.replaceState(state, '', location.href);
      }
    };
  }, [active]);
  return () => {
    allowed.current = true;
  };
}
