'use client';
import { dropTargetNear } from './drag-preview';
import { FullscreenControl, useFullscreen } from './fullscreen-control';
import {
  ExtensionControls,
  useNatureChoice,
} from '@/components/game/new-extensions';
import { useAdvancedView } from '@/components/game/advanced-view';
import { readSetup, saveSetup } from './setup-preferences';
import {
  readAmbienceLevel,
  saveAmbienceLevel,
  useAmbience,
} from './use-ambience';
import { ExtensionAction } from './extension-action';
import { FestivalControls, useFestivalChoice } from '../game/yatai-festival';
import { TableHeading, TableProgress, gameName } from '../game/table-heading';
import {
  useAutoRoll,
  MoveConfirmation,
  UndoChoice,
  useMoveConfirmation,
} from './confirmation';
import { TableMenu } from '../game/table-menu';
import { ArtworkLoading } from './artwork';
import { ScrollArea } from '../game/scroll-area';
import { SanctuaryBadges } from '@/components/game/mora-extension';
import {
  SetupBox,
  PlaceholderBox,
  StandaloneSetupBox,
  WorldSetupBox,
} from '../game/setup-box';
import { StandaloneTable } from './standalone-table';
import { WorldTable } from './world-table';
import {
  worldGames,
  worldIds,
  type WorldGame,
} from '@/lib/games/worlds/registry';
import type { WorldId } from '@/lib/games/worlds/types';
import {
  standaloneGames,
  standaloneIds,
  type AnyGame,
} from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import {
  realGames,
  standaloneLibraryGames,
  worldLibraryGames,
  type LibraryGame,
} from '@/lib/games/library-fixtures';
import { useEffect, useRef, useState } from 'react';

const isBotSeat = (seat: number) => seat > 0;
import { ArrowLeft, Volume2, VolumeX, RotateCcw } from 'lucide-react';
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
import { Slider } from '@/components/ui/slider';
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
  scores,
  passCount,
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
const SAVE = 'gamehub.tables.v3';
/** Games outside the trio engine save separately, so one save shape per engine. */
const OWN_SAVE = 'gamehub.standalone.v1';
/** The illustrated worlds save separately again: one save shape per engine, so
 * a rule change in one family never invalidates another family's matches. */
