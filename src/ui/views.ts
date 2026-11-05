import { BASE_INCOME, BOARD_COLS, BOARD_ROWS, REROLL_COST, TICKS_PER_SECOND } from '../game/config';
import type { Fight } from '../game/game';
import { boardToGrid, GRID_H, GRID_W, gridIndex, viewPoint } from '../game/grid';
import { auraGrants, effectiveTier, fieldStats, heldBy, type AuraGrant } from '../game/inventory';
import { cardItem, isItemCard, ITEMS, type ItemDef } from '../game/items';
import { orbOptions } from '../game/orb';
import { SKILLS } from '../game/skills';
import { copiesOf, findCopies } from '../game/merge';
import { boardCount, interest, levelUpCost, xpToNext } from '../game/player';
import { attackInterval, type StatKey, type StatMod, type Stats } from '../game/stats';
import { activeTraits, playerTraits, TRAITS, traitCounts, traitLevel, traitTiles, unitStats } from '../game/traits';
import type { GameState, Item, Loc, Orb, Player, Unit } from '../game/types';
import { UNIT_BY_ID, UNITS } from '../game/units';

// Pure HTML builders. No state, no DOM access: app.ts decides what to show.

export const traitNames = (ids: string[], sep = ', ') => ids.map((id) => TRAITS[id].name).join(sep);
const traitLabels = (ids: string[]) => ids.map((id) => `${TRAITS[id].icon} ${TRAITS[id].name}`).join(' · ');

// Inside of a unit chip, shared by board, bench and combat: trait icons, item icons, name, stars.
export function unitBodyHtml(defId: string, star: number, crowned = false, itemIds: string[] = [], orbTrait: string | null = null): string {
  const def = UNIT_BY_ID[defId];
  const bearer = itemIds.flatMap((id) => {
    const grant = ITEMS[id].grantsMembership;
    return grant ? [`<span title="${ITEMS[id].name} bearer: gets ${TRAITS[grant.trait].name} bonuses, doesn't count">${grant.icon}</span>`] : [];
  });
  return `<span class="unit-traits">${def.traits.map((id) => TRAITS[id].icon).join('')}${bearer.join('')}</span>
    ${crowned ? '<span class="chosen-badge" title="Protagonist">👑</span>' : ''}
    ${orbTrait ? `<span class="orb-badge" title="Magic Orb: +1 ${TRAITS[orbTrait].name}">🔮</span>` : ''}
    ${itemIds.length ? `<span class="unit-items">${itemIds.map((id) => ITEMS[id].icon).join('')}</span>` : ''}
    <span class="unit-name">${def.name}</span>
    <span class="unit-star">${'★'.repeat(star)}</span>`;
}

const tileClass = (tiles: Map<number, string>, i: number) => (tiles.has(i) ? ` tile tile-${tiles.get(i)}` : '');

export function unitHtml(
  u: Unit,
  loc: Loc,
  selected = false,
  chosen: Record<string, string> = {},
  items: Item[] = [],
  orb: Orb | null = null,
): string {
  const def = UNIT_BY_ID[u.defId];
  const traits = traitNames(def.traits);
  return `<div class="unit tier-${def.tier}${selected ? ' selected' : ''}" draggable="true" data-uid="${u.uid}" data-area="${loc.area}" data-index="${loc.index}"
    title="${def.name}${traits ? ` (${traits})` : ''}">
    ${unitBodyHtml(
      u.defId,
      u.star,
      isChosen(chosen, u.defId),
      items.filter((i) => i.holder === u.uid).map((i) => i.id),
      orb?.defId === u.defId ? orb.trait : null,
    )}
  </div>`;
}

const isChosen = (chosen: Record<string, string>, defId: string) => Object.values(chosen).includes(defId);

export function slotsHtml(
  slots: (Unit | null)[],
  area: Loc['area'],
  selectedUid: number | null,
  chosen: Record<string, string>,
  items: Item[],
  orb: Orb | null,
): string {
  const tiles = area === 'board' ? traitTiles(activeTraits(slots, orb)) : new Map<number, string>();
  return slots
    .map(
      (u, index) =>
        `<div class="cell${tileClass(tiles, index)}" data-area="${area}" data-index="${index}">${u ? unitHtml(u, { area, index }, u.uid === selectedUid, chosen, items, orb) : ''}</div>`,
    )
    .join('');
}

