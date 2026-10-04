'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Check, Pencil, Search, Send, Undo2 } from 'lucide-react';
import type { AnyMove } from '@/lib/games/standalone/registry';
import {
  clueLimit,
  drawMs,
  givesAway,
  inks,
  maxPoints,
  maxStrokePoints,
  maxStrokes,
  nibs,
  packPoints,
  unpackPoints,
  type ImpostorGame,
  type Stroke,
} from '@/lib/games/party/impostor';
import { voteTally, type RoundChoice } from '@/lib/games/party/vote';
import { useSecondsLeft } from './table-vote';
import { stagger } from './reveal-motion';
import './impostor.css';

type Props = {
  g: ImpostorGame;
  viewer: number;
  disabled: boolean;
  commit: (m: AnyMove) => void;
  canAdvance: boolean;
  hostName?: string;
};

/** Impostor's table: a drawing card against the clock, then an evidence
 * board with every drawing pinned to it, one word each, the accusations,
 * and a reveal that strings each accuser to their suspect. */
export function ImpostorTable(props: Props) {
  const { g } = props;
  if (g.phase === 'draw')
    return <DrawDesk key={`draw:${g.round}`} {...props} />;
  return <EvidenceBoard key={`board:${g.round}`} {...props} />;
}

/** A smooth path through a stroke's points, in the card's 0–1000 square. */
function sketchPath(p: number[]) {
  if (p.length < 4) return `M${p[0]} ${p[1]}l0.1 0`;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length - 2; i += 2)
    d += `Q${p[i]} ${p[i + 1]} ${(p[i] + p[i + 2]) / 2} ${(p[i + 1] + p[i + 3]) / 2}`;
  return `${d}L${p[p.length - 2]} ${p[p.length - 1]}`;
}
function traceStroke(
  ctx: CanvasRenderingContext2D,
  p: number[],
  c: number,
  w: number,
  scale: number,
) {
  ctx.strokeStyle = inks[c];
  ctx.fillStyle = inks[c];
  ctx.lineWidth = nibs[w] * scale;
  ctx.beginPath();
  if (p.length < 4) {
    ctx.arc(p[0] * scale, p[1] * scale, (nibs[w] * scale) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(p[0] * scale, p[1] * scale);
  for (let i = 2; i < p.length - 2; i += 2)
    ctx.quadraticCurveTo(
      p[i] * scale,
      p[i + 1] * scale,
      ((p[i] + p[i + 2]) / 2) * scale,
      ((p[i + 1] + p[i + 3]) / 2) * scale,
    );
  ctx.lineTo(p[p.length - 2] * scale, p[p.length - 1] * scale);
  ctx.stroke();
}

export function Sketch({
  strokes,
  label,
}: {
  strokes: Stroke[];
  label: string;
}) {
  const paths = useMemo(
    () => strokes.map((s) => ({ ...s, d: sketchPath(unpackPoints(s.p)) })),
    [strokes],
  );
  return (
    <>
      <span className="sr-only">{label}</span>
      <svg className="imp-sketch" viewBox="0 0 1000 1000" aria-hidden="true">
        {paths.map((s, i) => (
          <path
            key={i}
            d={s.d}
            stroke={inks[s.c]}
            strokeWidth={nibs[s.w]}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </>
  );
}

/** The secret word, on a manila tag. */
function WordTag({ word, small }: { word: string; small?: boolean }) {
  return (
    <span className={`imp-word ${small ? 'is-small' : ''}`}>
      <i aria-hidden="true" />
      <b>{word}</b>
    </span>
  );
}

function Countdown({ endsAt }: { endsAt: number | null }) {
  const left = useSecondsLeft(endsAt);
  if (left === null) return null;
  const total = drawMs / 1000,
    share = Math.min(1, left / total);
  return (
    <span
      className={`imp-clock ${left <= 10 ? 'is-late' : ''}`}
      role="timer"
      aria-label={`${left} seconds left`}
      style={{ '--left': share } as CSSProperties}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" />
        <circle cx="20" cy="20" r="17" pathLength={1} />
      </svg>
      <b>{left}</b>
    </span>
  );
}

/** Drawing against the clock. Strokes are kept here while they are drawn
 * and sent one by one, so a refresh or the clock never loses a card. */
function DrawDesk({ g, viewer, disabled, commit }: Props) {
  const mine = g.sketches[viewer];
  const [strokes, setStrokes] = useState<Stroke[]>(() => mine?.strokes ?? []);
  const [ink, setInk] = useState(0),
    [nib, setNib] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null),
    live = useRef<{ id: number; p: number[] } | null>(null),
    size = useRef(0);
  // Practice has no clock.
  const endsAt = g.tutorial ? null : g.drawEndsAt;
  const left = useSecondsLeft(endsAt);
  const locked = !!mine?.locked,
    timeUp = left === 0,
    used = strokes.reduce((t, s) => t + s.p.length / 4, 0),
    full = strokes.length >= maxStrokes || used >= maxPoints,
    // Strokes queue while one is in flight, so drawing never waits on the network.
    canDraw = !locked && !timeUp && !full;

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const scale = c.width / 1000;
    for (const s of strokes)
      traceStroke(ctx, unpackPoints(s.p), s.c, s.w, scale);
    if (live.current) traceStroke(ctx, live.current.p, ink, nib, scale);
  }, [strokes, ink, nib]);

  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const px = Math.round(
        c.getBoundingClientRect().width * Math.min(2.5, devicePixelRatio || 1),
      );
      if (px && px !== size.current) {
        size.current = px;
        c.width = px;
        c.height = px;
      }
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(c);
    return () => observer.disconnect();
  }, [redraw]);

  function at(e: { clientX: number; clientY: number }) {
    const r = canvas.current!.getBoundingClientRect();
    return [
      Math.round(
        Math.min(1000, Math.max(0, ((e.clientX - r.left) / r.width) * 1000)),
      ),
      Math.round(
        Math.min(1000, Math.max(0, ((e.clientY - r.top) / r.height) * 1000)),
      ),
    ];
  }
  function finish() {
    const s = live.current;
    live.current = null;
    if (!s || !s.p.length) return;
    const stroke: Stroke = { c: ink, w: nib, p: packPoints(s.p) };
    setStrokes((list) => [...list, stroke]);
    commit({ type: 'stroke', stroke });
  }
  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (
      !canDraw ||
      live.current ||
      (e.pointerType === 'mouse' && e.button !== 0)
    )
      return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = { id: e.pointerId, p: at(e) };
    redraw();
  }
  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    const s = live.current;
    if (!s || s.id !== e.pointerId) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = at(ev),
        n = s.p.length;
      const dx = x - s.p[n - 2],
        dy = y - s.p[n - 1];
      if (dx * dx + dy * dy < 36) continue;
      s.p.push(x, y);
      // A long line carries on as a new stroke rather than growing past a
      // request's size.
      if (
        s.p.length / 2 >= maxStrokePoints ||
        used + s.p.length / 2 >= maxPoints
      ) {
        finish();
        if (strokes.length + 2 > maxStrokes || used + 1 >= maxPoints) return;
        live.current = { id: e.pointerId, p: [x, y] };
        break;
      }
    }
    redraw();
  }
  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (live.current?.id !== e.pointerId) return;
    finish();
  }
  function undo() {
    if (!strokes.length) return;
    setStrokes((list) => list.slice(0, -1));
    commit({ type: 'undo' });
  }
  return (
    <section className="imp-desk" aria-label="Your drawing">
      <header className="imp-desk-head">
        <WordTag word={g.words[viewer]} />
        <Countdown endsAt={endsAt} />
      </header>
      <div className="imp-pad-room">
        <div className={`imp-pad ${locked ? 'is-locked' : ''}`}>
          <canvas
            ref={canvas}
            className={canDraw ? 'is-live' : ''}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
            aria-label={`Drawing card for ${g.words[viewer]}`}
          />
          {locked && <span className="imp-pin is-big" aria-hidden="true" />}
        </div>
      </div>
      <footer className="imp-tools">
        <div className="imp-inks">
          {inks.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-pressed={ink === i}
              aria-label={['Graphite', 'Red', 'Blue'][i]}
              className={`imp-ink ${ink === i ? 'is-on' : ''}`}
              style={{ '--ink': c } as CSSProperties}
              disabled={locked}
              onClick={() => setInk(i)}
            />
          ))}
        </div>
        <div className="imp-nibs">
          {nibs.map((w, i) => (
            <button
              key={w}
              type="button"
              aria-pressed={nib === i}
              aria-label={['Fine', 'Marker', 'Broad'][i]}
              className={`imp-nib ${nib === i ? 'is-on' : ''}`}
              style={
                {
                  '--nib': `${6 + i * 5}px`,
                  '--ink': inks[ink],
                } as CSSProperties
              }
              disabled={locked}
              onClick={() => setNib(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="imp-undo"
          aria-label="Undo"
          disabled={locked || timeUp || !strokes.length}
          onClick={undo}
        >
          <Undo2 size={20} />
        </button>
        {locked ? (
          <button
            type="button"
            className="imp-edit"
            disabled={disabled || timeUp}
            onClick={() => commit({ type: 'unlock' })}
          >
            <Pencil size={17} /> Edit
          </button>
        ) : (
          <button
            type="button"
            className="party-primary imp-done"
            disabled={disabled || timeUp || !strokes.length}
            onClick={() => commit({ type: 'lock' })}
          >
            <Check size={18} strokeWidth={3} /> Done
          </button>
        )}
      </footer>
    </section>
  );
}

const gapFor = (width: number) => (width < 520 ? 8 : 16);
/** Chooses the column count that gives every card the most room. */
function useBoardFit(n: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ cols: Math.min(n, 4), size: 160, gap: 16 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect(),
        gap = gapFor(width),
        // A card is its square drawing and a footer.
        ratio = 1.24;
      let best = { cols: 1, size: 0, gap };
      for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols),
          w = (width - gap * (cols - 1)) / cols,
          h = (height - gap * (rows - 1)) / rows,
          size = Math.floor(Math.min(w, h / ratio));
        if (size > best.size) best = { cols, size, gap };
      }
      setFit((f) =>
        f.cols === best.cols && f.size === best.size && f.gap === best.gap
          ? f
          : best,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [n]);
  return { ref, ...fit };
}

/** Where each card's pin sits inside the board, for the reveal's strings. */
function usePins(
  board: React.RefObject<HTMLDivElement | null>,
  key: string,
  active: boolean,
) {
  const [pins, setPins] = useState<[number, number][]>([]);
  useLayoutEffect(() => {
    const el = board.current;
    if (!el || !active) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      setPins(
        [...el.querySelectorAll<HTMLElement>('[data-pin]')].map((pin) => {
          const r = pin.getBoundingClientRect();
          return [
            r.left + r.width / 2 - box.left,
            r.top + r.height / 2 - box.top,
          ];
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [board, key, active]);
  return pins;
}

/** A slight tilt per seat, so the board looks pinned by hand. */
const tilt = (s: number) => [-2.2, 1.4, -0.8, 2, -1.6, 0.9, -2.6, 1.8][s % 8];

function EvidenceBoard({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
}: Props) {
  const n = g.seats.length,
    revealed = g.phase === 'vote' || g.phase === 'reveal',
    result = revealed ? g.result : null;
  const { ref, cols, size, gap } = useBoardFit(n);
  const pins = usePins(ref, `${cols}:${size}`, !!result);
  const myAccusation = g.accusations[viewer];
  const [chosen, setChosen] = useState<number | null>(
    myAccusation?.target ?? null,
  );
  const suspect = myAccusation?.locked ? myAccusation.target : chosen;
  const crowd = result
    ? g.words.find((_, s) => !g.impostors.includes(s))
    : null;
  const odd = result ? g.words[g.impostors[0]] : null;
  const allCaught = !!result && result.caught.length === g.impostors.length;
  const strings = result
    ? g.accusations.flatMap((a, s) =>
        a.target === null || !pins[s] || !pins[a.target]
          ? []
          : [
              {
                from: pins[s],
                to: pins[a.target],
                seat: s,
                hit: g.impostors.includes(a.target),
              },
            ],
      )
    : [];
  const stampAt = 160 + strings.length * 120;
  const accusing = g.phase === 'accuse' && !myAccusation?.locked && !disabled;

  return (
    <section
      className={`imp-room phase-${g.phase}`}
      aria-label="Evidence board"
    >
      <div className="imp-cork">
        <div
          ref={ref}
          className="imp-board"
          style={
            {
              '--cols': cols,
              '--card': `${size}px`,
              '--gap': `${gap}px`,
            } as CSSProperties
          }
        >
          {g.seats.map((name, s) => {
            const clue = g.clues[s],
              you = s === viewer,
              impostor = !!result && g.impostors.includes(s),
              caught = !!result && result.caught.includes(s),
              picked = suspect === s && g.phase === 'accuse',
              shown = you || g.phase !== 'clue';
            const body = (
              <>
                <span className="imp-pin" data-pin aria-hidden="true" />
                <span className="imp-card-art">
                  <Sketch
                    strokes={g.sketches[s].strokes}
                    label={`${name}'s drawing`}
                  />
                  {result && (
                    <span
                      className={`imp-card-word reveal-drop ${impostor ? 'is-odd' : ''}`}
                      style={stagger(s, stampAt, 60)}
                    >
                      {g.words[s]}
                    </span>
                  )}
                  {impostor && (
                    <span
                      className={`imp-stamp reveal-pop ${caught ? 'is-caught' : 'is-free'}`}
                      style={stagger(0, stampAt + 200)}
                    >
                      Impostor
                    </span>
                  )}
                  {result && result.tally[s] > 0 && (
                    <span
                      className="imp-tally reveal-pop"
                      style={stagger(0, stampAt - 80)}
                      aria-label={`${result.tally[s]} accusations`}
                    >
                      {result.tally[s]}
                    </span>
                  )}
                </span>
                <span className="imp-card-foot">
                  <span className={`party-avatar seat-${s}`} aria-hidden="true">
                    {name.slice(0, 1)}
                  </span>
                  <span className="imp-card-text">
                    <b className="imp-clue">
                      {shown && clue.text ? (
                        clue.text
                      ) : clue.locked ? (
                        <Check size={14} strokeWidth={3} aria-label="Written" />
                      ) : (
                        <span className="imp-dots" aria-label="Writing" />
                      )}
                    </b>
                    <small>{name}</small>
                  </span>
                  {result && (
                    <span
                      className={`imp-gain reveal-pop ${result.gains[s] ? '' : 'is-zero'}`}
                      style={stagger(0, stampAt + 450)}
                    >
                      +{result.gains[s]}
                    </span>
                  )}
                </span>
              </>
            );
            const cls = `imp-card ${you ? 'is-you' : ''} ${picked ? 'is-suspect' : ''} ${impostor ? 'is-impostor' : ''} ${caught ? 'is-caught' : ''}`;
            const style = { '--tilt': `${tilt(s)}deg` } as CSSProperties;
            return g.phase === 'accuse' && !you ? (
              <button
                key={s}
                type="button"
                className={cls}
                style={style}
                aria-pressed={picked}
                aria-label={`Suspect ${name}`}
                disabled={!accusing}
                onClick={() => setChosen(s)}
              >
                {body}
              </button>
            ) : (
              <div key={s} className={cls} style={style}>
                {body}
              </div>
            );
          })}
          {result && (
            <svg className="imp-strings" aria-hidden="true">
              {strings.map(({ from, to, seat, hit }, i) => {
                const sag = Math.min(
                  60,
                  Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.12,
                );
                return (
                  <path
                    key={seat}
                    className={`imp-string ${hit ? 'is-hit' : ''}`}
                    d={`M${from[0]} ${from[1]}Q${(from[0] + to[0]) / 2} ${(from[1] + to[1]) / 2 + sag} ${to[0]} ${to[1]}`}
                    pathLength={1}
                    style={stagger(i, 120, 120)}
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>
      <Dock
        g={g}
        viewer={viewer}
        disabled={disabled}
        commit={commit}
        canAdvance={canAdvance}
        hostName={hostName}
        chosen={chosen}
        crowd={crowd ?? null}
        odd={odd ?? null}
        allCaught={allCaught}
        revealAt={stampAt}
      />
    </section>
  );
}

function Dock({
  g,
  viewer,
  disabled,
  commit,
  canAdvance,
  hostName,
  chosen,
  crowd,
  odd,
  allCaught,
  revealAt,
}: Props & {
  chosen: number | null;
  crowd: string | null;
  odd: string | null;
  allCaught: boolean;
  revealAt: number;
}) {
  if (g.phase === 'clue')
    return (
      <ClueDock g={g} viewer={viewer} disabled={disabled} commit={commit} />
    );
  if (g.phase === 'accuse') {
    const mine = g.accusations[viewer],
      target = mine.locked ? mine.target : chosen;
    return (
      <footer className="imp-dock">
        <WordTag word={g.words[viewer]} small />
        <span className="imp-suspect" aria-live="polite">
          <Search size={18} aria-hidden="true" />
          {target !== null ? (
            <span className={`party-avatar seat-${target}`}>
              {g.seats[target].slice(0, 1)}
            </span>
          ) : (
            <span className="imp-suspect-empty" aria-label="No suspect" />
          )}
        </span>
        {mine.locked ? (
          <button
            type="button"
            className="imp-edit"
            disabled={disabled}
            onClick={() => commit({ type: 'unlock' })}
          >
            <Pencil size={17} /> Change
          </button>
        ) : (
          <button
            type="button"
            className="party-primary imp-accuse"
            disabled={disabled || chosen === null}
            onClick={() =>
              chosen !== null && commit({ type: 'accuse', target: chosen })
            }
          >
            Accuse
          </button>
        )}
      </footer>
    );
  }
  // The reveal: both words, caught or escaped, and the host's pick.
  const vote = g.vote,
    tally = vote ? voteTally(vote) : null,
    mine = vote?.choices[viewer] ?? null,
    pick = (choice: RoundChoice) => commit({ type: 'vote', choice }),
    open = !!vote && (vote.host ? canAdvance : true),
    caught = g.result?.caught.length ?? 0;
  return (
    <footer className="imp-dock is-reveal">
      <span
        className="imp-pair reveal-rise"
        style={stagger(0, revealAt)}
        aria-label={`Everyone drew ${crowd}; the impostor drew ${odd}`}
      >
        <WordTag word={crowd ?? ''} small />
        <span className="imp-vs" aria-hidden="true" />
        <span className="imp-word is-small is-odd">
          <i aria-hidden="true" />
          <b>{odd}</b>
        </span>
      </span>
      <strong
        className={`imp-verdict reveal-pop ${allCaught ? 'is-caught' : 'is-free'}`}
        style={stagger(0, revealAt + 250)}
      >
        {allCaught
          ? 'Caught'
          : caught
            ? `${caught}/${g.impostors.length} caught`
            : 'Escaped'}
      </strong>
      {vote && !g.over && (
        <span className="imp-next">
          {open ? (
            <>
              <button
                type="button"
                className={`party-primary ${mine === 'more' ? 'is-mine' : ''}`}
                disabled={disabled}
                aria-pressed={vote.host ? undefined : mine === 'more'}
                onClick={() => pick('more')}
              >
                Next round
                {!vote.host && tally && <VoteDots n={tally.more} />}
              </button>
              <button
                type="button"
                className={`imp-end ${mine === 'finish' ? 'is-mine' : ''}`}
                disabled={disabled}
                aria-pressed={vote.host ? undefined : mine === 'finish'}
                onClick={() => pick('finish')}
              >
                End
                {!vote.host && tally && <VoteDots n={tally.finish} />}
              </button>
              {!vote.host && <VoteSeconds endsAt={vote.endsAt} />}
            </>
          ) : (
            <span className="party-waiting">
              {hostName ?? 'The host'} picks
            </span>
          )}
        </span>
      )}
    </footer>
  );
}
function VoteDots({ n }: { n: number }) {
  return (
    <span className="imp-vote-dots" aria-label={`${n} votes`}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
function VoteSeconds({ endsAt }: { endsAt: number | null }) {
  const left = useSecondsLeft(endsAt);
  return left === null ? null : (
    <span
      className="imp-vote-clock"
      role="timer"
      aria-label={`${left} seconds left`}
    >
      {left}
    </span>
  );
}

function ClueDock({
  g,
  viewer,
  disabled,
  commit,
}: Pick<Props, 'g' | 'viewer' | 'disabled' | 'commit'>) {
  const mine = g.clues[viewer],
    word = g.words[viewer];
  const [text, setText] = useState(mine.text);
  const clean = text.replace(/\s+/g, ' ').trim(),
    blocked = clean.length > 0 && givesAway(clean, word),
    ready = clean.length > 0 && !blocked && clean.length <= clueLimit;
  const input = useRef<HTMLInputElement>(null);
  // Desktop players can type straight away; phones keep the board in view.
  useEffect(() => {
    if (!mine.locked && matchMedia('(pointer: fine)').matches)
      input.current?.focus({ preventScroll: true });
  }, [mine.locked]);
  return (
    <form
      className="imp-dock"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !mine.locked && !disabled)
          commit({ type: 'clue', text: clean });
      }}
    >
      <WordTag word={word} small />
      {mine.locked ? (
        <>
          <span className="imp-clue-sent">{mine.text}</span>
          <button
            type="button"
            className="imp-edit"
            disabled={disabled}
            onClick={() => commit({ type: 'unlock' })}
          >
            <Pencil size={17} /> Edit
          </button>
        </>
      ) : (
        <>
          <input
            ref={input}
            className={`imp-clue-input ${blocked ? 'is-blocked' : ''}`}
            value={text}
            maxLength={clueLimit}
            placeholder="One word"
            aria-label="One word"
            aria-invalid={blocked}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="party-primary imp-send"
            aria-label="Send"
            disabled={disabled || !ready}
          >
            <Send size={18} />
          </button>
        </>
      )}
    </form>
  );
}
