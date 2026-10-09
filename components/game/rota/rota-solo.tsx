'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createRota,
  observe,
  play,
  type RotaGame,
  type RotaMove,
} from '@/lib/games/rota/engine';
import { botRound } from '@/lib/games/rota/bot';
import { readRotaSave, writeRotaSave as writeSave, type RotaChoice } from './rota-save';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBoardLeave } from '../use-board-leave';
import { recordCompletedGame } from '../play-experience';
import { RotaTable } from './rota-table';
import { readAudioLevel, saveAudioLevel } from '@/lib/games/audio-preferences';

const VOLUME = 'gamehub.rota.volume';

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];

function fresh(choice: RotaChoice): RotaGame {
  if (choice.learn)
    return createRota(1, seed(), { map: 'meadow', names: ['You'], bots: [false] });
  return createRota(choice.seats, seed(), {
    map: choice.map,
    ext: choice.ext,
    difficulty: choice.difficulty,
    bots: Array.from({ length: choice.seats }, (_, i) => i > 0),
  });
}

const lessons = [
  { title: 'Pick a die', text: 'Tap a die, then a lit square beside an exit on the edge.' },
  { title: 'Turn it', text: 'Tap the piece you just drew to turn it.' },
  { title: 'Place all four', text: 'Every piece must join an exit or a route of its kind. Then press Done.' },
  { title: 'A special', text: 'Once a round you may add a special from the strip beside Undo. Three a match.' },
  { title: 'Loose ends', text: 'Red dots are loose ends: each costs a point at the end. Link as many exits as you can.' },
];

/** A solo match against bots, saved on this device. */
export default function RotaSolo({
  choice,
  onExit,
}: {
  choice: RotaChoice;
  onExit: () => void;
}) {
  const [g, setG] = useState<RotaGame>(() => (choice.resume && readRotaSave()) || fresh(choice));
  const [volume, setVolume] = useState(() => readAudioLevel(VOLUME));
  const [lesson, setLesson] = useState(choice.learn ? 0 : -1);
  const practice = lesson >= 0 || (choice.learn ?? false);
  const leaving = useLeaveDialog();
  const recorded = useRef(false);

  useEffect(() => {
    if (!practice) writeSave(g);
    if (g.over && !practice && !recorded.current) {
      recorded.current = true;
      recordCompletedGame('Rota');
    }
  }, [g, practice]);

  // Bots build their round in the background, one after another, from what
  // they may see; the round resolves once every seat has pressed Done.
  useEffect(() => {
    if (g.over) return;
    const bot = g.seats.findIndex((s) => s.bot && !s.locked);
    if (bot < 0) return;
    const timer = setTimeout(() => {
      setG((cur) => {
        if (cur.round !== g.round || cur.seats[bot].locked) return cur;
        let next = cur;
        for (const m of botRound(observe(cur, bot), bot)) next = play(next, m, bot);
        return next;
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [g]);

  const [turned, setTurned] = useState(false);
  const move = useCallback((m: RotaMove) => {
    if (m.type === 'turn') setTurned(true);
    setG((cur) => play(cur, m, 0));
  }, []);
  // The practice coach follows what you do.
  const [coached, setCoached] = useState({ g, turned });
  if (coached.g !== g || coached.turned !== turned) {
    setCoached({ g, turned });
    if (lesson === 0 && g.seats[0].draft.length) setLesson(1);
    else if (lesson === 1 && turned) setLesson(2);
    else if (lesson === 2 && g.round > 1) setLesson(3);
    else if (lesson === 3 && g.seats[0].specials.length) setLesson(4);
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

  // The bots' round in progress stays hidden, as it would at a table.
  const view = useMemo(() => observe(g, 0), [g]);
  const coach =
    lesson >= 0 ? (
      <aside className="coach sandbox-coach rota-coach" aria-label="Practice" aria-live="polite">
        <div>
          <span>
            Practice · {Math.min(lesson + 1, lessons.length)}/{lessons.length}
          </span>
        </div>
        <h3>{lessons[lesson]?.title}</h3>
        <p>{lessons[lesson]?.text}</p>
        <div className="sandbox-controls">
          {lesson === lessons.length - 1 ? (
            <button
              onClick={() => {
                setLesson(-1);
                setG(fresh({ ...choice, learn: false }));
              }}
            >
              Start a match
            </button>
          ) : (
            <button onClick={() => setLesson(lesson + 1)}>Next</button>
          )}
          <button
            onClick={() => {
              setLesson(-1);
              setG(fresh({ ...choice, learn: false }));
            }}
          >
            Skip
          </button>
        </div>
      </aside>
    ) : null;

  return (
    <>
      <RotaTable
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
        title="Leave the sheet?"
        saved="Your match is saved on this device."
        theme="rota"
      />
    </>
  );
}
