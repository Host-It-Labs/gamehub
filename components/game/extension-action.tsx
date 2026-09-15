'use client';
import { Shield, Store } from 'lucide-react';
import { AbilityRules } from './extension-rules';
import { Piece, type Inspect } from './interactions';

/** Fixed-size ability token; inspection remains available when spent or locked. */
export function ExtensionAction({ kind, label, selected, count, disabled, onTap, inspect }: {
  kind: 'tack' | 'shield' | 'stall'; label: string; description: string;
  selected: boolean; count: number; disabled: boolean; onTap: () => void; inspect: Inspect;
}) {
  const Icon = kind === 'shield' ? Shield : Store;
  return <Piece className={`extension-action extension-action-${kind} ${disabled ? 'unavailable' : ''} ${count === 0 ? 'spent' : ''}`}
    label={`${label} · ${count} remaining${selected ? ' · selected' : ''}${disabled ? ' · unavailable' : ''}`}
    selected={selected} unavailable={disabled} onTap={disabled ? undefined : onTap}
    inspect={() => inspect({ title: label, body: <AbilityRules kind={kind} /> })}>
    {kind === 'tack' ? <svg className="tack-wild-card" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="6" y="3" width="20" height="26" rx="4" stroke="currentColor" strokeWidth="1.7"/><path d="m16 9 2.2 4.8L23 16l-4.8 2.2L16 23l-2.2-4.8L9 16l4.8-2.2Z" fill="currentColor"/><circle cx="10" cy="7" r="1" fill="currentColor"/><circle cx="22" cy="25" r="1" fill="currentColor"/></svg> : <Icon size={24} aria-hidden="true" />}
    {kind !== 'tack' && <span className="extension-count" aria-hidden="true">{count}</span>}
    <span className="extension-selected" aria-hidden="true">{selected ? '✓' : ''}</span>
  </Piece>;
}
