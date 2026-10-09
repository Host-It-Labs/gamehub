'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  BedDouble,
  Dices,
  Moon,
  Square,
  Trophy,
  Wrench,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  gearPrice,
  patchPrice,
  runActive,
  runChoices,
  runMap,
  runNode,
  shiftConfig,
  troubleNames,
  type CampaignRun,
} from '@/lib/games/diner/campaign';
import type { Match } from '@/lib/games/diner/engine';
import {
  BOSSES,
  PLACES,
  REWARD_NAMES,
  ROAD_LEGS,
  type RoadNode,
} from '@/lib/games/diner/road';
import { dinerPlaceUrl } from '@/lib/games/diner/art';
import { GameNavigation } from '../game-navigation';
import { LeaveDialog, useLeaveDialog } from '../leave-dialog';
import DinerGame, {
  type CampaignShiftInfo,
  type CampaignShiftResult,
} from './diner-game';
import {
  DinerEquipment,
  DinerWorkshop,
  GearCard,
  RewardMark,
} from './diner-equipment';
import { DinerLandscape } from './diner-landscape';
import { DinerRules } from './diner-rules';
import { DinerIcon } from './icons';
import { Joystick, type Stick } from './joystick';
import { troubleNote } from './level-notes';
import { Overworld, type SignAnchor } from './overworld';
import { Pacer, ladder } from '../render-pacer';
import { devicePower, floorAt, startLevel } from '../render-quality';
import { SoloSession } from './session';
import { upgradesShown } from './upgrades-shown';
import {
  beginCampaign,
  buyCampaignGear,
  buyDinerUpgrade,
  checkpointCampaignMatch,
  driveCampaign,
  endCampaignRun,
  keepDrivingCampaign,
  leaveCampaignStop,
  patchCampaignCar,
  pickCampaignGear,
  readCampaign,
  rerollCampaignGear,
  restartCampaign,
  restAtMotel,
  settleCampaignMatch,
  tuneAtMotel,
  workshopOpen,
} from './diner-store';
import './diner-campaign.css';

type Save = ReturnType<typeof readCampaign>;
type Panel = 'rules' | 'workshop' | 'equipment' | 'retire' | null;
const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const REGION = ['The desert', 'The coast', 'The Moon Mile'];
const region = (leg: number) =>
  leg < ROAD_LEGS ? REGION[leg] : `Overtime ${leg - ROAD_LEGS + 1}`;

function stopTitle(node: RoadNode) {
  if (node.boss) return BOSSES[node.boss].name;
  if (node.kind === 'garage') return 'Garage';
  if (node.kind === 'motel') return 'Motel';
  return PLACES[node.place].name;
}
function stopLine(node: RoadNode) {
  if (node.boss) return BOSSES[node.boss].line;
  if (node.kind === 'garage') return 'Buy equipment, patch up the car.';
  if (node.kind === 'motel') return 'Sleep for two lives, or tune the car.';
  return PLACES[node.place].crowd;
}
const artOf = (node: RoadNode) =>
  dinerPlaceUrl(
    node.kind === 'garage' || node.kind === 'motel' ? node.kind : node.place,
  );

function shiftInfo(run: CampaignRun): CampaignShiftInfo | undefined {
  const node = runNode(run);
  const m = run.savedMatch;
  if (!node || !m?.config) return undefined;
  return {
    stop: run.visited.length,
    title: stopTitle(node),
    place: PLACES[node.place].name,
    boss: !!node.boss,
    troubles: troubleNames(m.config),
    reward: node.reward ? `Finish for: ${REWARD_NAMES[node.reward]}` : null,
  };
}

export function Lives({ lives, max }: { lives: number; max: number }) {
  return (
    <span className="diner-run-lives" aria-label={`${lives} of ${max} lives`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} data-full={i < lives} />
      ))}
    </span>
  );
}

