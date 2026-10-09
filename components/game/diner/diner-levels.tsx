'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CHAPTERS,
  chapterLevels,
  LEVEL_COUNT,
  type Level,
} from '@/lib/games/diner/levels';
import { PLACES } from '@/lib/games/diner/road';
import { dinerPlaceUrl } from '@/lib/games/diner/art';
import { GameNavigation } from '../game-navigation';
import DinerGame from './diner-game';
import { DinerRules } from './diner-rules';
import {
  levelOpen,
  levelsFinished,
  nextLevel,
  readLevels,
  rememberLevel,
  type LevelRecord,
} from './diner-store';
import { DinerLandscape } from './diner-landscape';
import { SoloSession } from './session';
import './diner-levels.css';

/** Medal pips under a level's number. */
function Medals({ count }: { count: number }) {
  return (
    <span className="diner-level-medals" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} className={`m${i}`} data-won={i < count} />
      ))}
    </span>
  );
}

function LevelTile({
  level,
  record,
  current,
  onPick,
}: {
  level: Level;
  record: LevelRecord;
  current: boolean;
  onPick: (id: number) => void;
}) {
  const open = levelOpen(record, level.id);
  const medals = record.medals[level.id - 1];
  return (
    <button
      type="button"
      className="diner-level-tile"
      data-open={open}
      data-current={current}
      data-boss={level.boss}
      disabled={!open}
      aria-label={`Level ${level.id}, ${level.name}${level.boss ? ', boss' : ''}. ${open ? `${medals} of 3 medals` : 'Locked'}`}
      onClick={() => onPick(level.id)}
    >
      <b>{level.id}</b>
      {open ? <Medals count={medals} /> : <Lock aria-hidden="true" />}
    </button>
  );
}

/**
 * Free play's levels (9 October 2026): eight chapters, one card each, with
 * the place's postcard behind its five levels. A tap on an open level starts
 * its shift, whose opening card says what is new.
 */
export function DinerLevels({
  volume,
  music,
  sound,
  learn = false,
  start,
  onExit,
}: {
  volume: number;
  music: number;
  sound: ReactNode;
  learn?: boolean;
  /** Open this level straight away (the box's Play opens the next one). */
  start?: number;
  onExit: () => void;
}) {
  const [record, setRecord] = useState(readLevels);
  const [session, setSession] = useState<SoloSession | null>(() =>
    start && levelOpen(readLevels(), start)
      ? new SoloSession({ level: start })
      : null,
  );
  const [rules, setRules] = useState(learn && !start);
  const grid = useRef<HTMLUListElement>(null);
  const current = nextLevel(record);
  const pick = (id: number) => {
    rememberLevel(id);
    setSession(new SoloSession({ level: id }));
  };
  const back = useCallback(() => {
    setRecord(readLevels());
    setSession(null);
  }, []);
  // Coming back to the grid puts focus on the level to play next.
  useEffect(() => {
    if (session) return;
    grid.current
      ?.querySelector<HTMLButtonElement>('[data-current="true"]')
      ?.focus({ preventScroll: true });
  }, [session]);

  if (session)
    return (
      <DinerGame
        key={session.level ?? 0}
        session={session}
        volume={volume}
        music={music}
        sound={sound}
        learn={learn}
        onExit={onExit}
        onLevels={back}
        onLevel={() => setRecord(readLevels())}
      />
    );

  const medals = record.medals.reduce((a, b) => a + b, 0);
  return (
    <DinerLandscape>
      <div className="diner-levels at-table">
        <GameNavigation
          name="Diner"
          onBack={onExit}
          menu={{
            theme: 'diner',
            sound,
            onRules: () => setRules(true),
            onLeave: onExit,
          }}
        />
        <p
          className="diner-levels-total"
          aria-label={`${levelsFinished(record)} of ${LEVEL_COUNT} levels finished, ${medals} of ${LEVEL_COUNT * 3} medals`}
        >
          <span aria-hidden="true">
            <b>{levelsFinished(record)}</b>/{LEVEL_COUNT}
          </span>
          <span aria-hidden="true">
            <i className="diner-medal" />
            <b>{medals}</b>
          </span>
        </p>
        <ul ref={grid} className="diner-chapters" aria-label="Levels">
          {CHAPTERS.map((c, ci) => {
            const levels = chapterLevels(ci);
            const reached = levels.some((l) => levelOpen(record, l.id));
            const art = c.place ?? levels[0].place;
            return (
              <li
                key={c.name}
                className="diner-chapter"
                data-reached={reached}
                style={
                  {
                    '--place': PLACES[art].colour,
                    backgroundImage: `url(${dinerPlaceUrl(art)})`,
                  } as CSSProperties
                }
                aria-label={`Chapter ${ci + 1}: ${c.name}`}
              >
                <h2>
                  <span>{ci + 1}</span>
                  {c.name}
                </h2>
                <div className="diner-chapter-levels">
                  {levels.map((l) => (
                    <LevelTile
                      key={l.id}
                      level={l}
                      record={record}
                      current={l.id === current}
                      onPick={pick}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <Dialog open={rules} onOpenChange={setRules}>
          <DialogContent className="modal diner-modal diner-rules-modal">
            <DialogTitle>How to play</DialogTitle>
            <DialogDescription className="sr-only">
              Rules of Diner
            </DialogDescription>
            <DinerRules />
            <button
              type="button"
              className="diner-button"
              onClick={() => setRules(false)}
            >
              Got it
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </DinerLandscape>
  );
}
