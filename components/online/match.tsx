'use client';
import { ScrollArea } from '../game/scroll-area';
import { Passing } from '../game/passing';
import { ExpansionBadge } from '../game/expansions';
import { useEffect, useRef, useState } from 'react';
import { Board, Hand, Players } from '@/components/game/boards';
import { Die } from '@/components/game/die';
import { Help } from '@/components/game/help';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Inspection } from '@/components/game/interactions';
import {
  type Card,
  type Move,
  scores,
  validMove,
  totalRounds,
  passCount,
  habitats,
} from '@/lib/games/trio/engine';
import type { GameView } from '@/lib/online/types';
import { cue, eventCue } from '@/lib/games/trio/sound';

export function OnlineMatch({
  g,
  viewer,
  disabled,
  send,
}: {
  g: GameView;
  viewer: number;
  disabled: boolean;
  send: (move: Move) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    [preparedZone, setPreparedZone] = useState<number | null>(null),
    [passed, setPassed] = useState<number[]>([]),
    [order, setOrder] = useState<number[]>([]),
    [ward, setWard] = useState(false),
    [calm, setCalm] = useState(false),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [panel, rememberPanel] = useState<'rules' | 'reference' | 'log' | null>(
      null,
    ),
    [panelOpen, setPanelOpen] = useState(false),
    [volume, setVolume] = useState(() => {
      try {
        const v = Number(localStorage.getItem('gamehub.volume.v3') ?? '.5');
        return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
      } catch {
        return 0.5;
      }
    });
  const scope = `${g.round}:${g.players[viewer].packet}`;
  const [preparationScope, setPreparationScope] = useState(scope);
  // A new packet invalidates only local choices; keep the table, die and dialogs mounted.
  if (preparationScope !== scope) {
    setPreparationScope(scope);
    setSelected(null);
    setPreparedZone(null);
    setPassed([]);
    setWard(false);
    setCalm(false);
  }
  function setPanel(value: typeof panel) {
    if (value) {
      rememberPanel(value);
      setInspection(null);
    }
    setPanelOpen(!!value);
  }
  const lastRevision = useRef(g.revision),
    origin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (lastRevision.current !== g.revision) {
      for (const e of g.events.filter(
        (e) => e.id >= (lastRevision.current + 1) * 10,
      ))
        eventCue(e, g.id, volume);
      lastRevision.current = g.revision;
    }
  }, [g.revision, g.events, g.id, volume]);
  const mine = g.active === viewer && g.phase !== 'over' && !disabled;
  function inspect(item: Inspection, source?: HTMLElement) {
    origin.current =
      source ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setInspection(item);
    setInspectorOpen(true);
  }
  async function commit(move: Move) {
    if (!mine || !validMove(g, move)) return;
    if ((await send(move)) && move.type !== 'roll') {
      setSelected(null);
      setPreparedZone(null);
      setPassed([]);
      setWard(false);
      setCalm(false);
    }
  }
  function tap(c: Card) {
    if (g.phase === 'over') return;
    if (g.phase === 'pass') {
      // Seats before the current actor have already confirmed their pass.
      if (g.active > viewer) return;
      setPassed((p) =>
        p.includes(c.id)
          ? p.filter((id) => id !== c.id)
          : p.length < passCount(g)
            ? [...p, c.id]
            : p,
      );
      return;
    }
    if (!mine || g.phase === 'roll' || g.id === 'wildgrove') {
      setSelected((previous) => (previous === c.id ? null : c.id));
      setPreparedZone(null);
      return;
    }
    const move: Move = {
      type: 'play',
      card: c.id,
      ...(ward ? { ward: true } : {}),
      ...(calm ? { calm: true } : {}),
    };
    if (validMove(g, move)) void commit(move);
    else setSelected((previous) => (previous === c.id ? null : c.id));
  }
  function place(zone: number) {
    if (selected === null || g.phase === 'over') return;
    if (mine && g.phase === 'play') {
      void commit({ type: 'play', card: selected, zone });
    } else setPreparedZone(zone);
  }
  function drop(c: Card, x: number, y: number) {
    const elements = document.elementsFromPoint(x, y),
      target = elements.find(
        (e) => e instanceof HTMLElement && e.dataset.drop,
      ) as HTMLElement | undefined,
      other = elements.find(
        (e) =>
          e instanceof HTMLElement &&
          e.dataset.cardId &&
          Number(e.dataset.cardId) !== c.id,
      ) as HTMLElement | undefined;
    if (target?.dataset.drop === 'hand' || other) {
      const ids = [...g.players[viewer].hand]
        .sort(
          (a, b) =>
            (order.indexOf(a.id) < 0 ? 999 : order.indexOf(a.id)) -
            (order.indexOf(b.id) < 0 ? 999 : order.indexOf(b.id)),
        )
        .map((c) => c.id)
        .filter((id) => id !== c.id);
      const at = other ? ids.indexOf(Number(other.dataset.cardId)) : ids.length;
      ids.splice(at < 0 ? ids.length : at, 0, c.id);
      setOrder(ids);
      return;
    }
    if (g.phase === 'over') return;
    if (!mine || g.phase === 'roll') {
      const destination = target?.dataset.drop;
      if (g.phase === 'pass') return;
      if (
        (g.id === 'wildgrove' && destination?.startsWith('zone:')) ||
        (g.id === 'undertow' && destination === 'trick') ||
        (g.id === 'midnight' && destination === 'menu')
      ) {
        setSelected(c.id);
        setPreparedZone(
          destination?.startsWith('zone:')
            ? Number(destination.split(':')[1])
            : null,
        );
      }
      return;
    }
    if (g.phase !== 'play') return;
    const dest = target?.dataset.drop;
    if (g.id === 'wildgrove' && dest?.startsWith('zone:'))
      void commit({
        type: 'play',
        card: c.id,
        zone: Number(dest.split(':')[1]),
      });
    else if (
      (g.id === 'undertow' && dest === 'trick') ||
      (g.id === 'midnight' && dest === 'menu')
    )
      void commit({
        type: 'play',
        card: c.id,
        ...(ward ? { ward: true } : {}),
        ...(calm ? { calm: true } : {}),
      });
  }
  const sc = scores(g),
    winning = g.id === 'undertow' ? Math.min(...sc) : Math.max(...sc);
  return (
    <main className={`table-layout ${g.id}`}>
      <div className="table-toolbar">
        <span>
          Round {g.round}/{totalRounds(g)}
        </span>
        <div className="toolbar-actions">
          <button onClick={() => setPanel('rules')}>Rules</button>
          <button onClick={() => setPanel('reference')}>Reference</button>
          <button onClick={() => setPanel('log')}>Activity</button>
          <button
            onClick={() => {
              const next = volume ? 0 : 0.5;
              setVolume(next);
              try {
                localStorage.setItem('gamehub.volume.v3', String(next));
              } catch {
                /* Optional preference. */
              }
            }}
          >
            {volume ? 'Mute' : 'Unmute'}
          </button>
        </div>
      </div>
      <div className="table-columns">
        <section className="play-area">
          <div className="game-controls">
            <Players g={g} inspect={inspect} />
            <ExpansionBadge g={g} />
            {g.starter && (
              <button
                className={`secondary calm-token ${calm ? 'armed' : ''}`}
                aria-pressed={calm}
                disabled={g.phase === 'over' || !g.players[viewer].calms}
                onClick={() => setCalm(!calm)}
                title="Arm before playing. Cancel the highest Storm card if you capture this trick; spent either way."
              >
                {calm ? 'Calm armed' : 'Arm Calm'} ·{' '}
                {g.players[viewer].calms ?? 0}
              </button>
            )}
            <p className="turn-status" aria-live="polite">
              {g.phase === 'over'
                ? 'Finished'
                : disabled
                  ? 'Connecting or saving…'
                  : mine
                    ? g.phase === 'pass'
                      ? `Choose ${passCount(g)} cards to pass`
                      : 'Your turn'
                    : `${g.players[g.active].name}’s turn`}
            </p>
            {g.id !== 'midnight' && (
              <button
                className={`dice-token ${g.phase === 'roll' && mine ? 'ready-to-roll' : ''}`}
                disabled={!mine || g.phase !== 'roll'}
                onClick={() => void commit({ type: 'roll' })}
              >
                <Die g={g} />
              </button>
            )}
            {g.id === 'undertow' && g.starter !== false && (
              <button
                className={`secondary ${ward ? 'armed' : ''}`}
                aria-pressed={ward}
                disabled={g.phase === 'over' || !g.players[viewer].wards}
                onClick={() => setWard(!ward)}
              >
                {ward ? 'Shield armed' : 'Arm shield'} ·{' '}
                {g.players[viewer].wards} left
              </button>
            )}
          </div>
          <ScrollArea
            className="board-viewport"
            itemSelector=".region, .serving-dish, .table-card"
          >
            <Board
              g={g}
              player={viewer}
              viewer={viewer}
              selected={selected}
              inspect={inspect}
              onPlace={place}
              preparedZone={preparedZone}
            />
          </ScrollArea>
          {selected !== null && g.phase !== 'over' && g.phase !== 'pass' && (
            <div className="prepared-move" aria-live="polite">
              <span>
                {mine && g.phase === 'play'
                  ? 'Prepared choice'
                  : 'Preparing your next move'}
                {preparedZone !== null
                  ? ` · ${habitats[preparedZone].name}`
                  : ''}
              </span>
              <button
                className="primary"
                disabled={
                  !mine ||
                  !validMove(g, {
                    type: 'play',
                    card: selected,
                    ...(g.id === 'wildgrove'
                      ? { zone: preparedZone ?? -1 }
                      : {}),
                    ...(ward ? { ward: true } : {}),
                    ...(calm ? { calm: true } : {}),
                  })
                }
                onClick={() =>
                  void commit({
                    type: 'play',
                    card: selected,
                    ...(g.id === 'wildgrove'
                      ? { zone: preparedZone ?? -1 }
                      : {}),
                    ...(ward ? { ward: true } : {}),
                    ...(calm ? { calm: true } : {}),
                  })
                }
              >
                Play choice
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setSelected(null);
                  setPreparedZone(null);
                }}
              >
                Clear
              </button>
            </div>
          )}
          <Passing g={g} viewer={viewer} />
          <div className="hand-controls">
            <span>Your hand · {g.players[viewer].hand.length}</span>
            {g.phase === 'pass' ? (
              <button
                className="primary"
                disabled={!mine || passed.length !== passCount(g)}
                onClick={() => void commit({ type: 'pass', cards: passed })}
              >
                Pass {passed.length}/{passCount(g)}
              </button>
            ) : (
              <button
                className="sort-button"
                onClick={() =>
                  setOrder(
                    [...g.players[viewer].hand]
                      .sort((a, b) => a.kind - b.kind || a.rank - b.rank)
                      .map((c) => c.id),
                  )
                }
              >
                Sort
              </button>
            )}
          </div>
          <Hand
            g={g}
            viewer={viewer}
            order={order}
            selected={selected}
            passed={passed}
            inspect={inspect}
            onTap={tap}
            onDrop={drop}
            onLift={() => cue('pickup', volume)}
          />
          {g.phase === 'over' && (
            <div className="online-card">
              <h2>
                {g.players
                  .filter((_, i) => sc[i] === winning)
                  .map((p) => p.name)
                  .join(' & ')}{' '}
                {sc.filter((s) => s === winning).length > 1
                  ? 'share victory'
                  : 'wins'}
              </h2>
              {g.players.map((p, i) => (
                <p key={i}>
                  {p.name}: {sc[i]} {g.id === 'undertow' ? 'marks' : 'points'}
                </p>
              ))}
              <p>The host can return to the lobby for another game.</p>
            </div>
          )}
        </section>
        <aside className="activity-sidebar">
          <h2>Scores</h2>
          {g.players.map((p, i) => (
            <div className="score-row" key={i}>
              <span>{p.name}</span>
              <b>{sc[i]}</b>
            </div>
          ))}
          <h2>Activity</h2>
          <ol>
            {[...g.events].reverse().map((e) => (
              <li key={e.id}>{e.text}</li>
            ))}
          </ol>
        </aside>
      </div>
      <Dialog
        open={inspectorOpen || panelOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInspectorOpen(false);
            setPanel(null);
            requestAnimationFrame(() => origin.current?.focus());
          }
        }}
      >
        <DialogContent className="modal inspector">
          <DialogTitle>
            {inspection?.title ??
              (panel === 'log'
                ? 'Scores & activity'
                : panel === 'reference'
                  ? 'Reference'
                  : 'How to play')}
          </DialogTitle>
          <DialogDescription>Table details</DialogDescription>
          {inspection ? (
            <>
              {inspection.art}
              <div className="inspection-body">{inspection.body}</div>
            </>
          ) : panel === 'log' ? (
            <div>
              <h3>Scores</h3>
              {g.players.map((p, i) => (
                <div className="score-row" key={i}>
                  <span>{p.name}</span>
                  <b>{sc[i]}</b>
                </div>
              ))}
              <h3>Activity</h3>
              <ol>
                {[...g.events].reverse().map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ol>
            </div>
          ) : (
            <Help g={g} reference={panel === 'reference'} />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
