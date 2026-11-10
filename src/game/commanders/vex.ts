import type { BoxPower, CommanderDef } from './types';

// Vex: Box round perks. Boxes count from the first (stage I's). Tune with `bun run commanders`.
export const VEX = {
  box: { gold: 10, goldBoxes: 3, bonusBoxes: 3, copyBoxes: 1 } satisfies BoxPower,
  card: { bonusBoxes: 4 },
};

const b = VEX.box;
const firstBoxes = (n: number) => (n === 1 ? 'the first Box round' : `the first ${n} Box rounds`);

export const vex: CommanderDef = {
  id: 'vex',
  name: 'Vex',
  icon: '🎁',
  title: 'Keeper of the Box',
  desc:
    `On ${firstBoxes(b.goldBoxes)}, gain ${b.gold} gold when the box opens, and once everyone has picked, take one bonus pick ` +
    `from what's left. On ${firstBoxes(b.copyBoxes)}, the first item you take comes with a free copy.`,
  innate: { boxPerks: VEX.box },
  card: {
    name: 'Second Helping',
    icon: '🎟️',
    selfDesc: `On ${firstBoxes(VEX.card.bonusBoxes)}, one more bonus pick, on top of your own.`,
    self: { boxBonus: VEX.card.bonusBoxes },
    otherDesc: `On ${firstBoxes(VEX.card.bonusBoxes)}, once everyone has picked, take one bonus pick from what's left.`,
    other: { boxBonus: VEX.card.bonusBoxes },
  },
};
