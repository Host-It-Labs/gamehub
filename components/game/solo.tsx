'use client';
import { GameProgress } from './game-progress';
import { useGameMotion } from './game-motion';
import { useGameSound } from './use-game-sound';
import { defaultAudioLevel, readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { useResultsFeedback, WinnerCelebration } from './results-feedback';
import { viewerWon, winningSeats } from '@/lib/games/results-feedback';
import { CountUp, stagger } from './reveal-motion';
import { previewPlacement, totalRounds, yataWorldFor } from '@/lib/games/trio/engine';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import { useBoardLeave } from './use-board-leave';
import { dropTargetNear } from './drag-preview';
import { LeaveDialog, useLeaveDialog } from './leave-dialog';
import {
  ExtensionControls,
  useNatureChoice,
} from '@/components/game/new-extensions';
import { readSetup, saveSetup } from './setup-preferences';
import {
  readAmbienceLevel,
  saveAmbienceLevel,
  useAmbience,
} from './use-ambience';
import { FestivalControls, useFestivalChoice } from '../game/yatai-festival';
import { TableHeading, gameName, worldTheme } from '../game/table-heading';
import { useAutoRoll, MoveConfirmation, UndoChoice } from './confirmation';
import { GameMenu } from './game-menu';
import { ArtworkLoading } from './artwork';
import { ScrollArea } from '../game/scroll-area';
import { SanctuaryBadges } from '@/components/game/mora-extension';
import {
  SetupBox,
  PlaceholderBox,
  StandaloneSetupBox,
} from '../game/setup-box';
import { StandaloneTable } from './standalone-table';
import {
  standaloneGames,
  standaloneIds,
  type AnyGame,
} from '@/lib/games/standalone/registry';
import { setOf } from '@/lib/games/party/vote';
import { FolioSetupBox } from './folio-box';
import { RelicSetupBox } from './relic-box';
import { ArenaSetupBox } from './arena/arena-box';
import { RotaSetupBox } from './rota/rota-box';
import type { RotaChoice } from './rota/rota-save';
import { AltoSetupEntry, type AltoChoice } from './alto/alto-entry';
import { DinerSetupBox } from './diner/diner-box';
import type { DinerChoice } from './diner/diner-entry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import {
  gameByLibraryId,
  realGames,
  standaloneLibraryGames,
  type LibraryGame,
} from '@/lib/games/library-fixtures';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
// The 3D battle and three.js load only when Arena opens.
const ArenaGame = lazy(() => import('./arena/arena-entry'));
// Rota's table, engine and bots load only when a match opens.
const RotaSolo = lazy(() => import('./rota/rota-solo'));
// Alto's table loads only when a match opens.
const AltoSolo = lazy(() => import('./alto/alto-game'));
// Diner's 3D room loads only when a shift opens.
const DinerSolo = process.env.NODE_ENV === 'development'
  ? lazy(() => import('./diner/diner-entry'))
  : null;