const WORLD_SAVE = 'gamehub.worlds.v1';
function seed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
export default function SoloGame() {
  const [ownPractice,setOwnPractice]=useState<AnyGame|null>(null);
  const [g, setG] = useState<Game | null>(null),
    [saves, setSaves] = useState<Partial<Record<GameId, Game>>>({}),
    [setup, setSetup] = useState<GameId | null>(null),
    [preview, setPreview] = useState<LibraryGame | null>(null),
    [shields, setShields] = useState(false),
    [customerOrders, setCustomerOrders] = useState(false),
    [sanctuaryGoalsEnabled, setSanctuaryGoalsEnabled] = useState(false),
    [options, setOptions] = useState<
      import('@/lib/games/trio/engine').GameOptions
    >({}),
    [fastMode, setFastMode] = useState(false),
    [difficulty, setDifficulty] = useState<Difficulty>('medium'),
    [players, setPlayers] = useState(3),
    [volume, setVolume] = useState(0.5),
    [ambience, setAmbience] = useState(0.6),
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
    [notice, setNotice] = useState(''),
    [botError, setBotError] = useState(false),
    [retry, setRetry] = useState(0),
    [showResults, setShowResults] = useState(false),
    [capturesSettled, setCapturesSettled] = useState(-1),
    [own, setOwn] = useState<Partial<Record<StandaloneId, AnyGame>>>({}),
    [openOwn, setOpenOwn] = useState<StandaloneId | null>(null),
    [ownSetup, setOwnSetup] = useState<StandaloneId | null>(null),
    [ownSeats, setOwnSeats] = useState(3),
    [worlds, setWorlds] = useState<Partial<Record<WorldId, WorldGame>>>({}),
    [openWorld, setOpenWorld] = useState<WorldId | null>(null),
    [worldSetup, setWorldSetup] = useState<WorldId | null>(null),
    [worldSeats, setWorldSeats] = useState(2);
  const [ownMode, setOwnMode] = useState<'teams' | 'individual'>('individual');
  const festival = useFestivalChoice(g, 0);
  function setPanel(value: typeof panel) {
    if (value) rememberPanel(value);
    setPanelOpen(!!value);
  }
  const current = useRef<Game | null>(null),
    ownRef = useRef<Partial<Record<StandaloneId, AnyGame>>>({}),
    worldRef = useRef<Partial<Record<WorldId, WorldGame>>>({}),
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
        if (isSavedGame(raw[c.id]) && !(raw[c.id] as Game).tutorial && (raw[c.id] as Game).id === c.id)
          restored[c.id] = raw[c.id] as Game;
      localStorage.setItem(SAVE, JSON.stringify(restored));
      saveRef.current = restored;
      setSaves(restored);
      const rawOwn = JSON.parse(
        localStorage.getItem(OWN_SAVE) || '{}',
      ) as Record<string, unknown>;
      const ownRestored: Partial<Record<StandaloneId, AnyGame>> = {};
      for (const id of standaloneIds) {
        const saved = rawOwn[id];
        if (standaloneGames[id].isSavedGame(saved) && !saved.tutorial && saved.kind === id)
          ownRestored[id] = saved;
      }
      localStorage.setItem(OWN_SAVE, JSON.stringify(ownRestored));
      ownRef.current = ownRestored;
      setOwn(ownRestored);
      const rawWorlds = JSON.parse(
        localStorage.getItem(WORLD_SAVE) || '{}',
      ) as Record<string, unknown>;
      const worldRestored: Partial<Record<WorldId, WorldGame>> = {};
      for (const id of worldIds) {
        const saved = rawWorlds[id];
        if (worldGames[id].isSavedGame(saved) && saved.kind === id)
          worldRestored[id] = saved;
      }
      localStorage.setItem(WORLD_SAVE, JSON.stringify(worldRestored));
      worldRef.current = worldRestored;
      setWorlds(worldRestored);
      const v = Number(localStorage.getItem('gamehub.volume.v3') ?? '.5');
      setVolume(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
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
    ownRef.current = { ...ownRef.current, [next.kind]: next };
    setOwn(ownRef.current);
    try {
      localStorage.setItem(OWN_SAVE, JSON.stringify(ownRef.current));
    } catch {
      setNotice(
        'Local saving is unavailable. Keep this tab open to keep your match.',
      );
    }
  }
  function storeWorld(next: WorldGame) {
    worldRef.current = { ...worldRef.current, [next.kind]: next };
    setWorlds(worldRef.current);
    try {
      localStorage.setItem(WORLD_SAVE, JSON.stringify(worldRef.current));
    } catch {
      setNotice(
        'Local saving is unavailable. Keep this tab open to keep your match.',
      );
    }
  }
  function openWorldSetup(id: WorldId) {
    const entry = worldGames[id];
    const saved = worlds[id];
    setWorldSeats(
      saved && entry.seatChoices.includes(saved.seats.length)
        ? saved.seats.length
        : entry.defaultSeats,
    );
    if (saved) setDifficulty(saved.difficulty);
    setWorldSetup(id);
  }
  function startWorld(id: WorldId) {
    storeWorld(worldGames[id].create(worldSeats, seed(), difficulty));
    setWorldSetup(null);
    setOpenWorld(id);
    cue('shuffle', volume);
  }
  function openOwnSetup(id: StandaloneId) {
    const entry = standaloneGames[id];
    const saved = own[id];
    setOwnSeats(
      saved && entry.seatChoices.includes(saved.seats.length)
        ? saved.seats.length
        : entry.defaultSeats,
    );
    setOwnMode(saved ? saved.mode : 'individual');
    if (saved) setDifficulty(saved.difficulty);
    setOwnSetup(id);
  }
  function startOwn(id: StandaloneId, learning=false) {
    storeOwn(learning?practice(id,ownSeats,difficulty,0,ownMode):standaloneGames[id].create(ownSeats, seed(), difficulty, ownMode));
    setOwnSetup(null);
    setOpenOwn(id);
    cue('shuffle', volume);
  }

  function progress(_action: string, next: Game) { return next; }
  function advanceTutorial() {
    const game=current.current;if(!game?.tutorial||game.phase==='over')return;
    const actor=game.players.findIndex((_,i)=>i!==0&&canAct(game,i));
    if(actor>=0)commit(fallbackMove(game,actor),actor);
    else if(canAct(game,0)&&game.phase==='roll')commit({type:'roll'});
  }
  const nature = useNatureChoice(g, 0);
  const [advanced, setAdvanced] = useAdvancedView(g?.id);
  const fullscreen = useFullscreen();
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
  useAmbience(openOwn ?? (g && !showResults ? g.id : null), volume, ambience, g?.contentSet);
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
    if (actor === 0) m = nature.withChoice(festival.withChoice(m));
    if (!game || !validMove(game, m, actor)) return;
    let next = play(game, m, actor);
    const action =
      m.type === 'pass'
        ? 'pass'
        : m.type === 'roll'
          ? 'roll'
          : game.id === 'wildgrove'
            ? 'place'
            : m.type === 'play' && m.ward
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
        shields,
        fastMode,
        customerOrders,
        sanctuaryGoalsEnabled,
        options,
      });
  }, [
    setup,
    players,
    difficulty,
    shields,
    fastMode,
    customerOrders,
    sanctuaryGoalsEnabled,
    options,
  ]);
  function openSetup(id: GameId) {
    const saved = readSetup(id);
    setPlayers(saved.players);
    setDifficulty(saved.difficulty);
    setShields(saved.shields);
    setFastMode(saved.fastMode);
    setCustomerOrders(saved.customerOrders);
    setSanctuaryGoalsEnabled(saved.sanctuaryGoalsEnabled);
    setOptions(saved.options);
    setSetup(id);
  }
  function start(id: GameId, tutorial = false) {
    const next = createGame(
      id,
      difficulty,
      seed(),
      tutorial,
      players,
      setup === id ? shields : g?.id === id ? (g.shields ?? false) : false,
      setup === id ? fastMode : g?.id === id ? (g.fastMode ?? false) : false,
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
    setWard(false);

    setSelected(null);
    setPreparedZone(null);
    setBotError(false);
    setShowResults(false);
    setCapturesSettled(-1);
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
    active: !g?.tutorial && !(panelOpen && panel === 'leave') && !inspectorOpen,
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
      ...(ward ? { ward: true } : {}),
    };
    if (!confirmMoves && validMove(g, festival.withChoice(move), 0))
      commit(move);
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
      });
    else cue('drop', volume);
  }
  function ambienceChange(v: number | readonly number[]) {
    const value = Array.isArray(v) ? v[0] : (v as number);
    setAmbience(value);
    saveAmbienceLevel(value);
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
    sc = g ? scores(g) : [],
    bestScore = g?.id === 'undertow' ? Math.min(...sc) : Math.max(...sc),
    winners = g?.players.filter((_, i) => sc[i] === bestScore) ?? [];
  const worldGame = openWorld ? worlds[openWorld] : undefined;
  if (openWorld && worldGame)
    return (
      <div className={`app at-table ${openWorld}`}>
        <WorldTable
          g={worldGame}
          volume={volume}
          onChange={storeWorld}
          onHome={() => setOpenWorld(null)}
          onNew={() => startWorld(openWorld)}
          onSound={() => setPanel('sound')}
        />
        <Dialog
          open={panelOpen && panel === 'sound'}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        >
          <DialogContent className="modal help-modal">
            <DialogTitle>Sound</DialogTitle>
            <DialogDescription>
              Volume applies to all games. Ambience is the world around the
              table.
            </DialogDescription>
            <div className="sound-settings">
              <Slider
                value={[volume]}
                onValueChange={volumeChange}
                min={0}
                max={1}
                step={0.05}
                aria-label="Sound volume"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  const ownGame = openOwn ? (ownPractice?.kind===openOwn?ownPractice:own[openOwn]) : undefined;
  if (openOwn && ownGame)
    return (
      <div className={`app at-table ${openOwn}`}>
        <StandaloneTable
          g={ownGame}
          volume={volume}
          onChange={storeOwn}
          onHome={() => {setOpenOwn(null);setOwnPractice(null);}}
          onNew={() => startOwn(openOwn)}
          onSound={() => setPanel('sound')}
        />
        <Dialog
          open={panelOpen && panel === 'sound'}
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
        >
          <DialogContent className="modal help-modal">
            <DialogTitle>Sound</DialogTitle>
            <DialogDescription>
              Volume applies to all games. Ambience is the world around the
              table.
            </DialogDescription>
            <div className="sound-settings">
              <Slider
                value={[volume]}
                onValueChange={volumeChange}
                min={0}
                max={1}
                step={0.05}
                aria-label="Sound volume"
              />
              <div className="ambience-setting">
                <span>Ambience</span>
                <Slider
                  value={[ambience]}
                  onValueChange={ambienceChange}
                  min={0}
                  max={1}
                  step={0.05}
                  aria-label="Ambience level"
                />
              </div>
              <button
                className="secondary"
                onClick={() => volumeChange(volume ? 0 : 0.5)}
              >
                {volume ? 'Mute' : 'Unmute'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  return (
    <div className={`app ${g ? 'at-table' : ''} ${g?.id ?? ''}`}>
      {g && (
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
      )}
      {!g ? (
        <Library
          saves={saves}
          own={own}
          volume={volume}
          onSetup={openSetup}
          worlds={worlds}
          onStandalone={openOwnSetup}
          onWorld={openWorldSetup}
          onOpenPlaceholder={setPreview}
          onSound={() => setPanel('sound')}
        />
      ) : (
        <main
          className={`table-layout ${world ? 'world-table' : ''}`}
          data-game={g.id}
          data-environment={environment}
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
              onClick={() => setPanel('leave')}
            >
              <ArrowLeft size={17} />
              <span>{world ? gameName(g) : 'Games'}</span>
            </button>
            {!world && <TableHeading g={g} />}
            {g.id === 'undertow' && <TableProgress g={g} roundOnly />}
            <div className="table-toolbar-actions">
              <div className="table-others-slot" />
              {!world && <FullscreenControl />}
              <TableMenu
                fullscreen={world ? fullscreen : undefined}
                advanced={advanced}
                onAdvanced={
                  g.id !== 'undertow' && !observatory ? setAdvanced : undefined
                }
                confirmMoves={confirmMoves}
                onConfirmMoves={setConfirmMoves}
                onRules={() => setPanel('rules')}
                onCounts={() => setPanel('reference')}
                onScores={() => setPanel('log')}
                onSound={() => setPanel('sound')}
              />
            </div>
          </div>
          <div className="table-columns">
            <section className="play-area">
              <div className="table-players">
                <Players
                  g={g}
                  viewer={0}
                  volume={volume}
                  inspect={inspect}
                  advanced={advanced}
                  boardButton
                  progress={<TableProgress g={g} roundOnly />}
                />
              </div>
              {g.id === 'wildgrove' && g.sanctuaryGoalsEnabled && (
                <div className="observatory-achievements">
                  <span className="achievements-heading">Sanctuary goals</span>
                  <SanctuaryBadges
                    zones={g.players[0].zones}
                    goals={g.sanctuaryGoals}
                    contentSet={g.contentSet}
                    inspect={inspect}
                  />
                </div>
              )}
              <ScrollArea className="board-viewport" fitBoard={g.id}>
                <Board
                  onCapturesSettled={setCapturesSettled}
                  natureChoice={nature.choice}
                  g={g}
                  selected={selected}
                  inspect={inspect}
                  onPlace={place}
                  preparedZone={preparedZone}
                  onMigrate={(migration) =>
                    nature.setChoice({ ...nature.choice, migration })
                  }
                />
              </ScrollArea>

              <div className="hand-controls">
                <div className="hand-abilities">
                  {g.id !== 'midnight' && <DieControl g={g} viewer={0} />}
                  <ExtensionControls
                    key={`${g.round}:${g.pick}:${g.phase}`}
                    g={g}
                    viewer={0}
                    choice={nature.choice}
                    onChange={nature.setChoice}
                    inspect={inspect}
                  />
                  <FestivalControls
                    g={g}
                    viewer={0}
                    choice={festival.choice}
                    onChange={festival.setChoice}
                    inspect={inspect}
                  />
                  {g.id === 'undertow' && g.shields && (
                    <div data-coach="ward">
                      <ExtensionAction
                        kind="shield"
                        label="Shield"
                        description="Halve ordinary trick penalties"
                        selected={ward}
                        count={g.players[0].wards}
                        disabled={
                          g.phase !== 'play' ||
                          !canAct(g, 0) ||
                          !g.players[0].wards
                        }
                        onTap={() => {
                          setWard(!ward);
                          cue('ward', volume);
                          const next = progress('arm', g);
                          if (next !== g) store(next);
                        }}
                        inspect={inspect}
                      />
                    </div>
                  )}
                </div>

                {g.id === 'undertow' ? (
                  <span />
                ) : g.phase === 'pass' ? (
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
          <UndoChoice g={g} viewer={0}
            drafted={selected !== null || passed.length > 0 || !!nature.choice.migration || !!nature.choice.roam || !!ward}

            onUndo={() => { commit({ type: 'undo' }); nature.setChoice({}); }}
            onClear={() => { setSelected(null); setPreparedZone(null); setPassed([]); setWard(false); nature.setChoice({}); }} />
              <MoveConfirmation
                g={g}
                viewer={0}
                selected={selected}
                passed={passed}
                zone={preparedZone}
                ward={ward}

                festivalChoice={festival.choice}
                natureChoice={nature.choice}

                enabled={confirmMoves}

                onConfirm={commit}
                onClear={() => {
                  setSelected(null);
                  setPreparedZone(null);
                  setPassed([]);
                }}
              />
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
        open={!!setup || !!preview || !!ownSetup || !!worldSetup}
        onOpenChange={(open) => {
          if (!open) {
            setSetup(null);
            setPreview(null);
            setOwnSetup(null);
            setWorldSetup(null);
          }
        }}
      >
        <DialogContent className="modal setup-modal">
          {worldSetup ? (
            <WorldSetupBox
              game={worldLibraryGames[worldSetup]}
              save={worlds[worldSetup]}
              seats={worldSeats}
              difficulty={difficulty}
              onSeats={setWorldSeats}
              onDifficulty={setDifficulty}
              onPlay={() => startWorld(worldSetup)}
              onResume={(match) => {
                setWorldSetup(null);
                setOpenWorld(match.kind);
              }}
            />
          ) : ownSetup ? (
            <StandaloneSetupBox
              game={standaloneLibraryGames[ownSetup]}
              save={own[ownSetup]}
              seats={ownSeats}
              difficulty={difficulty}
              mode={ownMode}
              onMode={setOwnMode}
              onSeats={n => { setOwnSeats(n); if (![4,6].includes(n)) setOwnMode('individual'); }}
              onDifficulty={setDifficulty}
              onPlay={() => startOwn(ownSetup)}
              onLearn={() => startOwn(ownSetup,true)}
              onResume={(match) => {
                setOwnSetup(null);
                setOpenOwn(match.kind);
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
              shields={shields}
              customerOrders={customerOrders}
              sanctuaryGoalsEnabled={sanctuaryGoalsEnabled}
              onPlayers={setPlayers}
              onDifficulty={setDifficulty}
              onFastMode={setFastMode}
              onOptions={setOptions}
              onExtensions={(value) => {
                if (value.shields !== undefined) setShields(value.shields);
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
              ? 'Volume applies to all games. Ambience is the world around the table.'
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
              <div className="ambience-setting">
                <span>Ambience</span>
                <Slider
                  value={[ambience]}
                  onValueChange={ambienceChange}
                  min={0}
                  max={1}
                  step={0.05}
                  aria-label="Ambience level"
                />
              </div>
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
