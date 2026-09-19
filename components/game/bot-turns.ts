'use client';
import { fallbackMove } from '@/lib/games/trio/bot';
import {
  canAct,
  observe,
  preparationKey,
  type Game,
  type Move,
} from '@/lib/games/trio/engine';
import { useEffect, useRef } from 'react';

type Job = {
  key: string;
  timer: ReturnType<typeof setTimeout>;
  watchdog?: ReturnType<typeof setTimeout>;
  worker?: Worker;
};

/** Every seat that may decide right now: several during simultaneous phases. */
export function actingSeats(g: Game, isBot: (seat: number) => boolean) {
  return g.players.map((_, i) => i).filter((i) => isBot(i) && canAct(g, i));
}

/**
 * Runs one bot worker per seat that can act, all at once, so simultaneous
 * phases resolve as fast as the slowest thinker instead of the sum of them.
 * A reply is applied only while that seat still faces the same decision, so
 * other seats committing in between never invalidates a thought in progress.
 */
export function useBotTurns({
  game,
  active,
  isBot,
  commit,
  nonce = 0,
  delayMs = 120,
  timeoutMs = 4000,
}: {
  game: Game | null;
  active: boolean;
  isBot: (seat: number) => boolean;
  commit: (move: Move, seat: number) => void;
  nonce?: number;
  delayMs?: number;
  timeoutMs?: number;
}) {
  const jobs = useRef(new Map<number, Job>());
  const latest = useRef(game);
  const commitRef = useRef(commit);
  useEffect(() => {
    latest.current = game;
    commitRef.current = commit;
  });
  useEffect(() => {
    const stop = (job: Job) => {
      clearTimeout(job.timer);
      clearTimeout(job.watchdog);
      job.worker?.terminate();
    };
    const stopAll = () => {
      for (const job of jobs.current.values()) stop(job);
      jobs.current.clear();
    };
    if (!game || !active || game.phase === 'over') {
      stopAll();
      return;
    }
    for (const [seat, job] of jobs.current)
      if (!canAct(game, seat) || preparationKey(game, seat) !== job.key) {
        stop(job);
        jobs.current.delete(seat);
      }
    for (const seat of actingSeats(game, isBot)) {
      if (jobs.current.has(seat)) continue;
      const key = preparationKey(game, seat);
      const settle = (move: Move | null) => {
        if (jobs.current.get(seat) !== job) return;
        stop(job);
        jobs.current.delete(seat);
        const now = latest.current;
        if (!now || !canAct(now, seat) || preparationKey(now, seat) !== key)
          return;
        commitRef.current(move ?? fallbackMove(now, seat), seat);
      };
      const job: Job = {
        key,
        timer: setTimeout(() => {
          try {
            job.worker = new Worker(
              new URL('../../lib/games/trio/bot.worker.ts', import.meta.url),
              { type: 'module' },
            );
            job.worker.onmessage = (
              e: MessageEvent<{ move?: Move; error?: string }>,
            ) => settle(e.data.move ?? null);
            job.worker.onerror = () => settle(null);
            job.worker.postMessage({ ...observe(game, seat), active: seat });
            job.watchdog = setTimeout(() => settle(null), timeoutMs);
          } catch {
            settle(null);
          }
        }, delayMs),
      };
      jobs.current.set(seat, job);
    }
    // Replies are validated against the seat's decision, not a snapshot.
  }, [game, active, isBot, nonce, delayMs, timeoutMs]);
  useEffect(() => {
    const running = jobs.current;
    return () => {
      for (const job of running.values()) {
        clearTimeout(job.timer);
        clearTimeout(job.watchdog);
        job.worker?.terminate();
      }
      running.clear();
    };
  }, []);
}
