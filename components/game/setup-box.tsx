'use client';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { printedBoxArt, wideCover } from '@/lib/games/box-covers';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import {
  Amphora,
  ArrowRight,
  BookOpen,
  Bot,
  Bug,
  Castle,
  Cat,
  Coffee,
  Drum,
  Fish,
  Flame,
  Grid3x3,
  Hexagon,
  Lamp,
  Leaf,
  Lightbulb,
  Moon,
  Play,
  Scale,
  Shell,
  Ship,
  Snowflake,
  Sparkles,
  Tent,
  TrainFront,
  Trophy,
  Flag,
  Repeat,
  Trash2,
  Users,
  Vote,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArtworkImage } from './artwork';
import { Segmented, SetupRow } from './setup-row';
import { ContentChoice, GameExtensionChoices } from './expansions';
import { SetupOptions } from './setup-pages';
import { StatStrip } from './library';
import { boxStyle } from './game-box';
import {
  seatRange,
  totalRounds,
  type Difficulty,
  type Game,
  type GameOptions,
} from '@/lib/games/trio/engine';
import { playerRange, type LibraryGame } from '@/lib/games/library-fixtures';
import { standaloneGames, type AnyGame } from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
import type { ActiveRatedGame } from '@/lib/games/leaderboards';
import { TriviaModeChoices } from './trivia-modes';
import {
  triviaLengths,
  type TriviaLength,
  type TriviaMode,
} from '@/lib/games/party/trivia';
import { triviaSetupLink, triviaSetupPick } from '@/lib/online/trivia-setup';
import './setup-box.css';

const motifs: Record<string, LucideIcon> = {
  lantern: Lamp,
  leaf: Leaf,
  flame: Flame,
  train: TrainFront,
  scale: Scale,
  lighthouse: Lightbulb,
  shell: Shell,
  drum: Drum,
  tent: Tent,
  wind: Wind,
  mushroom: Sparkles,
  cup: Coffee,
  sparkle: Sparkles,
  waves: Waves,
  cat: Cat,
  ship: Ship,
  grid: Grid3x3,
  snow: Snowflake,
  pot: Amphora,
  bridge: Castle,
  hexagon: Hexagon,
  moon: Moon,
  fish: Fish,
  moth: Bug,
};

export type SetupChoices = GameOptions & {
  customerOrders?: boolean;
  sanctuaryGoalsEnabled?: boolean;
};

/** The lid: the wide cover (its title painted in) edge to edge, then the stat chips. */
export function Lid({ game }: { game: LibraryGame }) {
  const Motif = motifs[game.motif] ?? Sparkles;
  const developed = game.gameId ?? game.standaloneId;
  const wide = wideCover(game.id);
  // Folio and Relic have no engine id but do have a printed cover.
  const cover =
    wide ?? game.cover ?? (developed && printedBoxArt(developed).cover);
  const titled = !!wide || game.coverIncludesTitle;
  return (
    <div
      className={`lid ${game.id} ${wide ? 'wide-cover' : titled ? 'printed-cover' : ''}`}
    >
      <div className="lid-art">
        {cover ? (
          <ArtworkImage
            src={cover}
            width={wide ? 1536 : 1024}
            height={wide ? 512 : game.coverIncludesTitle ? 1024 : 683}
            // The lid spans the modal, which is at most 720px wide.
            sizes={
              wide
                ? '(max-width: 740px) 100vw, 720px'
                : '(max-width: 700px) 200px, 260px'
            }
            alt=""
            draggable={false}
          />
        ) : (
          <span className="lid-illustration">
            <Motif strokeWidth={1.3} />
          </span>
        )}
        <DialogTitle className={titled ? 'sr-only' : 'lid-title'}>
          {game.name}
        </DialogTitle>
      </div>
      <div className="lid-edge">
        <StatStrip game={game} full />
      </div>
    </div>
  );
}

/** The world line under the lid; read out rather than shown on phones. */
export function SetupIntro({ game }: { game: LibraryGame }) {
  return (
    <DialogDescription className="setup-intro">
      {game.world.replace(/\.$/, '')}.
    </DialogDescription>
  );
}

