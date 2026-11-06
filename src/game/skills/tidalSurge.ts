import { pct } from '../traits/format';
import { enemiesOn, pathTo } from './areas';
import { freeCellNextTo } from './dashStrike';
import type { SkillDef } from './types';

// Rara Jonggrang (3g Mooneater): she becomes a wave. Per star, index 0 = 1★.
export const TIDAL_SURGE = {
  ap: [1.5, 1.8, 3.6], // of magic attack, magic, to each enemy on the path, per pass (out and back)
  back: 0.3, // seconds before the wave pulls back
};

export const tidalSurge: SkillDef = {
  id: 'tidalsurge',
  name: 'Tidal Surge',
  desc:
    'Becomes a wave: surges to its target and back to where it stood, ' +
    'hitting every enemy on the path both ways for {ap} of magic attack as magic damage each pass.',
  values: () => ({ ap: TIDAL_SURGE.ap.map(pct) }),
  cast(api, caster, target) {
    const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
    if (!victim) return;
    const raw = caster.stats.ap * TIDAL_SURGE.ap[caster.star - 1];
    const home = { x: caster.x, y: caster.y };
    // The wave's path runs all the way to the target; she lands beside it if there's room.
    const path = pathTo(home, victim);
    const pass = () => {
      for (const e of enemiesOn(api, caster, path)) if (e.hp > 0) api.hit(caster, e, raw, 'magic', 'tidalsurge');
    };
    const landing = freeCellNextTo(api, victim, home);
    if (landing) api.dashTo(caster, landing);
    pass();
    // The way back comes a beat later, so the surge out reads on screen.
    api.busy(caster, true);
    api.repeat(caster, TIDAL_SURGE.back, 1, () => {
      if (landing) {
        // Someone took her tile meanwhile: she washes up beside it instead.
        const back = api.occupant(home) ? freeCellNextTo(api, home, caster) : home;
        if (back) api.dashTo(caster, back);
      }
      pass();
      api.busy(caster, false);
    });
  },
};
