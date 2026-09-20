'use client';
import { lazy, Suspense } from 'react';
import { LockKeyhole, Compass, Check } from 'lucide-react';
import {
  captain,
  challengeLabels,
  type GeoGame,
  type GeoMove,
} from '@/lib/games/party/geography';
import { groupName } from '@/lib/games/party/groups';
import { SortableRanking } from './ranking-handle';
import './geography-table.css';
const GeoGlobe = lazy(() =>
  import('./geo-globe').then((m) => ({ default: m.GeoGlobe })),
);
const colors = ['#ff795d', '#ffd36b', '#7ee6db', '#bda5ff', '#f3a4cf'];
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
  const group = g.teams[viewer],
    choice = g.guesses[group],
    cap = captain(g, group),
    spectator = viewer < 0 || viewer >= g.seats.length;
  const revealed = g.phase === 'reveal',
    order = revealed
      ? g.result!.order
      : choice?.order.length
        ? choice.order
        : [0, 1, 2, 3, 4];
  const pins = revealed
    ? g.result!.order.map((id, i) => ({
        ...g.result!.places[id],
        color: colors[i],
        label: `${i + 1}. ${g.cities[id].name}`,
      }))
    : g.anchor
      ? [{ ...g.anchor, color: '#ffffff', label: g.anchor.name }]
      : [];
  function value(id: number) {
    const v = g.result!.values[id];
    return g.challenge === 'distance'
      ? `${Math.round(v).toLocaleString()} km`
      : g.challenge === 'west-east'
        ? `${Math.abs(v).toFixed(1)}° ${v < 0 ? 'W' : 'E'}`
        : `${Math.abs(v).toFixed(1)}° ${v < 0 ? 'N' : 'S'}`;
  }
  return (
    <section className={`atlas-stage ${revealed ? 'is-revealed' : ''}`}>
      <div className="atlas-brief">
        <span className="party-eyebrow">
          <Compass size={16} /> SHARED CHALLENGE
        </span>
        <h2>
          {revealed ? 'Your route, revealed.' : challengeLabels[g.challenge]}
        </h2>
        <p>
          {g.challenge === 'distance'
            ? `Order these capitals from nearest to farthest from ${g.anchor!.name}, ${g.anchor!.country}.`
            : g.challenge === 'west-east'
              ? 'Order these capitals by longitude, from the westernmost to the easternmost.'
              : 'Order these capitals by latitude, from the northernmost to the southernmost.'}
        </p>
        <small>
          Same five cities for everyone · no speed bonus · one point per correct
          position, +2 for all five
        </small>
      </div>
      <div className="atlas-layout">
        <div className="atlas-globe-frame">
          <Suspense fallback={<p>Unfolding the world…</p>}>
            <GeoGlobe pins={pins} />
          </Suspense>
          <div className="atlas-map-caption">
            {revealed
              ? 'Follow the coloured stops. Spin the globe to explore.'
              : g.anchor
                ? `White pin: ${g.anchor.name}`
                : 'An unlabelled world. The cities appear after everyone locks.'}
          </div>
        </div>
        <div className="atlas-route">
          <h3>
            {revealed
              ? 'The correct route'
              : spectator
                ? 'The shared cities'
                : `${groupName(g, group)}’s route`}
          </h3>
          <SortableRanking
            key={`${g.round}-${g.phase}`}
            order={order}
            disabled={disabled || revealed || !!choice?.locked || spectator}
            label={(id) => g.cities[id].name}
            onReorder={(next) => commit({ type: 'arrange', order: next })}
            render={(id, i) => (
              <>
                <span
                  className="tier-label"
                  style={revealed ? { background: colors[i] } : undefined}
                >
                  {i + 1}
                </span>
                <span>
                  <strong>{g.cities[id].name}</strong>
                  <small>
                    {g.cities[id].country}
                    {revealed ? ` · ${value(id)}` : ''}
                  </small>
                </span>
              </>
            )}
          />
          {!revealed && (
            <p>
              {spectator
                ? 'Answers stay hidden until every player or team locks.'
                : g.mode === 'teams'
                  ? `Talk it through together. Everyone on your team can move cities; ${g.seats[cap]} locks the route.`
                  : 'Drag the handles, then lock your private route.'}
            </p>
          )}
          {revealed && (
            <div className="atlas-results guess-comparison" aria-live="polite">
              {g.scores.map((_, t) => (
                <div key={t}>
                  <h4>
                    {groupName(g, t)} <b>+{g.result!.gains[t]}</b>
                  </h4>
                  <ol>
                    {g.result!.guesses[t].order.map((id, i) => (
                      <li
                        className={id === order[i] ? 'correct' : 'incorrect'}
                        key={id}
                      >
                        <span>{i + 1}</span>
                        {g.cities[id].name} {id === order[i] ? '✓' : '×'}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {revealed && (
        <details className="atlas-sources">
          <summary>Check the locations and sources</summary>
          <p>
            Approximate capital coordinates from the World Bank. Distances are
            great-circle distances between those coordinates. Directional rounds
            use signed longitude or latitude; ties and near-ties are excluded.
          </p>
          {g.result!.order.map((id) => (
            <p key={id}>
              <a
                href={g.result!.places[id].source}
                target="_blank"
                rel="noreferrer"
              >
                {g.cities[id].name}
              </a>{' '}
              · {value(id)}
            </p>
          ))}
        </details>
      )}
      <div className="party-dock" aria-live="polite">
        {revealed ? (
          <button
            className="party-primary"
            disabled={disabled || spectator || g.ready[viewer]}
            onClick={() => commit({ type: 'ready' })}
          >
            {g.ready[viewer]
              ? 'Waiting for everyone…'
              : g.round === 6
                ? 'See results'
                : 'Next shared challenge'}
            <Check size={18} />
          </button>
        ) : (
          <>
            <span>
              <LockKeyhole size={16} />
              {g.guesses.filter((b) => b?.locked).length} / {g.scores.length}{' '}
              {g.mode === 'teams' ? 'teams' : 'players'} locked
            </span>
            {cap === viewer && (
              <button
                className="party-primary"
                disabled={disabled}
                onClick={() =>
                  commit({ type: choice?.locked ? 'unlock' : 'lock' })
                }
              >
                {choice?.locked ? 'Unlock route' : 'Lock route'}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