const levels = ['easy', 'medium', 'hard'] as const;

/** Bot strength as one to three bars, so the three read as a scale. Where
 *  games count for the leaderboard, Hard wears a small trophy. */
export function BotLevels({
  value,
  onChange,
  disabled,
  rated = false,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled: boolean;
  rated?: boolean;
}) {
  return (
    <Segmented
      label="Bot difficulty"
      className="seg-levels"
      disabled={disabled}
      value={value}
      onChange={onChange}
      options={levels.map((level, i) => ({
        value: level,
        label: (
          <>
            <span className="level-bars" aria-hidden="true">
              {levels.map((_, bar) => (
                <i key={bar} className={bar <= i ? 'on' : ''} />
              ))}
            </span>
            <b>{level[0].toUpperCase() + level.slice(1)}</b>
            {rated && level === 'hard' && (
              <Trophy className="level-rated" aria-hidden="true" />
            )}
          </>
        ),
        name: rated && level === 'hard' ? 'Hard, counts for the leaderboard' : undefined,
      }))}
    />
  );
}

/** What setup needs to start, continue or replace a rated game. Rated
 *  games are the Hard ones: nobody picks a mode. */
export type RatedSetup = {
  /** This game's unfinished rated game, if there is one. */
  active?: ActiveRatedGame;
  busy: boolean;
  error: string;
  /** Starts a rated game on the server with the current setup. */
  onPlay: () => void;
  onDismissError: () => void;
};

/** Asks once, above the actions: replacing an unfinished rated game, or
 *  playing on without a rating when the server cannot be reached. */
export function RatedBar({
  rated,
  confirming,
  onCancel,
  onUnrated,
}: {
  rated: RatedSetup;
  confirming: boolean;
  onCancel: () => void;
  onUnrated: () => void;
}) {
  if (rated.error)
    return (
      <div className="rated-bar is-error" role="alert">
        <span>{rated.error}</span>
        <button type="button" disabled={rated.busy} onClick={onUnrated}>
          Play unrated
        </button>
        <button type="button" className="is-main" disabled={rated.busy} onClick={rated.onPlay}>
          Try again
        </button>
      </div>
    );
  if (!confirming || !rated.active) return null;
  return (
    <fieldset className="rated-bar" aria-label="Unfinished rated game">
      <span>
        {rated.active.kind === 'score'
          ? 'Your unfinished town alone is dropped.'
          : 'Your unfinished rated game ends as a loss.'}
      </span>
      <button type="button" disabled={rated.busy} onClick={rated.onPlay}>
        Start new
      </button>
      <a className="is-main" href={rated.active.url} data-starts-game onClick={onCancel}>
        Continue it
      </a>
    </fieldset>
  );
}

function SeatCount({
  seats,
  choices,
  minPlayers,
  maxPlayers = 8,
  onChange,
  disabled,
}: {
  seats: number;
  choices: readonly number[];
  minPlayers: number;
  maxPlayers?: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <Segmented
      label="Players"
      className="seg-count"
      disabled={disabled}
      value={seats}
      onChange={onChange}
      options={choices.map((n) => ({
        value: n,
        label: <b>{n}</b>,
        disabled: n < minPlayers || n > maxPlayers,
      }))}
    />
  );
}