// Opponent's half during prep. Never a drop target.
export const enemyHalfHtml = () => '<div class="cell enemy"></div>'.repeat(BOARD_COLS * BOARD_ROWS);

// Full combat grid with both sides' trait tiles, drawn from the viewer's side.
export function combatCellsHtml(fight: Fight, viewerId: string): string {
  const flip = fight.home !== viewerId;
  const tiles = new Map<number, string>();
  for (const side of [0, 1] as const) {
    for (const [cell, traitId] of traitTiles(fight.result.traits[side])) {
      tiles.set(gridIndex(viewPoint(boardToGrid(side, cell), flip)), traitId);
    }
  }
  return Array.from({ length: GRID_W * GRID_H }, (_, i) => `<div class="cell${tileClass(tiles, i)}"></div>`).join('');
}

// Traits with at least one unit on the board, active first: icon plus count/next breakpoint.
export function traitsPanelHtml(p: Player): string {
  const counts = traitCounts(p.board, p.orb);
  const tiles = Object.entries(counts)
    .map(([id, n]) => ({ t: TRAITS[id], n, lvl: traitLevel(id, n) }))
    .sort((a, b) => b.lvl - a.lvl || b.n - a.n)
    .map(({ t, n, lvl }) => {
      const goal = t.breakpoints[lvl] ?? t.breakpoints[t.breakpoints.length - 1];
      return `<button class="trait-tile${lvl ? ' active' : ''}" data-trait="${t.id}" title="${t.name}">
        <span class="trait-icon">${t.icon}</span>
        <span class="trait-count">${n}/${goal}</span>
      </button>`;
    })
    .join('');
  // Bearers (e.g. of the Pyre Offering) get their own 1/1 tile, lit while their trait is active.
  const levels = playerTraits(p);
  const fielded = new Set(p.board.flatMap((u) => (u ? [u.uid] : [])));
  const bearers = p.items
    .filter((it) => it.holder !== null && fielded.has(it.holder) && ITEMS[it.id].grantsMembership)
    .map((it) => {
      const grant = ITEMS[it.id].grantsMembership!;
      const name = `${ITEMS[it.id].name} bearer`;
      return `<button class="trait-tile bearer${effectiveTier(it, levels) ? ' active' : ''}" data-bearer="${it.uid}" title="${name}">
        <span class="trait-icon">${grant.icon}</span>
        <span class="trait-count">1/1</span>
      </button>`;
    })
    .join('');
  return `<aside class="traits">${tiles + bearers || '<p class="traits-empty">No synergies yet</p>'}</aside>`;
}

// Fills a trait's or item's {placeholders} with every level's value; `current` (1-based) is highlighted.
function descHtml(src: { desc: string; values(): Record<string, string[]> }, current: number): string {
  const values = src.values();
  return src.desc.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key].map((v, i) => `<span class="${i === current - 1 ? 'on' : ''}">${v}</span>`).join('<i> / </i>'),
  );
}

const STAT_NAMES: Partial<Record<StatKey, string>> = { atk: 'attack', hp: 'HP', armor: 'armor', mr: 'magic resist' };
const statName = (s: StatKey) => STAT_NAMES[s] ?? s;
const modText = (m: StatMod) => (m.add ? `+${m.add} ${statName(m.stat)}` : `+${Math.round((m.pct ?? 0) * 100)}% ${statName(m.stat)}`);

// "every Cult of Fire unit +122 attack (50% of 243)"
const auraText = (g: AuraGrant) =>
  `every ${TRAITS[g.to].name} unit +${g.amount} ${statName(g.stat)} (${Math.round(g.share * 100)}% of ${g.base})`;

// Plain text for one tier of an item, for tooltips.
const itemText = (def: ItemDef, tier: number) => {
  const values = def.values();
  return def.desc.replace(/\{(\w+)\}/g, (_, key: string) => values[key][tier - 1]);
};

