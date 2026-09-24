'use client';
import { printedBoxArt } from '@/lib/games/box-covers';
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
  Crown,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArtworkImage } from './artwork';
import { ContentChoice, GameExtensionChoices } from './expansions';
import { StatStrip, AvatarStack } from './library';
import { boxStyle } from './game-box';
import {
  scores,
  totalRounds,
  type Difficulty,
  type Game,
  type GameOptions,
} from '@/lib/games/trio/engine';
import { playerRange, type LibraryGame } from '@/lib/games/library-fixtures';
import {
  standaloneGames,
  type AnyGame,
} from '@/lib/games/standalone/registry';
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

export function Lid({ game }: { game: LibraryGame }) {
  const Motif = motifs[game.motif] ?? Sparkles;
  const developed = game.gameId ?? game.standaloneId;
  // Folio and Relic have no engine id but do have a printed cover.
  const cover = game.cover ?? (developed && printedBoxArt(developed).cover);
  return (
    <div
      className={`lid ${game.gameId ?? game.standaloneId ?? 'placeholder'} ${game.coverIncludesTitle ? 'printed-cover' : ''}`}
      style={boxStyle(game, 300)}
    >
      <div className="lid-art">
        {cover ? (
          <ArtworkImage
            src={cover}
            width={1024}
            height={game.coverIncludesTitle ? 1024 : game.standaloneId ? 1536 : 683}
            sizes="(max-width: 760px) 100vw, 720px"
            alt=""
            draggable={false}
          />
        ) : (
          <span className="lid-illustration">
            <Motif strokeWidth={1.3} />
          </span>
        )}
        <DialogTitle className={game.coverIncludesTitle ? "sr-only" : "lid-title"}>{game.name}</DialogTitle>
      </div>
      <div className="lid-edge">
        <StatStrip game={game} full />
      </div>
    </div>
  );
}

function SetupIntro({ game, onLearn, disabled = false }: { game: LibraryGame; onLearn: () => void; disabled?: boolean }) {
  return (
    <div className="setup-intro">
      <DialogDescription className="tray-note">{game.world}.</DialogDescription>
      <button type="button" className="setup-learn" disabled={disabled} onClick={onLearn}>
        <BookOpen aria-hidden="true" />
        <span>Learn</span>
      </button>
    </div>
  );
}

export function PlaceholderBox({ game }: { game: LibraryGame }) {
  return (
    <div className="setup-box">
      <Lid game={game} />
      <div className="tray">
        <DialogDescription className="tray-note">
          {game.world}. {game.genre} for {playerRange(game.players)} players,
          about {game.minutes} minutes.
        </DialogDescription>
        <div className="tray-social">
          {game.playing.length > 0 && (
            <>
              <AvatarStack ids={game.playing} size={28} max={4} />
              <small>
                {game.playing.length} friends have this on their table
              </small>
            </>
          )}
        </div>
        <p className="tray-soon">
          This box is not on the shelf yet. It stands in for a future game so
          the library shows its shape.
        </p>
      </div>
    </div>
  );
}

export type SetupPlayer = { id: string; name: string; connected: boolean; host: boolean; you: boolean };

