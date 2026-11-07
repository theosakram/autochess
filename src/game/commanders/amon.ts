import type { CommanderDef, MirrorBarPower, StarGoldPower } from './types';

// Tune with `bun run balance`.
export const AMON = {
  mirrorBar: { start: 1, steps: 7, max: 2, gold: 12 } satisfies MirrorBarPower,
  starGold: { gold: 4, max: 32 } satisfies StarGoldPower,
  otherMirrors: 1, // his card on another commander: just this many Mirror Devices
};

const m = AMON.mirrorBar;
const s = AMON.starGold;

export const amon: CommanderDef = {
  id: 'amon',
  name: 'Amon',
  icon: '🔮',
  title: 'Keeper of the Mirror',
  desc:
    `Start with ${m.start} Mirror Device (copy one of your units: a new 1-star copy). Every hero you take to 2 stars fills a step of the ` +
    `Mirror Bar; when all ${m.steps} steps are full it empties and makes another Mirror Device, plus ${m.gold} gold. ` +
    `The bar makes up to ${m.max} (${m.start + m.max} devices in all).`,
  innate: { mirrorBar: AMON.mirrorBar },
  card: {
    name: 'Polished Reflection',
    icon: '💠',
    selfDesc: `Gain ${s.gold} gold every time you take a hero to 2 stars, up to ${s.max} gold (${s.max / s.gold} times).`,
    self: { starGold: AMON.starGold },
    otherDesc: `Gain ${AMON.otherMirrors} Mirror Device (copy one of your units: a new 1-star copy).`,
    other: { pickMirrors: AMON.otherMirrors },
  },
};
