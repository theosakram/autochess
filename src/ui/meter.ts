import { COMMANDER_EFFECTS } from '../game/commanders';
import type { CombatEvent } from '../game/combat';
import type { Fight } from '../game/game';
import type { Side } from '../game/grid';
import { ITEMS } from '../game/items';
import { TRAITS } from '../game/traits';
import { UNIT_BY_ID } from '../game/units';
import { portraitOf } from './portraits';
import { itemIcon } from './itemIcons';

// Damage dealt, damage taken and healing done by the viewer's side in one fight, filled in as playback
// replays events. A summon's numbers count for its owner.
export interface Meter {
  fight: Fight;
  side: Side;
  byUnit: Map<number, { attack: number; skill: number }>;
  taken: Map<number, { attack: number; skill: number }>; // attack: from basic attacks; skill: everything else
  healed: Map<number, number>; // healing each unit did (to itself or allies)
  byTrait: Map<string, number>; // damage from effects with no unit behind them, e.g. lightning
  dead: Set<number>;
  live: boolean;
  summons: Map<number, { owner: number; side: Side }>; // units summoned mid-fight
}

export function createMeter(fight: Fight, viewerId: string): Meter {
  const side: Side = fight.home === viewerId ? 0 : 1;
  const mine = fight.result.fighters.filter((f) => f.side === side);
  const byUnit = new Map(mine.map((f) => [f.id, { attack: 0, skill: 0 }]));
  const taken = new Map(mine.map((f) => [f.id, { attack: 0, skill: 0 }]));
  const healed = new Map(mine.map((f) => [f.id, 0]));
  return { fight, side, byUnit, taken, healed, byTrait: new Map(), dead: new Set(), live: true, summons: new Map() };
}

export function recordEvent(m: Meter, e: CombatEvent): void {
  const owner = (id: number) => m.summons.get(id)?.owner ?? id;
  if (e.type === 'summon') {
    m.summons.set(e.fighter.id, { owner: e.owner, side: e.fighter.side });
  } else if (e.type === 'heal') {
    const by = owner(e.by ?? e.id);
    if (m.healed.has(by)) m.healed.set(by, m.healed.get(by)! + e.amount);
    return;
  }
  if (e.type === 'attack' || e.type === 'cast' || e.type === 'effect') {
    const hurt = m.taken.get(owner(e.target));
    if (hurt) hurt[e.type === 'attack' ? 'attack' : 'skill'] += e.damage;
  }
  if (e.type === 'attack' || e.type === 'cast') {
    const tally = m.byUnit.get(owner(e.id));
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

export type MeterTab = 'dealt' | 'taken' | 'healing';

const TABS: { id: MeterTab; name: string; title: string }[] = [
  { id: 'dealt', name: 'Dealt', title: 'Damage dealt' },
  { id: 'taken', name: 'Taken', title: 'Damage taken' },
  { id: 'healing', name: 'Healing', title: 'Healing done' },
];

type Row = { key: string; label: string; tier: number; attack: number; skill: number; dead: boolean };

export function meterHtml(m: Meter | null, tab: MeterTab = 'dealt'): string {
  const tabs = `<nav class="meter-tabs">${TABS.map((t) => `<button class="${t.id === tab ? 'on' : ''}" data-action="meterTab" data-tab="${t.id}" title="${t.title}">${t.name}</button>`).join('')}</nav>`;
  const title = TABS.find((t) => t.id === tab)!.title;
  if (!m) return `<aside class="meter"><h3>${title}</h3>${tabs}<p class="meter-empty">Fight to see who carried.</p></aside>`;
  const unitRow = (id: number, attack: number, skill: number): Row => {
    const f = m.fight.result.fighters[id];
    return { key: `u${id}`, label: `${portraitOf(f.defId)} ${UNIT_BY_ID[f.defId].name} ${'★'.repeat(f.star)}`, tier: UNIT_BY_ID[f.defId].tier, attack, skill, dead: m.dead.has(id) };
  };
  let rows: Row[];
  if (tab === 'dealt') {
    const traits = [...m.byTrait].map(([id, dmg]) => {
      const src = TRAITS[id] ?? ITEMS[id] ?? COMMANDER_EFFECTS[id];
      return { key: id, label: `${ITEMS[id] && !TRAITS[id] ? itemIcon(id) : src.icon} ${src.name}`, tier: 0, attack: 0, skill: dmg, dead: false };
    });
    rows = [...[...m.byUnit].map(([id, d]) => unitRow(id, d.attack, d.skill)), ...traits];
  } else if (tab === 'taken') {
    rows = [...m.taken].map(([id, d]) => unitRow(id, d.attack, d.skill));
  } else {
    // Healing has one colour: it's all in the "skill" part of the bar.
    rows = [...m.healed].map(([id, n]) => unitRow(id, 0, n));
  }
  rows.sort((a, b) => b.attack + b.skill - (a.attack + a.skill));
  const top = Math.max(1, ...rows.map((r) => r.attack + r.skill));
  const total = rows.reduce((n, r) => n + r.attack + r.skill, 0);

  const body = rows
    .map(
      (r) => `<li class="${r.dead ? 'dead' : ''}${r.tier ? ` tier-${r.tier}` : ' trait-row'}">
        <div class="meter-label"><span>${r.label}</span><b>${r.attack + r.skill}</b></div>
        <div class="meter-bar${tab === 'healing' ? ' heal' : ''}">
          <span class="attack" style="width:${(r.attack / top) * 100}%"></span><span class="skill" style="width:${(r.skill / top) * 100}%"></span>
        </div>
      </li>`,
    )
    .join('');
  const legend =
    tab === 'healing'
      ? '<p class="meter-legend"><span class="heal"></span>healing, its own and on allies</p>'
      : `<p class="meter-legend"><span class="attack"></span>${tab === 'taken' ? 'from attacks' : 'attacks'} <span class="skill"></span>${tab === 'taken' ? 'from skills &amp; effects' : 'skills &amp; effects'}</p>`;
  return `<aside class="meter">
    <h3>${m.live ? title : `${title}, last fight`} <small>${total}</small></h3>
    ${tabs}
    <ul>${body}</ul>
    ${legend}
  </aside>`;
}
