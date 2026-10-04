import type { TroopId } from '@/lib/games/arena/cards';
import type { Moves } from './types';
import { archers } from './archers';
import { balloon } from './balloon';
import { bee } from './bee';
import { beekeeper } from './beekeeper';
import { diver } from './diver';
import { drake } from './drake';
import { drummer } from './drummer';
import { duelist } from './duelist';
import { explorer } from './explorer';
import { firefighter } from './firefighter';
import { gladiator } from './gladiator';
import { gunner } from './gunner';
import { imps } from './imps';
import { inventor } from './inventor';
import { jetpack } from './jetpack';
import { linebacker } from './linebacker';
import { mage } from './mage';
import { medic } from './medic';
import { miner } from './miner';
import { ogre } from './ogre';
import { pirate } from './pirate';
import { ranger } from './ranger';
import { sumo } from './sumo';
import { viking } from './viking';

/** Every troop's moves, one file each. */
export const moves: Partial<Record<TroopId, Moves>> = {
  // The first seven (in troops.ts until 3 October 2026).
  archers,
  ogre,
  imps,
  duelist,
  ranger,
  drake,
  mage,
  // The eight of 29 September 2026.
  pirate,
  viking,
  gladiator,
  medic,
  miner,
  balloon,
  inventor,
  gunner,
  // The eight of 1 October 2026 and the Beekeeper's bees.
  diver,
  sumo,
  linebacker,
  beekeeper,
  drummer,
  firefighter,
  jetpack,
  explorer,
  bee,
};
