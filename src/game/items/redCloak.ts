import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Ruby's own item (see commanders/ruby.ts). Tune with `bun run balance`.
export const RED_CLOAK = {
  hp: 0.2, // + share of max hp
  hpEnhanced: 0.4,
  revive: 0.3, // Mastery: once a fight, back up with this share of max hp after dying
  markHeal: 0.1, // of max hp, when the Rage Marked enemy dies
};

const text = (hp: number) =>
  `+${pct(hp)} max HP. Mastery (unique): once a fight, the wearer gets back up with ${pct(RED_CLOAK.revive)} HP after dying. ` +
  `Its basic attacks put a Rage Mark on their target (one enemy at a time); when the marked enemy dies, the wearer restores ${pct(RED_CLOAK.markHeal)} of its max HP. ` +
  'Only from Commander Ruby.';

export const redCloak: ItemDef = {
  id: 'redcloak',
  name: 'Cloak',
  icon: '🧣',
  kind: 'defense',
  maxTier: 1,
  exclusive: true,
  desc: text(RED_CLOAK.hp),
  values: () => ({}),
  mods: () => [{ stat: 'hp', pct: RED_CLOAK.hp }],
  revive: RED_CLOAK.revive,
  rageMark: { effect: 'ragemark', heal: RED_CLOAK.markHeal },
  enhanced: { desc: text(RED_CLOAK.hpEnhanced), mods: () => [{ stat: 'hp', pct: RED_CLOAK.hpEnhanced }] },
};
