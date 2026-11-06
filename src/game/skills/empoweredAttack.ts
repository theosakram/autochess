import { pct } from '../traits/format';
import type { SkillDef } from './types';

// Per star, index 0 = 1★.
export interface EmpoweredAttack {
  id: string;
  name: string;
  bonus: number[]; // extra damage on top of a normal basic attack
  // Optionally tears the target's armor and magic resist afterwards.
  tear?: { defense: number[]; seconds: number };
  // Optionally saps a share of the target's attack and magic attack afterwards.
  weaken?: { share: number[]; seconds: number };
  // Optionally shields itself (a flat amount) afterwards.
  shield?: { amount: number[]; seconds: number };
  // Optionally shields itself for a share of its max hp afterwards.
  shieldHp?: { share: number[]; seconds: number };
  // Optionally lifesteals this share of the empowered hit's damage.
  lifesteal?: number[];
  // Optionally heals itself for a share of its max hp afterwards.
  heal?: number[];
}

// The simplest skill: the unit's next attack hits harder (an enhanced basic attack: it can crit,
// applies shred and lifesteals), optionally weakening the target after.
export function empoweredAttack(cfg: EmpoweredAttack): SkillDef {
  const { tear, weaken, shield, heal, shieldHp, lifesteal } = cfg;
  const after = [
    tear && `tears the target's defenses: -{defense} armor and magic resist for ${tear.seconds}s`,
    weaken && `saps the target: -{weaken} attack and magic attack for ${weaken.seconds}s`,
    shield && `gains a {shield} shield for ${shield.seconds}s`,
    shieldHp && `gains a shield of {shieldHp} of its max HP for ${shieldHp.seconds}s`,
    heal && 'heals itself for {heal} of its max HP',
  ].filter(Boolean);
  return {
    id: cfg.id,
    name: cfg.name,
    desc:
      'Empowers its next attack to deal {bonus} more damage' +
      (lifesteal ? ', healing it for {lifesteal} of the damage dealt' : '') +
      (after.length ? `, then ${after.join(', and ')}.` : '.'),
    values: () => ({
      bonus: cfg.bonus.map(pct),
      ...(tear && { defense: tear.defense.map(String) }),
      ...(weaken && { weaken: weaken.share.map(pct) }),
      ...(shield && { shield: shield.amount.map(String) }),
      ...(heal && { heal: heal.map(pct) }),
      ...(shieldHp && { shieldHp: shieldHp.share.map(pct) }),
      ...(lifesteal && { lifesteal: lifesteal.map(pct) }),
    }),
    cast(api, caster, target) {
      const victim = target.hp > 0 ? target : api.nearestEnemy(caster);
      if (!victim) return;
      const i = caster.star - 1;
      const power = api.attackPower(caster);
      // Lifesteal on just this hit: a basic hit heals by lifesteal, so lend it some for the moment.
      if (lifesteal) api.buff(caster, [{ stat: 'lifesteal', add: lifesteal[i] }], Infinity, `${cfg.id}leech`, caster);
      api.basicHit(caster, victim, power.amount * (1 + cfg.bonus[i]), power.type, cfg.id);
      if (lifesteal) api.unbuff(caster, `${cfg.id}leech`);
      // Its own shield comes whether or not the hit killed.
      if (shield) api.shield(caster, shield.amount[i], shield.seconds, cfg.id);
      if (shieldHp) api.shield(caster, caster.maxHp * shieldHp.share[i], shieldHp.seconds, cfg.id);
      if (heal) api.heal(caster, caster.maxHp * heal[i]);
      if (victim.hp <= 0) return;
      if (tear) api.debuff(victim, { armor: tear.defense[i], mr: tear.defense[i] }, tear.seconds, cfg.id);
      if (weaken) {
        const share = weaken.share[i];
        const mods = [
          { stat: 'atk' as const, add: -Math.round(victim.stats.atk * share) },
          { stat: 'ap' as const, add: -Math.round(victim.stats.ap * share) },
        ];
        api.buff(victim, mods, weaken.seconds, `${cfg.id}weaken`, caster);
      }
    },
  };
}
