'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- A painted card tile is one labelled picture. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Lock, RotateCcw, Ticket, Undo2, Volume2 } from 'lucide-react';
import {
  BANK_CARDS,
  bonusOf,
  cardShape,
  cardSide,
  colourOf,
  legalDraws,
  lineState,
  liveLine,
  mapOf,
  outcome,
  scoreSeat,
  validMove,
  type Card,
  type MetroGame,
  type MetroMove,
} from '@/lib/games/metro/engine';
import { SIDES, type Side } from '@/lib/games/metro/map';
import {
  INTERCHANGE_POINTS,
  goalProgress,
  type Final,
  type LineScore,
} from '@/lib/games/metro/score';
import { gameSound } from '@/lib/games/game-sound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { GameNavigation } from '../game-navigation';
import { PlayerStatus } from '../player-status';
import { SoundToggle } from '../sound-settings';
import { useBadgeFit } from '../use-fit';
import { useResultsFeedback, WinnerCelebration } from '../results-feedback';
import { useGameSound } from '../use-game-sound';
import { RuleSection, Rules } from '../rules';
import { BANK_NAMES, BankIcon, CardFace, LINE_NAMES, ShapeIcon, cardLabel } from './metro-art';
import { MetroMap, type Ghost } from './metro-map';
import {
  ExtensionRules,
  MetroRules,
  bonuses,
  extensionNames,
  goals as goalDefs,
} from './metro-rules';
import './metro.css';

export type MetroPerson = { online: boolean; bot: boolean; you?: boolean };

/** A painted card tile; it turns over when a new card takes its place. */
function CardTile({ card, small, label }: { card: Card; small?: boolean; label?: string }) {
  return (
    <span
      className="metro-card"
      data-small={small || undefined}
      data-side={cardSide(card) ?? 'switch'}
      role="img"
      aria-label={label ?? cardLabel(card)}
    >
      <CardFace card={card} />
    </span>
  );
}

/** The cards flipped this round, a row per bank: five slots each, and the
 *  round ends when a row fills. */
function Rack({ g }: { g: MetroGame }) {
  const per = (side: Side) => g.shown.filter((c) => cardSide(c) === side);
  const switched = g.shown.includes('sw');
  return (
    <div className="metro-rack" aria-label="Cards flipped this round">
      {SIDES.map((side) => {
        const cards = per(side);
        return (
          <div
            key={side}
            className="metro-rack-row"
            data-side={side}
            aria-label={`${BANK_NAMES[side]} bank: ${cards.length} of ${BANK_CARDS}`}
          >
            <span className="metro-rack-bank">
              <BankIcon side={side} />
            </span>
            {Array.from({ length: BANK_CARDS }, (_, i) => (
              <span key={i} className="metro-rack-slot" data-filled={i < cards.length || undefined}>
                {cards[i] && <ShapeIcon shape={cardShape(cards[i])!} />}
              </span>
            ))}
          </div>
        );
      })}
      <span
        className="metro-rack-switch"
        data-used={switched || undefined}
        aria-label={switched ? 'The switch has flipped' : 'The switch is still to come'}
      >
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 34 V20 M20 20 L10 7 M20 20 L30 7" />
        </svg>
      </span>
    </div>
  );
}

const lineText = (l: LineScore) =>
  l.parts.length
    ? l.parts.map((p) => `${p.districts}×${p.most}`).join(' + ')
    : '—';

