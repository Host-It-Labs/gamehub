'use client';
import { GameProgress } from '../game/game-progress';
import { totalRounds } from '@/lib/games/trio/engine';
import { dropTargetNear } from '../game/drag-preview';
import { FullscreenControl, useFullscreen } from '../game/fullscreen-control';
import {
  ExtensionControls,
  useNatureChoice,
} from '@/components/game/new-extensions';
import { useAdvancedView } from '@/components/game/advanced-view';
import { FestivalControls, useFestivalChoice } from '../game/yatai-festival';
import { ArrowLeft } from 'lucide-react';
import { TableHeading, gameName } from '../game/table-heading';
import {
  useAutoRoll,
  MoveConfirmation,
  UndoChoice,
  useMoveConfirmation,
} from '../game/confirmation';
import { TableMenu } from '../game/table-menu';
import { ArtworkLoading } from '../game/artwork';
import { ScrollArea } from '../game/scroll-area';
import { SanctuaryBadges } from '@/components/game/mora-extension';
import { ExtensionAction } from '../game/extension-action';
import { useEffect, useRef, useState } from 'react';
import { Board, Hand, Players } from '@/components/game/boards';
import { DieControl } from '@/components/game/die';
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
  canAct,
  passCount,
  preparationKey,
} from '@/lib/games/trio/engine';
import type { GameView } from '@/lib/online/types';
import { cue, eventCue } from '@/lib/games/trio/sound';
import { readAmbienceLevel, useAmbience } from '@/components/game/use-ambience';

