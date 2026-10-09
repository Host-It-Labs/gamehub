'use client';
import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Check, Coins, Footprints, Info, Package, Trophy } from 'lucide-react';
import type { AnyGame, AnyMove } from '@/lib/games/standalone/registry';
import type { SetGame } from '@/lib/games/party/vote';
import {
  campReady,
  finalTriviaCamp,
  legacyTriviaRoutes,
  triviaCosts,
  triviaModes,
  triviaOf,
  triviaRoutes,
  triviaTower,
  triviaStandings,
  type TriviaMode,
  type TriviaRoute,
} from '@/lib/games/party/trivia';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Piece } from './interactions';
import { QuizPick } from './quiz-pick';
import { CountUp } from './reveal-motion';
import { TriviaRules } from './trivia-rules';
import './trivia-modes.css';

const TriviaScene = lazy(() => import('./trivia-3d/trivia-scene'));

const colours = [
  '#ff5a3c',
  '#3569ff',
  '#12a870',
  '#9c52f2',
  '#f28c28',
  '#f26aae',
];

/** Small vector objects for the mode controls, in the measuring desk's materials. */
export function TriviaModeMark({ mode }: { mode: TriviaMode }) {
  return (
    <svg
      viewBox="0 0 150 90"
      className={`trivia-mode-mark mark-${mode}`}
      aria-hidden="true"
    >
      <ellipse cx="75" cy="77" rx="56" ry="7" fill="#183a3020" />
      {mode === 'quick' ? (
        <g stroke="#173a30" strokeWidth="2">
          <rect
            x="27"
            y="20"
            width="50"
            height="56"
            rx="6"
            fill="#3569ff"
            transform="rotate(-16 52 48)"
          />
          <rect
            x="73"
            y="20"
            width="50"
            height="56"
            rx="6"
            fill="#ffd23f"
            transform="rotate(16 98 48)"
          />
          <rect x="49" y="14" width="53" height="64" rx="6" fill="#fff8e6" />
          <path d="M56 30h39M56 37h39" stroke="#ff5a3c" />
          <path d="m66 49 18 11-18 11Z" fill="#ff5a3c" stroke="none" />
        </g>
      ) : mode === 'tower' ? (
        <g stroke="#183a30" strokeWidth="2" strokeLinejoin="round">
          <path d="M42 64h65v13H42Z" fill="#3569ff" />
          <path d="M48 49h53v15H48Z" fill="#ff5a3c" />
          <path d="M54 34h42v15H54Z" fill="#ffd23f" />
          <path d="M60 20h30v14H60Z" fill="#12a870" />
          <path d="M75 20V7l19 5-19 5" fill="#ff5a3c" />
          <path d="M50 68h49M55 53h39M61 38h28" stroke="#ffffff70" />
        </g>
      ) : (
        <g stroke="#183a30" strokeWidth="2" strokeLinejoin="round">
          <path
            d="m18 29 38-13 38 12 37-10v53l-37 11-38-13-38 12Z"
            fill="#fff8e6"
          />
          <path d="M56 16v53M94 28v54" stroke="#baa879" />
          <path
            d="m29 64 18-22 27 18 23-15 22-16"
            stroke="#ff5a3c"
            strokeWidth="3"
            strokeDasharray="4 4"
            fill="none"
          />
          <path d="m69 43 12-20 13 20" fill="#a8cabc" />
          <circle cx="119" cy="29" r="6" fill="#ffd23f" />
          <circle cx="29" cy="64" r="5" fill="#3569ff" />
        </g>
      )}
    </svg>
  );
}

