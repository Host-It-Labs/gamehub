'use client';
import { useEffect, useState } from 'react';
import type { MachineKind } from '@/lib/games/relic/factory';

let ready: Record<MachineKind, string> | null = null;
/** The machines' palette pictures, rendered from their 3D models on first
 * use (three.js loads only then). Null until they are drawn. */
export function useMachineIcons() {
  const [icons, setIcons] = useState(ready);
  useEffect(() => {
    if (icons) return;
    let live = true;
    void import('./icons')
      .then((m) => m.machineIcons())
      .then((made) => {
        ready = made;
        if (live) setIcons(made);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [icons]);
  return icons;
}
