'use client';
import type { MachineKind } from '@/lib/games/relic/factory';
import { useMachineIcons } from './use-icons';

/** A machine's picture, rendered from its 3D model (blank until drawn). */
export function MachineIcon({
  kind,
  className,
}: {
  kind: MachineKind;
  className?: string;
}) {
  const icons = useMachineIcons();
  return icons?.[kind] ? (
    <img src={icons[kind]} alt="" draggable={false} className={className} />
  ) : (
    <span className={`rs-icon-wait ${className ?? ''}`} aria-hidden="true" />
  );
}
