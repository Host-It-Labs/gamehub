'use client';
import {
  useAutoRoll,
  MoveConfirmation,
  useMoveConfirmation,
} from './confirmation';
import { ArtworkLoading } from './artwork';
import { ScrollArea } from '../game/scroll-area';
import { Passing } from '../game/passing';
import { ExpansionChoice, ExpansionBadge } from '../game/expansions';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  BookOpen,
  List,
  ScrollText,
  Shield,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { useIsMobile } from '@/hooks/use-mobile';
import { Library } from '@/components/game/library';
import { Board, Hand, Players } from '@/components/game/boards';
import { Piece, type Inspection } from '@/components/game/interactions';
import { Tutorial, lessons } from '@/components/game/tutorial';
import { Die } from '@/components/game/die';
import { Help } from '@/components/game/help';
import {
  catalog,
  createGame,
  play,
  validMove,
  canAct,
  observe,
  isSavedGame,
  scores,
  suits,
  dice,
  totalRounds,
  passCount,
  simultaneous,
  handSize,
  type Game,
  type GameId,
  type Card,
  type Move,
  type Difficulty,
} from '@/lib/games/trio/engine';
import { cue, eventCue } from '@/lib/games/trio/sound';
const SAVE = 'gamehub.tables.v3';
function seed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export default function SoloGame() {
  const [g, setG] = useState<Game | null>(null),
    [saves, setSaves] = useState<Partial<Record<GameId, Game>>>({}),
    [setup, setSetup] = useState<GameId | null>(null),
    [starter, setStarter] = useState(false),
    [difficulty, setDifficulty] = useState<Difficulty>('medium'),
    [players, setPlayers] = useState(3),
    [volume, setVolume] = useState(0.5),
    [panelOpen, setPanelOpen] = useState(false),
    [panel, rememberPanel] = useState<
      'rules' | 'reference' | 'log' | 'leave' | 'sound' | null
    >(null),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [preparedZone, setPreparedZone] = useState<number | null>(null),
    [passed, setPassed] = useState<number[]>([]),
    [order, setOrder] = useState<number[]>([]),
    [ward, setWard] = useState(false),
    [calm, setCalm] = useState(false),
    [notice, setNotice] = useState(''),
    [botError, setBotError] = useState(false),
    [retry, setRetry] = useState(0),
    [showResults, setShowResults] = useState(false);
  function setPanel(value: typeof panel) {
    if (value) rememberPanel(value);
    setPanelOpen(!!value);
  }
  const current = useRef<Game | null>(null),
    saveRef = useRef<Partial<Record<GameId, Game>>>({}),
    origin = useRef<HTMLElement | null>(null),
    vol = useRef(volume);
  const mobile = useIsMobile();
  useEffect(() => {
    vol.current = volume;
  }, [volume]);
  // Device storage is read after hydration; it never supplies the initial server render.
  /* eslint-disable react/react-compiler */
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE) || '{}') as Record<
        string,
        unknown
      >;
      const restored: Partial<Record<GameId, Game>> = {};
      for (const c of catalog)
        if (isSavedGame(raw[c.id]) && (raw[c.id] as Game).id === c.id)
          restored[c.id] = raw[c.id] as Game;
      saveRef.current = restored;
      setSaves(restored);
      const v = Number(localStorage.getItem('gamehub.volume.v3') ?? '.5');
      setVolume(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
      if (
        localStorage.getItem('gamehub.trio.v2') &&
        !localStorage.getItem(SAVE)
      )
        setNotice(
          'The rules have changed. Start a new table; your previous saves have been preserved.',
        );
    } catch {
      setNotice(
        'Local saving is unavailable. Keep this tab open to keep your match.',
      );
    }
  }, []);
  /* eslint-enable react/react-compiler */
  function store(next: Game) {
    current.current = next;
    setG(next);
    saveRef.current = { ...saveRef.current, [next.id]: next };
    setSaves(saveRef.current);
    try {
      localStorage.setItem(SAVE, JSON.stringify(saveRef.current));
    } catch {
      setNotice(
        'Local saving is unavailable. Keep this tab open to keep your match.',
      );
    }
  }
  function progress(action: string, next: Game) {
    const lesson = lessons[next.id][next.lesson];
    if (next.tutorial && lesson?.action === action)
      return { ...next, lesson: next.lesson + 1 };
    return next;
  }
  const [confirmMoves, setConfirmMoves] = useMoveConfirmation(g?.id);

  function inspect(item: Inspection, source?: HTMLElement) {
    origin.current =
      source ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setInspection(item);
    setInspectorOpen(true);
    const game = current.current;
    if (game) {
      const action = item.title.includes(' · ') ? 'opponent' : 'inspect';
      const next = progress(action, game);
      if (next !== game) store(next);
    }
  }
  function closeInspector() {
    setInspectorOpen(false);
    requestAnimationFrame(() => origin.current?.focus());
  }
  function commit(m: Move, actor = 0) {
    const game = current.current;
    if (!game || !validMove(game, m, actor)) return;
    let next = play(game, m, actor);
    const action =
      m.type === 'pass'
        ? 'pass'
        : m.type === 'roll'
          ? 'roll'
          : game.id === 'wildgrove'
            ? 'place'
            : m.ward
              ? 'ward-play'
              : 'play';
    if (actor === 0) next = progress(action, next);
    for (const e of next.events.filter((e) => e.id >= (game.revision + 1) * 10))
      eventCue(e, next.id, vol.current);
    store(next);
    if (
      (actor === 0 && m.type !== 'roll') ||
      next.round !== game.round ||
      next.players[0].packet !== game.players[0].packet
    ) {
      setSelected(null);
      setPreparedZone(null);
      setPassed([]);
      setWard(false);
      setCalm(false);
    }
    if (next.phase === 'over') setShowResults(true);
  }
  function start(id: GameId, tutorial = false) {
    const next = createGame(
      id,
      difficulty,
      seed(),
      tutorial,
      players,
      setup === id && starter,
    );
    store(next);
    setSetup(null);
    setPanel(null);
    setOrder([]);
    setPassed([]);
    setWard(false);
    setCalm(false);
    setSelected(null);
    setPreparedZone(null);
    setBotError(false);
    setShowResults(false);
    cue('shuffle', volume);
  }
  function resume(game: Game) {
    store(game);
    setSetup(null);
    setOrder([]);
    setPassed([]);
    setSelected(null);
    setPreparedZone(null);
    setWard(false);
    setCalm(false);
    setBotError(false);
    setShowResults(false);
  }
  function home() {
    setG(null);
    current.current = null;
    setPanel(null);
    setBotError(false);
  }
  useEffect(() => {
    if (
      !g ||
      g.phase === 'over' ||
      (panelOpen && panel === 'leave') ||
      inspectorOpen
    )
      return;
    const actor = g.players.findIndex((_, i) => i > 0 && canAct(g, i));
    if (actor < 0) return;
    let worker: Worker | undefined,
      cancelled = false;
    const snapshot = g.revision;
    const timer = setTimeout(() => {
      try {
        worker = new Worker(
          new URL('../../lib/games/trio/bot.worker.ts', import.meta.url),
          { type: 'module' },
        );
        worker.onmessage = (
          e: MessageEvent<{ move?: Move; error?: string }>,
        ) => {
          if (cancelled || current.current?.revision !== snapshot) return;
          if (e.data.move) commit(e.data.move, actor);
          else setBotError(true);
          worker?.terminate();
        };
        worker.onerror = () => {
          if (!cancelled) setBotError(true);
          worker?.terminate();
        };
        worker.postMessage({ ...observe(g, actor), active: actor });
      } catch {
        setBotError(true);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      worker?.terminate();
    };
    // Snapshot revision guards worker replies; mutable preferences are read through refs.
  }, [g, panelOpen, panel, inspectorOpen, retry]);
  const [autoRoll, setAutoRoll] = useAutoRoll(
    g?.id,
    !!g && g.phase === 'roll' && canAct(g, 0),
    () => {
      commit({ type: 'roll' });
    },
  );
  function tap(c: Card) {
    if (!g) return;
    if (g.phase === 'over') return;
    if (g.phase === 'pass') {
      // Seats before the current actor have already confirmed their pass.
      if (!canAct(g, 0)) return;
      const next = passed.includes(c.id)
        ? passed.filter((id) => id !== c.id)
        : passed.length < passCount(g)
          ? [...passed, c.id]
          : passed;
      setPassed(next);
      return;
    }
    if (!canAct(g, 0) || g.phase === 'roll' || g.id === 'wildgrove') {
      if (g.id === 'wildgrove' && selected !== c.id) {
        const next = progress('select', g);
        if (next !== g) store(next);
      }
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
    if (!confirmMoves && validMove(g, move, 0)) commit(move);
    else setSelected((previous) => (previous === c.id ? null : c.id));
  }
  function place(zone: number) {
    if (!g) return;
    if (selected === null || g.phase === 'over') return;
    if (!confirmMoves && canAct(g, 0) && g.phase === 'play') {
      commit({ type: 'play', card: selected, zone });
    } else setPreparedZone(zone);
  }
  function drop(c: Card, x: number, y: number, before?: number | null) {
    if (!g) return;
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
      const ids = g.players[0].hand
        .map((c) => c.id)
        .sort((a, b) => {
          const aa = order.indexOf(a),
            bb = order.indexOf(b);
          return (aa < 0 ? 999 : aa) - (bb < 0 ? 999 : bb);
        })
        .filter((id) => id !== c.id);
      const index = other
        ? ids.indexOf(Number(other.dataset.cardId))
        : ids.length;
      ids.splice(index < 0 ? ids.length : index, 0, c.id);
      setOrder(ids);
      cue('drop', volume);
      return;
    }
    if (g.phase === 'over') return;
    if (confirmMoves || !canAct(g, 0) || g.phase === 'roll') {
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
    if (g.id === 'wildgrove' && dest?.startsWith('zone:')) {
      const advanced = progress('select', g);
      if (advanced !== g) store(advanced);
      commit({ type: 'play', card: c.id, zone: Number(dest.split(':')[1]) });
    } else if (
      (g.id === 'undertow' && dest === 'trick') ||
      (g.id === 'midnight' && dest === 'menu')
    )
      commit({
        type: 'play',
        card: c.id,
        ...(ward ? { ward: true } : {}),
        ...(calm ? { calm: true } : {}),
      });
    else cue('drop', volume);
  }
  function volumeChange(v: number | readonly number[]) {
    const value = Array.isArray(v) ? v[0] : (v as number);
    setVolume(value);
    try {
      localStorage.setItem('gamehub.volume.v3', String(value));
    } catch {
      /* Preference is optional. */
    }
  }
  const meta = catalog.find((c) => c.id === g?.id),
    setupMeta = catalog.find((c) => c.id === setup),
    sc = g ? scores(g) : [],
    bestScore = g?.id === 'undertow' ? Math.min(...sc) : Math.max(...sc),
    winners = g?.players.filter((_, i) => sc[i] === bestScore) ?? [];
  return (
    <div className={`app ${g ? 'at-table' : ''} ${g?.id ?? ''}`}>
      <header className="app-header">
        <button
          className="brand"
          onClick={() => (g ? setPanel('leave') : undefined)}
          aria-label="Gamehub home"
        >
          <span className="brand-icon">g</span>gamehub
        </button>
        {!g && (
          <a className="secondary" href="/tables">
            Play with friends
          </a>
        )}
        {g && <span className="game-title">{meta?.name}</span>}
        <button
          className="icon-button"
          onClick={() => setPanel('sound')}
          aria-label="Sound settings"
        >
          {volume ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </header>
      {!g ? (
        <Library
          saves={saves}
          onSetup={(id) => {
            setStarter(false);
            setSetup(id);
          }}
          onLearn={(id) => start(id, true)}
          onResume={resume}
        />
      ) : (
        <main className="table-layout">
          <ArtworkLoading key={g.id} game={g.id} />
          <div className="table-toolbar">
            <button className="icon-label" onClick={() => setPanel('leave')}>
              <ArrowLeft size={17} />
              <span>Games</span>
            </button>
            <span className="round-counter">
              Round {g.round}/{totalRounds(g)}
              <small>
                {g.phase === 'pass'
                  ? 'Passing'
                  : g.phase === 'roll'
                    ? 'Dice'
                    : `Pick ${Math.min(g.pick, handSize(g))}/${handSize(g)}`}
              </small>
            </span>
            <div className="toolbar-actions">
              <button
                onClick={() => setPanel('rules')}
                aria-label="How to play"
              >
                <BookOpen size={18} />
                <span>Rules</span>
              </button>
              <button
                onClick={() => setPanel('reference')}
                aria-label="Game reference"
              >
                <List size={18} />
                <span>Reference</span>
              </button>
              <button
                className="mobile-log"
                onClick={() => setPanel('log')}
                aria-label="Scores and activity"
              >
                <ScrollText size={18} />
                <span>Scores</span>
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
                    disabled={g.phase === 'over' || !g.players[0].calms}
                    onClick={() => setCalm(!calm)}
                    title="Arm before playing. Cancel the highest Storm card if you capture this trick; spent either way."
                  >
                    {calm ? 'Calm armed' : 'Arm Calm'} ·{' '}
                    {g.players[0].calms ?? 0}
                  </button>
                )}
                <div className="turn-status" aria-live="polite">
                  <i className={canAct(g, 0) ? 'your-turn' : 'bot-turn'} />
                  {g.phase === 'over'
                    ? 'Finished'
                    : canAct(g, 0)
                      ? g.phase === 'pass'
                        ? `Choose ${passCount(g)} cards`
                        : g.phase === 'roll'
                          ? 'Roll the die'
                          : 'Your turn'
                      : simultaneous(g)
                        ? 'Waiting for the other choices'
                        : `${g.players[g.active].name} · ${g.difficulty}`}
                </div>
                {g.id !== 'midnight' && (
                  <Piece
                    className={`dice-token ${g.phase === 'roll' && canAct(g, 0) ? 'ready-to-roll' : ''}`}
                    coachId="die"
                    label="Dice"
                    inspect={() =>
                      inspect({
                        title:
                          g.id === 'undertow' ? 'Hazard die' : 'Placement die',
                        body:
                          g.id === 'undertow' ? (
                            <>
                              <p>
                                Four equally likely faces:{' '}
                                {suits.slice(0, 4).join(' ')}.
                              </p>
                              <p>
                                The selected suit’s 9 costs 40 this round. The
                                roll happens after passing.
                              </p>
                            </>
                          ) : (
                            <>
                              <h3>{dice[g.die].name}</h3>
                              <p>{dice[g.die].rule}</p>
                              <p>
                                {g.players[g.roller].name} is exempt. Capacity
                                still applies.
                              </p>
                            </>
                          ),
                      })
                    }
                    onTap={() =>
                      canAct(g, 0) &&
                      g.phase === 'roll' &&
                      commit({ type: 'roll' })
                    }
                  >
                    <Die g={g} />
                  </Piece>
                )}
                {g.id === 'undertow' && g.starter !== false && (
                  <div className="wards" data-coach="ward">
                    {[0, 1].map((i) => (
                      <Piece
                        key={i}
                        label={`Shield ${i + 1}`}
                        className={`ward-token ${i >= g.players[0].wards ? 'spent' : ''} ${ward && i === 0 ? 'armed' : ''}`}
                        inspect={() =>
                          inspect({
                            title: 'Shield',
                            body: (
                              <>
                                <p>
                                  Spend before playing. If you capture the
                                  trick, halve <b>all</b> its penalties, rounded
                                  up.
                                </p>
                                <div className="example">
                                  A 40-point 9 plus 5 Storm marks becomes 23.
                                </div>
                                <p>
                                  A shield is spent even if you lose. Two
                                  refresh each round.
                                </p>
                              </>
                            ),
                          })
                        }
                        onTap={() => {
                          if (g.phase !== 'over' && i < g.players[0].wards) {
                            setWard(!ward);
                            cue('ward', volume);
                            const next = progress('arm', g);
                            if (next !== g) store(next);
                          }
                        }}
                      >
                        <Shield size={25} />
                      </Piece>
                    ))}
                  </div>
                )}
              </div>
              <ScrollArea
                className="board-viewport"
                fitBoard={g.id}
                itemSelector=".region, .serving-dish, .table-card"
              >
                <Board
                  g={g}
                  selected={selected}
                  inspect={inspect}
                  onPlace={place}
                  preparedZone={preparedZone}
                />
              </ScrollArea>
              <div className="hand-status-row">
                <MoveConfirmation
                  g={g}
                  viewer={0}
                  selected={selected}
                  passed={passed}
                  zone={preparedZone}
                  ward={ward}
                  calm={calm}

                  enabled={confirmMoves}
                  autoRoll={autoRoll}
                  onAutoRollChange={setAutoRoll}
                  onChange={setConfirmMoves}
                  onConfirm={commit}
                  onClear={() => {
                    setSelected(null);
                    setPreparedZone(null);
                    setPassed([]);
                  }}
                />
              </div>
              <div className="hand-controls">
                <span>
                  {g.id === 'wildgrove' ? 'Creatures' : 'Your hand'}
                  <small>{g.players[0].hand.length}</small>
                </span>
                <Passing g={g} />
                {g.phase === 'pass' ? (
                  <span>
                    {passed.length}/{passCount(g)} selected
                  </span>
                ) : g.id !== 'wildgrove' ? (
                  <button
                    className="sort-button"
                    onClick={() =>
                      setOrder(
                        [...g.players[0].hand]
                          .sort((a, b) => a.kind - b.kind || a.rank - b.rank)
                          .map((c) => c.id),
                      )
                    }
                  >
                    Sort
                  </button>
                ) : (
                  <span />
                )}
              </div>
              <Hand
                g={g}
                order={order}
                selected={selected}
                passed={passed}
                inspect={inspect}
                onTap={tap}
                onDrop={drop}
                onLift={() => {
                  cue('pickup', volume);
                }}
              />
              {botError && (
                <div className="notice" role="alert">
                  Bot paused. Your match is saved.
                  <button
                    onClick={() => {
                      setBotError(false);
                      setRetry((x) => x + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {g.phase === 'over' && (
                <button
                  className="primary results-button"
                  onClick={() => setShowResults(true)}
                >
                  Final scores
                </button>
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
          {g.tutorial && !inspectorOpen && !panelOpen && (
            <Tutorial
              id={g.id}
              step={g.lesson}
              onSkip={() => store({ ...g, tutorial: false })}
              onRestart={() => start(g.id, true)}
            />
          )}
        </main>
      )}
      {notice && (
        <output className="notice global-notice">
          {notice}
          <button onClick={() => setNotice('')}>Dismiss</button>
        </output>
      )}
      <Dialog
        open={!!setup}
        onOpenChange={(open) => {
          if (!open) setSetup(null);
        }}
      >
        <DialogContent className="modal setup-modal">
          <DialogTitle>{setupMeta?.name}</DialogTitle>
          <DialogDescription>Choose your table.</DialogDescription>
          <fieldset>
            <legend>Players, including you</legend>
            <RadioGroup
              className="choices player-choices"
              value={String(players)}
              onValueChange={(v) => setPlayers(Number(v))}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <label key={n}>
                  <RadioGroupItem value={String(n)} />
                  <b>{n}</b>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset>
            <legend>Bots</legend>
            <RadioGroup
              className="choices"
              value={difficulty}
              onValueChange={(v) => setDifficulty(v as Difficulty)}
            >
              {(['easy', 'medium', 'hard'] as const).map((l) => (
                <label key={l}>
                  <RadioGroupItem value={l} />
                  <b>{l}</b>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          {setup === 'undertow' && (
            <ExpansionChoice enabled={starter} onChange={setStarter} />
          )}
          <p className="setup-detail">
            {difficulty === 'easy'
              ? 'Random legal moves.'
              : difficulty === 'medium'
                ? 'Bots look for immediate advantages.'
                : 'Bots remember seen packets and simulate possible futures.'}
          </p>
          <button className="primary" onClick={() => setup && start(setup)}>
            Play
          </button>
          <button
            className="secondary"
            onClick={() => setup && start(setup, true)}
          >
            Learn by playing
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={panelOpen}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="modal help-modal">
          <DialogTitle>
            {panel === 'rules'
              ? 'How to play'
              : panel === 'reference'
                ? 'Game reference'
                : panel === 'log'
                  ? 'Scores & activity'
                  : panel === 'sound'
                    ? 'Sound'
                    : 'Leave the table?'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'sound'
              ? 'Volume applies to all games.'
              : panel === 'leave'
                ? 'Your match is saved on this device.'
                : meta?.name}
          </DialogDescription>
          {panel === 'sound' ? (
            <div className="sound-settings">
              <Slider
                value={[volume]}
                onValueChange={volumeChange}
                min={0}
                max={1}
                step={0.05}
                aria-label="Sound volume"
              />
              <div>
                <button
                  className="secondary"
                  onClick={() => volumeChange(volume ? 0 : 0.5)}
                >
                  {volume ? 'Mute' : 'Unmute'}
                </button>
                <button
                  className="primary"
                  onClick={() => cue('combo', volume)}
                >
                  Test sound
                </button>
              </div>
            </div>
          ) : panel === 'leave' ? (
            <>
              <button className="primary" onClick={home}>
                Save & leave
              </button>
              <button className="secondary" onClick={() => setPanel(null)}>
                Keep playing
              </button>
            </>
          ) : g && panel === 'log' ? (
            <div>
              <h3>Scores</h3>
              {g.players.map((p, i) => (
                <div className="score-row" key={i}>
                  <span>{p.name}</span>
                  <b>{sc[i]}</b>
                </div>
              ))}
              <h3>Activity</h3>
              <ol className="modal-log">
                {[...g.events].reverse().map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ol>
            </div>
          ) : g ? (
            <>
              <Help g={g} reference={panel === 'reference'} />
              {panel === 'rules' && (
                <button className="primary" onClick={() => start(g.id, true)}>
                  <RotateCcw size={16} />
                  Restart tutorial in a new match
                </button>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      {mobile ? (
        <Sheet
          open={inspectorOpen}
          onOpenChange={(open) => {
            if (!open) closeInspector();
          }}
        >
          <SheetContent side="bottom" className="inspector">
            <SheetTitle>{inspection?.title}</SheetTitle>
            <SheetDescription>Details</SheetDescription>
            {inspection?.art && (
              <div className="inspection-art">{inspection.art}</div>
            )}
            <div className="inspection-body">{inspection?.body}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open={inspectorOpen}
          onOpenChange={(open) => {
            if (!open) closeInspector();
          }}
        >
          <DialogContent className="modal inspector">
            <DialogTitle>{inspection?.title}</DialogTitle>
            <DialogDescription>Details</DialogDescription>
            {inspection?.art && (
              <div className="inspection-art">{inspection.art}</div>
            )}
            <div className="inspection-body">{inspection?.body}</div>
          </DialogContent>
        </Dialog>
      )}
      <Dialog
        open={showResults && !!g && g.phase === 'over'}
        onOpenChange={setShowResults}
      >
        <DialogContent className="modal results">
          <DialogTitle>
            {winners.length > 1 ? 'Shared victory' : `${winners[0]?.name} wins`}
          </DialogTitle>
          <DialogDescription>
            {bestScore} {g?.id === 'undertow' ? 'marks' : 'points'}
          </DialogDescription>
          {g?.players.map((p, i) => (
            <div className="score-row" key={p.name}>
              <span>{p.name}</span>
              <b>{sc[i]}</b>
            </div>
          ))}
          <button className="primary" onClick={() => g && start(g.id)}>
            Play again
          </button>
          <button className="secondary" onClick={home}>
            Games
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
