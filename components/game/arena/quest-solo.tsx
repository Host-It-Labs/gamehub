'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  battleSetup,
  newQuest,
  questAct,
  type QuestAction,
  type QuestState,
} from '@/lib/games/arena/quest';
import ArenaGame from './arena-game';
import { arenaManifest } from './assets';
import { ArenaRules } from './arena-rules';
import { QuestView } from './quest-view';
import { addUnlocked, loadRun, loadUnlocked, saveRun } from './quest-store';

/**
 * A Quest on this device: the run is kept in local storage after every
 * choice, so leaving and coming back resumes it (a battle left half way
 * starts again). Battles are one against one against the stop's foe.
 */
export default function QuestSolo({
  resume,
  volume,
  music,
  sound,
  onExit,
}: {
  /** Continue the saved run instead of starting a new one. */
  resume: boolean;
  volume: number;
  music: number;
  sound: ReactNode;
  onExit: () => void;
}) {
  const [q, setQ] = useState<QuestState>(
    () =>
      (resume && loadRun()) ||
      newQuest(
        crypto.getRandomValues(new Uint32Array(1))[0],
        1,
        loadUnlocked(),
      ),
  );
  const [attempt, setAttempt] = useState(0);
  const [rules, setRules] = useState(false);
  useEffect(() => {
    saveRun(q);
    addUnlocked(q.unlocked);
  }, [q]);
  const act = useCallback((a: QuestAction) => {
    setQ((prev) => questAct(prev, a) ?? prev);
  }, []);
  const screen = q.screen;
  if (screen.kind === 'battle') {
    const stop = q.stops.find((s) => s.id === screen.stop)!;
    const { mode, difficulty, options } = battleSetup(q, stop);
    return (
      <ArenaGame
        key={`${q.region}-${stop.id}-${q.hearts}-${attempt}`}
        mode={mode}
        difficulty={difficulty}
        setup={{ options, foe: stop.foe!.name }}
        volume={volume}
        music={music}
        sound={sound}
        leaveNote="Your quest is saved. This battle starts again when you come back."
        onExit={onExit}
        onFinish={(outcome, crowns) => {
          // A draw is fought again.
          if (outcome === 'draw') setAttempt((n) => n + 1);
          else act({ type: 'result', won: outcome === 'won', crowns });
        }}
      />
    );
  }
  return (
    <>
      <QuestView
        q={q}
        act={act}
        onLeave={onExit}
        onNewRun={() =>
          setQ(
            newQuest(
              crypto.getRandomValues(new Uint32Array(1))[0],
              1,
              loadUnlocked(),
            ),
          )
        }
        rules={() => setRules(true)}
        sound={sound}
        volume={volume}
      />
      <Dialog open={rules} onOpenChange={setRules}>
        <DialogContent className="modal arena-modal arena-rules-modal">
          <DialogTitle>How to play</DialogTitle>
          <DialogDescription className="sr-only">
            Rules of Arena
          </DialogDescription>
          <ArenaRules
            quest
            cardArt={Object.fromEntries(
              Object.entries(arenaManifest.cards).map(([id, f]) => [
                id,
                f.path,
              ]),
            )}
          />
          <button
            type="button"
            className="arena-button"
            onClick={() => setRules(false)}
          >
            Back
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
