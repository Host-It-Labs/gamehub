'use client';
import { printedBoxArt } from '@/lib/games/box-covers';
import { requiresHumanPlayers } from '@/lib/games/player-policy';
import { useId } from 'react';
import { TeamPicker } from './team-picker';
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
  UserRound,
  UsersRound,
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

function Lid({ game }: { game: LibraryGame }) {
  const Motif = motifs[game.motif] ?? Sparkles;
  const developed = game.gameId ?? game.standaloneId;
  return (
    <div
      className={`lid ${game.gameId ?? game.standaloneId ?? 'placeholder'} ${game.coverIncludesTitle ? 'printed-cover' : ''}`}
      style={boxStyle(game, 300)}
    >
      <div className="lid-art">
        {developed ? (
          <ArtworkImage
            src={game.cover ?? printedBoxArt(developed!).cover}
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
  teams,
  onTeams,
  playerNames,
  mode,
  onMode,
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
  mode: 'teams' | 'individual';
  onMode: (mode: 'teams' | 'individual') => void;
  difficulty: Difficulty;
  onSeats: (n: number) => void;
  teams?: number[];
  onTeams?: (teams: number[]) => void;
  playerNames?: string[];
  onDifficulty: (d: Difficulty) => void;
  onPlay: () => void;
  onLearn: () => void;
  onResume: (game: AnyGame) => void;
}) {
  const modeId = useId();
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
        <fieldset className="compartment play-mode">
          <legend>Play mode</legend>
          <RadioGroup
              disabled={disabled}
            className="play-mode-options"
            aria-label="Play mode"
            value={mode}
            onValueChange={(value) => onMode(value as 'individual' | 'teams')}
          >
            <label className="play-mode-option" htmlFor={`${modeId}-individual`}>
              <RadioGroupItem id={`${modeId}-individual`} className="sr-only" value="individual" />
              <UserRound className="play-mode-icon" aria-hidden="true" />
              <span className="play-mode-copy">
                <strong>Individual</strong>
                <small>Everyone for themselves</small>
              </span>
              <span className="play-mode-check" aria-hidden="true" />
            </label>
            <label className="play-mode-option" htmlFor={`${modeId}-teams`}>
              <RadioGroupItem id={`${modeId}-teams`} className="sr-only" value="teams" />
              <UsersRound className="play-mode-icon" aria-hidden="true" />
              <span className="play-mode-copy">
                <strong>Two teams</strong>
                <small>Uneven teams welcome · Win together</small>
              </span>
              <span className="play-mode-check" aria-hidden="true" />
            </label>
          </RadioGroup>
        </fieldset>
        {mode === 'teams' && onTeams && <TeamPicker names={playerNames ?? Array.from({ length: seats }, (_, i) => i ? `Player ${i + 1}` : 'You')} teams={teams} onChange={onTeams} disabled={disabled} />}
        <p className="tray-soon">{game.standaloneId === 'miro' ? 'Two rounds: medium, then hard. Everyone privately completes Places, Photos and Three facts in any order, then locks all three pins. Once everyone is ready, one team has 60 seconds to choose all three pins, then the other team takes its turn. One captain confirms the complete set. The other team starts round two.' : 'Everyone prepares at once. The opposing team shares a guess. The author’s teammates guess silently on their own; their average scores against the shared guess. The author stays silent. In individual mode, everyone except the author guesses.'} {humanOnly ? 'Human players only. Every seat must be filled before starting.' : 'Solo bots are practice opponents.'}</p>
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
