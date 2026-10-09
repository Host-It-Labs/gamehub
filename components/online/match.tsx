'use client';
import { GameProgress } from '../game/game-progress';
import { useGameMotion } from '../game/game-motion';
import { useGameSound } from '../game/use-game-sound';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { useResultsFeedback, WinnerCelebration } from '../game/results-feedback';
import { viewerWon, winningSeats } from '@/lib/games/results-feedback';
import { CountUp, stagger } from '../game/reveal-motion';
import { decisionKey, previewPlacement, totalRounds, yataWorldFor } from '@/lib/games/trio/engine';
import { dropTargetNear } from '../game/drag-preview';
import {
  ExtensionControls,
  useNatureChoice,
} from '@/components/game/new-extensions';
import { FestivalControls, useFestivalChoice } from '../game/yatai-festival';
import { ArrowLeft, List, Trophy } from 'lucide-react';
import { TableHeading, gameName, worldTheme } from '../game/table-heading';
import { useAutoRoll, MoveConfirmation, UndoChoice } from '../game/confirmation';
import { GameMenu } from '../game/game-menu';
import { SoundSettings } from '../game/sound-settings';
import { ArtworkLoading } from '../game/artwork';
import { ScrollArea } from '../game/scroll-area';
import { SanctuaryBadges } from '@/components/game/mora-extension';
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
import {
  readAmbienceLevel,
  saveAmbienceLevel,
  useAmbience,
} from '@/components/game/use-ambience';