// The items a trait hands out, with your tier of each highlighted.
function traitItemsHtml(itemIds: string[], p: Player): string {
  const grants = auraGrants(p, playerTraits(p));
  const rows = itemIds
    .map((id) => {
      const def = ITEMS[id];
      const owned = p.items.find((it) => it.id === id);
      const grant = owned && grants.get(owned.uid);
      return `<li class="${owned ? 'owned' : ''}">
        <b>${def.icon} ${def.name}</b> <small>${def.kind} · ${owned ? `tier ${owned.tier}` : 'not yet'}</small>
        <p class="trait-desc">${descHtml(def, owned?.tier ?? 0)}</p>
        ${grant ? `<p class="aura-line">Now: ${auraText(grant)}</p>` : ''}
      </li>`;
    })
    .join('');
  return `<h4>Items</h4><ul class="trait-items">${rows}</ul>`;
}

// Popup for one trait: breakpoints, one description, and every unit that has it (yours highlighted).
// Title plus everything about a trait, measured against `board`. Shared by the single-trait
// popup and the gallery so the two never drift apart.
function traitCardHtml(traitId: string, p: Player, chosen: Record<string, string>, heading: 'h2' | 'h3'): string {
  const { board } = p;
  const t = TRAITS[traitId];
  const n = traitCounts(board, p.orb)[traitId] ?? 0;
  const lvl = traitLevel(traitId, n);
  const owned = new Set(board.flatMap((u) => (u ? [u.defId] : [])));
  const bps = t.breakpoints.map((b, i) => `<span class="${i < lvl ? 'on' : ''}${i === lvl - 1 ? ' current' : ''}">${b}</span>`).join('');
  const units = UNITS.filter((u) => u.traits.includes(traitId))
    .sort((a, b) => a.tier - b.tier)
    .map((u) => `<li class="tier-${u.tier}${owned.has(u.id) ? ' owned' : ''}">${u.name} <small>${u.tier}g</small></li>`)
    .join('');
  return `<${heading} class="trait-title"><span class="trait-icon">${t.icon}</span> ${t.name} <small>${t.kind} · ${n} on board</small></${heading}>
    <div class="trait-bps">${bps}</div>
    <p class="trait-desc">${descHtml(t, lvl)}</p>
    ${chosen[traitId] ? `<p class="trait-stacks">👑 This game: <b>${UNIT_BY_ID[chosen[traitId]].name}</b></p>` : ''}
    ${p.orb?.trait === traitId ? `<p class="trait-stacks">🔮 Orb: <b>${UNIT_BY_ID[p.orb.defId].name}</b> counts +1</p>` : ''}
    ${t.stacks ? `<p class="trait-stacks">Stacks: <b>${p.stacks[traitId] ?? 0}</b> / ${t.stacks.max}</p>` : ''}
    ${t.items ? traitItemsHtml(t.items.pool, p) : ''}
    <h4>Units</h4>
    <ul class="trait-units">${units}</ul>`;
}

// Modal shell: backdrop and × both fire `closeAction`.
const modalHtml = (closeAction: string, className: string, body: string) =>
  `<div class="overlay" data-action="${closeAction}"><div class="dialog modal ${className}">
    <button class="close" data-action="${closeAction}" aria-label="Close">×</button>
    ${body}
  </div></div>`;

export function traitDetailHtml(traitId: string, p: Player, chosen: Record<string, string>): string {
  return modalHtml('closeTrait', 'trait-popup', traitCardHtml(traitId, p, chosen, 'h2'));
}

// Every trait in the game, factions then roles.
export function galleryHtml(p: Player, chosen: Record<string, string>): string {
  const section = (kind: 'faction' | 'role', title: string) => {
    const cards = Object.values(TRAITS)
      .filter((t) => t.kind === kind)
      .map((t) => `<article class="gallery-card">${traitCardHtml(t.id, p, chosen, 'h3')}</article>`)
      .join('');
    return `<h3 class="gallery-section">${title}</h3><div class="gallery-grid">${cards}</div>`;
  };
  return modalHtml('closeGallery', 'gallery', `<h2>📖 Synergies</h2>${section('faction', 'Factions')}${section('role', 'Roles')}`);
}

