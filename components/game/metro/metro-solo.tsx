'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createMetro,
  observe,
  play,
  type MetroGame,
  type MetroMove,
} from '@/lib/games/metro/engine';
import { botTurn } from '@/lib/games/metro/bot';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBoardLeave } from '../use-board-leave';
import { recordCompletedGame } from '../play-experience';
import { readMetroSave, writeMetroSave, type MetroChoice } from './metro-save';
import { MetroTable } from './metro-table';

const VOLUME = 'gamehub.metro.volume';

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];

function fresh(choice: MetroChoice): MetroGame {
  if (choice.learn) return createMetro(1, seed(), { names: ['You'], bots: [false] });
  return createMetro(choice.seats, seed(), {
    ext: choice.ext,
    difficulty: choice.difficulty,
    bots: Array.from({ length: choice.seats }, (_, i) => i > 0),
  });
}

const lessons = [
  { title: 'Read the card', text: 'The tile shows a bank, Moon or Sun, and a station shape.' },
  { title: 'Draw a section', text: 'Tap a lit station: your line runs to it from the coloured start.' },
  { title: 'Done', text: 'Press Done and the next card turns over. You may also pass.' },
  { title: 'Join the starts', text: 'Meet your line from the other bank for 10 more points.' },
  { title: 'Scoring', text: 'Districts your line crosses, times its most stations in one district.' },
];

/** A solo match against bots, saved on this device. */
export default function MetroSolo({ choice, onExit }: { choice: MetroChoice; onExit: () => void }) {
  const [g, setG] = useState<MetroGame>(() => (choice.resume && readMetroSave()) || fresh(choice));
  const [volume, setVolume] = useState(() => readAudioLevel(VOLUME));
  const [lesson, setLesson] = useState(choice.learn ? 0 : -1);
  // Practice ends when the coach hands over to a real match.
  const practice = lesson >= 0;
  const leaving = useLeaveDialog();
  const recorded = useRef(false);

  useEffect(() => {
    if (!practice) writeMetroSave(g);
    if (g.over && !practice && !recorded.current) {
      recorded.current = true;
      recordCompletedGame('Metro');
    }
  }, [g, practice]);

  // Bots draw their turn in the background from what they may see; the next
  // card turns once every seat has pressed Done.
  useEffect(() => {
    if (g.over) return;
    const bot = g.seats.findIndex((s) => s.bot && !s.locked);
    if (bot < 0) return;
    const timer = setTimeout(() => {
      setG((cur) => {
        if (cur.round !== g.round || cur.turn !== g.turn || cur.seats[bot].locked) return cur;
        let next = cur;
        for (const m of botTurn(observe(cur, bot), bot)) next = play(next, m, bot);
        return next;
      });
    }, 90);
    return () => clearTimeout(timer);
  }, [g]);

  const move = useCallback((m: MetroMove) => setG((cur) => play(cur, m, 0)), []);
  // The practice coach follows what you do.
  const [coached, setCoached] = useState(g);
  if (coached !== g) {
    setCoached(g);
    const mine = g.seats[0].sections.length;
    if (lesson === 1 && mine > 0) setLesson(2);
    else if (lesson === 2 && g.turn > 1) setLesson(3);
  }

  const exit = useCallback(() => {
    if (g.over || practice) onExit();
    else leaving.ask(onExit);
  }, [g.over, practice, onExit, leaving]);
  useBoardLeave(true, (allow) => {
    if (g.over || practice) {
      allow();
      onExit();
    } else
      leaving.ask(() => {
        allow();
        onExit();
      });
  });

  // The bots' turn in progress stays hidden, as it would at a table.
  const view = useMemo(() => observe(g, 0), [g]);
  const startMatch = () => {
    setLesson(-1);
    setG(fresh({ ...choice, learn: false }));
  };
  const coach =
    lesson >= 0 ? (
      <aside className="coach sandbox-coach metro-coach" aria-label="Practice" aria-live="polite">
        <div>
          <span>
            Practice · {Math.min(lesson + 1, lessons.length)}/{lessons.length}
          </span>
        </div>
        <h3>{lessons[lesson]?.title}</h3>
        <p>{lessons[lesson]?.text}</p>
        <div className="sandbox-controls">
          {lesson === lessons.length - 1 ? (
            <button onClick={startMatch}>Start a match</button>
          ) : (
            <button onClick={() => setLesson(lesson + 1)}>Next</button>
          )}
          <button onClick={startMatch}>Skip</button>
        </div>
      </aside>
    ) : null;

  return (
    <>
      <MetroTable
        g={view}
        seat={0}
        onMove={move}
        onLeave={exit}
        onAgain={() => setG(fresh({ ...choice, learn: false }))}
        volume={volume}
        onVolume={(v) => {
          setVolume(v);
          saveAudioLevel(v, VOLUME);
        }}
        tableSlot={coach}
      />
      <LeaveDialog
        state={leaving}
        title="Leave the map?"
        saved="Your match is saved on this device."
        theme="metro"
      />
    </>
  );
}
