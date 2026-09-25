'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Clover,
  Coins,
  Crown,
  Factory,
  Gem,
  Grid3x3,
  Hand,
  Heart,
  Lock,
  Maximize,
  Printer,
  Sparkles,
  Star,
  TrendingUp,
  Wand,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber } from '@/lib/games/relic/engine';
import {
  PATHS,
  UPGRADES,
  level,
  upgradeCost,
  upgradeFor,
  upgradeReady,
  type PathId,
  type ScratchState,
} from '@/lib/games/relic/scratch';

const ICONS: Record<string, LucideIcon> = {
  coin: Maximize,
  foil: Wand,
  value: Coins,
  jackpot: Gem,
  golden: Crown,
  extra: Heart,
  star: Star,
  streak: TrendingUp,
  printers: Printer,
  bots: Bot,
  cashiers: Sparkles,
  floor: Grid3x3,
};
const PATH_ICONS: Record<PathId, LucideIcon> = {
  scratch: Hand,
  luck: Clover,
  payout: Coins,
  factory: Factory,
};
/** One sentence each, shown only for the selected upgrade. */
const DOES: Record<string, string> = {
  coin: 'A much wider coin: each stroke clears far more foil.',
  foil: 'Seals pop open with far less foil scratched away.',
  value: 'Doubles every prize, on your tickets and the factory’s.',
  jackpot: 'A perfect ticket pays this many times over.',
  golden: 'Doubles everything the desk earns.',
  extra: 'Every ticket forgives one more mistake.',
  star: 'Star tickets pay five times as much. Factory tickets too.',
  streak: 'Every perfect ticket in a row adds this much, up to ten.',
  printers: 'Every printer prints half as fast again.',
  bots: 'Every scratch bot scratches half as fast again.',
  cashiers: 'Scratch bots play their tickets better and hit more jackpots.',
  floor: 'More room on the factory floor.',
};

export function ScratchUpgrades({
  state,
  coins,
  busy,
  onBuy,
}: {
  state: ScratchState;
  coins: number;
  busy: boolean;
  onBuy: (id: string) => void;
}) {
  const [selected, setSelected] = useState('coin'),
    [path, setPath] = useState<PathId>('scratch');
  const u = upgradeFor(selected)!,
    rank = level(state, u.id),
    ready = upgradeReady(state, u),
    cost = upgradeCost(state, u),
    done = rank >= u.max;
  const Icon = ICONS[u.id];
  return (
    <div className="rs-upgrades">
      <div className="rs-path-tabs" role="tablist" aria-label="Upgrade paths">
        {PATHS.map((p) => {
          const PathIcon = PATH_ICONS[p.id];
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={path === p.id}
              style={{ '--path': p.color } as React.CSSProperties}
              onClick={() => {
                setPath(p.id);
                setSelected(UPGRADES.find((x) => x.path === p.id)!.id);
              }}
            >
              <PathIcon size={15} />
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="rs-lanes">
        {PATHS.map((p) => {
          const PathIcon = PATH_ICONS[p.id],
            list = UPGRADES.filter((x) => x.path === p.id);
          return (
            <section
              key={p.id}
              className={`rs-lane ${path === p.id ? 'is-current' : ''}`}
              style={{ '--path': p.color } as React.CSSProperties}
              aria-label={p.name}
            >
              <h3 className="rs-lane-name">
                <PathIcon size={20} />
                <span>{p.name}</span>
              </h3>
              <div className="rs-lane-cards">
                {list.map((x, i) => {
                  const r = level(state, x.id),
                    open = upgradeReady(state, x),
                    max = r >= x.max,
                    price = upgradeCost(state, x),
                    CardIcon = ICONS[x.id];
                  return (
                    <div className="rs-card-slot" key={x.id}>
                      {i > 0 && (
                        <ArrowRight
                          size={14}
                          className="rs-card-link"
                          aria-hidden="true"
                        />
                      )}
                      <button
                        className={`rs-card ${open ? '' : 'is-locked'} ${max ? 'is-max' : ''} ${open && !max && coins >= price ? 'is-affordable' : ''}`}
                        aria-pressed={selected === x.id}
                        onClick={() => {
                          setSelected(x.id);
                          setPath(p.id);
                        }}
                        onDoubleClick={() => {
                          if (open && !max && coins >= price) onBuy(x.id);
                        }}
                      >
                        <span className="rs-card-icon">
                          {open ? <CardIcon size={20} /> : <Lock size={16} />}
                        </span>
                        <span className="rs-card-body">
                          <b>{x.name}</b>
                          <span className="rs-card-stat">
                            <small>{x.label}</small>
                            <strong>
                              {x.show(r)}
                              {!max && (
                                <>
                                  <ArrowRight size={11} />
                                  {x.show(r + 1)}
                                </>
                              )}
                            </strong>
                          </span>
                        </span>
                        <span className="rs-card-foot">
                          <span
                            className="rs-card-pips"
                            aria-label={`${r} of ${x.max}`}
                          >
                            <i style={{ width: `${(r / x.max) * 100}%` }} />
                          </span>
                          {max ? (
                            <Check size={13} />
                          ) : (
                            <small>
                              <Coins size={10} />
                              {formatNumber(price)}
                            </small>
                          )}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div
        className="rs-buy-bar"
        style={
          {
            '--path': PATHS.find((p) => p.id === u.path)!.color,
          } as React.CSSProperties
        }
        aria-live="polite"
      >
        <span className="rs-card-icon">
          <Icon size={20} />
        </span>
        <div className="rs-buy-text">
          <b>
            {u.name}{' '}
            <small>
              {rank} / {u.max}
            </small>
          </b>
          <small>
            {!ready && u.requires
              ? `First buy ${upgradeFor(u.requires)?.name}.`
              : !ready
                ? 'Build the factory first.'
                : DOES[u.id]}
          </small>
        </div>
        <span className="rs-buy-stat">
          {u.label} <b>{u.show(rank)}</b>
          {!done && (
            <>
              <ArrowRight size={13} />
              <b>{u.show(rank + 1)}</b>
            </>
          )}
        </span>
        <button
          className="rs-primary"
          disabled={busy || !ready || done || coins < cost}
          onClick={() => onBuy(u.id)}
        >
          {done ? (
            <>
              <Check size={17} /> Maxed
            </>
          ) : (
            <>
              Buy <Coins size={15} />
              {formatNumber(cost)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
