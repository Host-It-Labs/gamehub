'use client';
import { useAdvancedView } from '@/components/game/advanced-view';
import { readSetup, saveSetup } from './setup-preferences';
import { OpponentBoards } from '@/components/game/opponent-boards';
import { ExtensionAction } from './extension-action';
import { FestivalControls, useFestivalChoice } from '../game/yatai-festival';
import { TableHeading } from '../game/table-heading';
import {
  useAutoRoll,
  MoveConfirmation,
  useMoveConfirmation,
} from './confirmation';
import { TableMenu } from '../game/table-menu';
import { ArtworkLoading } from './artwork';
import { ScrollArea } from '../game/scroll-area';
import { Passing } from '../game/passing';
import { ExpansionChoice, FestivalExpansionChoice } from '../game/expansions';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, Shield, RotateCcw } from 'lucide-react';
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
import { DieControl } from '@/components/game/die';
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
  passCount,
  tidePenaltyValue,
  type Game,
  type GameId,
  type Card,
  type Move,
  type Difficulty,
} from '@/lib/games/trio/engine';
import { cue, eventCue } from '@/lib/games/trio/sound';
import { fallbackMove } from '@/lib/games/trio/bot';
const SAVE = 'gamehub.tables.v3';
function seed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export default function SoloGame() {
  const [g, setG] = useState<Game | null>(null),
    [saves, setSaves] = useState<Partial<Record<GameId, Game>>>({}),
    [setup, setSetup] = useState<GameId | null>(null),
    [starter, setStarter] = useState(false),
    [nightMarket, setNightMarket] = useState(false),
    [fastMode, setFastMode] = useState(false),
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
    [tack, setTack] = useState(false),
    [notice, setNotice] = useState(''),
    [botError, setBotError] = useState(false),
    [retry, setRetry] = useState(0),
    [showResults, setShowResults] = useState(false);
  const festival = useFestivalChoice(g, 0);
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
  const [advanced, setAdvanced] = useAdvancedView(g?.id);
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
    if (actor === 0) m = festival.withChoice(m);
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
      setTack(false);
    }
  }
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    if (setup) saveSetup(setup, { players, difficulty, starter, fastMode, nightMarket });
  }, [setup, players, difficulty, starter, fastMode, nightMarket]);
  function openSetup(id: GameId) {
    const saved = readSetup(id);
    setPlayers(saved.players);
    setDifficulty(saved.difficulty);
    setStarter(saved.starter);
    setFastMode(saved.fastMode);
    setNightMarket(saved.nightMarket);
    setSetup(id);
  }
  function start(id: GameId, tutorial = false) {
    const next = createGame(
      id,
      difficulty,
      seed(),
      tutorial,
      players,
      setup === id ? starter : g?.id === id ? (g.starter ?? false) : false,
      setup === id ? fastMode : g?.id === id ? (g.fastMode ?? false) : false,
      setup === id ? nightMarket : g?.id === id ? (g.nightMarket ?? false) : false,
    );
    store(next);
    setSetup(null);
    setPanel(null);
    setOrder([]);
    setPassed([]);
    setWard(false);
    setTack(false);
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
    setTack(false);
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
    if (g?.phase !== 'over') return;
    const timer = setTimeout(
      () => setShowResults(true),
      g.id === 'undertow' ? 2600 : 0,
    );
    return () => clearTimeout(timer);
  }, [g?.phase, g?.id]);
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
      watchdog: ReturnType<typeof setTimeout> | undefined,
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
          clearTimeout(watchdog);
          commitRef.current(e.data.move ?? fallbackMove(g, actor), actor);
          worker?.terminate();
        };
        worker.onerror = () => {
          clearTimeout(watchdog);
          if (!cancelled && current.current?.revision === snapshot)
            commitRef.current(fallbackMove(g, actor), actor);
          worker?.terminate();
        };
        worker.postMessage({ ...observe(g, actor), active: actor });
        watchdog = setTimeout(() => {
          if (!cancelled && current.current?.revision === snapshot)
            commitRef.current(fallbackMove(g, actor), actor);
          worker?.terminate();
        }, 4000);
      } catch {
        if (!cancelled && current.current?.revision === snapshot)
          commitRef.current(fallbackMove(g, actor), actor);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(watchdog);
      worker?.terminate();
    };
    // Snapshot revision guards worker replies; mutable preferences are read through refs.
  }, [g, panelOpen, panel, inspectorOpen, retry]);
  useAutoRoll(!!g && g.phase === 'roll' && canAct(g, 0), () => {
    commit({ type: 'roll' });
  });
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
    if (!canAct(g, 0) || g.phase === 'roll') return;
    if (g.id === 'wildgrove') {
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
      ...(tack ? { tack: true } : {}),
    };
    if (!confirmMoves && validMove(g, festival.withChoice(move), 0)) commit(move);
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
        ...(tack ? { tack: true } : {}),
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
          onSetup={openSetup}
          onResume={resume}
        />
      ) : (
        <main className="table-layout">
          <ArtworkLoading key={g.id} game={g.id} />
          <div className="table-toolbar">
            <button
              className="table-back"
              aria-label="Back to games"
              onClick={() => setPanel('leave')}
            >
              <ArrowLeft size={17} />
              <span>Games</span>
            </button>
            <TableHeading g={g} />
            <TableMenu
              advanced={advanced}
              onAdvanced={g.id !== 'undertow' ? setAdvanced : undefined}
              confirmMoves={confirmMoves}
              onConfirmMoves={setConfirmMoves}
              onRules={() => setPanel('rules')}
              onCounts={() => setPanel('reference')}
              onScores={() => setPanel('log')}
              onSound={() => setPanel('sound')}
            />
          </div>
          <div className={`table-columns ${advanced && g.id !== 'undertow' ? 'with-opponents' : ''}`}>
            <section className="play-area">
              <div className="table-players">
                <Players g={g} inspect={inspect} />
              </div>
              <ScrollArea className="board-viewport" fitBoard={g.id} fitBoardWidth={advanced}>
                <Board
                  g={g}
                  selected={selected}
                  inspect={inspect}
                  onPlace={place}
                  preparedZone={preparedZone}
                />
              </ScrollArea>
              <div className="game-controls">
                <MoveConfirmation
                  g={g}
                  viewer={0}
                  selected={selected}
                  passed={passed}
                  zone={preparedZone}
                  ward={ward}
                  tack={tack}
                  festivalChoice={festival.choice}

                  enabled={confirmMoves}

                  onConfirm={commit}
                  onClear={() => {
                    setSelected(null);
                    setPreparedZone(null);
                    setPassed([]);
                  }}
                />
                {g.id !== 'midnight' && <DieControl g={g} viewer={0} />}
              </div>
              <div className="hand-controls">
                <div className="hand-abilities">
                  <FestivalControls g={g} viewer={0} choice={festival.choice} onChange={festival.setChoice} inspect={inspect} />
                  {g.starter && (
                    <ExtensionAction kind="tack" label="Tack" selected={tack} count={g.players[0].tacks ?? 0}
 disabled={g.phase !== 'play' || g.active !== 0 || !g.players[0].tacks || !g.trick.length || !g.players[0].hand.some((c) => c.kind === g.trick[0].card.kind) || !g.players[0].hand.some((c) => c.kind !== g.trick[0].card.kind)} onTap={() => { setTack(!tack); setWard(false); }} inspect={inspect}
 description="Once each round, Tack lets you break the follow-suit rule. Select it, then play a card of a different suit, even when you hold the led suit. For example, if Hearts are led and you hold Hearts, Tack lets you shed a dangerous Storm card instead. Only cards of the led suit can win the trick, and all penalties still count. Use it to shed a dangerous card or save a strong led-suit card for later. Tack is spent only when you play the off-suit card. You cannot use it when leading, when you already cannot follow suit, or together with a Shield. Tap it again to cancel before playing. One Tack refreshes each round." />
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
                                    trick, halve <b>all</b> its penalties,
                                    rounded up.
                                  </p>
                                  <div className="example">
                                    A {tidePenaltyValue(g)}-point card plus 5
                                    Storm points becomes{' '}
                                    {Math.ceil((tidePenaltyValue(g) + 5) / 2)}.
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
                              setTack(false);
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
                onDragSelect={setSelected}
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
            {advanced && g.id !== 'undertow' && <OpponentBoards g={g} viewer={0} inspect={inspect} />}
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
          <div className="setup-heading">
            <DialogTitle>{setupMeta?.name}</DialogTitle>
            <button className="secondary setup-learn" onClick={() => setup && start(setup, true)}>Learn</button>
          </div>
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
            <legend>Bot difficulty</legend>
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
            <>
              <label className="tide-fast-mode" aria-label="Fast mode">
                <input
                  type="checkbox"
                  checked={fastMode}
                  onChange={(e) => setFastMode(e.target.checked)}
                />
                <span>
                  <b>Fast mode</b>
                  <small>Cards 1–5 · the 4 matching the die is +8</small>
                </span>
              </label>
              <ExpansionChoice
                enabled={starter}
                fastMode={fastMode}
                onChange={setStarter}
              />
            </>
          )}
          {setup === 'midnight' && <FestivalExpansionChoice enabled={nightMarket} onChange={setNightMarket} />}
          <button className="primary" onClick={() => setup && start(setup)}>
            Play
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
                ? 'Card and piece counts'
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
            {bestScore} {g?.id === 'undertow' ? 'penalty points' : 'points'}
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
