'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  ArrowRight,
  LockKeyhole,
  MapPin as PinIcon,
  Camera,
  Lightbulb,
} from 'lucide-react';
import {
  activeTeam,
  captain,
  challengeLabels,
  challenges,
  type GeoGame,
  type GeoMove,
} from '@/lib/games/party/geography';
import { groupName } from '@/lib/games/party/groups';
import { GeoPinMap, type MapPin } from './geo-pin-map';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './geography-table.css';
const colors = [
  '#b74735',
  '#365ac0',
  '#26765b',
  '#853b95',
  '#ac6520',
  '#3b7180',
];
export function GeographyTable({
  g,
  viewer,
  disabled,
  commit,
}: {
  g: GeoGame;
  viewer: number;
  disabled: boolean;
  commit: (m: GeoMove) => void;
}) {
  // Reset clue-local state between categories and decision phases.
  return (
    <Round
      key={`${g.round}:${g.challenge}:${g.phase}:${g.turn}`}
      g={g}
      viewer={viewer}
      disabled={disabled}
      commit={commit}
    />
  );
}
function Round({
  g,
  viewer,
  disabled,
  commit,
}: {
  g: GeoGame;
  viewer: number;
  disabled: boolean;
  commit: (m: GeoMove) => void;
}) {
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
          color: '#ffdb72',
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
  return (
    <section className="atlas-stage">
      <output className="atlas-turn">
        <b>
          {revealed
            ? 'The answer is in'
            : discussing
              ? `${groupName(g, active)} has the floor${g.discussionEndsAt === null ? '' : ` · ${Math.max(0, Math.ceil((g.discussionEndsAt - now) / 1000))}s`}`
              : 'Complete all three private pins'}
        </b>
        <span>
          {revealed
            ? 'Gold marks the answer. Compare your distances below.'
            : discussing
              ? `${g.seats[cap]} chooses all three team pins. The other team listens.`
              : 'Places, Photos and Three facts, in any order. Discussion starts when everyone locks all three.'}
        </span>
      </output>
      <div className="atlas-layout">
        <div className="atlas-cartography">
          <GeoPinMap
            pins={visiblePins}
            onPin={
              canPin ? (p) => commit({ type: 'pin', prompt, ...p }) : undefined
            }
          />
          <div className="atlas-pin-legend">
            {visiblePins.map((p, i) => (
              <span key={i}>
                <i style={{ background: p.color }} />
                {p.label}
              </span>
            ))}
          </div>
        </div>
        <aside className="atlas-fieldbook">
          {!revealed && (
            <div
              className="atlas-tabs"
              aria-label={discussing ? 'Team categories' : 'Private categories'}
            >
              {challenges.map((category, i) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={selected === i}
                  onClick={() => setSelected(i)}
                >
                  {['Places', 'Photos', 'Three facts'][i]}
                  {(discussing
                    ? g.choices[team]?.seats[i] != null
                    : mine?.pins[i]) && (
                    <Check
                      size={14}
                      aria-label={discussing ? 'Team pin chosen' : 'Pin placed'}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="atlas-clue">
            <small>
              {kind === 'named' ? (
                <PinIcon size={16} />
              ) : kind === 'photo' ? (
                <Camera size={16} />
              ) : (
                <Lightbulb size={16} />
              )}
              {challengeLabels[kind]}
            </small>
            <h2>
              {revealed
                ? `${g.result!.places[0].name}, ${g.result!.places[0].country}`
                : current.title}
            </h2>
            {current.photo &&
              (failedPhoto === current.photo ? (
                <div role="alert">
                  Photo unavailable.{' '}
                  <button
                    onClick={() => {
                      setFailedPhoto(null);
                      setPhotoRetry((n) => n + 1);
                    }}
                  >
                    Retry photo
                  </button>
                </div>
              ) : (
                <img
                  key={`${current.photo}-${photoRetry}`}
                  className="atlas-photo"
                  src={`${current.photo}${photoRetry ? `?retry=${photoRetry}` : ''}`}
                  alt={
                    revealed
                      ? g.result!.places[0].name
                      : (current.photoAlt ?? 'Location photograph')
                  }
                  onError={() => setFailedPhoto(current.photo)}
                />
              ))}
            {current.photo && (
              <>
                <button
                  className="atlas-photo-expand"
                  onClick={() => setPhotoOpen(true)}
                >
                  Enlarge photograph
                </button>
                <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
                  <DialogContent className="atlas-photo-dialog">
                    <DialogHeader>
                      <DialogTitle>Destination photograph</DialogTitle>
                    </DialogHeader>
                    <img
                      src={current.photo}
                      alt={current.photoAlt ?? 'Location photograph'}
                    />
                  </DialogContent>
                </Dialog>
              </>
            )}
            {current.facts.length > 0 && (
              <ol className="atlas-facts">
                {current.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ol>
            )}
          </div>
          {!revealed && !discussing && (
            <div className="atlas-actions">
              <p>
                {spectator
                  ? 'Players are placing their private pins.'
                  : mine.locked
                    ? 'All three pins are frozen. Waiting for everyone to finish.'
                    : mine.pins[prompt]
                      ? 'Pin placed. Tap the map to adjust it.'
                      : 'Tap the map to place your pin.'}
              </p>
              {!spectator && (
                <output className="atlas-pin-progress">
                  {allPinsPlaced
                    ? 'All three pins placed. Ready to lock.'
                    : `${mine.pins.filter(Boolean).length}/3 private pins placed`}
                </output>
              )}
              {!spectator && !mine.locked && (
                <button
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
                  {allPinsPlaced ? 'Lock all three pins' : 'Next'}
                </button>
              )}
            </div>
          )}
          {discussing && (
            <div className="atlas-actions">
              <p>
                {spectator
                  ? `${groupName(g, active)} is choosing.`
                  : team === active
                    ? 'Choose one frozen teammate pin in each tab, then confirm all three. After 60 seconds, missing choices use the captain’s pins.'
                    : 'Listen to the other team. All three of your pins are already frozen.'}
              </p>
              {!spectator && (
                <div className="atlas-candidates">
                  {members.map((s) => (
                    <button
                      key={s}
                      disabled={!canChoose}
                      aria-pressed={g.choices[team].seats[prompt] === s}
                      onClick={() =>
                        commit({ type: 'choose', prompt, seat: s })
                      }
                    >
                      <i style={{ background: colors[s] }}>{s + 1}</i>
                      {g.seats[s]}
                      {g.choices[team].seats[prompt] === s && (
                        <Check size={16} />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {canChoose && (
                <>
                  <p>
                    {g.choices[team].seats.filter((s) => s !== null).length}/3
                    team pins chosen
                  </p>
                  <button
                    className="party-primary"
                    disabled={g.choices[team].seats.some((s) => s === null)}
                    onClick={() => commit({ type: 'lock' })}
                  >
                    Confirm all three team pins
                  </button>
                </>
              )}
            </div>
          )}
          {revealed && (
            <div className="atlas-reveal">
              {g.result!.distances.map((pair, t) => (
                <div key={t}>
                  <b>{groupName(g, t)}</b>
                  <strong>
                    {Math.round(pair[0]).toLocaleString()} km away
                  </strong>
                </div>
              ))}
              <p>Closest pin: +1 · Within 100 km: +1</p>
              <details>
                <summary>Sources & photograph credits</summary>
                <a
                  href={g.result!.places[0].source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Location reference
                </a>
                {g.challenge === 'photo' && (
                  <p>
                    <a
                      href={g.result!.places[0].photoSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Original photograph
                    </a>{' '}
                    · {g.result!.places[0].artist.replace(/<[^>]*>/g, '')} ·{' '}
                    <a
                      href={
                        g.result!.places[0].licenseUrl ||
                        g.result!.places[0].photoSource
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {g.result!.places[0].license}
                    </a>{' '}
                    · Resized for play.
                  </p>
                )}
              </details>
              <div className="atlas-round-score">
                {g.result!.gains.map((gain, t) => (
                  <span key={t}>
                    {groupName(g, t)} <b>+{gain}</b> this category
                  </span>
                ))}
              </div>
              {!spectator && (
                <button
                  className="party-primary"
                  disabled={disabled || g.ready[viewer]}
                  onClick={() => commit({ type: 'ready' })}
                >
                  {g.ready[viewer]
                    ? 'Waiting for everyone…'
                    : g.round === 2 && g.challenge === 'facts'
                      ? 'Finish game'
                      : g.challenge === 'facts'
                        ? 'Next round →'
                        : 'Next category →'}
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
