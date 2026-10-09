'use client';
import type { CSSProperties } from 'react';
import { CircleCheck } from 'lucide-react';
import {
  GEAR,
  gearById,
  UPGRADES,
  type GearIcon,
  type GearId,
  type UpgradeId,
} from '@/lib/games/diner/campaign-content';
import type { CampaignProfile, CampaignRun } from '@/lib/games/diner/campaign';
import { REWARD_NAMES, type Reward } from '@/lib/games/diner/road';
import { RuleList } from '../rules';
import { DinerIcon, type IconName } from './icons';

/** Equipment and Workshop pictures, drawn from the diner's own icon set. */
const GEAR_ICON: Record<GearIcon, IconName> = {
  grill: 'burger',
  fries: 'fries',
  shake: 'shake',
  pie: 'pie',
  clock: 'order',
  heart: 'heart',
  coins: 'coin',
  eye: 'out',
  tools: 'repair',
  bolt: 'bolt',
  wash: 'wash',
  mop: 'mop',
  plate: 'dirty',
  star: 'star',
  tray: 'tray',
  skate: 'skate',
  coffee: 'coffee',
  music: 'music',
  tire: 'tire',
  fuel: 'fuel',
  dice: 'dice',
  map: 'map',
  neon: 'neon',
  patio: 'seat',
};
export function GearMark({ icon }: { icon: GearIcon }) {
  return <DinerIcon name={GEAR_ICON[icon]} />;
}

const REWARD_ICON: Record<Reward, IconName> = {
  gear: 'crate',
  rare: 'crate',
  cash: 'coin',
  life: 'heart',
};
export function RewardMark({ reward }: { reward: Reward }) {
  return (
    <span
      className="diner-reward-mark"
      data-reward={reward}
      title={REWARD_NAMES[reward]}
    >
      <DinerIcon name={REWARD_ICON[reward]} />
    </span>
  );
}

/** One piece of equipment as a card: picked after a shift, or bought at the Garage. */
export function GearCard({
  id,
  onPick,
  price,
  sold,
  disabled,
}: {
  id: GearId;
  onPick: (id: GearId) => void;
  price?: number;
  sold?: boolean;
  disabled?: boolean;
}) {
  const gear = gearById(id);
  return (
    <button
      type="button"
      className="diner-gear-card"
      data-rarity={gear.rarity}
      data-sold={sold || undefined}
      disabled={disabled || sold}
      onClick={() => onPick(id)}
      aria-label={`${gear.name}: ${gear.description}${price !== undefined ? ` ${price} coins` : ''}`}
    >
      <span className="diner-gear-stamp">
        <GearMark icon={gear.icon} />
      </span>
      <span className="diner-gear-text">
        <strong>{gear.name}</strong>
        <span>{gear.description}</span>
      </span>
      {price !== undefined && (
        <span className="diner-gear-price">
          {sold ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <>
              <DinerIcon name="coin" />
              <b>{price}</b>
            </>
          )}
        </span>
      )}
    </button>
  );
}

/** What this run carries: its equipment and the Workshop's upgrades. */
export function DinerEquipment({ run }: { run: CampaignRun }) {
  const gear = run.gear.map(gearById);
  const workshop = UPGRADES.filter((u) => (run.upgradeRanks[u.id] ?? 0) > 0);
  return (
    <div className="diner-equipment-list">
      {gear.length ? (
        <RuleList
          items={gear.map((g) => ({
            key: g.id,
            name: g.name,
            mark: <GearMark icon={g.icon} />,
            text: g.description,
          }))}
        />
      ) : (
        <p className="diner-equipment-empty">
          Finish a shift with a crate on its sign to pick your first equipment.
        </p>
      )}
      {workshop.length > 0 && (
        <>
          <h3>From the Workshop</h3>
          <RuleList
            items={workshop.map((u) => ({
              key: u.id,
              name: u.max > 1 ? `${u.name} ${run.upgradeRanks[u.id]}` : u.name,
              mark: <GearMark icon={u.icon} />,
              text: u.description,
            }))}
          />
        </>
      )}
    </div>
  );
}

/** The Workshop upgrades the diner car itself; it opens between runs. */
export function DinerWorkshop({
  profile,
  locked,
  onBuy,
}: {
  profile: CampaignProfile;
  /** A run is under way: purchases wait until it ends. */
  locked: boolean;
  onBuy: (id: UpgradeId) => void;
}) {
  return (
    <div className="diner-workshop">
      <div
        className="diner-workshop-bank"
        aria-label={`${profile.tokens} tokens`}
      >
        <DinerIcon name="token" />
        <b>{profile.tokens}</b>
      </div>
      {locked && (
        <p className="diner-workshop-note">Finish this run to spend tokens.</p>
      )}
      <div className="diner-upgrade-grid">
        {UPGRADES.map((u) => {
          const rank = profile.upgrades[u.id] ?? 0;
          const maxed = rank >= u.max;
          const price = u.costs[rank];
          return (
            <article
              key={u.id}
              className="diner-workshop-node"
              data-owned={rank > 0}
              data-maxed={maxed}
              style={{ '--ranks': u.max } as CSSProperties}
            >
              <span className="diner-gear-stamp">
                <GearMark icon={u.icon} />
              </span>
              <div className="diner-workshop-text">
                <strong>{u.name}</strong>
                <p>{u.description}</p>
              </div>
              {u.max > 1 && (
                <span
                  className="diner-workshop-ranks"
                  aria-label={`Rank ${rank} of ${u.max}`}
                >
                  {Array.from({ length: u.max }, (_, i) => (
                    <i key={i} data-filled={i < rank} />
                  ))}
                </span>
              )}
              {maxed ? (
                <span className="diner-workshop-complete">
                  <CircleCheck aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  className="diner-workshop-buy"
                  aria-label={`Buy ${u.name} for ${price} tokens`}
                  disabled={locked || profile.tokens < price}
                  onClick={() => onBuy(u.id)}
                >
                  <DinerIcon name="token" />
                  {price}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Every piece of equipment, for the rules. */
export const ALL_GEAR = GEAR;
