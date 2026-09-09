'use client';
import { useSyncExternalStore, useEffect, useEffectEvent } from 'react';
import type { GameId } from '@/lib/games/trio/engine';
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('gamehub-confirmation', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('gamehub-confirmation', listener);
  };
}
const preferences = new Map<string, boolean>();
function usePreference(
  game: GameId | undefined,
  setting: string,
  defaultValue: boolean,
) {
  const key = `gamehub.${setting}.${game}`;
  const enabled = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const saved = localStorage.getItem(key);
        return saved === null
          ? (preferences.get(key) ?? defaultValue)
          : saved === 'true';
      } catch {
        return preferences.get(key) ?? defaultValue;
      }
    },
    () => defaultValue,
  );
  function change(enabled: boolean) {
    if (!game) return;
    preferences.set(key, enabled);
    try {
      localStorage.setItem(key, String(enabled));
    } catch {}
    window.dispatchEvent(new Event('gamehub-confirmation'));
  }
  return [enabled, change] as const;
}
export function useMoveConfirmation(game: GameId | undefined) {
  return usePreference(game, 'confirm-moves', true);
}
export function useAutoRoll(
  game: GameId | undefined,
  eligible: boolean,
  roll: () => void,
) {
  const [enabled, change] = usePreference(game, 'auto-roll', false);
  const performRoll = useEffectEvent(roll);
  useEffect(() => {
    if (!enabled || !eligible) return;
    const timer = setTimeout(() => performRoll(), 450);
    return () => clearTimeout(timer);
  }, [enabled, eligible]);
  return [enabled, change] as const;
}
export function AutoRoll({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="confirm-moves">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Auto-roll dice
    </label>
  );
}
export function ConfirmMoves({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="confirm-moves">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      Confirm moves
    </label>
  );
}

import {
  canAct,
  simultaneous,
  validMove,
  passCount,
  cardName,
  habitats,
  type PublicGame,
  type Move,
} from '@/lib/games/trio/engine';
export function MoveConfirmation({
  g,
  viewer,
  selected,
  passed,
  zone,
  ward,
  calm,
  enabled,
  onChange,
  onConfirm,
  onClear,
  autoRoll,
  onAutoRollChange,
  disabled = false,
}: {
  g: PublicGame;
  viewer: number;
  selected: number | null;
  passed: number[];
  zone: number | null;
  ward: boolean;
  calm: boolean;
  enabled: boolean;
  onChange: (v: boolean) => void;
  onConfirm: (move: Move) => void;
  onClear: () => void;
  autoRoll: boolean;
  onAutoRollChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  const choice: Move | null =
    g.phase === 'pass'
      ? passed.length
        ? { type: 'pass', cards: passed }
        : null
      : g.phase === 'roll'
        ? null
        : g.phase === 'over'
          ? null
          : selected !== null
            ? {
                type: 'play',
                card: selected,
                ...(g.id === 'wildgrove' ? { zone: zone ?? -1 } : {}),
                ...(ward ? { ward: true } : {}),
                ...(calm ? { calm: true } : {}),
              }
            : null;
  const card = g.players[viewer].hand.find((c) => c.id === selected);
  const text =
    !canAct(g, viewer) && simultaneous(g)
      ? 'Choice locked · waiting for the others'
      : g.phase === 'roll'
        ? canAct(g, viewer)
          ? 'Click the die to roll'
          : 'Waiting for the die roll'
        : choice?.type === 'pass'
          ? `Pass ${passed.length} of ${passCount(g)} cards · confirmation required`
          : card
            ? `${cardName(g.id, card)}${zone !== null ? ` → ${habitats[zone].name}` : g.id === 'wildgrove' ? ' · choose a habitat' : ''}${ward ? ' + Safe Harbour' : ''}${calm ? ' + Calm' : ''}`
            : g.phase === 'over'
              ? 'Game complete'
              : canAct(g, viewer)
                ? enabled || g.phase === 'pass'
                  ? 'Choose your move, then confirm'
                  : 'Moves are sent as soon as you choose'
                : 'You can prepare your next move';
  return (
    <div className="preparation-slot">
      <div className="move-preferences">
        <ConfirmMoves enabled={enabled} onChange={onChange} />
        {g.id !== 'midnight' && (
          <AutoRoll enabled={autoRoll} onChange={onAutoRollChange} />
        )}
      </div>
      <div className="prepared-move" aria-live="polite">
        <span>{text}</span>
        {choice && (
          <button
            className="primary"
            disabled={disabled || !validMove(g, choice, viewer)}
            onClick={() => onConfirm(choice)}
          >
            Confirm
          </button>
        )}
        {(selected !== null || passed.length > 0) && (
          <button className="secondary" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
