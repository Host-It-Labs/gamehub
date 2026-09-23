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
  Lock,
  Maximize,
  Printer,
  Sparkles,
  Star,
  Store,
  Target,
  Ticket,
  TrendingUp,
  Wand,
  Zap,
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
  quick: Zap,
  lucky: Clover,
  star: Star,
  jackpot: Gem,
  value: Coins,
  foilpay: Ticket,
  tenth: Target,
  golden: Crown,
  bonus: Sparkles,
  steady: Hand,
  streak: TrendingUp,
  printers: Printer,
  bots: Bot,
  cashiers: Store,
  floor: Grid3x3,
};
const PATH_ICONS: Record<PathId, LucideIcon> = {
  scratch: Hand,
  luck: Clover,
  payout: Coins,
  craft: Sparkles,
  factory: Factory,
};
/** One sentence each, shown only for the selected upgrade. */
const DOES: Record<string, string> = {
  coin: 'Your coin clears a wider path with every stroke.',
  foil: 'Seals pop open with less foil scratched away.',
  quick: 'Once most seals are open, the rest clear by themselves.',
  lucky: 'New tickets print more ×6 and ×12 symbols.',
  star: 'Star tickets pay three times as much. Factory tickets too.',
  jackpot: 'Any seal can hide a ×50 jackpot.',
  value: 'Every printed prize is worth more.',
  foilpay: 'The paper itself pays more for each seal on a ticket.',
  tenth: 'Every tenth ticket you scratch pays a multiple.',
  golden: 'Multiplies everything: your tickets and the factory.',
  bonus: 'Following a book’s rule pays a bigger bonus.',
  steady: 'Adds free technique to every ticket with a rule.',
  streak: 'Good tickets in a row build a streak of up to 10 steps.',
  printers: 'Every printer prints faster.',
  bots: 'Every scratch bot scratches faster.',
  cashiers: 'Tickets sold by the factory pay more.',
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