export function TriviaModeChoices({
  value,
  onChange,
  disabled,
}: {
  value: TriviaMode;
  onChange?: (mode: TriviaMode) => void;
  disabled: boolean;
}) {
  const [help, setHelp] = useState<TriviaMode | null>(null);
  const source = useRef<HTMLElement | null>(null);
  const choices = useRef<HTMLDivElement>(null);
  return (
    <>
      <div
        ref={choices}
        className="trivia-mode-choices"
        aria-label="Trivia mode"
      >
        {triviaModes.map((mode) => (
          <div
            className={`trivia-mode-choice ${value === mode.id ? 'is-selected' : ''}`}
            data-mode={mode.id}
            key={mode.id}
          >
            <Piece
              className="trivia-mode-toggle"
              label={`${mode.name}, ${mode.rounds ? `${mode.rounds} rounds` : 'play as long as you like'}. Hold or press I for rules.`}
              selected={value === mode.id}
              unavailable={disabled || !onChange}
              onTap={() => onChange?.(mode.id)}
              inspect={() => {
                source.current =
                  choices.current?.querySelector<HTMLElement>(
                    `[data-mode="${mode.id}"] .trivia-mode-toggle`,
                  ) ?? null;
                setHelp(mode.id);
              }}
            >
              <TriviaModeMark mode={mode.id} />
              <strong>{mode.name}</strong>
              <small>
                {mode.rounds ? `${mode.rounds} rounds` : 'Free play'}
              </small>
              {value === mode.id && (
                <Check
                  className="trivia-mode-check"
                  size={16}
                  aria-hidden="true"
                />
              )}
            </Piece>
            <button
              className="trivia-mode-info"
              type="button"
              aria-label={`${mode.name} rules`}
              aria-haspopup="dialog"
              onClick={(event) => {
                source.current = event.currentTarget;
                setHelp(mode.id);
              }}
            >
              <Info size={16} />
            </button>
          </div>
        ))}
      </div>
      <Dialog
        open={help !== null}
        onOpenChange={(open) => !open && setHelp(null)}
      >
        <DialogContent
          className="modal extension-rules-modal"
          finalFocus={source}
        >
          <DialogTitle>
            {triviaModes.find((m) => m.id === help)?.name}
          </DialogTitle>
          {help && <TriviaRules mode={help} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TriviaScore({ g, seat }: { g: AnyGame; seat: number }) {
  const t = triviaOf(g),
    p = t?.players[seat];
  if (!p || !t || t.mode === 'quick') return null;
  return t.mode === 'tower' ? (
    <span
      className="trivia-badge-score"
      aria-label={`${p.floors} floors, ${p.victories} victories`}
    >
      <Package size={11} />
      {p.floors}
      <span className="trivia-badge-detail">
        <Trophy size={11} />
        {p.victories}
      </span>
    </span>
  ) : (
    <span
      className="trivia-badge-score"
      aria-label={`${p.distance} steps, ${p.trophies} trophies${t.rules === 2 ? '' : `, ${p.coins} coins`}`}
    >
      {t.rules === 2 ? <Footprints size={11} /> : <Trophy size={11} />}
      {t.rules === 2 ? p.distance : p.trophies}
      <span className="trivia-badge-detail">
        {t.rules === 2 ? (
          <>
            <Trophy size={11} />
            {p.trophies}
          </>
        ) : (
          <>
            <Coins size={11} />
            {p.coins}
            <Footprints size={11} />
            {p.distance}
          </>
        )}
      </span>
    </span>
  );
}

export function TriviaFinalScore({
  g,
  seat,
  delay,
}: {
  g: AnyGame;
  seat: number;
  delay: number;
}) {
  const t = triviaOf(g),
    p = triviaStandings(g).find((p) => p.seat === seat);
  if (!t || !p) return null;
  return (
    <span
      className="trivia-final-score"
      aria-label={
        t.mode === 'tower'
          ? `${p.floors} floors, ${p.victories} victories, ${p.rawPoints} points`
          : `${p.distance} steps, ${p.trophies} trophies${t.rules === 2 ? '' : `, ${p.coins} coins`}, ${p.rawPoints} points`
      }
    >
      <span>
        {t.mode === 'tower' ? (
          <Package size={18} />
        ) : t.rules === 2 ? (
          <Footprints size={18} />
        ) : (
          <Trophy size={18} />
        )}
        <CountUp value={p.score} delay={delay} duration={650} />
      </span>
      <small>
        {t.mode === 'tower' ? (
          <>
            <Trophy size={12} />
            {p.victories}
          </>
        ) : (
          <>
            {t.rules === 2 ? (
              <>
                <Trophy size={12} />
                {p.trophies}
              </>
            ) : (
              <>
                <Footprints size={12} />
                {p.distance}
                <Coins size={12} />
                {p.coins}
              </>
            )}
          </>
        )}
        <span>{p.rawPoints} pts</span>
      </small>
    </span>
  );
}

export function TriviaBoard({
  g,
  ledger = true,
  animate = !g.over,
}: {
  g: AnyGame;
  ledger?: boolean;
  /** The development bench can replay a completed world's last round. */
  animate?: boolean;
}) {
  const t = triviaOf(g);
  const [renderer, setRenderer] = useState<'loading' | 'webgl' | 'fallback'>(
    'loading',
  );
  const players = useMemo(() => {
    if (!t) return [];
    const last = t.rounds.at(-1);
    return t.players.map((p, seat) => {
      const addedFloors = last
        ? Math.floor(last.scores[seat] / triviaTower.pointsPerFloor) +
          (last.winners.includes(seat) ? triviaTower.victoryFloors : 0)
        : 0;
      const r = triviaRoutes.find((r) => r.id === last?.routes[seat]);
      const addedSteps =
        r && last
          ? last.scores[seat] >= r.threshold
            ? r.distance
            : r.missDistance
          : 0;
      const scale = t.rules === 2 ? 1 : 0.5;
      return {
        floors: p.floors,
        previousFloors: Math.max(0, p.floors - addedFloors),
        distance: p.distance * scale,
        previousDistance: Math.max(0, p.distance - addedSteps) * scale,
      };
    });
  }, [t]);
  if (!t || t.mode === 'quick') return null;
  return (
    <figure
      className={`trivia-world world-${t.mode} ${ledger ? '' : 'is-final-world'}`}
      data-renderer={renderer}
    >
      <figcaption className="sr-only">
        {t.players
          .map(
            (p, seat) =>
              `${g.seats[seat]}: ${t.mode === 'tower' ? `${p.floors} floors` : `${p.distance} steps, ${p.trophies} trophies`}`,
          )
          .join('; ')}
      </figcaption>
      <div className="trivia-world-view">
        {renderer !== 'webgl' && (
          <div className="trivia-scene-fallback" aria-hidden="true">
            <TriviaModeMark mode={t.mode} />
          </div>
        )}
        <Suspense fallback={null}>
          <TriviaScene
            mode={t.mode}
            players={players}
            animate={animate}
            onReady={(ready) => setRenderer(ready ? 'webgl' : 'fallback')}
          />
        </Suspense>
      </div>
      {ledger && (
        <ol
          className="trivia-world-ledger"
          aria-label={
            t.mode === 'tower' ? 'Tower heights' : 'Expedition progress'
          }
        >
          {t.players.map((p, seat) => (
            <li
              key={seat}
              style={{ '--trivia-seat': colours[seat] } as CSSProperties}
            >
              <i aria-hidden="true">{g.seats[seat].slice(0, 1)}</i>
              <b title={g.seats[seat]}>{g.seats[seat]}</b>
              <span
                aria-label={
                  t.mode === 'tower'
                    ? `${p.floors} floors`
                    : `${p.distance} steps`
                }
              >
                {t.mode === 'tower' ? (
                  <Package size={14} />
                ) : (
                  <Footprints size={14} />
                )}
                <CountUp value={t.mode === 'tower' ? p.floors : p.distance} />
              </span>
              <span
                aria-label={`${t.mode === 'tower' ? p.victories : p.trophies} ${t.mode === 'tower' ? 'victories' : 'trophies'}`}
              >
                <Trophy size={13} />
                {t.mode === 'tower' ? p.victories : p.trophies}
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

export function TriviaCamp(props: {
  g: AnyGame;
  viewer: number | null;
  disabled: boolean;
  canAdvance: boolean;
  hostName?: string;
  commit: (move: AnyMove) => void;
}) {
  return triviaOf(props.g)?.rules === 2 ? (
    <RouteCamp {...props} />
  ) : (
    <LegacyTriviaCamp {...props} />
  );
}

function RouteCamp({
  g,
  viewer,
  disabled,
  canAdvance,
  commit,
}: {
  g: AnyGame;
  viewer: number | null;
  disabled: boolean;
  canAdvance: boolean;
  hostName?: string;
  commit: (move: AnyMove) => void;
}) {
  const t = triviaOf(g)!;
  const final = finalTriviaCamp(g);
  const mine = viewer === null ? null : t.plans[viewer];
  const locked = viewer !== null && t.ready[viewer];
  const [route, setRoute] = useState<TriviaRoute>(mine?.route ?? 'trail');
  const selected = locked ? mine?.route : route;
  const ready = campReady(g);
  return (
    <section
      className={`trivia-camp is-${t.mode} is-streamlined ${final ? 'is-last-camp' : ''}`}
      aria-label={`${t.mode === 'tower' ? 'Tower' : 'Expedition'} progress`}
    >
      <TriviaBoard g={g} />
      <div className="trivia-camp-dock">
        {t.mode === 'expedition' && !final && viewer !== null && (
          <div className="trivia-route-plan">
            <fieldset className="trivia-routes">
              <legend className="sr-only">Your next route</legend>
              {triviaRoutes.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={`trivia-route route-${r.id}`}
                  aria-pressed={selected === r.id}
                  aria-label={`${r.name}: ${r.threshold ? `${r.threshold} points for ${r.distance} steps; below, ${r.missDistance} step${r.missDistance === 1 ? '' : 's'}` : 'one guaranteed step'}`}
                  disabled={disabled || locked}
                  onClick={() => setRoute(r.id)}
                >
                  <span className="trivia-route-picture" aria-hidden="true">
                    <Footprints size={26} />
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{r.name}</b>
                  <span>
                    <Footprints size={14} />
                    {r.distance}
                  </span>
                  <small>
                    {r.threshold === 0 ? 'Any score' : `${r.threshold}+ pts`}
                  </small>
                  <small className="trivia-route-below">
                    {r.threshold === 0
                      ? 'Guaranteed'
                      : `Below: ${r.missDistance}`}
                  </small>
                </button>
              ))}
            </fieldset>
            <button
              className={
                locked
                  ? 'party-locked trivia-route-lock'
                  : 'party-primary trivia-route-lock'
              }
              disabled={disabled || (locked && ready)}
              onClick={() =>
                commit(
                  locked
                    ? { type: 'trivia-unlock' }
                    : { type: 'trivia-plan', route, purchase: null },
                )
              }
            >
              {locked && <Check size={18} />}
              {locked ? 'Unlock' : 'Lock'}
            </button>
          </div>
        )}
        {g.vote && (
          <QuizPick
            vote={g.vote}
            current={null}
            viewer={viewer ?? -1}
            disabled={
              disabled || !canAdvance || (t.mode === 'expedition' && !ready)
            }
            showHostWait={false}
            onVote={(choice) => commit({ type: 'vote', choice })}
          />
        )}
      </div>
    </section>
  );
}

function LegacyTriviaCamp({
  g,
  viewer,
  disabled,
  canAdvance,
  hostName,
  commit,
}: {
  g: AnyGame;
  viewer: number | null;
  disabled: boolean;
  canAdvance: boolean;
  hostName?: string;
  commit: (move: AnyMove) => void;
}) {
  const t = triviaOf(g)!;
  const final = finalTriviaCamp(g);
  const mine = viewer === null ? null : t.plans[viewer];
  const locked = viewer !== null && t.ready[viewer];
  const p = viewer === null ? null : t.players[viewer];
  const [route, setRoute] = useState<TriviaRoute>(mine?.route ?? 'trail');
  const [purchase, setPurchase] = useState<'trophy' | 'supplies' | null>(
    mine?.purchase ?? null,
  );
  const ready = campReady(g);
  const selectedRoute = locked ? mine?.route : route;
  const selectedPurchase = locked ? mine?.purchase : purchase;
  const nextSupplies =
    (p?.supplies ?? 0) + (selectedPurchase === 'supplies' ? 1 : 0);
  const available = (kind: 'trophy' | 'supplies') =>
    !!p &&
    p.coins >= triviaCosts[kind] &&
    (kind !== 'supplies' || (!final && p.supplies < triviaCosts.maxSupplies));
  const canLock = !selectedPurchase || available(selectedPurchase);
  return (
    <section
      className={`trivia-camp ${t.mode === 'tower' ? 'is-tower' : 'is-expedition'}`}
      aria-label={`${t.mode === 'tower' ? 'Tower' : 'Expedition'} camp`}
    >
      <TriviaBoard g={g} />
      {t.mode === 'expedition' && p && (
        <div className="trivia-plan sabi-card">
          {!final && (
            <fieldset className="trivia-routes">
              <legend className="sr-only">Your next route</legend>
              {legacyTriviaRoutes.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={`trivia-route route-${r.id}`}
                  aria-pressed={selectedRoute === r.id}
                  aria-label={`${r.name}: ${r.threshold ? `${r.threshold} points for` : 'guaranteed'} ${r.coins + nextSupplies} coins and ${r.distance} step${r.distance === 1 ? '' : 's'}${r.threshold ? `; otherwise ${r.missCoins + nextSupplies} coin${r.missCoins + nextSupplies === 1 ? '' : 's'} and ${r.missDistance} step${r.missDistance === 1 ? '' : 's'}` : ''}`}
                  disabled={disabled || locked}
                  onClick={() => setRoute(r.id)}
                >
                  <span className="trivia-route-picture" aria-hidden="true">
                    <Footprints size={30} />
                    <i />
                    <i />
                    <i />
                  </span>
                  <b>{r.name}</b>
                  <span>
                    <Coins size={14} />
                    {r.coins + nextSupplies}
                    <Footprints size={14} />
                    {r.distance}
                  </span>
                  <small>
                    {r.threshold === 0 ? 'Any score' : `≥ ${r.threshold} pts`}
                  </small>
                </button>
              ))}
            </fieldset>
          )}
          <fieldset className="trivia-shop">
            <legend className="sr-only">Your camp purchase</legend>
            <button
              type="button"
              aria-pressed={selectedPurchase === null}
              disabled={disabled || locked}
              onClick={() => setPurchase(null)}
              aria-label="Save your coins"
            >
              Save
            </button>
            {(['trophy', 'supplies'] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                aria-pressed={selectedPurchase === kind}
                disabled={disabled || locked || !available(kind)}
                onClick={() => setPurchase(kind)}
                aria-label={`${kind === 'trophy' ? 'Trophy' : 'Supplies'}, ${triviaCosts[kind]} coins${kind === 'supplies' ? ', +1 coin every later round' : ''}`}
              >
                {kind === 'trophy' ? (
                  <Trophy size={20} />
                ) : (
                  <Package size={20} />
                )}
                <b>{kind === 'trophy' ? 'Trophy' : 'Supplies'}</b>
                <span>
                  <Coins size={14} />
                  {triviaCosts[kind]}
                </span>
              </button>
            ))}
          </fieldset>
          <div className="trivia-plan-actions">
            <span
              className="trivia-wallet"
              aria-label={`${p.coins} coins, ${p.supplies} supplies`}
            >
              <Coins size={18} />
              {p.coins}
              <Package size={18} />
              {p.supplies}
            </span>
            <button
              className={locked ? 'party-locked' : 'party-primary'}
              disabled={disabled || (locked && ready) || !canLock}
              onClick={() =>
                commit(
                  locked
                    ? { type: 'trivia-unlock' }
                    : {
                        type: 'trivia-plan',
                        route: final ? null : route,
                        purchase,
                      },
                )
              }
            >
              {locked && <Check size={18} />} {locked ? 'Unlock' : 'Lock'}
            </button>
          </div>
        </div>
      )}
      {g.vote && (
        <QuizPick
          vote={g.vote}
          current={
            g.vote.opening || t.completed === 0 ? null : (g.kind as SetGame)
          }
          viewer={viewer ?? -1}
          disabled={
            disabled || !canAdvance || (t.mode === 'expedition' && !ready)
          }
          hostName={hostName}
          showHostWait={false}
          onVote={(choice) => commit({ type: 'vote', choice })}
        />
      )}
    </section>
  );
}