/** The seated players; the host picks who leads the table (starts and moves it on). */
function HostPicker({ players, seats, onHost, disabled }: {
  players: SetupPlayer[];
  seats: number;
  onHost?: (id: string) => void;
  disabled: boolean;
}) {
  const host = players.find((p) => p.host)?.id ?? '';
  return (
    <fieldset className="compartment host-picker">
      <legend><Crown aria-hidden="true" />Host</legend>
      <RadioGroup
        disabled={disabled || !onHost}
        className="host-seats"
        aria-label="Host"
        value={host}
        onValueChange={(id) => id !== host && onHost?.(id)}
      >
        {players.map((p) => (
          <label key={p.id} className={`host-seat ${p.connected ? 'present' : 'away'}`}>
            <RadioGroupItem value={p.id} className="sr-only" />
            <span className="host-avatar" aria-hidden="true">{p.name.trim().charAt(0).toUpperCase() || '?'}</span>
            <b>{p.name}{p.you ? ' (you)' : ''}</b>
            <Crown className="host-crown" aria-hidden="true" />
          </label>
        ))}
        {Array.from({ length: Math.max(0, seats - players.length) }, (_, i) => (
          <span key={`empty-${i}`} className="host-seat empty" aria-label="Empty seat">
            <span className="host-avatar" aria-hidden="true" />
          </span>
        ))}
      </RadioGroup>
    </fieldset>
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
    <div className="setup-box">
      <Lid game={game} />
      <div className="tray">
        <SetupIntro game={game} onLearn={onLearn} disabled={disabled || startDisabled || unavailable} />

        <div className="tray-row tray-row-top">
          <fieldset className="compartment seats">
            <legend>Players, including you</legend>
            <RadioGroup
              disabled={disabled}
              className="seat-row"
              value={String(seats)}
              onValueChange={(v) => onSeats(Number(v))}
            >
              {entry.seatChoices.map((n) => (
                <label key={n} className="seat">
                  <RadioGroupItem value={String(n)} className="sr-only" disabled={n < minPlayers} />
                  <span className="chair" aria-hidden="true">
                    <i />
                  </span>
                  <b>{n}</b>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          {!humanOnly && <fieldset className="compartment bots">
            <legend>
              <Bot aria-hidden="true" />
              Bot difficulty
            </legend>
            <RadioGroup
              disabled={disabled}
              className="pawn-row"
              value={difficulty}
              onValueChange={(v) => onDifficulty(v as Difficulty)}
            >
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <label key={level} className={`pawn-choice ${level}`}>
                  <RadioGroupItem value={level} className="sr-only" />
                  <span className="pawn" aria-hidden="true">
                    <i />
                  </span>
                  <b>{level}</b>
                </label>
              ))}
            </RadioGroup>
          </fieldset>}
        </div>
        {players && <HostPicker players={players} seats={seats} onHost={onHost} disabled={disabled} />}
        {unavailable && <a className="play-plate" href="/tables">Play with friends at an online table</a>}
        <div className="setup-actions">
        <button type="button" className="play-plate" disabled={disabled || startDisabled || unavailable} onClick={onPlay}>
          <Play aria-hidden="true" />
          Play
        </button>
        {resumable && progress && (
          <button
            type="button"
            className="resume-strip"
            onClick={() => onResume(save)}
            aria-label={`Continue your ${game.name} match, ${progress.label}`}
          >
            <span className="resume-thumb" aria-hidden="true">
              <span className="resume-thumb-board" />
            </span>
            <span className="resume-copy">
              <strong>Continue your match</strong>
              <small>
                {progress.label} · {progress.detail}
              </small>
            </span>
            <span className="resume-go" aria-hidden="true">
              <ArrowRight />
            </span>
          </button>
        )}
        </div>
      </div>
    </div>
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
    <div className="setup-box">
      <Lid game={game} />
      <div className="tray">
        <SetupIntro game={game} onLearn={onLearn} disabled={disabled || startDisabled} />

        <div className="tray-row tray-row-top">
          <fieldset className="compartment seats">
            <legend>Players, including you</legend>
            <RadioGroup
              disabled={disabled}
              className="seat-row"
              value={String(players)}
              onValueChange={(v) => onPlayers(Number(v))}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <label key={n} className="seat">
                  <RadioGroupItem value={String(n)} className="sr-only" disabled={n < minPlayers} />
                  <span className="chair" aria-hidden="true">
                    <i />
                  </span>
                  <b>{n}</b>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset className="compartment bots">
            <legend>
              <Bot aria-hidden="true" />
              Bot difficulty
            </legend>
            <RadioGroup
              disabled={disabled}
              className="pawn-row"
              value={difficulty}
              onValueChange={(v) => onDifficulty(v as Difficulty)}
            >
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <label key={level} className={`pawn-choice ${level}`}>
                  <RadioGroupItem value={level} className="sr-only" />
                  <span className="pawn" aria-hidden="true">
                    <i />
                  </span>
                  <b>{level}</b>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
        </div>
        <div className="tray-row tray-row-bottom">
          {id === 'undertow' ? (
            <fieldset className="compartment fast-mode">
              <legend>Deck</legend>
              <RadioGroup disabled={disabled} className="deck-choices" value={fastMode ? 'fast' : 'normal'} onValueChange={(value) => onFastMode(value === 'fast')}>
                {(['normal', 'fast'] as const).map((deck) => <label className="deck-choice" key={deck}>
                  <RadioGroupItem className="sr-only" value={deck} />
                  <span className="deck-glyph" aria-hidden="true">{deck === 'normal' ? '1–10' : '1–5'}</span>
                  <span><strong>{deck === 'normal' ? 'Normal' : 'Fast mode'}</strong><small>{deck === 'normal' ? 'Full deck · a longer voyage' : 'Short deck · a quicker voyage'}</small></span>
                </label>)}
              </RadioGroup>
            </fieldset>
          ) : (
            <div className="compartment content">
              <ContentChoice disabled={disabled} id={id} options={options} onChange={onOptions} />
            </div>
          )}
          <div className="compartment extensions">
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
        </div>
        <div className="setup-actions">
        <button type="button" className="play-plate" disabled={disabled || startDisabled} onClick={onPlay}>
          <Play aria-hidden="true" />
          Play
        </button>
        {resumable && (
          <button
            type="button"
            className="resume-strip"
            onClick={() => onResume(save)}
            aria-label={`Continue your ${game.name} match, round ${save.round} of ${totalRounds(save)}`}
          >
            <span className="resume-thumb" aria-hidden="true">
              <span className="resume-thumb-board" />
            </span>
            <span className="resume-copy">
              <strong>Continue your match</strong>
              <small>
                Round {save.round} of {totalRounds(save)} ·{' '}
                {save.players
                  .map((p, i) => `${p.name} ${saveScores[i]}`)
                  .join(' · ')}
              </small>
            </span>
            <span className="resume-go" aria-hidden="true">
              <ArrowRight />
            </span>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
