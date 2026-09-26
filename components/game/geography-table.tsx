'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Check, ArrowRight, LockKeyhole, Expand } from 'lucide-react';
import {
  activeTeam,
  captain,
  challengeLabels,
  challenges,
  closestPoints,
  nearPoints,
  type GeoGame,
  type GeoMove,
} from '@/lib/games/party/geography';
import { groupName } from '@/lib/games/party/groups';
import type { MapPin } from './geo-pin-map';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CountUp, stagger } from './reveal-motion';
import { SabiSteps } from './sabi-steps';
import './geography-table.css';
// The globe pulls in three.js; load it only once an Atlas table opens.
const GeoPinMap = lazy(() =>
  import('./geo-pin-map').then((m) => ({ default: m.GeoPinMap })),
);
/** Seat colours, shared with Sizes. */
const colors = [
  '#ff5a3c',
  '#3569ff',
  '#12a870',
  '#9c52f2',
  '#f28c28',
  '#f26aae',
];
type Advance = { canAdvance: boolean; hostName?: string };
export function GeographyTable({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: GeoGame;
  viewer: number;
  disabled: boolean;
  commit: (m: GeoMove) => void;
} & Advance) {
  // Reset clue-local state between categories and decision phases.
  return (
    <Round
      key={`${g.round}:${g.challenge}:${g.phase}:${g.turn}`}
      g={g}
      viewer={viewer}
      disabled={disabled}
      commit={commit}
      canAdvance={canAdvance}
      hostName={hostName}
    />
  );
}
function Round({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: {
  g: GeoGame;
  viewer: number;
  disabled: boolean;
  commit: (m: GeoMove) => void;
} & Advance) {
  const [selected, setSelected] = useState(0);
  const prompt =
    g.phase === 'reveal' ? challenges.indexOf(g.challenge) : selected;
  const kind = challenges[prompt];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (g.discussionEndsAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [g.discussionEndsAt]);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const [photoRetry, setPhotoRetry] = useState(0);
  const [photoOpen, setPhotoOpen] = useState(false);
  const spectator = viewer < 0 || viewer >= g.seats.length;
  const team = g.teams[viewer],
    mine = g.guesses[viewer];
  const revealed = g.phase === 'reveal',
    discussing = g.phase === 'discuss';
  const active = activeTeam(g),
    cap = captain(g, active);
  const canPin = !disabled && !spectator && g.phase === 'guess' && !mine.locked;
  const canChoose = !disabled && discussing && viewer === cap;
  const allPinsPlaced = !!mine?.pins.every(Boolean);
  const nextUnfinished = challenges
    .map((_, offset) => (prompt + offset + 1) % challenges.length)
    .find((index) => !mine?.pins[index]);
  const current = g.prompts[prompt];
  const members = g.teams.flatMap((t, s) => (t === team ? [s] : []));
  const visiblePins: MapPin[] = revealed
    ? [
        ...g.result!.pins.map((pair, t) => ({
          ...pair[0],
          color: colors[t],
          label: groupName(g, t),
        })),
        {
          ...g.result!.places[0],
          color: '#ffd23f',
          label: 'Answer',
          answer: true,
        },
      ]
    : g.guesses.flatMap((guess, s) =>
        guess.pins[prompt]
          ? [
              {
                ...guess.pins[prompt]!,
                color: colors[s],
                label: `${s + 1} · ${g.seats[s]}`,
              },
            ]
          : [],
      );
  const place = revealed ? g.result!.places[0] : null;
  const final = kind === 'final';
  const photo =
    current.photo &&
    (failedPhoto === current.photo ? (
      <div className="atlas-photo is-missing" role="alert">
        <button
          type="button"
          onClick={() => {
            setFailedPhoto(null);
            setPhotoRetry((n) => n + 1);
          }}
        >
          Retry photo
        </button>
      </div>
    ) : (
      <button
        type="button"
        className="atlas-photo"
        onClick={() => setPhotoOpen(true)}
        aria-label="Enlarge photograph"
      >
        <img
          key={`${current.photo}-${photoRetry}`}
          src={`${current.photo}${photoRetry ? `?retry=${photoRetry}` : ''}`}
          alt={place ? place.name : (current.photoAlt ?? 'Location photograph')}
          onError={() => setFailedPhoto(current.photo)}
        />
        <Expand size={16} aria-hidden="true" />
      </button>
    ));
  return (
    <section
      className={`sabi-stage atlas-stage ${revealed ? 'is-revealed' : ''}`}
    >
      <div className="sabi-board atlas-board">
        <Suspense fallback={<div className="atlas-map-shell" />}>
          <GeoPinMap
            pins={visiblePins}
            onPin={
              canPin ? (p) => commit({ type: 'pin', prompt, ...p }) : undefined
            }
          />
        </Suspense>
        {discussing && (
          <output className="atlas-turn">
            {groupName(g, active)}
            {g.discussionEndsAt !== null && (
              <b>
                {Math.max(0, Math.ceil((g.discussionEndsAt - now) / 1000))}s
              </b>
            )}
          </output>
        )}
        {visiblePins.length > 0 && (
          <div className="atlas-pin-legend">
            {visiblePins.map((p, i) => (
              <span
                key={i}
                data-game-motion="piece"
                data-game-motion-key={`${p.label}:${p.color}`}
              >
                <i style={{ background: p.color }} />
                {p.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <aside className={`sabi-card atlas-card ${final ? 'is-final' : ''}`}>
        <SabiSteps
          steps={challenges.map((c) => challengeLabels[c])}
          current={prompt}
          label={discussing ? 'Team places' : 'Your places'}
          done={(i) =>
            revealed
              ? i < prompt
              : !!(discussing
                  ? g.choices[team]?.seats[i] != null
                  : mine?.pins[i])
          }
          onSelect={revealed ? undefined : setSelected}
        />
        <div
          className="atlas-clue"
          data-game-motion="change"
          data-game-motion-key={`${prompt}:${revealed}`}
        >
          {final && !revealed ? (
            <>
              {photo}
              <ol className="atlas-facts">
                {current.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            </>
          ) : (
            <>
              {final && photo}
              <h2>
                {place ? `${place.name}, ${place.country}` : current.title}
              </h2>
            </>
          )}
        </div>
        {current.photo && (
          <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
            <DialogContent className="atlas-photo-dialog">
              <DialogHeader>
                <DialogTitle>Photograph</DialogTitle>
              </DialogHeader>
              <img
                src={current.photo}
                alt={current.photoAlt ?? 'Location photograph'}
              />
            </DialogContent>
          </Dialog>
        )}
        {!revealed && !discussing && !spectator && !mine.locked && (
          <div
            className="sabi-actions"
            data-game-motion="change"
            data-game-motion-key={allPinsPlaced ? 'lock' : 'next'}
          >
            <button
              type="button"
              className="party-primary"
              disabled={disabled || !mine.pins[prompt]}
              onClick={() => {
                if (allPinsPlaced) commit({ type: 'lock' });
                else if (nextUnfinished !== undefined)
                  setSelected(nextUnfinished);
              }}
            >
              {allPinsPlaced ? (
                <LockKeyhole size={16} />
              ) : (
                <ArrowRight size={16} />
              )}
              {allPinsPlaced ? 'Lock' : 'Next'}
            </button>
          </div>
        )}
        {discussing && !spectator && (
          <div className="sabi-actions atlas-discuss">
            <div className="atlas-candidates">
              {members.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!canChoose}
                  aria-pressed={g.choices[team].seats[prompt] === s}
                  onClick={() => commit({ type: 'choose', prompt, seat: s })}
                >
                  <i style={{ background: colors[s] }}>{s + 1}</i>
                  {g.seats[s]}
                  {g.choices[team].seats[prompt] === s && <Check size={16} />}
                </button>
              ))}
            </div>
            {canChoose && (
              <button
                type="button"
                className="party-primary"
                disabled={g.choices[team].seats.some((s) => s === null)}
                onClick={() => commit({ type: 'lock' })}
              >
                <LockKeyhole size={16} />
                Confirm
              </button>
            )}
          </div>
        )}
        {revealed && (
          <>
            <ol className="sabi-results">
              {g
                .result!.distances.map((pair, t) => ({
                  t,
                  km: pair[0],
                  gain: g.result!.gains[t],
                }))
                .sort((a, b) => a.km - b.km)
                .map((row, i) => (
                  <li
                    key={row.t}
                    className={`reveal-rise ${row.gain === closestPoints + nearPoints ? 'is-perfect' : ''} ${row.t === g.teams[viewer] ? 'is-you' : ''}`}
                    style={stagger(i, 200, 160)}
                  >
                    <i
                      style={{ background: colors[row.t] }}
                      aria-hidden="true"
                    />
                    <b>{groupName(g, row.t)}</b>
                    <CountUp
                      value={row.km}
                      duration={800}
                      delay={200 + i * 160}
                      format={(v) => `${Math.round(v).toLocaleString('en')} km`}
                    />
                    <strong
                      className={`reveal-pop ${row.gain === closestPoints + nearPoints ? 'reveal-burst' : ''}`}
                      style={stagger(i, 1000, 160)}
                    >
                      +{row.gain}
                    </strong>
                  </li>
                ))}
            </ol>
            <details className="atlas-sources">
              <summary>Sources</summary>
              <a href={place!.source} target="_blank" rel="noreferrer">
                Location reference
              </a>
              {final && place!.photoSource && (
                <p>
                  <a href={place!.photoSource} target="_blank" rel="noreferrer">
                    Original photograph
                  </a>{' '}
                  · {(place!.artist ?? '').replace(/<[^>]*>/g, '')} ·{' '}
                  <a
                    href={place!.licenseUrl || place!.photoSource}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {place!.license}
                  </a>{' '}
                  · Resized for play.
                </p>
              )}
            </details>
            {!spectator &&
              (canAdvance ? (
                <div className="sabi-actions">
                  <button
                    type="button"
                    className="party-primary"
                    disabled={disabled}
                    onClick={() => commit({ type: 'next' })}
                  >
                    Next
                  </button>
                </div>
              ) : (
                <p className="party-host-wait">
                  {hostName ?? 'The host'} moves on
                </p>
              ))}
          </>
        )}
      </aside>
    </section>
  );
}