export function OnlineMatch({
  g,
  viewer,
  disabled,
  connectionStatus,
  ambienceEnabled = false,
  send,
  onHome,
}: {
  g: GameView;
  viewer: number;
  disabled: boolean;
  connectionStatus?: string;
  ambienceEnabled?: boolean;
  send: (move: Move) => Promise<boolean>;
  onHome: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null),
    [preparedZone, setPreparedZone] = useState<number | null>(null),
    [passed, setPassed] = useState<number[]>([]),
    [order, setOrder] = useState<number[]>([]),
    [ward, setWard] = useState(false),
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
  const scope = preparationKey(g, viewer);
  const [preparationScope, setPreparationScope] = useState(scope);
  // A new packet invalidates only local choices; keep the table, die and dialogs mounted.
  if (preparationScope !== scope) {
    setPreparationScope(scope);
    setSelected(null);
    setPreparedZone(null);
    setPassed([]);
    setWard(false);
  }
  const festival = useFestivalChoice(g, viewer);
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
  const mine = canAct(g, viewer) && !disabled;
  const nature = useNatureChoice(g, viewer);
  const [advanced, setAdvanced] = useAdvancedView(g.id);
  const fullscreen = useFullscreen();
  // Both Mora worlds (Observatory and Floodline Station) share the paper-table environment.
  const observatory = g.id === 'wildgrove';
  // Full-table worlds float their controls over one environment plate.
  const environment = observatory
    ? 'observatory'
    : g.id === 'undertow'
      ? 'cabin'
      : g.id === 'midnight'
        ? 'market'
        : undefined;
  const world = environment !== undefined;
  const [ambience] = useState(readAmbienceLevel);
  useAmbience(g.phase === 'over' ? null : g.id, volume, ambienceEnabled ? ambience : 0, g.contentSet);
  const [confirmMoves, setConfirmMoves] = useMoveConfirmation(g.id);

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
    move = nature.withChoice(festival.withChoice(move));
    if (disabled || (move.type !== 'undo' && !mine) || !validMove(g, festival.withChoice(move), viewer)) return;

    if ((await send(move)) && move.type !== 'roll') {
      setSelected(null);
      setPreparedZone(null);
      setPassed([]);
      setWard(false);
    }
  }
  useAutoRoll(
    !!g && g.phase === 'roll' && canAct(g, viewer) && !disabled,
    () => {
      void commit({ type: 'roll' });
    },
  );
  function tap(c: Card) {
    if (g.phase === 'over') return;
    if (g.phase === 'pass') {
      // Seats before the current actor have already confirmed their pass.
      if (!canAct(g, viewer)) return;
      const next = passed.includes(c.id)
        ? passed.filter((id) => id !== c.id)
        : passed.length < passCount(g)
          ? [...passed, c.id]
          : passed;
      setPassed(next);
      return;
    }
    if (!mine || g.phase !== 'play') return;
    if (g.id === 'wildgrove') {
      setSelected((previous) => (previous === c.id ? null : c.id));
      setPreparedZone(null);
      return;
    }
    const move: Move = {
      type: 'play',
      card: c.id,
      ...(ward ? { ward: true } : {}),
    };
    if (!confirmMoves && validMove(g, festival.withChoice(move), viewer))
      void commit(move);
    else setSelected((previous) => (previous === c.id ? null : c.id));
  }
  function place(zone: number) {
    if (selected === null || g.phase === 'over') return;
    if (!confirmMoves && mine && g.phase === 'play') {
      void commit({ type: 'play', card: selected, zone });
    } else setPreparedZone(zone);
  }
  function drop(c: Card, x: number, y: number, before?: number | null) {
    if (before !== undefined) {
      const ids = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-drop="hand"] > [data-card-id]',
        ),
      )
        .map((el) => Number(el.dataset.cardId))
        .filter((id) => id !== c.id);
      const at = before === null ? ids.length : ids.indexOf(before);
      ids.splice(at < 0 ? ids.length : at, 0, c.id);
      setOrder(ids);
      cue('drop', volume);
      return;
    }
    const elements = document.elementsFromPoint(x, y),
      target =
        (elements.find(
          (e) => e instanceof HTMLElement && e.dataset.drop === 'hand',
        ) as HTMLElement | undefined) ??
        dropTargetNear(x, y, document.querySelector('.hand [data-card-id]')?.getBoundingClientRect().width ?? 64) ??
        undefined,
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
    if (confirmMoves || !mine || g.phase === 'roll') {
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
      });
  }
  const sc = scores(g),
    winning = g.id === 'undertow' ? Math.min(...sc) : Math.max(...sc);
  return (
    <main
      className={`table-layout ${g.id} ${world ? 'world-table' : ''}`}
      data-game={g.id}
      data-environment={environment}
    >
      <ArtworkLoading
        key={`${g.id}:${g.contentSet}`}
        game={g.id}
        contentSet={g.contentSet}
      />
      <div className="table-toolbar">
        <button className="table-back" onClick={onHome} aria-label="Back to my tables">
          <ArrowLeft size={17} />
          <span>{world ? gameName(g) : 'My tables'}</span>
        </button>
        {!world && <TableHeading g={g} />}
            <GameProgress label={`Round ${g.round} / ${totalRounds(g)}`} />
        <div className="table-toolbar-actions">
              <div className="table-others-slot" />
              {!world && <FullscreenControl />}
            <TableMenu
              fullscreen={world ? fullscreen : undefined}
          advanced={advanced}
          onAdvanced={g.id !== 'undertow' && !observatory ? setAdvanced : undefined}
          confirmMoves={confirmMoves}
          onConfirmMoves={setConfirmMoves}
          onRules={() => setPanel('rules')}
          onCounts={() => setPanel('reference')}
          onScores={() => setPanel('log')}
          soundLabel={volume ? 'Mute sound' : 'Unmute sound'}
          onSound={() => {
            const next = volume ? 0 : 0.5;
            setVolume(next);
            try {
              localStorage.setItem('gamehub.volume.v3', String(next));
            } catch {}
          }}
        />
            </div>
      </div>
      <div
        className="table-columns"
      >
        <section className="play-area">
          <div className="table-players">
            <Players
              g={g}
              viewer={viewer}
              volume={volume}
              inspect={inspect}
              disabled={disabled}
              boardButton
              connectionStatus={connectionStatus}
              advanced={advanced}
            />
          </div>
          {g.id === 'wildgrove' &&
            g.sanctuaryGoalsEnabled && (
              <div className="observatory-achievements">
                <span className="achievements-heading">Sanctuary goals</span>
                <SanctuaryBadges
                  zones={g.players[viewer].zones}
                  goals={g.sanctuaryGoals}
                  contentSet={g.contentSet}
                  inspect={inspect}
                />
              </div>
            )}
          <ScrollArea
            className="board-viewport"
            fitBoard={g.id}
          >
            <Board
              natureChoice={nature.choice}
              g={g}
              player={viewer}
              viewer={viewer}
              selected={selected}
              inspect={inspect}
              onPlace={place}
              preparedZone={preparedZone}
              onMigrate={(migration) => nature.setChoice({ ...nature.choice, migration })}
            />
          </ScrollArea>

          <div className="hand-controls">
            <div className="hand-abilities">
              {g.id !== 'midnight' && <DieControl g={g} viewer={viewer} />}
              <ExtensionControls
                key={`${g.round}:${g.pick}:${g.phase}`}
                g={g}
                viewer={viewer}
                choice={nature.choice}
                onChange={nature.setChoice}
                inspect={inspect}
                disabled={disabled}
              />
              <FestivalControls
                g={g}
                viewer={viewer}
                choice={festival.choice}
                onChange={festival.setChoice}
                inspect={inspect}
                disabled={disabled}
              />
              {g.id === 'undertow' && g.shields === true && (
                <ExtensionAction
                  kind="shield"
                  label="Shield"
                  selected={ward}
                  count={g.players[viewer].wards}
                  disabled={
                    disabled ||
                    g.phase !== 'play' ||
                    !mine ||
                    !g.players[viewer].wards
                  }
                  onTap={() => {
                    setWard(!ward);
                  }}
                  inspect={inspect}
                  description="Select before playing to halve the trick's penalties, rounding up, if you win it. Spent even if you lose. Two Shields refresh each round. Tap again to cancel."
                />
              )}
            </div>

            {g.id === 'undertow' ? (
              <span />
            ) : g.phase === 'pass' ? (
              <span>
                {passed.length}/{passCount(g)} selected
              </span>
            ) : null}
          </div>
          <UndoChoice g={g} viewer={viewer}
            drafted={selected !== null || passed.length > 0 || !!nature.choice.migration || !!nature.choice.roam || !!ward}
            disabled={disabled}
            onUndo={() => { void commit({ type: 'undo' }); nature.setChoice({}); }}
            onClear={() => { setSelected(null); setPreparedZone(null); setPassed([]); setWard(false); nature.setChoice({}); }} />
          <MoveConfirmation
            g={g}
            viewer={viewer}
            selected={selected}
            passed={passed}
            zone={preparedZone}
            ward={ward}

            festivalChoice={festival.choice}
            natureChoice={nature.choice}

            enabled={confirmMoves}

            onConfirm={commit}
            disabled={disabled}
            onClear={() => {
              setSelected(null);
              setPreparedZone(null);
              setPassed([]);
            }}
          />
          <Hand
            g={g}
            viewer={viewer}
            order={order}
            selected={selected}
            passed={passed}
            inspect={inspect}
            onTap={tap}
            onDrop={drop}
            onDragSelect={setSelected}
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
                  {p.name}: {sc[i]}{' '}
                  {g.id === 'undertow' ? 'penalty points' : 'points'}
                </p>
              ))}
              <p>The host can return to the lobby for another game.</p>
            </div>
          )}
        </section>
        <aside className="activity-sidebar">
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
        <DialogContent className={`modal inspector ${inspection?.wide ? 'inspector-wide' : ''}`}>
          <DialogTitle>
            {inspection?.title ??
              (panel === 'log'
                ? 'Scores & activity'
                : panel === 'reference'
                  ? 'Card counts'
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
