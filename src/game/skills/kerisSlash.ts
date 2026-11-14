import { GRID_H, GRID_W } from '../grid';
import { pct } from '../traits/format';
import { around, enemiesOn } from './areas';
import type { SkillDef } from './types';

// Ken Arok (Plane Wanderer, Weapon Master): the cursed keris wakes for a while. Per star, index 0 = 1★.
export const KERIS_SLASH = {
  seconds: 5, // how long the stance lasts; no mana meanwhile, so the next cast comes after it
  power: [1.8, 2, 3], // of attack: each of his basic hits while it lasts, his target and every splash alike
  lifesteal: [0.5, 0.6, 0.8], // gained while it lasts
  attackSpeed: [1.2, 1.2, 1.5], // gained while it lasts
  boardStar: 3, // from this star, every enemy on the board is struck instead of those around him
};

const EFFECT = 'kerisslash';

export const kerisSlash: SkillDef = {
  id: 'kerisslash',
  name: 'Cursed Keris',
  desc:
    `For ${KERIS_SLASH.seconds}s his basic attacks deal {power} of attack and strike every enemy on the tiles around him, not only his target, ` +
    'and he gains +{as} attack speed and +{steal} lifesteal. He gains no mana while it lasts. At 3★ they strike every enemy on the board.',
  damage: { power: 'physical' },
  values: () => ({ power: KERIS_SLASH.power.map(pct), steal: KERIS_SLASH.lifesteal.map(pct), as: KERIS_SLASH.attackSpeed.map(pct) }),
  cast(api, caster) {
    const i = caster.star - 1;
    api.buff(
      caster,
      [
        { stat: 'basicAmp', add: KERIS_SLASH.power[i] - 1 },
        { stat: 'lifesteal', add: KERIS_SLASH.lifesteal[i] },
        { stat: 'attackSpeed', add: KERIS_SLASH.attackSpeed[i] },
      ],
      KERIS_SLASH.seconds,
      EFFECT,
      caster,
    );
  },
  holdsMana: (api, caster) => api.hasBuff(caster, EFFECT),
  // While the keris is awake, every basic hit also lands on the others in reach: enhanced basic hits (they
  // crit and lifesteal like the attack), at his attack with the stance's bonus.
  onBasicHit(api, caster, target) {
    if (!api.hasBuff(caster, EFFECT)) return;
    const board = caster.star >= KERIS_SLASH.boardStar;
    // The look: a half-moon slash toward his target, or one huge crescent across the whole board.
    if (board) api.showProjectile(caster, { x: (GRID_W - 1) / 2, y: (GRID_H - 1) / 2 }, 0.45, 'kerisslashall');
    else api.showProjectile(caster, target, 0.3, EFFECT);
    const others = board ? api.enemiesOf(caster) : enemiesOn(api, caster, around(caster));
    for (const e of others) if (e !== target && e.hp > 0) api.basicHit(caster, e, caster.stats.atk, 'physical', EFFECT);
  },
};
