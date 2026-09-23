'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  CountryGuess,
  CountryView,
} from '@/lib/games/folio/kinds/country';
import { COUNTRY_NAMES } from '@/lib/games/folio/country-names';
import { Panel, useFresh, usePulse, useToast, type KindProps } from './shared';
import './country.css';

const ANGLE: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};
const WORDS: Record<string, string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};
const CONFETTI = Array.from({ length: 18 }, (_, i) => i);

/** Worldle's autocomplete: names starting with the text first, then containing it. */
function suggest(text: string, taken: Set<string>) {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const starts: string[] = [],
    contains: string[] = [];
  for (const n of COUNTRY_NAMES) {
    if (taken.has(n)) continue;
    const l = n.toLowerCase();
    if (l.startsWith(q)) starts.push(n);
    else if (l.includes(q)) contains.push(n);
  }
  return [...starts, ...contains];
}

export default function Country({
  p,
  view,
  busy,
  done,
  move,
}: KindProps<CountryView>) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  // The highlighted suggestion, by name so it survives the list changing under it.
  const [picked, setPicked] = useState<string | null>(null);
  const [toast, say] = useToast();
  const [shake, fireShake] = usePulse();
  const fresh = useFresh(view.guesses.length);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId().replace(/:/g, '');
  const taken = useMemo(
    () => new Set(view.guesses.map((g) => g.name)),
    [view.guesses],
  );
  const options = useMemo(() => suggest(text, taken), [text, taken]);
  const won = view.guesses.at(-1)?.pct === 100;
  const lost = done && !won;
  const rows = Math.max(p.allowance, view.guesses.length);
  const active = picked ? options.indexOf(picked) : -1;

  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-i="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(name: string) {
    setText(name);
    setPicked(null);
    setOpen(false);
    input.current?.focus();
  }
  async function guess() {
    if (done || busy) return;
    const name = COUNTRY_NAMES.find(
      (n) => n.toLowerCase() === text.trim().toLowerCase(),
    );
    if (!name) {
      say('Unknown country!');
      fireShake();
      return;
    }
    if (taken.has(name)) {
      say('Country already guessed!');
      fireShake();
      return;
    }
    setOpen(false);
    const error = await move({ guess: name });
    if (error) {
      say(error);
      fireShake();
    } else {
      setText('');
      setPicked(null);
    }
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const shown = open && options.length > 0;
    if (e.key === 'ArrowDown' && shown) {
      e.preventDefault();
      setPicked(options[(active + 1) % options.length]);
    } else if (e.key === 'ArrowUp' && shown) {
      e.preventDefault();
      setPicked(options[active <= 0 ? options.length - 1 : active - 1]);
    } else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (shown && active >= 0) choose(options[active]);
      else void guess();
    }
  }

  return (
    <Panel className={`fk-country ${won ? 'won' : ''} ${lost ? 'lost' : ''}`}>
      {toast}
      <figure
        className="fk-country-stage"
        aria-label="Country outline to identify"
      >
        <svg
          key={view.shape}
          className="fk-country-shape"
          viewBox="0 0 200 200"
          aria-labelledby={`${uid}-title`}
        >
          <title id={`${uid}-title`}>
            {view.rotate ? 'Outline, turned' : 'Outline'}
          </title>
          <defs>
            <filter
              id={`${uid}-ink`}
              x="-5%"
              y="-5%"
              width="110%"
              height="110%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                seed="4"
              />
              <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.55 1.12" />
              <feComposite in="SourceGraphic" operator="in" />
            </filter>
          </defs>
          <g
            transform={
              view.rotate ? `rotate(${view.rotate} 100 100)` : undefined
            }
          >
            <path
              className="fk-country-fill"
              d={view.shape}
              filter={`url(#${uid}-ink)`}
            />
            <path className="fk-country-line" d={view.shape} pathLength={1} />
          </g>
        </svg>
        {won && (
          <div className="fk-country-confetti" aria-hidden="true">
            {CONFETTI.map((i) => (
              <i key={i} style={{ '--i': i } as React.CSSProperties} />
            ))}
          </div>
        )}
      </figure>
      {done && view.answer && (
        <p className={`fk-country-answer ${won ? 'won' : ''}`}>
          {won ? 'Well done! ' : ''}
          <b>{view.answer.toUpperCase()}</b>
        </p>
      )}
      <ol className="fk-country-rows" aria-label="Guesses">
        {Array.from({ length: rows }, (_, i) => {
          const g = view.guesses[i];
          return g ? (
            <GuessRow key={i} g={g} fresh={i >= fresh} />
          ) : (
            <li key={i} className="fk-country-row empty" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </li>
          );
        })}
      </ol>
      {!done && (
        <form
          className={`fk-country-form ${shake ? 'shake' : ''}`}
          onSubmit={(e) => {
            e.preventDefault();
            void guess();
          }}
        >
          <div className="fk-country-field">
            <input
              ref={input}
              type="text"
              value={text}
              placeholder="Country, territory..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              role="combobox"
              aria-label="Country"
              aria-expanded={open && options.length > 0}
              aria-controls={`${uid}-list`}
              aria-autocomplete="list"
              aria-activedescendant={
                active >= 0 ? `${uid}-o${active}` : undefined
              }
              readOnly={busy}
              onChange={(e) => {
                setText(e.target.value);
                setPicked(null);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKey}
            />
            {open && options.length > 0 && (
              <ul ref={list} id={`${uid}-list`} className="fk-country-list">
                {options.map((n, i) => (
                  <li key={n}>
                    <button
                      type="button"
                      id={`${uid}-o${i}`}
                      data-i={i}
                      tabIndex={-1}
                      aria-current={i === active || undefined}
                      className={i === active ? 'active' : ''}
                      // mousedown keeps focus in the field so blur does not close the list first
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(n)}
                      onMouseEnter={() => setPicked(n)}
                    >
                      <Highlight name={n} query={text} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="fk-country-go" disabled={busy}>
            Guess
          </button>
        </form>
      )}
    </Panel>
  );
}

function Highlight({ name, query }: { name: string; query: string }) {
  const q = query.trim().toLowerCase();
  const at = name.toLowerCase().indexOf(q);
  if (!q || at < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, at)}
      <b>{name.slice(at, at + q.length)}</b>
      {name.slice(at + q.length)}
    </>
  );
}

function GuessRow({ g, fresh }: { g: CountryGuess; fresh: boolean }) {
  const hit = g.pct === 100;
  return (
    <li
      className={`fk-country-row ${fresh ? 'fresh' : ''} ${hit ? 'hit' : ''}`}
      aria-label={
        hit
          ? `${g.name}, correct`
          : `${g.name}, ${g.km} km, go ${WORDS[g.dir!]}, ${g.pct}%`
      }
    >
      <span
        className="fk-country-name"
        style={{ '--i': 0 } as React.CSSProperties}
      >
        {g.name}
      </span>
      <span
        className="fk-country-km"
        style={{ '--i': 1 } as React.CSSProperties}
      >
        {g.km.toLocaleString('en-US')} km
      </span>
      <span
        className="fk-country-dir"
        style={{ '--i': 2 } as React.CSSProperties}
      >
        {hit ? (
          <svg
            viewBox="0 0 24 24"
            className="fk-country-star"
            aria-hidden="true"
          >
            <path d="M12 1.5l2.6 6.9 7.2.4-5.6 4.6 1.9 7.1L12 16.5l-6.1 4 1.9-7.1-5.6-4.6 7.2-.4z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="fk-country-arrow"
            style={{ '--a': `${ANGLE[g.dir!]}deg` } as React.CSSProperties}
            aria-hidden="true"
          >
            <path d="M12 2.5l7 8.2h-4.6v10.8H9.6V10.7H5z" />
          </svg>
        )}
      </span>
      <span
        className="fk-country-pct"
        style={{ '--i': 3 } as React.CSSProperties}
      >
        {g.pct}%
      </span>
    </li>
  );
}