/** The secondary action beside Play: Learn for most games, Practise for Folio. */
export function LearnButton({
  onClick,
  disabled = false,
  label = 'Learn',
  Icon = BookOpen,
  expanded,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  Icon?: LucideIcon;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className="setup-learn"
      disabled={disabled}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/** Play, filled with the game's own colour. */
export function PlayButton({
  children = 'Play',
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  return (
    <button type={type} className="play-plate" {...props}>
      <Play aria-hidden="true" />
      {children}
    </button>
  );
}

/** Keep the start actions in the setup footer, with Play as the primary action. */
export function StartGameButton({
  name,
  saved,
  detail,
  disabled,
  rated = false,
  onPlay,
  onLearn,
  onResume,
}: {
  name: string;
  saved: boolean;
  detail?: string;
  disabled?: boolean;
  /** This game counts for the leaderboard; Play says so. */
  rated?: boolean;
  onPlay: () => void;
  onLearn: () => void;
  onResume: () => void;
}) {
  return (
    <>
      <LearnButton disabled={disabled} onClick={onLearn} />
      <PlayButton
        disabled={disabled}
        data-starts-game
        onClick={onPlay}
        aria-label={rated ? 'Play, rated' : undefined}
      >
        Play
        {rated && (
          <span className="play-rated" aria-hidden="true">
            <Trophy />
            Rated
          </span>
        )}
      </PlayButton>
      {saved && (
        <button
          type="button"
          className="resume-strip"
          data-starts-game
          disabled={disabled}
          aria-label={`Continue your ${name} game${detail ? `, ${detail}` : ''}`}
          onClick={onResume}
        >
          <span className="resume-copy">
            <strong>Continue</strong>
            {detail && <small>{detail}</small>}
          </span>
        </button>
      )}
    </>
  );
}

export type SavedRun = {
  key: string;
  href: string;
  /** The accessible name of the run's link. */
  label: string;
  title: ReactNode;
  detail: ReactNode;
  icon?: ReactNode;
};

/**
 * Continue for games that keep several runs at once (Folio, Relic). One run
 * links straight to it; more open a short list above the actions.
 */
export function RunPicker({
  runs,
  noun = 'run',
  onDelete,
  onContinue,
  disabled = false,
}: {
  runs: SavedRun[];
  onContinue?: (key: string) => void;
  disabled?: boolean;
  noun?: string;
  /** Deletes a run from the viewer's list; a confirmation comes first. */
  onDelete?: (key: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [doomed, setDoomed] = useState<SavedRun | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes the list first, not the whole setup dialog behind it.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  if (runs.length === 0) return null;
  const remove = (run: SavedRun) =>
    onDelete && (
      <button
        type="button"
        className="run-delete"
        aria-label={`Delete ${noun}: ${[run.title, run.detail]
          .filter((t) => typeof t === 'string')
          .join(', ')}`}
        onClick={() => {
          setOpen(false);
          setDoomed(run);
        }}
      >
        <Trash2 aria-hidden="true" />
      </button>
    );
  const confirm = onDelete && (
    <DeleteRunDialog
      run={doomed}
      noun={noun}
      onClose={() => setDoomed(null)}
      onDelete={onDelete}
    />
  );
  if (runs.length === 1) {
    const [run] = runs;
    return (
      <div className="run-picker single">
        <a
          className="resume-strip"
          href={run.href}
          aria-label={run.label}
          aria-disabled={disabled}
          onClick={(e) => {
            if (onContinue || disabled) e.preventDefault();
            if (!disabled) onContinue?.(run.key);
          }}
        >
          <span className="resume-copy">
            <strong>Continue</strong>
            <small>{run.title}</small>
          </span>
        </a>
        {remove(run)}
        {confirm}
      </div>
    );
  }
  return (
    <div className="run-picker" ref={root}>
      <button
        ref={toggle}
        type="button"
        className="resume-strip"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Continue: ${runs.length} ${noun}s in progress`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="resume-copy">
          <strong>Continue</strong>
        </span>
        <span className="run-count" aria-hidden="true">
          {runs.length}
        </span>
      </button>
      {open && (
        <ul className="run-list" id={listId} aria-label={`Your ${noun}s`}>
          {runs.map((run) => (
            <li key={run.key}>
              <a
                href={run.href}
                aria-label={run.label}
                aria-disabled={disabled}
                onClick={(e) => {
                  if (onContinue || disabled) e.preventDefault();
                  if (!disabled) onContinue?.(run.key);
                }}
              >
                {run.icon && (
                  <span className="run-icon" aria-hidden="true">
                    {run.icon}
                  </span>
                )}
                <span className="run-copy">
                  <strong>{run.title}</strong>
                  <small>{run.detail}</small>
                </span>
                <ArrowRight aria-hidden="true" />
              </a>
              {remove(run)}
            </li>
          ))}
        </ul>
      )}
      {confirm}
    </div>
  );
}

/** Asks before a saved run is deleted; nothing is removed until confirmed. */
export function DeleteRunDialog({
  run,
  noun,
  onClose,
  onDelete,
}: {
  run: SavedRun | null;
  noun: string;
  onClose: () => void;
  onDelete: (key: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Keep the last run on screen while the dialog fades out.
  const [r, setR] = useState(run);
  if (run && run !== r) setR(run);
  return (
    <Dialog
      open={!!run}
      onOpenChange={(o) => {
        if (!o && !busy) {
          setError('');
          onClose();
        }
      }}
    >
      <DialogContent className="run-delete-dialog" showCloseButton={false}>
        <DialogTitle>Delete this {noun}?</DialogTitle>
        <DialogDescription>
          {r?.title} · {r?.detail}
        </DialogDescription>
        <p>This cannot be undone. At a shared table, the others keep theirs.</p>
        {error && <p role="alert">{error}</p>}
        <div className="run-delete-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Keep
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (!r) return;
              setBusy(true);
              setError('');
              try {
                await onDelete(r.key);
                onClose();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : 'Could not delete it.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** What every setup shares: the game's colours, the lid, then the tray. */
export function SetupShell({
  game,
  className = '',
  children,
}: {
  game: LibraryGame;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`setup-box ${className}`} style={boxStyle(game, 300)}>
      <Lid game={game} />
      <div className="tray">{children}</div>
    </div>
  );
}

export function PlaceholderBox({ game }: { game: LibraryGame }) {
  return (
    <SetupShell game={game}>
      <DialogDescription className="setup-intro">
        {game.world}. {game.genre} for {playerRange(game.players)} players,{' '}
        {game.durationSpoken.toLowerCase()}.
      </DialogDescription>
      <p className="setup-soon">
        This box is not on the shelf yet. It stands in for a future game so the
        library shows its shape.
      </p>
    </SetupShell>
  );
}

export type SetupPlayer = {
  id: string;
  name: string;
  connected: boolean;
  host: boolean;
  you: boolean;
};

/** The seated players; the host picks who leads this match (moves it on).
 *  The pick lasts one match; the table's creator keeps hosting the table. */
function HostPicker({
  players,
  seats,
  onHost,
  disabled,
}: {
  players: SetupPlayer[];
  seats: number;
  onHost?: (id: string) => void;
  disabled: boolean;
}) {
  const host = players.find((p) => p.host)?.id ?? '';
  return (
    <SetupRow label="Leads" Icon={Flag} className="host-picker">
      <RadioGroup
        disabled={disabled || !onHost}
        className="host-seats"
        aria-label="Leads this game"
        value={host}
        onValueChange={(id) => id !== host && onHost?.(id)}
      >
        {players.map((p) => (
          <label
            key={p.id}
            className={`host-seat ${p.connected ? 'present' : 'away'}`}
          >
            <RadioGroupItem value={p.id} className="sr-only" />
            <span className="host-avatar" aria-hidden="true">
              {p.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <b>
              {p.name}
              {p.you ? ' (you)' : ''}
            </b>
            <Flag className="host-crown" aria-hidden="true" />
          </label>
        ))}
        {Array.from({ length: Math.max(0, seats - players.length) }, (_, i) => (
          <span
            key={`empty-${i}`}
            className="host-seat empty"
            aria-label="Empty seat"
          >
            <span className="host-avatar" aria-hidden="true" />
          </span>
        ))}
      </RadioGroup>
    </SetupRow>
  );
}

/**
 * Setup for a game with its own rules module. Those games carry no content
 * sets or extensions yet, so the tray is the two choices that always matter:
 * how many seats, and how well the others play.
 */
export function StandaloneSetupBox({
  game,
  minPlayers = 2,
  online = false,
  disabled = false,
  startDisabled = false,
  save,
  seats,
  difficulty,
  onSeats,
  players,
  onHost,
  votes = false,
  onVotes,
  triviaMode = 'quick',
  onTriviaMode,
  triviaRounds = 4,
  onTriviaRounds,
  onDifficulty,
  onPlay,
  onLearn,
  onResume,
}: {
  game: LibraryGame;
  minPlayers?: number;
  online?: boolean;
  disabled?: boolean;
  startDisabled?: boolean;
  save?: AnyGame;
  seats: number;
  difficulty: Difficulty;
  onSeats: (n: number) => void;
  /** Online tables: who is seated, so the host can hand the lead to someone else. */
  players?: SetupPlayer[];
  onHost?: (id: string) => void;
  /** Party sets: whether the table votes between rounds or the host picks. */
  votes?: boolean;
  onVotes?: (on: boolean) => void;
  triviaMode?: TriviaMode;
  onTriviaMode?: (mode: TriviaMode) => void;
  /** Tower and Expedition: 4 or 8 rounds. */
  triviaRounds?: TriviaLength;
  onTriviaRounds?: (rounds: TriviaLength) => void;
  onDifficulty: (d: Difficulty) => void;
  onPlay: () => void;
  onLearn: () => void;
  onResume: (game: AnyGame) => void;
}) {
  const entry = standaloneGames[game.standaloneId as StandaloneId];
  const humanOnly = requiresHumanPlayers(game.standaloneId);
  const unavailable = humanOnly && !online;
  const resumable = !unavailable && save && !save.over;
  const progress = resumable ? entry.progress(save) : null;
  return (
    <SetupShell game={game}>
      <SetupIntro game={game} />
      <SetupOptions>
        {game.standaloneId === 'miro' && (
          <SetupRow label="Mode" Icon={Trophy} className="trivia-mode-row">
            <TriviaModeChoices
              value={triviaMode}
              onChange={onTriviaMode}
              disabled={disabled}
            />
          </SetupRow>
        )}
        <SetupRow label="Players" Icon={Users}>
          <SeatCount
            seats={seats}
            choices={entry.seatChoices}
            minPlayers={minPlayers}
            onChange={onSeats}
            disabled={disabled}
          />
        </SetupRow>
        {!humanOnly && (
          <SetupRow label="Bots" Icon={Bot}>
            <BotLevels
              value={difficulty}
              onChange={onDifficulty}
              disabled={disabled}
            />
          </SetupRow>
        )}
        {players && (
          <HostPicker
            players={players}
            seats={seats}
            onHost={onHost}
            disabled={disabled}
          />
        )}
        {game.standaloneId === 'miro' && triviaMode !== 'quick' && (
          <SetupRow label="Rounds" Icon={Repeat}>
            <Segmented
              label="How many rounds"
              value={triviaRounds}
              options={triviaLengths.map((n) => ({
                value: n,
                label: `${n} rounds`,
              }))}
              onChange={(n) => onTriviaRounds?.(n)}
              disabled={disabled || !onTriviaRounds}
            />
          </SetupRow>
        )}
        {onVotes && (game.standaloneId !== 'miro' || triviaMode === 'quick') && (
          <SetupRow label="Next round" Icon={Vote}>
            <Segmented
              label="Who picks the next round"
              value={votes ? 'vote' : 'host'}
              options={[
                { value: 'host', label: 'Host picks' },
                { value: 'vote', label: 'Everyone votes' },
              ]}
              onChange={(v) => onVotes(v === 'vote')}
              disabled={disabled}
            />
          </SetupRow>
        )}
      </SetupOptions>
      <div className="setup-actions">
        {unavailable ? (
          <a
            className="play-plate"
            data-starts-game
            href={game.standaloneId === 'miro' ? triviaSetupLink('/tables', triviaSetupPick(triviaMode, triviaRounds)) : '/tables'}
            aria-label="Play with friends at an online table"
          >
            <Play aria-hidden="true" />
            Online
          </a>
        ) : (
          <StartGameButton
            name={game.name}
            saved={!!resumable}
            detail={progress?.label}
            disabled={disabled || startDisabled}
            onPlay={onPlay}
            onLearn={onLearn}
            onResume={() => {
              if (save) onResume(save);
            }}
          />
        )}
      </div>
    </SetupShell>
  );
}

export function SetupBox({
  game,
  minPlayers = 2,
  disabled = false,
  startDisabled = false,
  save,
  players,
  difficulty,
  fastMode,
  options,
  customerOrders,
  sanctuaryGoalsEnabled,
  onPlayers,
  onDifficulty,
  onFastMode,
  onOptions,
  onExtensions,
  onLearn,
  onPlay,
  onResume,
  rated,
}: {
  game: LibraryGame;
  minPlayers?: number;
  disabled?: boolean;
  startDisabled?: boolean;
  save?: Game;
  players: number;
  difficulty: Difficulty;
  fastMode: boolean;
  options: GameOptions;
  customerOrders: boolean;
  sanctuaryGoalsEnabled: boolean;
  onPlayers: (n: number) => void;
  onDifficulty: (d: Difficulty) => void;
  onFastMode: (on: boolean) => void;
  onOptions: (value: GameOptions) => void;
  onExtensions: (value: SetupChoices) => void;
  onLearn: () => void;
  onPlay: () => void;
  onResume: (game: Game) => void;
  /** Solo setup only: Hard games are rated and run on the server. */
  rated?: RatedSetup;
}) {
  const [confirming, setConfirming] = useState(false);
  const isRated = !!rated && difficulty === 'hard';
  const busy = !!rated?.busy;
  const id = game.gameId!;
  const resumable = save && save.phase !== 'over';
  // One Continue: the rated game while Hard is chosen (or when there is no
  // local save), this device's save otherwise.
  const ratedRun = rated?.active && (isRated || !resumable) ? rated.active : undefined;
  // Nox starts at three; its Fast deck greys out five and six.
  const fewest = seatRange(id)[0];
  const most = seatRange(id, fastMode)[1];
  const seatChoices = [2, 3, 4, 5, 6].filter((n) => n >= fewest);
  return (
    <SetupShell game={game}>
      <SetupIntro game={game} />
      <SetupOptions>
        <SetupRow label="Players" Icon={Users}>
          <SeatCount
            seats={players}
            choices={seatChoices}
            minPlayers={minPlayers}
            maxPlayers={most}
            onChange={onPlayers}
            disabled={disabled || busy}
          />
        </SetupRow>
        <SetupRow label="Bots" Icon={Bot}>
          <BotLevels
            value={difficulty}
            onChange={(d) => {
              setConfirming(false);
              rated?.onDismissError();
              onDifficulty(d);
            }}
            disabled={disabled || busy}
            rated={!!rated}
          />
        </SetupRow>
        <ContentChoice
          disabled={disabled || busy}
          id={id}
          options={options}
          fastMode={fastMode}
          seatsTaken={minPlayers}
          onChange={onOptions}
          onFastMode={onFastMode}
        />
        <GameExtensionChoices
          disabled={disabled || busy}
          id={id}
          options={options}
          customerOrders={customerOrders}
          sanctuaryGoalsEnabled={sanctuaryGoalsEnabled}
          fastMode={fastMode}
          onChange={onExtensions}
        />
      </SetupOptions>
      {rated && (
        <RatedBar
          rated={rated}
          confirming={confirming}
          onCancel={() => setConfirming(false)}
          onUnrated={() => {
            rated.onDismissError();
            onPlay();
          }}
        />
      )}
      <div className="setup-actions">
        <StartGameButton
          name={game.name}
          saved={!!ratedRun || !!resumable}
          detail={
            ratedRun
              ? `Rated · round ${ratedRun.round} of ${ratedRun.rounds}`
              : resumable
                ? `Round ${save.round} of ${totalRounds(save)}`
                : undefined
          }
          rated={isRated}
          disabled={disabled || startDisabled || busy}
          onPlay={() => {
            if (!isRated || !rated) return onPlay();
            if (rated.active && !confirming) return setConfirming(true);
            rated.onPlay();
          }}
          onLearn={onLearn}
          onResume={() => {
            if (ratedRun) window.location.assign(ratedRun.url);
            else if (save) onResume(save);
          }}
        />
      </div>
    </SetupShell>
  );
}
