'use client';
import { Store } from 'lucide-react';
import { AbilityRules } from './extension-rules';
import { Piece, type Inspect } from './interactions';

/** Yata's fixed-size stall permit token; inspection remains available when spent or locked. */
export function ExtensionAction({
  label,
  selected,
  count,
  disabled,
  onTap,
  inspect,
}: {
  label: string;
  description: string;
  selected: boolean;
  count: number;
  disabled: boolean;
  onTap: () => void;
  inspect: Inspect;
}) {
  return (
    <Piece
      className={`extension-action extension-action-stall ${disabled ? 'unavailable' : ''} ${count === 0 ? 'spent' : ''}`}
      label={`${label} · ${count} remaining${selected ? ' · selected' : ''}${disabled ? ' · unavailable' : ''}`}
      selected={selected}
      unavailable={disabled}
      onTap={disabled ? undefined : onTap}
      inspect={() =>
        inspect({ title: label, body: <AbilityRules /> })
      }
    >
      <Store size={30} aria-hidden="true" />
      <span className="extension-count" aria-hidden="true">
        {count}
      </span>
      <span className="extension-selected" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
    </Piece>
  );
}
