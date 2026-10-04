'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  actingSeats,
  observe,
  play,
  type AltoGame,
  type AltoMove,
} from '@/lib/games/alto/engine';
import { botMove } from '@/lib/games/alto/bot';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import { useBoardLeave } from '../use-board-leave';
import { recordCompletedGame } from '../play-experience';
import { AltoTable } from './alto-table';
import { SAVE_KEY, type AltoSetup } from './alto-box';
import { newAltoMatch } from './alto-match';
/** Bots think for a moment each, so their locks arrive one after another. */
const BOT_MS = [650, 1100, 1500, 1850, 2150];
/** After a reveal, the next turn waits until the flights have landed. */
const REVEAL_PAUSE = 2200;

function store(g: AltoGame) {
  if (g.tutorial) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(g));
  } catch {
    // Without storage the match still plays in this tab.
  }
}

/**
 * A solo match of Alto against bots, saved on this device after every move.
 * Bots choose with a short, staggered delay; a new turn waits for the last
 * reveal to land first. Learn plays the same match with the coach.
 */
export default function AltoGameView({
  initial,
  setup,
  volume,
  sound,
  onExit,
}: {
  initial: AltoGame;
  setup: AltoSetup;
  volume: number;
  sound?: ReactNode;
  onExit: () => void;
}) {
  const [g, setG] = useState(initial);
  const latest = useRef(g);
  const recorded = useRef(initial.over);
  const commit = useCallback((next: AltoGame) => {
    latest.current = next;
    setG(next);
    store(next);
    if (next.over && !next.tutorial && !recorded.current) {
      recorded.current = true;
      recordCompletedGame('Alto');
    }
  }, []);
  // Bots hold back while a reveal plays, so their next picks never race it.
  const revealKey = g.last ? `${g.last.season}:${g.last.turn}` : '';
  const shown = useRef({ key: revealKey, at: 0 });
  useEffect(() => {
    if (g.over) return;
    if (shown.current.key !== revealKey)
      shown.current = { key: revealKey, at: Date.now() };
    const wait = Math.max(0, REVEAL_PAUSE - (Date.now() - shown.current.at));
    const bots = actingSeats(g).filter((s) => s !== 0);
    const timers = bots.map((s, k) =>
      setTimeout(
        () => {
          const current = latest.current;
          if (!actingSeats(current).includes(s)) return;
          const m = botMove(current, s);
          if (m) commit(play(current, m, s));
        },
        wait + BOT_MS[k % BOT_MS.length] + Math.random() * 250,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [g, revealKey, commit]);

  const leaving = useLeaveDialog();
  const allow = useBoardLeave(!g.over && !g.tutorial, (go) =>
    leaving.ask(() => {
      go();
      onExit();
    }),
  );
  const leave = () => {
    if (g.over || g.tutorial) {
      allow();
      onExit();
    } else
      leaving.ask(() => {
        allow();
        onExit();
      });
  };
  const again = () => {
    recorded.current = false;
    commit(newAltoMatch(setup));
  };
  const move = (m: AltoMove) => {
    const next = play(latest.current, m, 0);
    if (next !== latest.current) commit(next);
  };
  return (
    <div className="app at-table alto">
      <AltoTable
        g={observe(g, 0)}
        viewer={0}
        volume={volume}
        sound={sound}
        onMove={move}
        onLeave={leave}
        leaveLabel={g.over || g.tutorial ? 'Leave' : 'Save and leave'}
        onNew={g.tutorial ? undefined : again}
        practice={
          g.tutorial
            ? {
                step: g.lesson,
                canTeach: true,
                onStep: (step) => commit({ ...latest.current, lesson: step }),
                onBegin: again,
              }
            : null
        }
        finale={
          <>
            <button type="button" onClick={again}>
              Play again
            </button>
            <button type="button" onClick={leave}>
              Library
            </button>
          </>
        }
      />
      <LeaveDialog
        state={leaving}
        title="Leave the match?"
        saved="Your match is saved on this device."
        theme="alto"
      />
    </div>
  );
}