/** The score ticket: each round's line, interchanges, goals and the total. */
function ScoreTicket({
  g,
  seat,
  final,
  onOpen,
}: {
  g: MetroGame;
  seat: number;
  final: Final;
  onOpen?: () => void;
}) {
  const s = g.seats[seat];
  const live = !g.over && s.lines.length < g.round ? liveLine(g, seat) : null;
  const rows = [...s.lines, ...(live ? [live] : [])];
  return (
    <button
      type="button"
      className="metro-ticket"
      onClick={onOpen}
      aria-label={`${s.name}: ${final.total} points. Show the score sheet.`}
    >
      <span className="metro-ticket-head">
        <Ticket aria-hidden="true" />
        <b>{final.total}</b>
      </span>
      <span className="metro-ticket-lines">
        {s.order.map((c, r) => {
          const l = rows[r];
          return (
            <span
              key={r}
              className="metro-ticket-row"
              data-line={c}
              data-live={(live && r === g.round - 1) || undefined}
              data-future={!l || undefined}
            >
              <i className="metro-roundel" aria-label={`Round ${r + 1}, ${LINE_NAMES[c]}`}>
                {r + 1}
              </i>
              <span className="metro-ticket-sum">
                {l ? lineText(l) : ''}
                {l?.bonus ? <em>+{l.bonus}</em> : null}
              </span>
              <b>{l ? l.total : ''}</b>
            </span>
          );
        })}
      </span>
      <span className="metro-ticket-row metro-ticket-inter">
        <span className="metro-inter-marks" aria-label="Interchanges">
          {([2, 3, 4] as const).map((n) => (
            <span key={n} data-n={n}>
              <i>{n}</i>
              {final.interchanges.counts[n]}
            </span>
          ))}
        </span>
        <b>{final.interchanges.points}</b>
      </span>
      {g.goals.length > 0 && (
        <span className="metro-ticket-row metro-ticket-goals">
          <span className="metro-goal-marks" aria-label="Goals">
            {g.goals.map((id) => {
              const G = goalDefs[id];
              return (
                <G.Icon
                  key={id}
                  data-done={final.goals.includes(id) || undefined}
                  aria-label={`${G.name}${final.goals.includes(id) ? ', reached' : ''}`}
                />
              );
            })}
          </span>
          <b>{final.goalPoints}</b>
        </span>
      )}
    </button>
  );
}

/**
 * A Metro table: your map of the city in the middle, the cards flipped this
 * round on the left and your score ticket on the right, the turn's card in
 * the dock with Undo and Done. Solo and online tables both drive it.
 */