function Busy({ n }: { n: number }) {
  return (
    <span className="diner-busy" aria-label={`Busy ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} data-on={i <= n} />
      ))}
    </span>
  );
}

/** The sign floating over a stop you may choose: what it is and pays. */
function MapSign({
  node,
  here,
  register,
  onPick,
}: {
  node: RoadNode;
  here: boolean;
  register: (id: string, el: HTMLElement | null) => void;
  onPick: (id: string) => void;
}) {
  return (
    <button
      ref={(el) => register(node.id, el)}
      type="button"
      className="diner-map-sign"
      data-kind={node.kind}
      data-here={here}
      style={{ '--place': PLACES[node.place].colour } as CSSProperties}
      aria-label={`${stopTitle(node)}. ${stopLine(node)}${node.busy ? ` Busy ${node.busy} of 3.` : ''}${node.gas ? ` Gas ${node.gas} coins.` : ''}${node.reward ? ` Pays ${REWARD_NAMES[node.reward]}.` : ''} Drive there.`}
      onClick={() => onPick(node.id)}
    >
      <span
        className="diner-map-sign-art"
        style={{ backgroundImage: `url(${artOf(node)})` }}
        aria-hidden="true"
      >
        {node.boss && <DinerIcon name="star" />}
      </span>
      <span className="diner-map-sign-body" aria-hidden="true">
        <strong>{stopTitle(node)}</strong>
        <span className="diner-map-sign-meta">
          {node.busy > 0 && <Busy n={node.busy} />}
          {node.gas > 0 && (
            <span className="diner-map-gas">
              <DinerIcon name="fuel" />
              {node.gas}
            </span>
          )}
          {node.reward && <RewardMark reward={node.reward} />}
          {node.kind === 'garage' && <DinerIcon name="crate" />}
          {node.kind === 'motel' && <DinerIcon name="heart" />}
        </span>
      </span>
    </button>
  );
}

/**
 * The campaign (9 October 2026): drive the diner rig round a little world,
 * choosing one of two stops at every fork; play the shift there; pick up
 * equipment; keep the car going to the end of the night.
 */
export function DinerCampaign({
  volume,
  music,
  sound,
  onExit,
  learn = false,
}: {
  volume: number;
  music: number;
  sound: ReactNode;
  onExit: () => void;
  learn?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<Overworld | null>(null);
  const signs = useRef(new Map<string, HTMLElement>());
  const modalOrigin = useRef<HTMLElement | null>(null);
  const stick = useRef<Stick>({ x: 0, z: 0 });
  const keys = useRef(new Set<string>());
  const blockedRef = useRef(false);
  const arrive = useRef<(id: string) => void>(() => {});
  const [save, setSave] = useState(() => {
    // Play starts driving: a new run if none is under way (beginCampaign
    // keeps a run that is, so this is safe to call more than once).
    try {
      return beginCampaign(randomSeed());
    } catch {
      return readCampaign();
    }
  });
  const [session, setSession] = useState<SoloSession | null>(() => {
    const r = save.run;
    return r?.status === 'shift' && r.savedMatch
      ? new SoloSession({ match: r.savedMatch })
      : null;
  });
  const [info, setInfo] = useState(() =>
    save.run ? shiftInfo(save.run) : undefined,
  );
  const [panel, setPanel] = useState<Panel>(learn ? 'rules' : null);
  const [notice, setNotice] = useState('');
  const [lot, setLot] = useState<string | null>(null);
  const [parking, setParking] = useState<string | null>(null);
  const [bannerSeen, setBannerSeen] = useState('');
  const [touch, setTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches,
  );
  const [persisted, setPersisted] = useState(save.persisted);
  const leave = useLeaveDialog();
  const askLeave = leave.ask;
  const { profile, run } = save;
  const active = runActive(run);
  const showPanel = (next: Panel, origin?: HTMLElement) => {
    const focused = document.activeElement;
    modalOrigin.current =
      origin ??
      (focused instanceof HTMLElement && focused !== document.body
        ? focused
        : null);
    setPanel(next);
  };
  const update = useCallback((next: Save) => {
    setSave(next);
    setPersisted(next.persisted);
    return next;
  }, []);
  const act = (operation: () => Save) => {
    try {
      setNotice('');
      return update(operation());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save your run.');
      return null;
    }
  };
  const checkpoint = useCallback((m: Match) => {
    setPersisted(checkpointCampaignMatch(m).persisted);
  }, []);
  const settle = useCallback(
    (m: Match) => {
      update(settleCampaignMatch(m));
    },
    [update],
  );

  useEffect(() => {
    if (session) return;
    const request = (event: Event) => {
      const allow = (event as CustomEvent<{ allow?: () => void }>).detail
        ?.allow;
      askLeave(() => {
        allow?.();
        onExit();
      });
    };
    window.addEventListener('diner-request-leave', request);
    return () => window.removeEventListener('diner-request-leave', request);
  }, [session, askLeave, onExit]);

  const map = run ? runMap(run) : null;
  const node = run ? runNode(run) : null;
  const choices = useMemo(
    () => (run && !parking ? runChoices(run) : []),
    [run, parking],
  );
  const status = run?.status ?? 'over';
  const blocked =
    panel !== null || leave.open || status !== 'route' || !!parking;
  const ranks = JSON.stringify(
    run && active ? run.upgradeRanks : profile.upgrades,
  );
  const upgrades = useMemo(() => upgradesShown(JSON.parse(ranks)), [ranks]);
  const lotNode = lot ? (choices.find((n) => n.id === lot) ?? null) : null;

  // The world: built once per visit to the map, fed the run as it changes.
  const mapKey = map ? `${run!.seed}:${run!.legs}` : '';
  useEffect(() => {
    const el = canvas.current;
    if (!el || session || !mapKey) return;
    let w: Overworld;
    try {
      const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
      const power = devicePower();
      w = new Overworld(
        el,
        {
          onLot: (id) => setLot(id),
          onArrive: (id) => {
            setParking(null);
            arrive.current(id);
          },
        },
        power === 'low' || (phone && power === 'mid') ? 'low' : 'high',
      );
    } catch {
      void Promise.resolve().then(() =>
        setNotice('This browser cannot show 3D graphics.'),
      );
      return;
    }
    w.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    world.current = w;
    w.onSigns = (anchors: SignAnchor[]) => {
      for (const a of anchors) {
        const s = signs.current.get(a.id);
        if (!s) continue;
        s.style.transform = `translate3d(${a.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        s.style.visibility = a.visible ? 'visible' : 'hidden';
      }
    };
    const resize = () => w.resize();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const rungs = ladder(2048, floorAt(1.2));
    const pacer = new Pacer(
      rungs,
      (rung) => w.setRung(rung),
      startLevel(rungs, window.innerWidth, window.innerHeight),
    );
    if (pacer.level) w.setRung(pacer.rung);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) {
        last = now;
        return;
      }
      if (!pacer.frame(now)) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keys.current;
      let x =
        (k.has('d') || k.has('arrowright') ? 1 : 0) -
        (k.has('a') || k.has('arrowleft') ? 1 : 0);
      let z =
        (k.has('s') || k.has('arrowdown') ? 1 : 0) -
        (k.has('w') || k.has('arrowup') ? 1 : 0);
      if (stick.current.x || stick.current.z) {
        x = stick.current.x;
        z = stick.current.z;
      }
      w.stick = blockedRef.current ? { x: 0, z: 0 } : { x, z };
      w.frame(dt);
    };
    raf = requestAnimationFrame(loop);
    if (process.env.NODE_ENV === 'development')
      Object.assign(window, { dinerMap: w });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      w.dispose();
      world.current = null;
    };
  }, [session, mapKey]);

  // Keep the world in step with the run.
  useEffect(() => {
    if (!map || !run || session) return;
    world.current?.setState({
      map,
      visited: run.visited,
      at: run.at,
      choices: choices.map((n) => n.id),
    });
  }, [map, run, choices, session]);
  // A new stretch of road: say where you are, once.
  const legStart =
    status === 'route' && choices[0]?.col === 0 ? choices[0] : null;
  const banner =
    legStart && bannerSeen !== legStart.id ? region(legStart.leg) : null;
  useEffect(() => {
    if (!legStart || bannerSeen === legStart.id) return;
    const t = window.setTimeout(() => setBannerSeen(legStart.id), 2600);
    return () => window.clearTimeout(t);
  }, [legStart, bannerSeen]);

  const openShift = (r: CampaignRun) => {
    if (!r.savedMatch) return;
    setInfo(shiftInfo(r));
    setSession(new SoloSession({ match: r.savedMatch }));
  };
  // The render loop and the world's callbacks read these through refs.
  useEffect(() => {
    blockedRef.current = blocked;
    arrive.current = (id: string) => {
      const next = act(() => driveCampaign(id));
      const r = next?.run;
      if (r?.status === 'shift' && r.savedMatch) openShift(r);
    };
  });
  const stop = (id: string) => {
    if (blocked) return;
    setParking(id);
    world.current?.commit(id);
  };

  // Keys: drive, Space or Enter to stop at the lot you are in.
  useEffect(() => {
    if (session) return;
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      const k = e.key.toLowerCase();
      if (
        [
          'w',
          'a',
          's',
          'd',
          'arrowup',
          'arrowdown',
          'arrowleft',
          'arrowright',
        ].includes(k)
      ) {
        if (panel || leave.open) return;
        keys.current.add(k);
        e.preventDefault();
      } else if (
        (k === ' ' || k === 'enter' || k === 'e') &&
        lot &&
        !blocked &&
        !t?.closest?.('button')
      ) {
        e.preventDefault();
        stop(lot);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerdown', onTouch);
    };
  });

  const registerSign = useCallback((id: string, el: HTMLElement | null) => {
    if (el) signs.current.set(id, el);
    else signs.current.delete(id);
  }, []);

  if (session && run) {
    const last = run.status !== 'shift' ? run.lastResult : null;
    const result: CampaignShiftResult | null = last
      ? {
          survived: last.survived,
          banked: last.banked,
          lost: last.lost,
          lives: last.lives,
          tokens: last.tokens,
          reward: last.reward ? REWARD_NAMES[last.reward] : null,
        }
      : null;
    return (
      <>
        <DinerGame
          key={session.match.config?.stop}
          session={session}
          volume={volume}
          music={music}
          sound={sound}
          onExit={onExit}
          campaign={info}
          campaignResult={result}
          upgrades={upgrades}
          leaveNote={
            persisted ? undefined : 'This browser cannot save your run.'
          }
          equipment={<DinerEquipment run={run} />}
          onCheckpoint={checkpoint}
          onShiftEnd={settle}
          onResultsContinue={() => {
            setLot(null);
            setSession(null);
          }}
        />
        {(!persisted || notice) && (
          <output className="diner-save-notice" role="alert">
            {notice || 'This browser cannot save your run. Keep this tab open.'}
          </output>
        )}
      </>
    );
  }

  const lotConfig =
    lotNode && run && (lotNode.kind === 'shift' || lotNode.kind === 'boss')
      ? shiftConfig(run, lotNode)
      : null;
  const short = !!run && lotNode ? run.wallet < lotNode.gas : false;
  const stopNumber = run
    ? Math.max(1, run.visited.length + (status === 'route' ? 1 : 0))
    : 1;

  return (
    <DinerLandscape>
      <div
        ref={root}
        className="diner-campaign at-table"
        data-status={status}
        data-touch={touch}
        data-parking={!!parking}
      >
        <canvas
          ref={canvas}
          className="diner-map-canvas"
          aria-label="The road map. Drive to one of the two stops ahead."
        />
        <div className="diner-map-signs">
          {status === 'route' &&
            choices.map((n) => (
              <MapSign
                key={n.id}
                node={n}
                here={n.id === lot}
                register={registerSign}
                onPick={(id) =>
                  !blocked &&
                  (lot === id ? stop(id) : world.current?.driveTo(id))
                }
              />
            ))}
        </div>
        <GameNavigation
          name="Diner"
          round={active && run ? `Stop ${stopNumber}` : undefined}
          onBack={() => leave.ask()}
          menu={{
            theme: 'diner',
            sound,
            onRules: () => showPanel('rules'),
            onLeave: () => leave.ask(),
            items: [
              ...(workshopOpen(run)
                ? [
                    {
                      label: 'Workshop',
                      icon: Wrench,
                      onSelect: () => showPanel('workshop'),
                    },
                  ]
                : []),
              ...(active
                ? [
                    {
                      label: 'Equipment',
                      icon: Wrench,
                      onSelect: () => showPanel('equipment'),
                    },
                  ]
                : []),
              ...(active
                ? [
                    {
                      label: 'End run',
                      icon: Square,
                      onSelect: () => showPanel('retire'),
                    },
                  ]
                : []),
            ],
          }}
        />
        {run && active && (
          <div className="diner-run-bar">
            <Lives lives={run.lives} max={run.maxLives} />
            <span
              className="diner-run-wallet"
              aria-label={`${run.wallet} coins`}
            >
              <DinerIcon name="coin" />
              <b>{run.wallet}</b>
            </span>
            <button
              type="button"
              className="diner-run-gear"
              aria-label={`Equipment: ${run.gear.length}`}
              onClick={(e) => showPanel('equipment', e.currentTarget)}
            >
              <DinerIcon name="crate" />
              <b>{run.gear.length}</b>
            </button>
            {workshopOpen(run) && (
              <button
                type="button"
                className="diner-run-gear"
                aria-label={`Workshop: ${profile.tokens} tokens`}
                onClick={(e) => showPanel('workshop', e.currentTarget)}
              >
                <Wrench aria-hidden="true" />
                <DinerIcon name="token" />
                <b>{profile.tokens}</b>
              </button>
            )}
          </div>
        )}
        {banner && status === 'route' && (
          <output className="diner-map-banner" key={banner}>
            {banner}
          </output>
        )}

        {/* In a lot: what this stop brings, and the way in. */}
        {status === 'route' && lotNode && !parking && (
          <section
            className="diner-lot-card"
            aria-label={stopTitle(lotNode)}
            style={{ '--place': PLACES[lotNode.place].colour } as CSSProperties}
          >
            <span
              className="diner-lot-art"
              style={{ backgroundImage: `url(${artOf(lotNode)})` }}
              aria-hidden="true"
            />
            <div className="diner-lot-copy">
              <strong>
                {lotNode.boss && <DinerIcon name="star" />}
                {stopTitle(lotNode)}
              </strong>
              <span>{stopLine(lotNode)}</span>
              {lotConfig && troubleNames(lotConfig).length > 0 && (
                <ul className="diner-tonight" aria-label="Trouble">
                  {troubleNames(lotConfig).map((t) => {
                    const n = troubleNote(t);
                    return (
                      <li key={t}>
                        <DinerIcon name={n.icon} />
                        {n.title}
                      </li>
                    );
                  })}
                </ul>
              )}
              <span className="diner-lot-meta">
                {lotNode.busy > 0 && <Busy n={lotNode.busy} />}
                {lotNode.gas > 0 && (
                  <span className="diner-map-gas" data-short={short}>
                    <DinerIcon name="fuel" />
                    {lotNode.gas}
                  </span>
                )}
                {lotNode.reward && (
                  <span className="diner-lot-reward">
                    <RewardMark reward={lotNode.reward} />
                    {REWARD_NAMES[lotNode.reward]}
                  </span>
                )}
              </span>
              {short && (
                <span className="diner-lot-warning">
                  Not enough coins for gas: pushing the car costs a life.
                </span>
              )}
            </div>
            <button
              type="button"
              className="diner-button"
              onClick={() => stop(lotNode.id)}
            >
              Stop here
              <kbd>Space</kbd>
            </button>
          </section>
        )}
        {touch && status === 'route' && !panel && (
          <div className="diner-map-pad">
            <Joystick stick={stick} disabled={blocked} />
          </div>
        )}

        {status !== 'route' && (
          <div className="diner-plate-wrap diner-map-plate">
            <section
              className="diner-plate diner-journey-panel"
              data-phase={status}
              aria-label="The night road"
            >
              {!run || status === 'over' ? (
                <>
                  <span className="diner-journey-emblem">
                    <Moon aria-hidden="true" />
                  </span>
                  <h2>
                    {run && run.bosses >= ROAD_LEGS
                      ? 'Night beaten'
                      : 'End of the road'}
                  </h2>
                  {run && (
                    <dl className="diner-run-summary">
                      <div>
                        <dt>Stops</dt>
                        <dd>{run.visited.length}</dd>
                      </div>
                      <div>
                        <dt>Shifts</dt>
                        <dd>{run.shifts}</dd>
                      </div>
                      <div>
                        <dt>Bosses</dt>
                        <dd>{run.bosses}</dd>
                      </div>
                      <div>
                        <dt>
                          <DinerIcon name="token" />
                        </dt>
                        <dd>+{run.tokens}</dd>
                      </div>
                    </dl>
                  )}
                  <div className="diner-result-actions">
                    <button
                      type="button"
                      className="diner-button"
                      data-starts-game
                      onClick={() => act(() => restartCampaign(randomSeed()))}
                    >
                      New run
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="diner-button quiet"
                      onClick={(e) => showPanel('workshop', e.currentTarget)}
                    >
                      <Wrench aria-hidden="true" />
                      Workshop
                    </button>
                  </div>
                </>
              ) : status === 'reward' ? (
                <>
                  <p className="diner-plate-night">
                    {node ? stopTitle(node) : 'Reward'}
                  </p>
                  <h2>Pick one</h2>
                  <div className="diner-gear-list">
                    {run.offers.map((id) => (
                      <GearCard
                        key={id}
                        id={id}
                        onPick={(g) => act(() => pickCampaignGear(g))}
                      />
                    ))}
                  </div>
                  {run.rerolls > 0 && (
                    <button
                      type="button"
                      className="diner-button quiet"
                      onClick={() => act(rerollCampaignGear)}
                    >
                      <Dices aria-hidden="true" />
                      Reroll
                    </button>
                  )}
                </>
              ) : status === 'garage' ? (
                <>
                  <h2>Garage</h2>
                  <div className="diner-gear-list">
                    {run.offers.map((id) => (
                      <GearCard
                        key={id}
                        id={id}
                        price={gearPrice(run, id)}
                        sold={run.sold.includes(id)}
                        disabled={run.wallet < gearPrice(run, id)}
                        onPick={(g) => act(() => buyCampaignGear(g))}
                      />
                    ))}
                  </div>
                  <div className="diner-result-actions">
                    <button
                      type="button"
                      className="diner-button quiet"
                      disabled={
                        run.patched ||
                        run.lives >= run.maxLives ||
                        run.wallet < patchPrice(run)
                      }
                      onClick={() => act(patchCampaignCar)}
                      aria-label={`Patch up: one life for ${patchPrice(run)} coins`}
                    >
                      <DinerIcon name="heart" />
                      +1
                      <span className="diner-price">
                        <DinerIcon name="coin" />
                        {patchPrice(run)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="diner-button"
                      onClick={() => act(leaveCampaignStop)}
                    >
                      Drive on
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </>
              ) : status === 'motel' ? (
                <>
                  <h2>Motel</h2>
                  <div className="diner-motel-choices">
                    <button
                      type="button"
                      className="diner-motel-choice"
                      disabled={run.lives >= run.maxLives}
                      onClick={() => act(restAtMotel)}
                    >
                      <BedDouble aria-hidden="true" />
                      <strong>Sleep</strong>
                      <span>
                        <DinerIcon name="heart" />
                        +2
                      </span>
                    </button>
                    <button
                      type="button"
                      className="diner-motel-choice"
                      onClick={() => act(tuneAtMotel)}
                    >
                      <Wrench aria-hidden="true" />
                      <strong>Tune-up</strong>
                      <span>
                        <DinerIcon name="crate" />1
                      </span>
                    </button>
                  </div>
                </>
              ) : status === 'cleared' ? (
                <>
                  <span className="diner-journey-emblem">
                    <Trophy aria-hidden="true" />
                  </span>
                  <h2>Night beaten</h2>
                  <div className="diner-result-actions">
                    <button
                      type="button"
                      className="diner-button"
                      onClick={() => act(keepDrivingCampaign)}
                    >
                      Keep driving
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="diner-button quiet"
                      onClick={() => act(endCampaignRun)}
                    >
                      Finish
                    </button>
                  </div>
                </>
              ) : run?.status === 'shift' && run.savedMatch ? (
                <button
                  type="button"
                  className="diner-button"
                  onClick={() => openShift(run)}
                >
                  Continue
                  <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
            </section>
          </div>
        )}
        {(!persisted || notice) && (
          <output className="diner-save-notice" role="alert">
            {notice || 'This browser cannot save your run. Keep this tab open.'}
          </output>
        )}
        <Dialog
          open={panel !== null}
          onOpenChange={(open) => !open && setPanel(null)}
        >
          <DialogContent
            className={`modal diner-modal diner-tour-modal ${panel === 'workshop' ? 'diner-workshop-modal' : ''}`}
            finalFocus={() =>
              modalOrigin.current?.isConnected &&
              modalOrigin.current.getClientRects().length
                ? modalOrigin.current
                : (root.current?.querySelector<HTMLButtonElement>(
                    '.game-navigation-menu',
                  ) ?? null)
            }
          >
            <DialogTitle>
              {panel === 'rules'
                ? 'How to play'
                : panel === 'workshop'
                  ? 'Workshop'
                  : panel === 'equipment'
                    ? 'Equipment'
                    : 'End this run?'}
            </DialogTitle>
            <DialogDescription
              className={panel === 'retire' ? undefined : 'sr-only'}
            >
              {panel === 'retire'
                ? 'Your tokens and the Workshop stay.'
                : 'Diner campaign'}
            </DialogDescription>
            {panel === 'rules' ? (
              <DinerRules campaign />
            ) : panel === 'workshop' ? (
              <DinerWorkshop
                profile={profile}
                locked={!workshopOpen(run)}
                onBuy={(id) => act(() => buyDinerUpgrade(id))}
              />
            ) : panel === 'equipment' && run ? (
              <DinerEquipment run={run} />
            ) : panel === 'retire' ? (
              <>
                <button
                  type="button"
                  className="diner-button"
                  onClick={() => {
                    setParking(null);
                    act(endCampaignRun);
                    setPanel(null);
                  }}
                >
                  End
                </button>
                <button
                  type="button"
                  className="diner-button quiet"
                  onClick={() => setPanel(null)}
                >
                  Keep playing
                </button>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
        <LeaveDialog
          state={leave}
          title="Leave the diner?"
          saved={
            persisted
              ? 'Your run is saved on this device.'
              : 'This browser cannot save your run.'
          }
          theme="diner"
          onLeave={onExit}
        />
      </div>
    </DinerLandscape>
  );
}