export function shopHtml(p: Player, locked: boolean, chosen: Record<string, string>): string {
  const cards = p.shop
    .map((id, slot) => {
      if (!id) return `<div class="shop-card empty"></div>`;
      if (isItemCard(id)) {
        const item = ITEMS[cardItem(id)];
        const tier = p.items.find((it) => it.id === item.id)?.tier ?? 0;
        return `<button class="shop-card item-card" data-slot="${slot}" ${locked ? 'disabled' : ''} title="${item.name} tier ${tier + 1}: ${itemText(item, tier + 1)}">
          <span class="unit-name">${item.icon} ${item.name}</span>
          <span class="traits">Tier ${tier} → ${tier + 1}</span>
          <span class="cost">Free</span>
        </button>`;
      }
      const def = UNIT_BY_ID[id];
      const upgrade = findCopies(p, id, 1).length >= 2 ? ' upgrade' : '';
      return `<button class="shop-card tier-${def.tier}${upgrade}" data-slot="${slot}" ${locked || p.gold < def.tier ? 'disabled' : ''}>
        <span class="unit-name">${isChosen(chosen, id) ? '👑 ' : ''}${def.name}</span>
        <span class="traits">${traitLabels(def.traits)}</span>
        <span class="cost">${def.tier}g</span>
      </button>`;
    })
    .join('');
  const disabled = locked ? 'disabled' : '';
  const levelCost = levelUpCost(p);
  const levelBtn =
    levelCost === null
      ? `<button disabled title="Max level">🏅 max</button>`
      : `<button data-action="levelUp" title="Level up" ${locked || p.gold < levelCost ? 'disabled' : ''}>⏫ ${levelCost}g <kbd>F</kbd></button>`;
  const lockBtn = `<button data-action="toggleLock" class="lock${p.shopLocked ? ' on' : ''}"
    title="${p.shopLocked ? 'Locked: keeps this shop next round (click to unlock)' : 'Lock: keep this shop next round'}">${p.shopLocked ? '🔒' : '🔓'}</button>`;
  return `<section class="shop${p.shopLocked ? ' locked' : ''}" title="Drop a unit here to sell it">
    <div class="shop-cards">${cards}</div>
    <div class="shop-buttons">
      ${lockBtn}
      <button data-action="reroll" title="Reroll the shop" ${disabled}>🔄 ${REROLL_COST}g <kbd>D</kbd></button>
      ${levelBtn}
      ${
        locked
          ? `<button data-action="skip" class="primary" title="Skip fight">⏭️ <kbd>Space</kbd></button>`
          : `<button data-action="endTurn" class="primary" title="Fight!">⚔️ <kbd>Space</kbd></button>`
      }
    </div>
  </section>`;
}

// The player's items: drag one onto a unit to equip it, back here to unequip.
export function armoryHtml(p: Player, selectedItem: number | null = null): string {
  if (p.items.length === 0) return '';
  const levels = playerTraits(p);
  const grants = auraGrants(p, levels);
  const units = [...p.board, ...p.bench];
  const chips = p.items
    .map((it) => {
      const def = ITEMS[it.id];
      const tier = effectiveTier(it, levels);
      const holder = units.find((u) => u?.uid === it.holder);
      const grant = grants.get(it.uid);
      const state = tier ? `tier ${tier}` : `inactive: needs ${TRAITS[def.trait].name}`;
      return `<div class="item-chip${tier ? '' : ' inactive'}${holder ? ' equipped' : ''}${it.uid === selectedItem ? ' selected' : ''}" draggable="true" data-item="${it.uid}"
        title="${def.name} (${state}). ${itemText(def, tier || it.tier)}${grant ? ` Now: ${auraText(grant)}.` : ''}">
        <span class="item-icon">${def.icon}</span><b>T${tier || it.tier}</b>
        ${holder ? `<small>${UNIT_BY_ID[holder.defId].name}</small>` : ''}
        ${grant ? `<small class="aura-line">+${grant.amount} ${statName(grant.stat)}</small>` : ''}
      </div>`;
    })
    .join('');
  return `<section class="armory" title="Click an item, then a unit, to equip it (max 3). Or drag it.">${chips}</section>`;
}

