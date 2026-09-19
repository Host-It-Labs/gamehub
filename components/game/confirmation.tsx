'use client';
import {
  useSyncExternalStore,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';
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
  const [browserValue, setBrowserValue] = usePreference(
    game,
    'confirm-moves',
    false,
  );
  const [accountPreference, setAccountPreference] = useState<{
    game: GameId;
    value: boolean;
  } | null>(null);
  useEffect(() => {
    if (!game) return;
    let active = true;
    void fetch(`/api/preferences/confirm-moves.${game}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          account: boolean;
          value: boolean | null;
        };
      })
      .then((result) => {
        if (active && result?.account)
          setAccountPreference({ game, value: result.value ?? false });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [game]);
  function change(enabled: boolean) {
    if (game) setAccountPreference({ game, value: enabled });
    setBrowserValue(enabled);
    if (!game) return;
    void fetch(`/api/preferences/confirm-moves.${game}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: enabled }),
    }).catch(() => {});
  }
  const accountValue =
    accountPreference && accountPreference.game === game
      ? accountPreference.value
      : null;
  return [accountValue ?? browserValue, change] as const;
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
  validMove,
  passCount,
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
  festivalChoice = {},
  natureChoice = {},
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
  natureChoice?: {
    roam?: boolean;
    migration?: { card: number; from: number; to: number };
  };
  festivalChoice?: { order?: number; stall?: boolean };
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
                ...festivalChoice,
                ...natureChoice,
                ...(g.id === 'wildgrove' ? { zone: zone ?? -1 } : {}),
                ...(ward ? { ward: true } : {}),
              }
            : null;
  const [salvageDraft, setSalvageDraft] = useState<{
    key: string;
    claim: boolean;
  } | null>(null);
  const key = `${g.round}:${g.pick}:${g.phase}`;
  const salvageChoice = salvageDraft?.key === key ? salvageDraft.claim : null;
  if (g.phase === 'salvage')
    return canAct(g, viewer) ? (
      <div
        className="hand-confirmation salvage-decision"
        aria-label="Secret Salvage decision"
      >
        <button
          className={salvageChoice === true ? 'primary' : 'secondary'}
          aria-pressed={salvageChoice === true}
          disabled={disabled}
          onClick={() => setSalvageDraft({ key, claim: true })}
        >
          Claim · −6 / +3
        </button>
        <button
          className={salvageChoice === false ? 'primary' : 'secondary'}
          aria-pressed={salvageChoice === false}
          disabled={disabled}
          onClick={() => setSalvageDraft({ key, claim: false })}
        >
          Pass
        </button>
        <button
          className="primary confirm-action"
          disabled={disabled || salvageChoice === null}
          onClick={() => {
            if (salvageChoice !== null)
              onConfirm({ type: 'salvage', claim: salvageChoice });
          }}
        >
          Lock choice
        </button>
      </div>
    ) : null;
  if (
    (!enabled && g.phase !== 'pass') ||
    !canAct(g, viewer) ||
    g.phase === 'roll' ||
    g.phase === 'over'
  )
    return null;
  return (
    <div className="hand-confirmation" aria-label="Confirm prepared move">
      <button
        className="primary confirm-action"
        disabled={disabled || !choice || !validMove(g, choice, viewer)}
        onClick={() => {
          if (choice) onConfirm(choice);
        }}
      >
        {g.phase === 'pass'
          ? `Pass ${passed.length}/${passCount(g)}`
          : 'Confirm move'}
      </button>
      <button
        className="secondary"
        disabled={disabled || (selected === null && passed.length === 0)}
        onClick={onClear}
      >
        Clear
      </button>
    </div>
  );
}
