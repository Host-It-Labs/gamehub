'use client';
import { Shield, Store } from 'lucide-react';
import { AbilityRules } from './extension-rules';
import { Piece, type Inspect } from './interactions';

/** Fixed-size ability token; inspection remains available when spent or locked. */
export function ExtensionAction({
  kind,
  label,
  selected,
  count,
  disabled,
  onTap,
  inspect,
}: {
  kind: 'shield' | 'stall';
  label: string;
  description: string;
  selected: boolean;
  count: number;
  disabled: boolean;
  onTap: () => void;
  inspect: Inspect;
}) {
  const Icon = kind === 'shield' ? Shield : Store;
  return (
    <Piece
      className={`extension-action extension-action-${kind} ${disabled ? 'unavailable' : ''} ${count === 0 ? 'spent' : ''}`}
      label={`${label} · ${count} remaining${selected ? ' · selected' : ''}${disabled ? ' · unavailable' : ''}`}
      selected={selected}
      unavailable={disabled}
      onTap={disabled ? undefined : onTap}
      inspect={() =>
        inspect({ title: label, body: <AbilityRules kind={kind} /> })
      }
    >
      <Icon size={30} aria-hidden="true" />
      <span className="extension-count" aria-hidden="true">
        {count}
      </span>
      <span className="extension-selected" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
    </Piece>
  );
}
