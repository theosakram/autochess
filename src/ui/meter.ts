import { COMMANDER_EFFECTS } from '../game/commanders';
import type { CombatEvent } from '../game/combat';
import type { Fight } from '../game/game';
import type { Side } from '../game/grid';
import { ITEMS } from '../game/items';
import { TRAITS } from '../game/traits';
import { UNIT_BY_ID } from '../game/units';

// Damage dealt by the viewer's side in one fight, filled in as playback replays events.
export interface Meter {
  fight: Fight;
  side: Side;
  byUnit: Map<number, { attack: number; skill: number }>;
  byTrait: Map<string, number>; // damage from effects with no unit behind them, e.g. lightning
  dead: Set<number>;
  live: boolean;
  summons: Map<number, { owner: number; side: Side }>; // units summoned mid-fight
}

export function createMeter(fight: Fight, viewerId: string): Meter {
  const side: Side = fight.home === viewerId ? 0 : 1;
  const byUnit = new Map(fight.result.fighters.filter((f) => f.side === side).map((f) => [f.id, { attack: 0, skill: 0 }]));
  return { fight, side, byUnit, byTrait: new Map(), dead: new Set(), live: true, summons: new Map() };
}

export function recordEvent(m: Meter, e: CombatEvent): void {
  if (e.type === 'summon') {
    m.summons.set(e.fighter.id, { owner: e.owner, side: e.fighter.side });
  } else if (e.type === 'attack' || e.type === 'cast') {
    const tally = m.byUnit.get(m.summons.get(e.id)?.owner ?? e.id);
    if (tally) tally[e.type === 'cast' ? 'skill' : 'attack'] += e.damage;
  } else if (e.type === 'effect') {
    if (e.by !== undefined) {
      // An item effect: counts for its holder, like a skill.
      const tally = m.byUnit.get(e.by);
      if (tally) tally.skill += e.damage;
    } else if ((m.fight.result.fighters[e.target]?.side ?? m.summons.get(e.target)?.side) !== m.side) {
      // Trait damage lands on the side that doesn't own the trait.
      m.byTrait.set(e.effect, (m.byTrait.get(e.effect) ?? 0) + e.damage);
    }
  } else if (e.type === 'death' && m.byUnit.has(e.id)) {
    m.dead.add(e.id);
  }
}

export function meterHtml(m: Meter | null): string {
  if (!m) return `<aside class="meter"><h3>Damage</h3><p class="meter-empty">Fight to see who carried.</p></aside>`;
  const units = [...m.byUnit].map(([id, d]) => {
    const f = m.fight.result.fighters[id];
    return { key: `u${id}`, label: `${UNIT_BY_ID[f.defId].name} ${'★'.repeat(f.star)}`, tier: UNIT_BY_ID[f.defId].tier, ...d, dead: m.dead.has(id) };
  });
  const traits = [...m.byTrait].map(([id, dmg]) => {
    const src = TRAITS[id] ?? ITEMS[id] ?? COMMANDER_EFFECTS[id];
    return { key: id, label: `${src.icon} ${src.name}`, tier: 0, attack: 0, skill: dmg, dead: false };
  });
  const rows = [...units, ...traits].sort((a, b) => b.attack + b.skill - (a.attack + a.skill));
  const top = Math.max(1, ...rows.map((r) => r.attack + r.skill));
  const total = rows.reduce((n, r) => n + r.attack + r.skill, 0);

  const body = rows
    .map(
      (r) => `<li class="${r.dead ? 'dead' : ''}${r.tier ? ` tier-${r.tier}` : ' trait-row'}">
        <div class="meter-label"><span>${r.label}</span><b>${r.attack + r.skill}</b></div>
        <div class="meter-bar">
          <span class="attack" style="width:${(r.attack / top) * 100}%"></span><span class="skill" style="width:${(r.skill / top) * 100}%"></span>
        </div>
      </li>`,
    )
    .join('');
  return `<aside class="meter">
    <h3>${m.live ? 'Damage' : 'Last fight'} <small>${total}</small></h3>
    <ul>${body}</ul>
    <p class="meter-legend"><span class="attack"></span>attacks <span class="skill"></span>skills &amp; effects</p>
  </aside>`;
}
