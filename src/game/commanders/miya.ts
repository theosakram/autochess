import { pct } from '../traits/format';
import type { CommanderDef, IceArrowPower } from './types';

// Tune with `bun run balance`.
export const MIYA = {
  iceArrow: { every: 6, targets: 6, share: 0.07, attackSpeed: 0.5 } satisfies IceArrowPower,
  card: { gold: 12, item: 'icelongbow' },
};

const a = MIYA.iceArrow;

export const miya: CommanderDef = {
  id: 'miya',
  name: 'Miya',
  icon: '🧝',
  title: 'Moonlit Elf Archer',
  desc:
    'Give one hero the Ice Arrow Blessing (open a unit to pick it; move it freely, one hero at a time). ' +
    `It gets +${pct(a.attackSpeed)} attack speed, and every ${a.every}th basic attack also looses ice arrows at the ${a.targets} nearest enemies, ` +
    `each dealing ${pct(a.share)} of that enemy's max HP as physical damage (armor applies).`,
  innate: { iceArrow: MIYA.iceArrow },
  card: {
    name: 'Ice Longbow',
    icon: '🏹',
    selfDesc:
      `Gain ${MIYA.card.gold} gold and the Ice Longbow, her own equipment: +30% attack speed, and every kill heals your lowest-HP ally ` +
      '20% of its max HP. It stacks with the Ice Arrow Blessing on the same hero.',
    self: { pickGold: MIYA.card.gold, pickItem: MIYA.card.item },
  },
};