export function hudHtml(state: GameState, p: Player, hp: number, opponentName: string | null): string {
  const need = xpToNext(p);
  const income = BASE_INCOME + interest(p.gold);
  const xp =
    need === null
      ? '<small>max</small>'
      : `<span class="xp-bar"><span style="width:${(p.xp / need) * 100}%"></span></span><small>${p.xp}/${need}</small>`;
  const stat = (icon: string, title: string, value: string) => `<span class="hud-stat" title="${title}">${icon} ${value}</span>`;
  return `<header class="hud">
    ${stat('⏳', `Round ${state.round}`, `<b>${state.round}</b>`)}
    ${stat('❤️', 'HP', `<b>${hp}</b>`)}
    ${stat('💰', `Gold (+${income} next round)`, `<b>${p.gold}</b>`)}
    ${stat('🏅', need === null ? `Level ${p.level} (max)` : `Level ${p.level}, ${p.xp}/${need} XP`, `<b>${p.level}</b> ${xp}`)}
    ${stat('♟️', 'Units on board / max', `<b>${boardCount(p)}/${p.level}</b>`)}
    ${p.orbs.length ? stat('🔮', 'Magic Orb ready: click a unit, then Use Magic Orb', `<b>${p.orbs.length}</b>`) : ''}
    ${opponentName ? `<span class="hud-stat vs" title="Fighting">⚔️ <b>${opponentName}</b></span>` : ''}
    <button class="hud-book" data-action="openGallery" title="All factions and roles">📖</button>
  </header>`;
}

// Right-column card for one of the player's units: stats as it would fight right now.
export function unitDetailHtml(p: Player, uid: number, chosen: Record<string, string>): string {
  const area = p.board.some((u) => u?.uid === uid) ? 'board' : 'bench';
  const slots = area === 'board' ? p.board : p.bench;
  const cell = slots.findIndex((u) => u?.uid === uid);
  const u = slots[cell]!;
  const def = UNIT_BY_ID[u.defId];
  const base = unitStats(def, u.star);
  // Bench units don't fight, so only fielded ones get trait and item bonuses.
  const levels = area === 'board' ? playerTraits(p) : {};
  const held = heldBy(p, uid);
  const s = area === 'board' ? fieldStats(p, levels, chosen).get(uid)! : base;

  const fmt = (n: number) => String(+n.toFixed(2));
  const row = (label: string, key: keyof Stats, show = (n: number) => fmt(n)) => {
    const diff = s[key] - base[key];
    const bonus = Math.abs(diff) > 1e-9 ? `<em>${diff > 0 ? '+' : ''}${show(diff)}</em>` : '';
    return `<dt>${label}</dt><dd>${show(s[key])} ${bonus}</dd>`;
  };
  const optional = (label: string, key: keyof Stats, show?: (n: number) => string) => (s[key] ? row(label, key, show) : '');
  const perSec = (ticks: number) => (TICKS_PER_SECOND / ticks).toFixed(2);
  const position = `${def.range <= 1 ? 'Frontline · melee' : `Backline · range ${def.range}`} · ${def.attackType ?? 'physical'} attacks`;
  const honorary = held.flatMap((it) => {
    const grant = ITEMS[it.id].grantsMembership;
    return grant && effectiveTier(it, levels) ? [grant] : [];
  });
  const traits = [
    ...def.traits.map((id) => `<button class="chip" data-trait="${id}">${TRAITS[id].icon} ${TRAITS[id].name}</button>`),
    ...honorary.map((g) => `<button class="chip" data-trait="${g.trait}" title="Gets the bonuses, doesn't count">${g.icon} ${TRAITS[g.trait].name} bearer</button>`),
  ].join('');

  return `<section class="unit-detail tier-${def.tier}">
    <button class="close" data-action="closeUnit" aria-label="Close">×</button>
    <h3>${isChosen(chosen, def.id) ? '👑 ' : ''}${def.name} <span class="unit-star">${'★'.repeat(u.star)}</span></h3>
    <p class="meta">${def.tier}g · ${position}${area === 'bench' ? ' · on bench' : ''}</p>
    ${traits ? `<div class="chips">${traits}</div>` : ''}
    ${p.orb?.defId === def.id ? `<p class="orb-line">🔮 Orb: +1 ${TRAITS[p.orb.trait].icon} ${TRAITS[p.orb.trait].name}${area === 'bench' ? ' (when fielded)' : ''}</p>` : ''}
    ${p.orbs.length ? `<button class="orb-use" data-action="openOrb" data-unit="${uid}">🔮 Use Magic Orb</button>` : ''}
    <dl>
      ${row('HP', 'hp')}
      ${row('Attack', 'atk')}
      <dt>Attack speed</dt><dd>${perSec(attackInterval(s))}/s ${
        attackInterval(s) !== attackInterval(base) ? `<em>+${fmt((s.attackSpeed - base.attackSpeed) * 100)}%</em>` : ''
      }</dd>
      ${row('Range', 'range')}
      ${row('Armor', 'armor')}
      ${row('Magic resist', 'mr')}
      ${row('Mana', 'maxMana')}
      ${optional('Mana regen', 'manaRegen', (n) => `${fmt(n)}/s`)}
      ${optional('Damage amp', 'damageAmp', (n) => `${fmt(n * 100)}%`)}
      ${optional('Armor shred', 'armorShred')}
      ${optional('Crit chance', 'critChance', (n) => `${fmt(n * 100)}%`)}
      ${s.critChance ? row('Crit damage', 'critDamage', (n) => `${fmt(n * 100)}%`) : ''}
      ${optional('Lifesteal', 'lifesteal', (n) => `${fmt(n * 100)}%`)}
      ${optional('Spell lifesteal', 'spellLifesteal', (n) => `${fmt(n * 100)}%`)}
    </dl>
    ${held.length ? `<h4>Items</h4><ul class="detail-items">${held.map((it) => itemRowHtml(it, effectiveTier(it, levels), area === 'board' ? auraGrants(p, levels, chosen).get(it.uid) : undefined)).join('')}</ul>` : ''}
    ${skillHtml(def.skill, u.star, s)}
    <button class="unit-sell" data-action="sellUnit" data-uid="${u.uid}">Sell for ${def.tier * copiesOf(u)}g</button>
    <p class="meta">Tip: with this unit selected, click any board or bench cell to move it there.</p>
  </section>`;
}