const isBotSeat = (seat: number) => seat > 0;
import { ArrowLeft, Volume2, VolumeX, RotateCcw, List, Trophy } from 'lucide-react';
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
import { SoundSettings } from './sound-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Library } from '@/components/game/library';
import { Board, Hand, Players } from '@/components/game/boards';
import { type Inspection } from '@/components/game/interactions';
import { Tutorial } from '@/components/game/tutorial';
import { DieControl } from '@/components/game/die';
import { Help } from '@/components/game/help';
import {
  catalog,
  createGame,
  play,
  validMove,
  canAct,
  isSavedGame,
  upgradeSave,
  scores,
  passCount,
  revealingTrick,
  seatRange,
  type Game,
  type GameId,
  type Card,
  type Move,
  type Difficulty,
} from '@/lib/games/trio/engine';
import { cue, eventCue } from '@/lib/games/trio/sound';
import { fallbackMove } from '@/lib/games/trio/bot';
import { practice } from '@/lib/games/adventures/lessons';
import { useBotTurns } from './bot-turns';
import { recordCompletedGame } from './play-experience';
const SAVE = 'gamehub.tables.v3';
/** Games outside the trio engine save separately, so one save shape per engine. */
const OWN_SAVE = 'gamehub.standalone.v1';
function seed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export default function SoloGame() {
  const [ownPractice,setOwnPractice]=useState<AnyGame|null>(null);
  const [g, setG] = useState<Game | null>(null),
    [saves, setSaves] = useState<Partial<Record<GameId, Game>>>({}),
    [setup, setSetup] = useState<GameId | null>(null),
    // /arena and /rota open the library with that game's box already open.
    [preview, setPreview] = useState<LibraryGame | null>(() =>
      typeof window !== 'undefined' &&
      (window.location.pathname === '/arena' || window.location.pathname === '/rota' || window.location.pathname === '/alto' || window.location.pathname === '/diner')
        ? (gameByLibraryId(window.location.pathname.slice(1)) ?? null)
        : null,
    ),
    [customerOrders, setCustomerOrders] = useState(false),
    [sanctuaryGoalsEnabled, setSanctuaryGoalsEnabled] = useState(false),
    [options, setOptions] = useState<
      import('@/lib/games/trio/engine').GameOptions
    >({}),
    [fastMode, setFastMode] = useState(false),
    [difficulty, setDifficulty] = useState<Difficulty>('medium'),
    [players, setPlayers] = useState(3),
    [volume, setVolume] = useState(defaultAudioLevel(0.5)),
    [ambience, setAmbience] = useState(defaultAudioLevel(0.6)),
    [panelOpen, setPanelOpen] = useState(false),
    [panel, rememberPanel] = useState<
      'rules' | 'reference' | 'log' | 'sound' | null
    >(null),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [inspectorOpen, setInspectorOpen] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [preparedZone, setPreparedZone] = useState<number | null>(null),
    [passed, setPassed] = useState<number[]>([]),
    [order, setOrder] = useState<number[]>([]),
    [notice, setNotice] = useState(''),
    [botError, setBotError] = useState(false),
    [retry, setRetry] = useState(0),
    [showResults, setShowResults] = useState(false),
    [capturesSettled, setCapturesSettled] = useState(-1),
    [own, setOwn] = useState<Partial<Record<StandaloneId, AnyGame>>>({}),
    [openOwn, setOpenOwn] = useState<StandaloneId | null>(null),
    [ownSetup, setOwnSetup] = useState<StandaloneId | null>(null),
    [ownSeats, setOwnSeats] = useState(3),
    [triviaMode, setTriviaMode] = useState<'quick' | 'tower' | 'expedition'>('quick'),
    [arena, setArena] = useState<
      (import('./arena/arena-entry').ArenaChoice & { key: number }) | null
    >(null),
    [rota, setRota] = useState<(RotaChoice & { key: number }) | null>(null),
    [alto, setAlto] = useState<(AltoChoice & { key: number }) | null>(null),
    [diner, setDiner] = useState<(DinerChoice & { key: number }) | null>(null);
  // Leaving a saved match asks once and says it is saved; practice simply leaves.
  const leaving = useLeaveDialog();
  function leaveOwn() {
    leaving.ask(() => { setOpenOwn(null); setOwnPractice(null); });
  }
  useEffect(() => {
    if (window.location.pathname === '/arena' || window.location.pathname === '/rota' || window.location.pathname === '/alto' || window.location.pathname === '/diner')
      history.replaceState(history.state, '', '/');
  }, []);
  const festival = useFestivalChoice(g, 0);
  const motionRoot = useRef<HTMLElement>(null);
  useGameMotion(motionRoot, g ? `${g.id}:${g.round}:${g.phase}` : 'library');
  useGameSound(arena ? 'arena' : (openOwn ?? g?.id), volume);
  function setPanel(value: typeof panel) {
    if (value) rememberPanel(value);
    setPanelOpen(!!value);
  }
  const current = useRef<Game | null>(null),
    ownRef = useRef<Partial<Record<StandaloneId, AnyGame>>>({}),
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
      for (const c of catalog) {
        const saved = upgradeSave(raw[c.id]);
        if (isSavedGame(saved) && !saved.tutorial && saved.id === c.id)
          restored[c.id] = saved;
      }
      localStorage.setItem(SAVE, JSON.stringify(restored));
      saveRef.current = restored;
      setSaves(restored);
      const rawOwn = JSON.parse(
        localStorage.getItem(OWN_SAVE) || '{}',
      ) as Record<string, unknown>;
      const ownRestored: Partial<Record<StandaloneId, AnyGame>> = {};
      for (const id of standaloneIds) {
        const saved = rawOwn[id];
        if (
          standaloneGames[id].isSavedGame(saved) &&
          !saved.tutorial &&
          (saved.kind === id ||
            (!!saved.tribu && (id === 'orin' || id === 'miro') && setOf(saved.kind) === id))
        )
          ownRestored[id] = saved;
      }
      localStorage.setItem(OWN_SAVE, JSON.stringify(ownRestored));
      ownRef.current = ownRestored;
      setOwn(ownRestored);
      setVolume(readAudioLevel());
      setAmbience(readAmbienceLevel());
      if (catalog.some((game) => raw[game.id] && !restored[game.id]))
        setNotice(
          'The rules have changed. Start a new match; your settings are still saved.',
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
    if(next.tutorial)return;
    if (next.phase === 'over' && saveRef.current[next.id]?.phase !== 'over')
      recordCompletedGame(catalog.find((entry) => entry.id === next.id)!.name);
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
  function storeOwn(next: AnyGame) {
    if(next.tutorial){setOwnPractice(next);return;}
    setOwnPractice(null);
    // A set keeps one save under its library id whichever game it is playing.
    const id = next.tribu ? setOf(next.kind) : next.kind;
    if (next.over && !ownRef.current[id]?.over)
      recordCompletedGame(standaloneGames[id].name);
    ownRef.current = { ...ownRef.current, [id]: next };
    setOwn(ownRef.current);
    try {
      localStorage.setItem(OWN_SAVE, JSON.stringify(ownRef.current));
    } catch {
      setNotice(
        'Local saving is unavailable. Keep this tab open to keep your match.',
      );
    }
  }
  function openOwnSetup(id: StandaloneId) {
    const entry = standaloneGames[id];
    const saved = own[id];
    setOwnSeats(
      saved && entry.seatChoices.includes(saved.seats.length)
        ? saved.seats.length
        : entry.defaultSeats,
    );
    if (saved) setDifficulty(saved.difficulty);
    setTriviaMode(saved?.tribu?.trivia?.mode ?? 'quick');
    setOwnSetup(id);
  }
  function startOwn(id: StandaloneId, learning=false) {
    if (requiresHumanPlayers(id)) return;
    storeOwn(learning?practice(id,ownSeats,difficulty,0):standaloneGames[id].create(ownSeats, seed(), difficulty, undefined, undefined, undefined, false, id === 'miro' ? triviaMode : undefined));
    setOwnSetup(null);
    setOpenOwn(id);
    cue('shuffle', volume, 0, id);
  }

  function progress(_action: string, next: Game) { return next; }
  function advanceTutorial() {
    const game=current.current;if(!game?.tutorial||game.phase==='over')return;
    const actor=game.players.findIndex((_,i)=>i!==0&&canAct(game,i));
    if(actor>=0)commit(fallbackMove(game,actor),actor);
    else if(canAct(game,0)&&game.phase==='roll')commit({type:'roll'});
  }
  const nature = useNatureChoice(g, 0);
  const display = g ? previewPlacement(g, 0, g.pending?.[0] ?? undefined) : null;
  // Both Mora worlds (Observatory and Floodline Station) share the paper-table environment.
  const observatory = g?.id === 'wildgrove';
  // Full-table worlds float their controls over one environment plate.
  const environment = observatory
    ? 'observatory'
    : g?.id === 'undertow'
      ? 'cabin'
      : g?.id === 'midnight'
        ? 'market'
        : undefined;
  const world = environment !== undefined;
  // The world's soundscape runs while a table is open, and stops on the shelf.
  // Effects and ambience are switched on and off separately.
  // Arena plays its own battle music at the ambience level instead.
  useAmbience(
    arena ? null : (openOwn ?? (g && !showResults ? g.id : null)),
    1,
    ambience,
    g?.contentSet,
  );

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
    if (actor === 0) m = nature.withChoice(festival.withChoice(m));
    if (!game || !validMove(game, m, actor)) return;
    if (actor === 0 && m.type === 'play') cue('place', vol.current, 0, game.id);
    let next = play(game, m, actor);
    const action =
      m.type === 'pass'
        ? 'pass'
        : m.type === 'roll'
          ? 'roll'
          : game.id === 'wildgrove'
            ? 'place'
            : 'play';
    if (actor === 0) next = progress(action, next);
    for (const e of next.events.filter((e) => e.id >= (game.revision + 1) * 10 && !(e.type === 'play' && e.player === 0)))
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
    }
  }
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    if (setup)
      saveSetup(setup, {
        players,
        difficulty,
        fastMode,
        customerOrders,
        sanctuaryGoalsEnabled,
        options,
      });
  }, [
    setup,
    players,
    difficulty,
    fastMode,
    customerOrders,
    sanctuaryGoalsEnabled,
    options,
  ]);
  function openSetup(id: GameId) {
    const saved = readSetup(id);
    const [fewest, most] = seatRange(id, saved.fastMode);
    setPlayers(Math.min(most, Math.max(fewest, saved.players)));
    setDifficulty(saved.difficulty);
    setFastMode(saved.fastMode);
    setCustomerOrders(saved.customerOrders);
    setSanctuaryGoalsEnabled(saved.sanctuaryGoalsEnabled);
    setOptions(saved.options);
    setSetup(id);
  }
  function start(id: GameId, tutorial = false) {
    const fast =
      setup === id ? fastMode : g?.id === id ? (g.fastMode ?? false) : false;
    const [fewest, most] = seatRange(id, fast);
    const next = createGame(
      id,
      difficulty,
      seed(),
      tutorial,
      Math.min(most, Math.max(fewest, players)),
      false,
      fast,
      setup === id
        ? customerOrders
        : g?.id === id
          ? (g.customerOrders ?? false)
          : false,
      setup === id
        ? sanctuaryGoalsEnabled
        : g?.id === id
          ? (g.sanctuaryGoalsEnabled ?? false)
          : false,
      setup === id ? options : (g ?? {}),
    );
    store(next);
    setSetup(null);
    setPanel(null);
    setOrder([]);
    setPassed([]);

    setSelected(null);
    setPreparedZone(null);
    setBotError(false);
    setShowResults(false);
    setCapturesSettled(-1);
    cue('shuffle', volume, 0, id);
  }
  function resume(game: Game) {
    store(game);
    setSetup(null);
    setOrder([]);
    setPassed([]);
    setSelected(null);
    setPreparedZone(null);

    setBotError(false);
    setShowResults(false);
    setCapturesSettled(-1);
  }
  function home() {
    setG(null);
    current.current = null;
    setPanel(null);
    setBotError(false);
  }
  function exitTable() {
    const game = current.current;
    if (!game || game.tutorial || game.phase === 'over') home();
    else leaving.ask(home);
  }
  useBoardLeave(!!(g || openOwn || arena || diner), (allow) => {
    if (diner) {
      window.dispatchEvent(new CustomEvent('diner-request-leave', { detail: { allow } }));
    } else if (arena) {
      if (window.confirm('Leave the battle? It ends when you leave.')) setArena(null);
    } else if (openOwn) leaveOwn(); else exitTable();
  });
  useEffect(() => {
    if (g?.phase !== 'over' || g.tutorial) return;
    // The last capture must finish even when several trick events were queued.
    if (g.id === 'undertow' && capturesSettled < (g.events.at(-1)?.id ?? -1))
      return;
    const timer = setTimeout(() => setShowResults(true), 120);
    return () => clearTimeout(timer);
  }, [g?.phase, g?.id, g?.events, g?.tutorial, capturesSettled]);
  useBotTurns({
    game: g,
    active:
      !g?.tutorial &&
      !leaving.open &&
      !inspectorOpen &&
      // Bots wait until the table has finished showing the completed trick.
      !(g && revealingTrick(g) && capturesSettled < (g.events.findLast((e) => e.type === 'trick')?.id ?? -1)),
    isBot: isBotSeat,
    commit: (move, seat) => commitRef.current(move, seat),
    nonce: retry,
  });
  useAutoRoll(!!g && !g.tutorial && g.phase === 'roll' && canAct(g, 0), () => {
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
    if (!canAct(g, 0) || g.phase !== 'play') return;
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
    };
    if (validMove(g, festival.withChoice(move), 0)) commit(move);
    else setSelected((previous) => (previous === c.id ? null : c.id));
  }
  function place(zone: number) {
    if (!g) return;
    if (selected === null || g.phase === 'over') return;
    if (canAct(g, 0) && g.phase === 'play') {
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
      cue('drop', volume, 0, g.id);
      return;
    }
    const elements = document.elementsFromPoint(x, y),
      target =
        (elements.find(
          (e) => e instanceof HTMLElement && e.dataset.drop === 'hand',
        ) as HTMLElement | undefined) ??
        dropTargetNear(
          x,
          y,
          document
            .querySelector('.hand [data-card-id]')
            ?.getBoundingClientRect().width ?? 64,
        ) ??
        undefined,
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
      cue('drop', volume, 0, g.id);
      return;
    }
    if (g.phase === 'over') return;
    if (!canAct(g, 0) || g.phase === 'roll') {
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
        });
    else cue('drop', volume, 0, g.id);
  }
  function ambienceChange(value: number) {
    setAmbience(value);
    saveAmbienceLevel(value);
  }
  function volumeChange(value: number) {
    setVolume(value);
    saveAudioLevel(value);
  }
  const soundSettings = (
    <SoundSettings
      volume={volume}
      ambience={ambience}
      onVolume={volumeChange}
      onAmbience={ambienceChange}
    />
  );
  const meta = catalog.find((c) => c.id === g?.id),
    sc = g ? scores(g) : [],
    bestScore = g?.id === 'undertow' ? Math.min(...sc) : Math.max(...sc),
    winners = g?.players.filter((_, i) => sc[i] === bestScore) ?? [];
  useResultsFeedback(
    g?.id ?? '',
    g?.phase === 'over',
    showResults && !openOwn,
    volume,
  );
  if (arena)
    return (
      <div className="app at-table arena">
        <Suspense
          fallback={
            <main className="startup-loading" aria-busy="true">
              Arena
            </main>
          }
        >
          <ArenaGame
            key={arena.key}
            choice={arena}
            volume={volume}
            music={ambience}
            onExit={() => setArena(null)}
            sound={soundSettings}
          />
        </Suspense>
      </div>
    );
  if (rota)
    return (
      <div className="app at-table rota">
        <Suspense
          fallback={
            <main className="startup-loading" aria-busy="true">
              Rota
            </main>
          }
        >
          <RotaSolo key={rota.key} choice={rota} onExit={() => setRota(null)} />
        </Suspense>
      </div>
    );
  if (diner && DinerSolo)
    return (
      <div className="app at-table diner">
        <Suspense
          fallback={
            <main className="startup-loading" aria-busy="true">
              Diner
            </main>
          }
        >
          <DinerSolo
            key={diner.key}
            choice={diner}
            volume={volume}
            music={ambience}
            sound={soundSettings}
            onExit={() => setDiner(null)}
          />
        </Suspense>
      </div>
    );
  if (alto)
    return (
      <Suspense
        fallback={
          <main className="startup-loading" aria-busy="true">
            Alto
          </main>
        }
      >
        <AltoSolo
          key={alto.key}
          initial={alto.game}
          setup={alto.setup}
          volume={volume}
          sound={soundSettings}
          onExit={() => setAlto(null)}
        />
      </Suspense>
    );
  const ownGame = openOwn ? (ownPractice && (ownPractice.tribu ? setOf(ownPractice.kind) : ownPractice.kind)===openOwn?ownPractice:own[openOwn]) : undefined;
  if (openOwn && ownGame && !requiresHumanPlayers(openOwn))
    return (
      <div className={`app at-table ${openOwn}`}>
        <StandaloneTable
          g={ownGame}
          volume={volume}
          onChange={storeOwn}
          onHome={leaveOwn}
          onNew={() => startOwn(openOwn)}
          sound={soundSettings}
        />
        <LeaveDialog state={leaving} title="Leave the table?" saved="Your game is saved on this device." />
      </div>
    );
  return (
    <div className={`app ${g ? 'at-table' : ''} ${g?.id ?? ''}`}>
      {g && (
        <header className="app-header">
          <button
            className="brand"
            onClick={() => (g ? exitTable() : undefined)}
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
      )}
      {!g ? (
        <Library
          volume={volume}
          ambience={ambience}
          onSetup={openSetup}
          onStandalone={openOwnSetup}
          onOpenPlaceholder={setPreview}
          onSound={() => setPanel('sound')}
          onVolume={volumeChange}
          onAmbience={ambienceChange}
        />
      ) : (
        <main
          ref={motionRoot}
          className={`table-layout ${world ? 'world-table' : ''}`}
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
            <button
              className="table-back"
              aria-label="Back to games"
              onClick={exitTable}
            >
              <ArrowLeft size={17} />
              <span>{world ? gameName(g) : 'Games'}</span>
            </button>
            {!world && <TableHeading g={g} />}
            <GameProgress round label={`Round ${g.round} / ${totalRounds(g)}`} />
            <div className="table-toolbar-actions">
              <div className="table-others-slot" />
              <GameMenu
                name={meta?.name ?? gameName(g) ?? ''}
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
                sound={soundSettings}
                onLeave={exitTable}
                leaveLabel={g.tutorial ? 'Leave' : 'Save and leave'}
              />
            </div>
          </div>
          <div className="table-columns">
            <section className="play-area">
              <div className="table-players">
                <Players
                  g={display ?? g}
                  viewer={0}
                  volume={volume}
                  turnSound={false}
                  inspect={inspect}
                  boardButton

                />
              </div>
              {g.id === 'wildgrove' && g.sanctuaryGoalsEnabled && (
                <div className="observatory-achievements">
                  <span className="achievements-heading">Sanctuary goals</span>
                  <SanctuaryBadges
                    zones={(display ?? g).players[0].zones}
                    goals={g.sanctuaryGoals}
                    contentSet={g.contentSet}
                    inspect={inspect}
                  />
                </div>
              )}
              <ScrollArea className="board-viewport" fitBoard={g.id}>
                <Board
                  onCapturesSettled={setCapturesSettled}
                  natureChoice={g.ready?.[0] ? {} : nature.choice}
                  g={display ?? g}
                  selected={selected}
                  inspect={inspect}
                  onPlace={place}
                  preparedZone={preparedZone}
                />
              </ScrollArea>

              <div className="hand-controls" data-game-motion="stage">
                <div className="hand-abilities">
                  {g.id !== 'midnight' && <DieControl g={g} viewer={0} />}
                  <ExtensionControls
                    key={`${g.round}:${g.pick}:${g.phase}`}
                    g={display ?? g}
                    viewer={0}
                    choice={nature.choice}
                    onChange={nature.setChoice}
                    inspect={inspect}
                  />
                  <FestivalControls
                    g={display ?? g}
                    viewer={0}
                    choice={festival.choice}
                    onChange={festival.setChoice}
                    inspect={inspect}
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
          <UndoChoice g={g} viewer={0}
            drafted={selected !== null || passed.length > 0 || !!nature.choice.roam}

            onUndo={() => { commit({ type: 'undo' }); nature.setChoice({}); }}
            onClear={() => { setSelected(null); setPreparedZone(null); setPassed([]); nature.setChoice({}); }} />
              <MoveConfirmation
                g={g}
                viewer={0}
                passed={passed}
                onConfirm={commit}
                onClear={() => {
                  setSelected(null);
                  setPreparedZone(null);
                  setPassed([]);
                }}
              />
              <Hand
                g={display ?? g}
                order={order}
                selected={selected}
                passed={passed}
                inspect={inspect}
                onTap={tap}
                onDrop={drop}
                onDragSelect={setSelected}
                onLift={() => {
                  cue('pickup', volume, 0, g.id);
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
                  data-game-motion="result"
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
              onSkip={() => start(g.id, false)}
              onStep={(step) => store({...g,lesson:step})}
              onAdvance={advanceTutorial}
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
        open={!!setup || !!preview || !!ownSetup}
        onOpenChange={(open) => {
          if (!open) {
            setSetup(null);
            setPreview(null);
            setOwnSetup(null);
          }
        }}
      >
        <DialogContent className="modal setup-modal">
          {ownSetup ? (
            <StandaloneSetupBox
              game={standaloneLibraryGames[ownSetup]}
              save={own[ownSetup]}
              seats={ownSeats}
              difficulty={difficulty}
              onSeats={setOwnSeats}
              triviaMode={triviaMode}
              onTriviaMode={setTriviaMode}
              onDifficulty={setDifficulty}
              onPlay={() => startOwn(ownSetup)}
              onLearn={() => startOwn(ownSetup,true)}
              onResume={(match) => {
                setOwnSetup(null);
                // A set saves under its library id whichever game it is on.
                setOpenOwn(match.tribu ? setOf(match.kind) : match.kind);
              }}
            />
          ) : setup ? (
            <SetupBox
              game={realGames[setup]}
              save={saves[setup]}
              players={players}
              difficulty={difficulty}
              fastMode={fastMode}
              options={options}
              customerOrders={customerOrders}
              sanctuaryGoalsEnabled={sanctuaryGoalsEnabled}
              onPlayers={setPlayers}
              onDifficulty={setDifficulty}
              onFastMode={(on) => {
                setFastMode(on);
                // The Fast deck deals four hands at most.
                if (setup) setPlayers((n) => Math.min(n, seatRange(setup, on)[1]));
              }}
              onOptions={setOptions}
              onExtensions={(value) => {
                if (value.customerOrders !== undefined)
                  setCustomerOrders(value.customerOrders);
                if (value.sanctuaryGoalsEnabled !== undefined)
                  setSanctuaryGoalsEnabled(value.sanctuaryGoalsEnabled);
                setOptions((previous) => ({ ...previous, ...value }));
              }}
              onLearn={() => start(setup, true)}
              onPlay={() => start(setup)}
              onResume={resume}
            />
          ) : preview?.id === 'folio' ? (
            <FolioSetupBox game={preview} />
          ) : preview?.id === 'relic' ? (
            <RelicSetupBox game={preview} />
          ) : preview?.id === 'arena' ? (
            <ArenaSetupBox
              game={preview}
              onPlay={(choice) => {
                setPreview(null);
                setArena({ ...choice, key: Date.now() });
              }}
            />
          ) : process.env.NODE_ENV === 'development' && preview?.id === 'diner' ? (
            <DinerSetupBox
              game={preview}
              onPlay={(choice) => {
                setPreview(null);
                setDiner({ ...choice, key: Date.now() });
              }}
            />
          ) : preview?.id === 'alto' ? (
            <AltoSetupEntry
              game={preview}
              onPlay={(choice) => {
                setPreview(null);
                setAlto({ ...choice, key: Date.now() });
              }}
            />
          ) : preview?.id === 'rota' ? (
            <RotaSetupBox
              game={preview}
              onPlay={(choice) => {
                setPreview(null);
                setRota({ ...choice, key: Date.now() });
              }}
            />
          ) : preview ? (
            <PlaceholderBox game={preview} />
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={panelOpen}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        {/* From the library it is a menu dialog and follows the menu theme. */}
        <DialogContent className={`modal help-modal ${g ? '' : 'menu-modal'}`}>
          <DialogTitle>
            {panel === 'rules'
              ? 'How to play'
              : panel === 'reference'
                ? 'Card and piece counts'
                : panel === 'log'
                  ? 'Scores & activity'
                  : 'Sound'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'sound'
              ? 'Applies to every game on this device.'
              : meta?.name}
          </DialogDescription>
          {panel === 'sound' ? (
            <SoundSettings
              volume={volume}
              ambience={ambience}
              onVolume={volumeChange}
              onAmbience={ambienceChange}
            />
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
          <DialogContent
            className={`modal inspector ${inspection?.wide ? 'inspector-wide' : ''}`}
          >
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
        <DialogContent className="modal results results-surface">
          <WinnerCelebration
            won={viewerWon(0, winningSeats(sc, g?.id === 'undertow'))}
          />
          <DialogTitle>
            {winners.length > 1 ? 'Shared victory' : `${winners[0]?.name} wins`}
          </DialogTitle>
          <DialogDescription>
            {bestScore} {g?.id === 'undertow' ? 'penalty points' : 'points'}
          </DialogDescription>
          {g?.players.map((p, i) => (
            <div className="score-row reveal-rise" style={stagger(i, 0, 70)} key={p.name}>
              <span>{p.name}</span>
              <b><CountUp value={sc[i]} duration={600} delay={i * 70} /></b>
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
      <LeaveDialog
        state={leaving}
        title="Leave the table?"
        saved="Your match is saved on this device."
        theme={g ? worldTheme(g.id) : undefined}
      />
    </div>
  );
}