export function MetroTable({
  g,
  seat,
  people,
  onMove,
  onLeave,
  onAgain,
  againLabel = 'Play again',
  volume,
  onVolume,
  tableSlot,
  resultSlot,
  notice,
}: {
  g: MetroGame;
  seat: number;
  people?: MetroPerson[];
  onMove: (m: MetroMove) => void;
  onLeave: () => void;
  onAgain?: () => void;
  againLabel?: string;
  volume: number;
  onVolume: (v: number) => void;
  /** The table admin's Table button, or the practice coach. */
  tableSlot?: ReactNode;
  /** Under the final standings. */
  resultSlot?: ReactNode;
  notice?: string;
}) {
  const map = mapOf(g);
  const me = g.seats[seat];
  const over = g.over;
  const [panel, setPanel] = useState<'rules' | 'score' | 'others' | 'goal' | 'bonus' | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [viewing, setViewing] = useState(seat);
  // A pick belongs to its turn: the next card clears it.
  const turnKey = `${g.round}:${g.turn}:${me.sections.length}`;
  const [held, setHeld] = useState<{ key: string; from: number | null; to: number | null }>({
    key: turnKey,
    from: null,
    to: null,
  });
  const pick = held.key === turnKey ? held : { key: turnKey, from: null, to: null };
  const setPick = (from: number | null, to: number | null) => setHeld({ key: turnKey, from, to });
  const badges = useRef<HTMLDivElement>(null);
  useBadgeFit(badges);
  useGameSound('metro', volume);

  const colour = over ? undefined : colourOf(g, seat);
  const draws = useMemo(() => (over ? [] : legalDraws(g, seat)), [g, seat, over]);
  const scores = useMemo(
    () => g.seats.map((_, i) => (g.final ? g.final[i] : scoreSeat(g, i))),
    [g],
  );
  // What lights up: with a station to reach picked, the ends that reach it;
  // with an end picked, where it goes (the other ends stay tappable to
  // switch); otherwise every end that can go somewhere and every station
  // within reach.
  const usable = draws.filter(
    (d) => (pick.from === null || d.from === pick.from) && (pick.to === null || d.to === pick.to),
  );
  const targets = new Set(usable.map((d) => d.to));
  const leaving = new Set((pick.to === null ? draws : usable).map((d) => d.from));
  const ghosts: Ghost[] = usable;
  const myFresh = useMemo(
    () => new Set(me.sections.filter((s) => s.r === g.round && s.t === g.turn)),
    [me.sections, g.round, g.turn],
  );
  const joined = !over && lineState(g, seat).joined;

  // Sounds: a new card turns over, a line joins, the round closes.
  const seenTurn = useRef(`${g.round}:${g.turn}`);
  useEffect(() => {
    const key = `${g.round}:${g.turn}`;
    if (key === seenTurn.current || over) return;
    const newRound = seenTurn.current.split(':')[0] !== String(g.round);
    seenTurn.current = key;
    gameSound('metro', newRound ? 'round' : 'flip', volume);
    // Only a new turn matters here.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [g.round, g.turn, over]);
  const wasJoined = useRef(joined);
  useEffect(() => {
    if (joined && !wasJoined.current) gameSound('metro', 'join', volume);
    wasJoined.current = joined;
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  const outcomeNow = over ? outcome(g) : null;
  useResultsFeedback('metro', over, over, volume);

  function send(m: MetroMove) {
    if (!validMove(g, m, seat)) {
      gameSound('metro', 'invalid', volume);
      return false;
    }
    onMove(m);
    return true;
  }
  function draw(from: number, to: number) {
    if (send({ type: 'draw', from, to })) gameSound('metro', 'place', volume);
    setPick(null, null);
  }
  function tapStation(id: number) {
    if (me.locked || over) return;
    // A station picked to reach: tap an end that reaches it, or the station
    // again to let it go.
    if (pick.to !== null) {
      if (id !== pick.to && leaving.has(id)) return draw(id, pick.to);
      return setPick(null, null);
    }
    // A station that is both an end and within reach (only on a switch
    // turn) is picked as an end first, so every section stays reachable.
    const end = leaving.has(id);
    if (targets.has(id) && !(end && pick.from === null)) {
      const ways = usable.filter((d) => d.to === id);
      if (ways.length === 1) return draw(ways[0].from, id);
      gameSound('metro', 'select', volume);
      return setPick(null, id);
    }
    if (end) {
      gameSound('metro', 'select', volume);
      return setPick(pick.from === id ? null : id, null);
    }
    setPick(null, null);
  }

  const status = (i: number): 'deciding' | 'ready' | 'offline' => {
    if (people?.[i] && !people[i].online && !people[i].bot) return 'offline';
    return g.seats[i].locked ? 'ready' : 'deciding';
  };
  const viewSeat = over ? viewing : seat;
  const viewed = g.seats[viewSeat];
  const bonus = over ? null : bonusOf(g);
  const B = bonus ? bonuses[bonus] : null;
  const peek = bonus === 'peek' && g.deck[0] ? g.deck[0] : null;
  const drawn = myFresh.size;
  const canDraw = !me.locked && draws.length > 0;
  const goalTile = (id: (typeof g.goals)[number], k: number) => {
    const G = goalDefs[id];
    const p = goalProgress(map, id, viewed.sections, viewed.boxed);
    return (
      <button
        key={id}
        type="button"
        className="metro-goal"
        data-done={p.have >= p.need || undefined}
        onClick={() => {
          setGoal(k);
          setPanel('goal');
        }}
        aria-label={`${G.name}: ${Math.min(p.have, p.need)} of ${p.need}`}
      >
        <G.Icon aria-hidden="true" />
        <span>
          {Math.min(p.have, p.need)}/{p.need}
        </span>
      </button>
    );
  };

  return (
    <main
      className="metro-world"
      data-over={over || undefined}
      data-locked={me.locked || undefined}
      data-line={colour}
    >
      <div className="metro-hall" aria-hidden="true" />
      <GameNavigation
        name="Metro"
        round={over ? 'Final' : `Round ${g.round} of ${g.rounds}`}
        onBack={onLeave}
        onOthers={g.seats.length > 1 ? () => setPanel('others') : undefined}
        menu={{
          theme: 'metro',
          onRules: () => setPanel('rules'),
          items: [
            { label: 'Score sheet', icon: Ticket, onSelect: () => setPanel('score') },
          ],
          sound: (
            <SoundToggle
              Icon={Volume2}
              label="Sound effects"
              on={volume > 0}
              onChange={(on) => onVolume(on ? 0.5 : 0)}
            />
          ),
          onLeave,
        }}
      />
      {tableSlot}
      <div className="metro-players" ref={badges} aria-label="Players">
        {g.seats.map((s, i) => (
          <button
            type="button"
            key={i}
            className="metro-badge"
            data-you={i === seat || undefined}
            data-line={over ? undefined : s.order[g.round - 1]}
            title={s.name}
            onClick={() => (over ? setViewing(i) : i === seat ? setPanel('score') : setPanel('others'))}
            aria-label={`${s.name}, ${scores[i].total} points`}
          >
            <i className="metro-badge-mark" aria-hidden="true">
              {s.name.slice(0, 1).toUpperCase()}
            </i>
            <b className="metro-badge-name">{s.name}</b>
            <span className="metro-badge-score">{scores[i].total}</span>
            {!over && <PlayerStatus state={status(i)} />}
          </button>
        ))}
      </div>
      {notice && <output className="metro-notice">{notice}</output>}
      <div className="metro-stage">
        <aside className="metro-side metro-side-left">
          {!over && <Rack g={g} />}
          {B && (
            <button
              type="button"
              className="metro-bonus"
              onClick={() => setPanel('bonus')}
              aria-label={`This round: ${B.name}`}
            >
              <B.Icon aria-hidden="true" />
              <span>{B.name}</span>
            </button>
          )}
          {g.goals.length > 0 && (
            <div className="metro-goals" aria-label="Goals">
              {g.goals.map((id, k) => goalTile(id, k))}
            </div>
          )}
        </aside>
        <section className="metro-board">
          <MetroMap
            map={map}
            sections={viewed.sections}
            boxed={viewed.boxed}
            colour={over ? undefined : colour}
            froms={canDraw ? leaving : undefined}
            targets={canDraw ? targets : undefined}
            picked={pick.from ?? undefined}
            ghosts={canDraw ? ghosts : undefined}
            fresh={over ? undefined : myFresh}
            onStation={canDraw ? tapStation : undefined}
            label={`${viewed.name}’s map`}
          />
        </section>
        <aside className="metro-side metro-side-right">
          <ScoreTicket
            g={g}
            seat={viewSeat}
            final={scores[viewSeat]}
            onOpen={() => setPanel('score')}
          />
        </aside>
      </div>
      {over && outcomeNow ? (
        <section className="metro-results" aria-label="Results">
          <WinnerCelebration won={outcomeNow.winners.includes(seat)} />
          <h2>{outcomeNow.title}</h2>
          <ol>
            {outcomeNow.rows.map((r, rank) => (
              <li
                key={r.seat}
                data-you={r.seat === seat || undefined}
                data-viewing={r.seat === viewing || undefined}
              >
                <button
                  type="button"
                  onClick={() => setViewing(r.seat)}
                  aria-label={`${r.name}: ${r.value} points. Show their map.`}
                >
                  <span className="metro-rank">{rank + 1}</span>
                  <b>{r.name}</b>
                  <span className="metro-result-total">{r.value}</span>
                </button>
              </li>
            ))}
          </ol>
          {resultSlot}
          <div className="metro-results-actions">
            {onAgain && (
              <button type="button" className="metro-button metro-again" onClick={onAgain}>
                <RotateCcw aria-hidden="true" />
                {againLabel}
              </button>
            )}
            <button type="button" className="metro-button" onClick={onLeave}>
              Leave
            </button>
          </div>
        </section>
      ) : (
        <div className="metro-dock" aria-label="This turn">
          <button
            type="button"
            className="metro-undo"
            disabled={me.locked || drawn === 0}
            onClick={() => send({ type: 'undo' })}
            aria-label="Undo"
          >
            <Undo2 aria-hidden="true" />
          </button>
          <div className="metro-cards" data-turn={`${g.round}-${g.turn}`}>
            {g.cards.map((c, i) => (
              <CardTile key={`${g.round}-${g.turn}-${i}-${c}`} card={c} />
            ))}
            {peek && (
              <span className="metro-peek">
                <CardTile card={peek} small label={`Next: ${cardLabel(peek)}`} />
              </span>
            )}
          </div>
          {me.locked ? (
            <button
              type="button"
              className="metro-done"
              data-locked=""
              onClick={() => send({ type: 'reopen' })}
              aria-label="Locked in. Tap to change this turn."
            >
              <Lock aria-hidden="true" />
              <PlayerStatus state="waiting" />
            </button>
          ) : (
            <button
              type="button"
              className="metro-done"
              data-ready={drawn > 0 || !canDraw || undefined}
              onClick={() => {
                if (send({ type: 'done' })) gameSound('metro', 'select', volume);
              }}
              aria-label={drawn > 0 || !canDraw ? 'Done' : 'Done without drawing'}
            >
              <Check aria-hidden="true" />
              <span>Done</span>
            </button>
          )}
        </div>
      )}
      <Dialog open={panel === 'rules'} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="modal help-modal metro-modal">
          <DialogTitle>How to play</DialogTitle>
          <DialogDescription className="sr-only">Metro rules</DialogDescription>
          <MetroRules />
          {(['goals', 'express'] as const)
            .filter((e) => g.ext[e])
            .map((e) => (
              <div key={e} className="metro-rules-ext">
                <h3>{extensionNames[e]}</h3>
                <ExtensionRules id={e} />
              </div>
            ))}
        </DialogContent>
      </Dialog>
      <Dialog open={panel === 'score'} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="modal metro-modal metro-score-modal">
          <DialogTitle>Score sheet</DialogTitle>
          <DialogDescription className="sr-only">Everyone’s points so far</DialogDescription>
          <ScoreTable g={g} scores={scores} seat={seat} />
        </DialogContent>
      </Dialog>
      <Dialog open={panel === 'others'} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="modal metro-modal metro-others-modal">
          <DialogTitle>Others</DialogTitle>
          <DialogDescription className="sr-only">
            The other players’ maps, as of their last finished turn
          </DialogDescription>
          <div className="metro-others">
            {g.seats.map((s, i) =>
              i === seat ? null : (
                <figure key={i}>
                  <MetroMap
                    map={map}
                    sections={s.sections}
                    boxed={s.boxed}
                    colour={over ? undefined : s.order[g.round - 1]}
                    label={`${s.name}’s map`}
                    className="metro-map-small"
                  />
                  <figcaption>
                    <i className="metro-roundel" data-line={over ? undefined : s.order[g.round - 1]} aria-hidden="true">
                      {s.name.slice(0, 1).toUpperCase()}
                    </i>
                    <b>{s.name}</b>
                    <span>{scores[i].total}</span>
                    {!over && <PlayerStatus state={status(i)} />}
                  </figcaption>
                </figure>
              ),
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={panel === 'goal' && goal !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="modal extension-rules-modal metro-modal">
          {goal !== null && g.goals[goal] && (
            <>
              <DialogTitle>{goalDefs[g.goals[goal]].name}</DialogTitle>
              <DialogDescription className="sr-only">Goal</DialogDescription>
              <Rules className="metro-rules">
                <RuleSection note="Everyone who reaches it by the end scores 10.">
                  <p>{goalDefs[g.goals[goal]].text}</p>
                </RuleSection>
              </Rules>
              <ul className="metro-goal-who">
                {g.seats.map((s, i) => {
                  const p = goalProgress(map, g.goals[goal], s.sections, s.boxed);
                  return (
                    <li key={i} data-done={p.have >= p.need || undefined}>
                      <b>{s.name}</b>
                      <span>
                        {Math.min(p.have, p.need)}/{p.need}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={panel === 'bonus' && !!B} onOpenChange={(o) => !o && setPanel(null)}>
        <DialogContent className="modal extension-rules-modal metro-modal">
          {B && (
            <>
              <DialogTitle>{B.name}</DialogTitle>
              <DialogDescription className="sr-only">This round’s bonus</DialogDescription>
              <Rules className="metro-rules">
                <RuleSection note="It lasts this round only.">
                  <p>{B.text}</p>
                </RuleSection>
              </Rules>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ScoreTable({ g, scores, seat }: { g: MetroGame; scores: Final[]; seat: number }) {
  const lines = g.seats.map((s, i) => {
    const live = !g.over && s.lines.length < g.round ? liveLine(g, i) : null;
    return [...s.lines, ...(live ? [live] : [])];
  });
  return (
    <div className="metro-score-table-wrap">
      <table className="metro-score-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Line</span>
            </th>
            {g.seats.map((s, i) => (
              <th key={i} scope="col" data-you={i === seat || undefined}>
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: g.rounds }, (_, r) => (
            <tr key={r}>
              <th scope="row">Round {r + 1}</th>
              {g.seats.map((s, i) => {
                const l = lines[i][r];
                return (
                  <td key={i}>
                    <i className="metro-roundel" data-line={s.order[r]} aria-label={LINE_NAMES[s.order[r]]} />
                    {l ? (
                      <span>
                        {lineText(l)}
                        {l.bonus ? ` +${l.bonus}` : ''} = <b>{l.total}</b>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row">Interchanges</th>
            {scores.map((f, i) => (
              <td key={i}>
                <span>
                  {([2, 3, 4] as const)
                    .filter((n) => f.interchanges.counts[n])
                    .map((n) => `${INTERCHANGE_POINTS[n]}×${f.interchanges.counts[n]}`)
                    .join(' + ') || '0'}{' '}
                  = <b>{f.interchanges.points}</b>
                </span>
              </td>
            ))}
          </tr>
          {g.goals.length > 0 && (
            <tr>
              <th scope="row">Goals</th>
              {scores.map((f, i) => (
                <td key={i}>
                  <b>{f.goalPoints}</b>
                </td>
              ))}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {scores.map((f, i) => (
              <td key={i}>{f.total}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