// Choose which trait a Magic Orb boosts through this unit type, with the count it would give.
export function orbChoiceHtml(p: Player, uid: number): string {
  const unit = [...p.board, ...p.bench].find((u) => u?.uid === uid)!;
  const def = UNIT_BY_ID[unit.defId];
  const before = traitCounts(p.board, p.orb);
  const rows = orbOptions(p.orbs[0], def.id)
    .map((id) => {
      const t = TRAITS[id];
      const after = traitCounts(p.board, { defId: def.id, trait: id })[id] ?? 0;
      const from = before[id] ?? 0;
      const bp = traitLevel(id, after) > traitLevel(id, from) ? ` · reaches ${t.breakpoints[traitLevel(id, after) - 1]}!` : '';
      const own = def.traits.includes(id) ? 'counts double' : 'random pick';
      // Not data-trait: that attribute means "open this trait's popup" to the click handler.
      return `<button class="orb-option" data-action="useOrb" data-orb-trait="${id}">
        <span class="trait-icon">${t.icon}</span>
        <span><b>${t.name}</b> <small>${own}</small><br><small>${from} → ${after}${bp}</small></span>
      </button>`;
    })
    .join('');
  const replaces = p.orb ? `<p class="meta">Replaces your orb on ${UNIT_BY_ID[p.orb.defId].name} (+1 ${TRAITS[p.orb.trait].name}).</p>` : '';
  const benched = p.board.some((u) => u?.uid === uid) ? '' : '<p class="meta">Counts once this unit is on the board.</p>';
  return modalHtml(
    'closeOrb',
    'orb-popup',
    `<h2>🔮 Magic Orb: ${def.name}</h2>
    <p class="meta">Pick a trait. Every ${def.name} you field counts +1 for it, all game, until you use another orb.</p>
    ${replaces}${benched}
    <div class="orb-options">${rows}</div>`,
  );
}

