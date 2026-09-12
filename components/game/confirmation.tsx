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
export function useAutoRoll(eligible: boolean, roll: () => void) {
  const performRoll = useEffectEvent(roll);
  useEffect(() => {
    if (!eligible) return;
    const timer = setTimeout(() => performRoll(), 450);
    return () => clearTimeout(timer);
  }, [eligible]);
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
  onConfirm,
  onClear,
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
  onConfirm: (move: Move) => void;
  onClear: () => void;
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
  const text = disabled
    ? 'Connecting or saving…'
    : !canAct(g, viewer) && simultaneous(g)
      ? 'Waiting for other players'
      : g.phase === 'roll'
        ? canAct(g, viewer)
          ? 'Rolling the die…'
          : 'The die rolls automatically'
        : choice?.type === 'pass'
          ? `${passed.length} of ${passCount(g)} cards selected to pass`
          : card
            ? `${cardName(g.id, card)}${zone !== null ? ` → ${habitats[zone].name}` : g.id === 'wildgrove' ? ' · choose a habitat' : ''}${ward ? ' + Shield' : ''}${calm ? ' + Calm' : ''}`
            : g.phase === 'over'
              ? 'Game complete'
              : canAct(g, viewer)
                ? enabled || g.phase === 'pass'
                  ? g.phase === 'pass'
                    ? `Choose ${passCount(g)} cards to pass`
                    : 'Your turn · choose a move'
                  : 'Your turn · tap or drop to play'
                : `${g.players[g.active].name}’s turn`;
  return (
    <div
      className={`preparation-slot ${canAct(g, viewer) && !disabled ? 'is-your-turn' : ''}`}
    >
      <div className="prepared-move" aria-live="polite">
        <span>{text}</span>
        <div className="move-actions">
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
    </div>
  );
}
