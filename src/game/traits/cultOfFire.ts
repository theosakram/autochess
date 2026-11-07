import { BURN_SECONDS } from '../stats';
import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const CULT_OF_FIRE = {
  burn: [0.01, 0.018, 0.025, 0.08], // of the target's max hp per second, magic: Cult of Fire basic attacks (and the Offering's bearer)
};

export const cultOfFire: TraitDef = {
  id: 'cultoffire',
  name: 'Cult of Fire',
  icon: '🔥',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    `Cult of Fire units' basic attacks set the target burning: {burn} of its max HP per second as magic damage for ${BURN_SECONDS}s. ` +
    'Grants the Pyre Offering: give it to a unit outside the cult, and every cultist gains a share of that unit’s attack; ' +
    'its bearer burns its targets too.',
  values: () => ({ burn: CULT_OF_FIRE.burn.map(pct) }),
  // Members, and the Offering's bearer (it gets the member bonus), burn on hit.
  mods: ({ level, member }) => (member ? [{ stat: 'burnOnHit', add: CULT_OF_FIRE.burn[level - 1] }] : []),
  items: { pool: ['offering'], grants: [1, 1, 1, 1], shopChance: 0, maxShopTier: 1 },
};
