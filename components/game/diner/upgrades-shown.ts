import type { UpgradeRanks } from '@/lib/games/diner/campaign-content';
import type { CarUpgrades } from './stage-contract';

/** What the Workshop shows on the car, the truck and the patio. */
export function upgradesShown(ranks: UpgradeRanks): CarUpgrades {
  return {
    spareTires: ranks['spare-tire'] ?? 0,
    biggerPatio: !!ranks['bigger-patio'],
    neonSign: !!ranks['neon-sign'],
    jukebox: !!ranks.jukebox,
    heatLampPass: !!ranks['heat-lamp-pass'],
    coffeeUrn: !!ranks['coffee-urn'],
    twinGrill: !!ranks['twin-grill'],
    rollerSkates: !!ranks['roller-skates'],
    chromeTray: !!ranks['chrome-tray'],
    gasCan: !!ranks['gas-can'],
    luckyDice: !!ranks['lucky-dice'],
    roadAtlas: !!ranks['road-atlas'],
  };
}
