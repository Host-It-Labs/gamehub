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
  Flag,
  Trash2,
  Users,
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
import { StatStrip } from './library';
import { boxStyle } from './game-box';
import {
  scores,
  totalRounds,
  type Difficulty,
  type Game,
  type GameOptions,
} from '@/lib/games/trio/engine';
import { playerRange, type LibraryGame } from '@/lib/games/library-fixtures';
import { standaloneGames, type AnyGame } from '@/lib/games/standalone/registry';
import type { StandaloneId } from '@/lib/games/standalone/types';
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
  shields?: boolean;
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

/** Bot strength as one to three bars, so the three read as a scale. */
function BotLevels({
  value,
  onChange,
  disabled,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled: boolean;
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
          </>
        ),
      }))}
    />
  );
}

function SeatCount({
  seats,
  choices,
  minPlayers,
  onChange,
  disabled,
}: {
  seats: number;
  choices: readonly number[];
  minPlayers: number;
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
        disabled: n < minPlayers,
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

/** A single saved match: one plain Continue button with its progress underneath. */
function ContinueButton({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="resume-strip"
      data-starts-game
      onClick={onClick}
      aria-label={label}
    >
      <span className="resume-copy">
        <strong>Continue</strong>
        <small>{detail}</small>
      </span>
    </button>
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
}: {
  runs: SavedRun[];
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
        <a className="resume-strip" href={run.href} aria-label={run.label}>
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
              <a href={run.href} aria-label={run.label}>
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
        {game.world}. {game.genre} for {playerRange(game.players)} players,
        about {game.minutes} minutes.
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
      <div className="setup-options">
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
      </div>
      <div className="setup-actions">
        <LearnButton
          onClick={onLearn}
          disabled={disabled || startDisabled || unavailable}
        />
        {unavailable ? (
          <a
            className="play-plate"
            data-starts-game
            href="/tables"
            aria-label="Play with friends at an online table"
          >
            <Play aria-hidden="true" />
            Online
          </a>
        ) : (
          <PlayButton
            data-starts-game
            disabled={disabled || startDisabled}
            onClick={onPlay}
          />
        )}
        {resumable && progress && (
          <ContinueButton
            label={`Continue your ${game.name} match, ${progress.label}`}
            detail={progress.label}
            onClick={() => onResume(save)}
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
  shields,
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
  shields: boolean;
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
}) {
  const id = game.gameId!;
  const resumable = save && save.phase !== 'over';
  const saveScores = resumable ? scores(save) : [];
  return (
    <SetupShell game={game}>
      <SetupIntro game={game} />
      <div className="setup-options">
        <SetupRow label="Players" Icon={Users}>
          <SeatCount
            seats={players}
            choices={[2, 3, 4, 5, 6]}
            minPlayers={minPlayers}
            onChange={onPlayers}
            disabled={disabled}
          />
        </SetupRow>
        <SetupRow label="Bots" Icon={Bot}>
          <BotLevels
            value={difficulty}
            onChange={onDifficulty}
            disabled={disabled}
          />
        </SetupRow>
        <ContentChoice
          disabled={disabled}
          id={id}
          options={options}
          fastMode={fastMode}
          onChange={onOptions}
          onFastMode={onFastMode}
        />
        <GameExtensionChoices
          disabled={disabled}
          id={id}
          options={options}
          shields={shields}
          customerOrders={customerOrders}
          sanctuaryGoalsEnabled={sanctuaryGoalsEnabled}
          onChange={onExtensions}
        />
      </div>
      <div className="setup-actions">
        <LearnButton onClick={onLearn} disabled={disabled || startDisabled} />
        <PlayButton
          data-starts-game
          disabled={disabled || startDisabled}
          onClick={onPlay}
        />
        {resumable && (
          <ContinueButton
            label={`Continue your ${game.name} match, round ${save.round} of ${totalRounds(save)}, ${save.players
              .map((p, i) => `${p.name} ${saveScores[i]}`)
              .join(', ')}`}
            detail={`Round ${save.round} of ${totalRounds(save)}`}
            onClick={() => onResume(save)}
          />
        )}
      </div>
    </SetupShell>
  );
}