export function OnlineMatch({
  g,
  viewer,
  disabled,
  connectionStatus,
  ambienceEnabled = false,
  turnSound = true,
  send,
  onHome,
}: {
  g: GameView;
  viewer: number;
  disabled: boolean;
  connectionStatus?: string;
  ambienceEnabled?: boolean;
  turnSound?: boolean;
  send: (move: Move) => Promise<boolean>;
  onHome: () => void;
}) {
  const [submitted, setSubmitted] = useState<{ key: string; move: Move } | null>(null);
  const localMove = submitted?.key === decisionKey(g) ? submitted.move : undefined;
  const display = previewPlacement(g, viewer, localMove ?? g.ownMove);
  const motionRoot = useRef<HTMLElement>(null);
  useGameMotion(motionRoot, `${g.id}:${g.round}:${g.phase}`);
  const [selected, setSelected] = useState<number | null>(null),
    [preparedZone, setPreparedZone] = useState<number | null>(null),
    [passed, setPassed] = useState<number[]>([]),
    [order, setOrder] = useState<number[]>([]),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [panel, rememberPanel] = useState<'rules' | 'reference' | 'log' | null>(
      null,
    ),
    [panelOpen, setPanelOpen] = useState(false),
    [volume, setVolume] = useState(() => readAudioLevel());
  useGameSound(g.id, volume);
  const scope = preparationKey(g, viewer);
  const [preparationScope, setPreparationScope] = useState(scope);
  // A new packet invalidates only local choices; keep the table, die and dialogs mounted.
  if (preparationScope !== scope) {
    setPreparationScope(scope);
    setSelected(null);
    setPreparedZone(null);
    setPassed([]);
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
        (e) => e.id >= (lastRevision.current + 1) * 10 && !(e.type === 'play' && e.player === viewer),
      ))
        eventCue(e, g.id, volume);
      lastRevision.current = g.revision;
    }
  }, [g.revision, g.events, g.id, volume, viewer]);
  const mine = canAct(g, viewer) && !disabled && !localMove;
  const nature = useNatureChoice(g, viewer);
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
  const [ambience, setAmbience] = useState(readAmbienceLevel);
  useAmbience(g.phase === 'over' ? null : g.id, 1, ambienceEnabled ? ambience : 0, g.contentSet);

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

    if (move.type === 'play') {
      setSubmitted({ key: decisionKey(g), move });
      cue('place', volume, 0, g.id);
    }
    let accepted = false;
    try {
      accepted = await send(move);
    } finally {
      setSubmitted(null);
    }
    if (accepted && move.type !== 'roll') {
      setSelected(null);
      setPreparedZone(null);
      setPassed([]);
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
    };
    if (validMove(g, festival.withChoice(move), viewer)) void commit(move);
    else setSelected((previous) => (previous === c.id ? null : c.id));
  }
  function place(zone: number) {
    if (selected === null || g.phase === 'over') return;
    if (mine && g.phase === 'play') {
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
      cue('drop', volume, 0, g.id);
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
        });
  }
  const sc = scores(g),
    winning = g.id === 'undertow' ? Math.min(...sc) : Math.max(...sc);
  useResultsFeedback(g.id, g.phase === 'over', g.phase === 'over', volume);
  return (
    <main
      ref={motionRoot}
      className={`table-layout ${g.id} ${world ? 'world-table' : ''}`}
      data-game={g.id}
      data-environment={environment}
      data-market={g.id === 'midnight' ? yataWorldFor(g.contentSet) : undefined}
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
            <GameProgress round label={`Round ${g.round} / ${totalRounds(g)}`} />
        <div className="table-toolbar-actions">
              <div className="table-others-slot" />
            <GameMenu
              name={gameName(g) ?? ''}
              theme={worldTheme(g.id)}
              triggerClassName="table-menu-trigger"
              onRules={() => setPanel('rules')}
              items={[
                {
                  label: 'Card and piece counts',
                  icon: List,
                  onSelect: () => setPanel('reference'),
                },
                {
                  label: 'Scores and activity',
                  icon: Trophy,
                  onSelect: () => setPanel('log'),
                },
              ]}
              sound={
                <SoundSettings
                  volume={volume}
                  ambience={ambience}
                  onVolume={(next) => {
                    setVolume(next);
                    saveAudioLevel(next);
                  }}
                  onAmbience={(next) => {
                    setAmbience(next);
                    saveAmbienceLevel(next);
                  }}
                />
              }
              onLeave={onHome}
            />
            </div>
      </div>
      <div
        className="table-columns"
      >
        <section className="play-area">
          <div className="table-players">
            <Players
              g={display}
              viewer={viewer}
              volume={volume}
              turnSound={turnSound}
              inspect={inspect}
              disabled={disabled}
              boardButton
              connectionStatus={connectionStatus}
            />
          </div>
          {g.id === 'wildgrove' &&
            g.sanctuaryGoalsEnabled && (
              <div className="observatory-achievements">
                <span className="achievements-heading">Sanctuary goals</span>
                <SanctuaryBadges
                  zones={display.players[viewer].zones}
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
              natureChoice={display.ready?.[viewer] ? {} : nature.choice}
              g={display}
              player={viewer}
              viewer={viewer}
              selected={selected}
              inspect={inspect}
              onPlace={place}
              preparedZone={preparedZone}
            />
          </ScrollArea>

          <div className="hand-controls" data-game-motion="stage">
            <div className="hand-abilities">
              {g.id !== 'midnight' && <DieControl g={g} viewer={viewer} />}
              <ExtensionControls
                key={`${g.round}:${g.pick}:${g.phase}`}
                g={display}
                viewer={viewer}
                choice={nature.choice}
                onChange={nature.setChoice}
                inspect={inspect}
                disabled={disabled}
              />
              <FestivalControls
                g={display}
                viewer={viewer}
                choice={festival.choice}
                onChange={festival.setChoice}
                inspect={inspect}
                disabled={disabled}
              />
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
            drafted={selected !== null || passed.length > 0 || !!nature.choice.roam}
            disabled={disabled}
            onUndo={() => { void commit({ type: 'undo' }); nature.setChoice({}); }}
            onClear={() => { setSelected(null); setPreparedZone(null); setPassed([]); nature.setChoice({}); }} />
          <MoveConfirmation
            g={g}
            viewer={viewer}
            passed={passed}
            onConfirm={commit}
            disabled={disabled}
            onClear={() => {
              setSelected(null);
              setPreparedZone(null);
              setPassed([]);
            }}
          />
          <Hand
            g={display}
            viewer={viewer}
            order={order}
            selected={selected}
            passed={passed}
            inspect={inspect}
            onTap={tap}
            onDrop={drop}
            onDragSelect={setSelected}
            onLift={() => cue('pickup', volume, 0, g.id)}
          />
          {g.phase === 'over' && (
            <div className="online-card results-surface" data-game-motion="result">
              <WinnerCelebration
                won={viewerWon(viewer, winningSeats(sc, g.id === 'undertow'))}
              />
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
                <p className="reveal-rise" style={stagger(i, 0, 70)} key={i}>
                  {p.name}: <CountUp value={sc[i]} duration={600} delay={i * 70} />{' '}
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