// The unit's skill, its current star's numbers highlighted; or the placeholder cast.
function skillHtml(skillId: string | undefined, star: number, s: Stats): string {
  if (!skillId) {
    return `<h4>Skill <small>placeholder</small></h4>
      <p class="skill">At full mana, the next attack deals ${Math.round(s.castMult * 100)}% attack (${Math.round(s.atk * s.castMult)}) as magic damage.</p>`;
  }
  const skill = SKILLS[skillId];
  return `<h4>Skill: ${skill.name}</h4><p class="skill trait-desc">${descHtml(skill, star)}</p>`;
}

function itemRowHtml(it: Item, tier: number, grant?: AuraGrant): string {
  const def = ITEMS[it.id];
  return `<li class="${tier ? '' : 'inactive'}">
    <b>${def.icon} ${def.name} <small>T${tier || it.tier}${tier ? '' : ' · inactive'}</small></b>
    <button class="chip" data-action="unequip" data-item="${it.uid}" title="Back to your items">✕</button>
    <p>${itemText(def, tier || it.tier)}</p>
    ${grant ? `<p class="aura-line">Now: ${auraText(grant)}</p>` : ''}
  </li>`;
}

// Popup for a bearer: who holds a membership-granting item, what it gets, what it gives.
export function bearerDetailHtml(p: Player, itemUid: number, chosen: Record<string, string>): string {
  const it = p.items.find((i) => i.uid === itemUid)!;
  const def = ITEMS[it.id];
  const grant = def.grantsMembership!;
  const trait = TRAITS[grant.trait];
  const levels = playerTraits(p);
  const level = levels[grant.trait] ?? 0;
  const holder = [...p.board, ...p.bench].find((u) => u?.uid === it.holder);
  const aura = auraGrants(p, levels, chosen).get(itemUid);
  const bonus = level
    ? trait.mods({ level, member: true, cell: -1, chosen: false, stacks: 0 }).map(modText).join(', ')
    : `nothing until ${trait.name} is active`;
  const who = holder ? `${UNIT_BY_ID[holder.defId].name} ${'★'.repeat(holder.star)}` : 'nobody';
  return modalHtml(
    'closeBearer',
    'trait-popup',
    `<h2 class="trait-title"><span class="trait-icon">${grant.icon}</span> ${def.name} bearer <small>1/1</small></h2>
    <p class="trait-desc"><b>${who}</b> holds the ${def.icon} ${def.name}.</p>
    <ul class="bearer-facts">
      <li>Gets the ${trait.icon} ${trait.name} unit bonus: <b>${bonus}</b>.</li>
      <li>Does <b>not</b> count toward ${trait.name}.</li>
      ${aura ? `<li>Gives ${auraText(aura)}, to ${aura.receivers} unit${aura.receivers === 1 ? '' : 's'} now.</li>` : ''}
      ${def.forbidden ? `<li>${TRAITS[def.forbidden].name} units can't hold it.</li>` : ''}
    </ul>`,
  );
}

export function playersHtml(others: Player[], shownHp: (p: Player) => number, opponentId: string | null): string {
  const rows = others
    .slice()
    .sort((a, b) => shownHp(b) - shownHp(a) || (a.place ?? 0) - (b.place ?? 0))
    .map((o) => {
      const hp = shownHp(o);
      const cls = [hp <= 0 ? 'out' : '', o.id === opponentId ? 'current' : ''].join(' ');
      const info = hp <= 0 ? `#${o.place}` : `${hp} HP · Lv ${o.level} · ${boardCount(o)} units`;
      return `<li class="${cls}"><span>${o.name}</span><span>${info}</span></li>`;
    })
    .join('');
  return `<aside class="opponents"><h3>Players</h3><ul>${rows}</ul></aside>`;
}

export function gameOverHtml(p: Player, playerCount: number): string {
  return `<div class="overlay"><div class="dialog">
    <h2>${p.place === 1 ? 'Victory!' : 'Eliminated'}</h2>
    <p>You finished <b>#${p.place}</b> of ${playerCount}.</p>
    <button data-action="newGame" class="primary">New game</button>
  </div></div>`;
}
