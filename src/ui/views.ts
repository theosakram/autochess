import { rewardText } from '../game/traits/format';
import { autoHalo, beastOf, cardFace, COMMANDERS, MARKS, markedUid, markKinds, powersOf, type MarkKind } from '../game/commanders';
import { BASE_INCOME, isMonsterRound, REROLL_COST, START_HP, TICKS_PER_SECOND } from '../game/config';
import { type AuraGrant, auraGrants, effectiveTier, fieldLeaders, fieldStats, heldBy, leadsOf } from '../game/inventory';
import { cardItem, isItemCard, ITEMS, type ItemDef } from '../game/items';
import { MIST_WARES, mistCoins } from '../game/mistShop';
import { orbOptions } from '../game/orb';
import { SKILLS } from '../game/skills';
import { copiesOf, findCopies } from '../game/merge';
import { MAX_ITEMS_PER_UNIT } from '../game/config';
import { boardCount, freeSlotCount, interest, levelUpCost, xpToNext } from '../game/player';
import { attackInterval, type StatKey, type StatMod, type Stats } from '../game/stats';
import { fieldedMistOrbs, playerTraitCounts, playerTraits, traitCounts, traitLevel, TRAITS, unitStats } from '../game/traits';
import type { GameState, Item, Player, UnitDef } from '../game/types';
import { UNIT_BY_ID, UNITS } from '../game/units';
import { portraitHtml } from './portraits';
import { bearerBadgeHtml, traitBadgeHtml } from './traitBadges';

// Pure HTML builders. No state, no DOM access: app.ts decides what to show.

export const traitNames = (ids: string[], sep = ', ') => ids.map((id) => TRAITS[id].name).join(sep);
const isChosen = (chosen: Record<string, string>, defId: string) => Object.values(chosen).includes(defId);

// Traits with at least one unit on the board, active first: icon plus count/next breakpoint.
export function traitsPanelHtml(p: Player): string {
  const counts = playerTraitCounts(p);
  const tiles = Object.entries(counts)
    .map(([id, n]) => ({ t: TRAITS[id], n, lvl: traitLevel(id, n) }))
    .sort((a, b) => b.lvl - a.lvl || b.n - a.n)
    .map(({ t, n, lvl }) => {
      const goal = t.breakpoints[lvl] ?? t.breakpoints[t.breakpoints.length - 1];
      const steps = t.breakpoints.map((b, i) => `<i class="${i < lvl ? 'on' : ''}">${b}</i>`).join('');
      return `<button class="trait-tile${lvl ? ' active' : ''}" data-trait="${t.id}" title="${t.name}">
        <span class="trait-icon">${traitBadgeHtml(t.id)}</span>
        <span class="trait-name">${t.name}</span>
        <span class="trait-count">${n}/${goal}</span>
        <span class="trait-steps">${steps}</span>
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
        <span class="trait-icon">${bearerBadgeHtml(grant.trait)}</span>
        <span class="trait-name">${name}</span>
        <span class="trait-count">1/1</span>
      </button>`;
    })
    .join('');
  // Units that carry a trait's bonuses themselves (e.g. the Plane Wanderer) get one too; it opens their card.
  const honoraryUnits = p.board
    .flatMap((u) => (u && UNIT_BY_ID[u.defId].honorary ? [u] : []))
    .map((u) => {
      const h = UNIT_BY_ID[u.defId].honorary!;
      return `<button class="trait-tile bearer${levels[h.trait] ? ' active' : ''}" data-select-unit="${u.uid}" title="${UNIT_BY_ID[u.defId].name}: ${TRAITS[h.trait].name} bonus, doesn't count">
        <span class="trait-icon">${bearerBadgeHtml(h.trait)}</span>
        <span class="trait-name">${UNIT_BY_ID[u.defId].name}</span>
        <span class="trait-count">1/1</span>
      </button>`;
    })
    .join('');
  return `<aside class="traits"><h3>Synergies</h3>${tiles + bearers + honoraryUnits || '<p class="traits-empty">Put heroes on the board to start one.</p>'}</aside>`;
}

// Fills a trait's or item's {placeholders} with every level's value; `current` (1-based) is highlighted.
function descHtml(src: { desc: string; values(): Record<string, string[]> }, current: number): string {
  const values = src.values();
  return src.desc.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key].map((v, i) => `<span class="${i === current - 1 ? 'on' : ''}">${v}</span>`).join('<i> / </i>'),
  );
}

const STAT_NAMES: Partial<Record<StatKey, string>> = { atk: 'attack', ap: 'magic attack', hp: 'HP', armor: 'armor', mr: 'magic resist' };
const statName = (s: StatKey) => STAT_NAMES[s] ?? s;
const modText = (m: StatMod) => (m.add ? `+${m.add} ${statName(m.stat)}` : `+${Math.round((m.pct ?? 0) * 100)}% ${statName(m.stat)}`);

// "every Cult of Fire unit +122 attack (50% of 243)"
const auraText = (g: AuraGrant) =>
  `every ${TRAITS[g.to].name} unit +${g.amount} ${g.stats.map(statName).join(' and ')} (${Math.round(g.share * 100)}% of ${g.base} ${statName(g.from)})`;

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
  const n = playerTraitCounts(p)[traitId] ?? 0;
  const lvl = traitLevel(traitId, n);
  const owned = new Set(board.flatMap((u) => (u ? [u.defId] : [])));
  const bps = t.breakpoints.map((b, i) => `<span class="${i < lvl ? 'on' : ''}${i === lvl - 1 ? ' current' : ''}">${b}</span>`).join('');
  const row = (u: UnitDef) => {
    const mine = Object.values(p.rewardUnit ?? {}).includes(u.id);
    const chips = [
      ...u.traits.filter((id) => id !== traitId).map((id) => traitChipHtml(id)),
      // A bearer unit (e.g. a Plane Wanderer) links to the trait it carries, from its other cards.
      u.honorary && u.honorary.trait !== traitId ? bearerChipHtml(u.honorary) : '',
    ].join('');
    return `<li class="tier-${u.tier}${owned.has(u.id) ? ' owned' : ''}">
        <span class="unit-cost">${u.tier}g</span>
        <span class="unit-name">${portraitHtml(u.id, 'tiny')}<button class="unit-link" data-unit-info="${u.id}">${u.name}</button>${u.shop === false ? ` <small class="unit-tag">${mine ? 'yours' : 'not in shop'}</small>` : ''}</span>
        <span class="unit-traits">${chips}</span>
      </li>`;
  };
  const byCost = (a: UnitDef, b: UnitDef) => a.tier - b.tier || a.name.localeCompare(b.name);
  const units = UNITS.filter((u) => u.traits.includes(traitId)).sort(byCost).map(row).join('');
  const bearers = UNITS.filter((u) => u.honorary?.trait === traitId).sort(byCost).map(row).join('');
  return `<${heading} class="trait-title"><span class="trait-icon">${traitBadgeHtml(t.id)}</span> ${t.name} <small>${t.kind} · ${n} on board</small></${heading}>
    <div class="trait-bps">${bps}</div>
    <p class="trait-desc">${descHtml(t, lvl)}</p>
    ${chosen[traitId] ? `<p class="trait-stacks">👑 This game: <b>${UNIT_BY_ID[chosen[traitId]].name}</b></p>` : ''}
    ${t.leader ? leaderLineHtml(traitId, p) : ''}
    ${p.orb?.trait === traitId ? `<p class="trait-stacks">🔮 Magic Orb: <b>${UNIT_BY_ID[p.orb.defId].name}</b> counts +1</p>` : ''}
    ${t.stacks ? stacksHtml(traitId, p) : ''}
    ${unlockHtml(traitId, p)}
    ${t.items ? traitItemsHtml(t.items.pool, p) : ''}
    <h4>Units</h4>
    <ul class="trait-units">${units}</ul>
    ${bearers ? `<h4>Bearers <small>get the bonus, don't count</small></h4><ul class="trait-units">${bearers}</ul>` : ''}`;
}

// Locked units of this trait the player has unlocked, and free units waiting for bench room.
function unlockHtml(traitId: string, p: Player): string {
  const unlocked = UNITS.filter((u) => u.locked && u.traits.includes(traitId) && p.unlocked?.includes(u.id));
  const waiting = (p.gifts ?? []).filter((id) => UNIT_BY_ID[id].traits.includes(traitId));
  return [
    ...unlocked.map((u) => `<p class="trait-stacks">🔓 <b>${u.name}</b> is in your shop now</p>`),
    waiting.length ? `<p class="trait-stacks">🎁 Waiting for bench room: <b>${waiting.map((id) => UNIT_BY_ID[id].name).join(', ')}</b></p>` : '',
  ].join('');
}

// A counting trait's number, and its rewards: done, or how far off.
function stacksHtml(traitId: string, p: Player): string {
  const rule = TRAITS[traitId].stacks!;
  const n = p.stacks[traitId] ?? 0;
  const claimed = p.rewards?.[traitId] ?? 0;
  const unit = p.rewardUnit?.[traitId];
  const name = unit ? rewardLabel(UNIT_BY_ID[unit]) : 'rolled when it first appears';
  const rewards = (rule.rewards ?? [])
    .map((r, i) => `<li class="${i < claimed ? 'done' : ''}">${r.at}: ${rewardText(r, name)}${i < claimed ? ' ✓' : ''}</li>`)
    .join('');
  return `<p class="trait-stacks">${rule.label}: <b>${n}</b> / ${rule.max}</p>${rewards ? `<ul class="stack-rewards">${rewards}</ul>` : ''}`;
}

// The Mist Shop beside the board, while any Mistbender is fielded: coins, the 3 wares, what's been bought.
export function sideShopsHtml(p: Player): string {
  const t = TRAITS.mistbender;
  if (!p.mistShop || !p.board.some((u) => u && UNIT_BY_ID[u.defId].traits.includes(t.id))) return '';
  const coins = mistCoins(p);
  const wares = p.mistShop
    .map((id, slot) => {
      const w = MIST_WARES[id];
      return `<button class="mist-ware" data-action="mistBuy" data-slot="${slot}" ${coins < w.price ? 'disabled' : ''} title="${w.desc}">
        <span class="mist-ware-icon">${w.icon}</span>
        <span class="mist-ware-name">${w.name}</span>
        <b class="mist-ware-price">${w.price}</b>
      </button>`;
    })
    .join('');
  const owned = [
    p.mistBonus?.atk ? `🗡️ +${Math.round(p.mistBonus.atk * 100)}% atk & ap` : '',
    p.mistBonus?.def ? `🛡️ +${Math.round(p.mistBonus.def * 100)}% def` : '',
    ...(p.mistOrbs ?? []).map((o) => {
      const holder = [...p.board, ...p.bench].find((u) => u?.uid === o.holder);
      return `${traitBadgeHtml(o.trait)} ${holder ? `on ${UNIT_BY_ID[holder.defId].name}` : 'in inventory: put it on in 🎒 Equipment'}`;
    }),
  ].filter(Boolean);
  return `<section class="side-shop">
    <button class="side-shop-head" data-trait="${t.id}">${traitBadgeHtml(t.id)} ${t.sideShop!.title}</button>
    <p class="side-shop-coins"><b>${coins}</b> ${t.stacks?.label ?? ''}</p>
    <div class="mist-wares">${wares}</div>
    ${owned.length ? `<p class="mist-owned">${owned.join(' · ')}</p>` : ''}
  </section>`;
}

// The pick for a Mist ware that needs one: one of your units (Mirror), or a faction / role (orbs).
export function mistChoiceHtml(p: Player, slot: number): string {
  const w = MIST_WARES[p.mistShop![slot]];
  const options =
    w.choose === 'unit'
      ? [...p.board, ...p.bench]
          .flatMap((u) => (u && UNIT_BY_ID[u.defId].shop !== false ? [u] : []))
          .map((u) => `<button class="chip" data-action="mistPick" data-choice="${u.uid}">${UNIT_BY_ID[u.defId].name} ${'★'.repeat(u.star)}</button>`)
      : Object.values(TRAITS)
          .filter((t) => t.kind === w.choose)
          .map((t) => `<button class="chip" data-action="mistPick" data-choice="${t.id}">${traitBadgeHtml(t.id)} ${t.name}</button>`);
  return modalHtml(
    'closeMistPick',
    'trait-popup',
    `<h2 class="trait-title">${w.icon} ${w.name} <small>${w.price} Mist coins</small></h2>
    <p class="trait-desc">${w.desc}</p>
    <div class="orb-options">${options.join('') || '<p class="meta">Nothing to pick.</p>'}</div>`,
  );
}

// A reward unit by its role icon and name: the names are new to the player, the role icons aren't.
function rewardLabel(def: UnitDef): string {
  const roles = def.traits.filter((id) => TRAITS[id].kind === 'role').map((id) => traitBadgeHtml(id));
  return `${roles.join('') || (def.honorary?.icon ?? '🎁')} ${def.name}`;
}

// The grave beside the board: every counting trait with rewards, once it has shown up this game.
// It names the reward unit rolled for this player (e.g. their Plane Wanderer), which opens its card,
// so they can decide early whether it's worth building toward.
export function graveHtml(p: Player): string {
  return Object.entries(p.stacks)
    .filter(([id]) => TRAITS[id].stacks?.rewards)
    .map(([id, n]) => {
      const rule = TRAITS[id].stacks!;
      const next = rule.rewards![p.rewards?.[id] ?? 0];
      const reward = p.rewardUnit?.[id] ? UNIT_BY_ID[p.rewardUnit[id]] : null;
      return `<button class="grave" data-trait="${id}" title="${TRAITS[id].name}: ${rule.label.toLowerCase()}">
        <span class="grave-icon">${traitBadgeHtml(id)}</span>
        <b class="grave-count">${n}</b>
        <small>${next ? `next ${next.at}: ${'star' in next ? '★'.repeat(next.star) : rewardText(next, '')}` : 'complete'}</small>
        ${reward ? `<span class="grave-unit" data-unit-info="${reward.id}" title="Your reward unit: click to see it">${rewardLabel(reward)}</span>` : ''}
      </button>`;
    })
    .join('');
}

// Who leads a trait on the player's board right now.
function leaderLineHtml(traitId: string, p: Player): string {
  const leader = TRAITS[traitId].leader!;
  const uid = fieldLeaders(p, playerTraits(p))[traitId];
  const u = uid === undefined ? null : p.board.find((x) => x?.uid === uid);
  return `<p class="trait-stacks">${leader.icon} ${leader.title}: <b>${u ? `${UNIT_BY_ID[u.defId].name} ${'★'.repeat(u.star)}` : 'none yet'}</b></p>`;
}

// Modal shell: backdrop and × both fire `closeAction`.
// `scrollKey` names the dialog's scroll position so re-renders keep it (see app.ts); defaults to the close action.
const modalHtml = (closeAction: string, className: string, body: string, scrollKey = closeAction) =>
  `<div class="overlay" data-action="${closeAction}"><div class="dialog modal ${className}" data-keep-scroll="${scrollKey}">
    <button class="close" data-action="${closeAction}" aria-label="Close">×</button>
    ${body}
  </div></div>`;

export function traitDetailHtml(traitId: string, p: Player, chosen: Record<string, string>): string {
  return modalHtml('closeTrait', 'trait-popup', traitCardHtml(traitId, p, chosen, 'h2'));
}

// Like a trait chip, for a unit that carries a trait's bonus without being a member.
const bearerChipHtml = (h: { trait: string; icon: string }) =>
  `<button class="trait-chip bearer-chip" data-trait="${h.trait}" title="Gets the ${TRAITS[h.trait].name} bonus, doesn't count">${bearerBadgeHtml(h.trait)} ${TRAITS[h.trait].name} bearer</button>`;

// A small button naming a trait; clicking it opens that trait's popup.
const traitChipHtml = (id: string) =>
  `<button class="trait-chip" data-trait="${id}" title="${TRAITS[id].name}">${traitBadgeHtml(id)} ${TRAITS[id].name}</button>`;

export type GalleryTab = 'cards' | 'grid';

// Every trait in the game: as cards (factions then roles), or as a role x faction grid
// showing which units sit at each crossing.
export function galleryHtml(p: Player, chosen: Record<string, string>, tab: GalleryTab = 'cards'): string {
  const tabs = (['cards', 'grid'] as const)
    .map((t) => `<button class="gallery-tab${t === tab ? ' on' : ''}" data-action="galleryTab" data-tab="${t}">${t === 'cards' ? 'Synergies' : 'Crossovers'}</button>`)
    .join('');
  const body = tab === 'grid' ? crossoverGridHtml(p) : gallerySection(p, chosen, 'faction', 'Factions') + gallerySection(p, chosen, 'role', 'Roles');
  // Each tab keeps its own scroll position.
  return modalHtml('closeGallery', 'gallery', `<h2>📖 Synergies</h2><nav class="gallery-tabs">${tabs}</nav>${body}`, `gallery-${tab}`);
}

function gallerySection(p: Player, chosen: Record<string, string>, kind: 'faction' | 'role', title: string): string {
  const cards = Object.values(TRAITS)
    .filter((t) => t.kind === kind)
    .map((t) => `<article class="gallery-card">${traitCardHtml(t.id, p, chosen, 'h3')}</article>`)
    .join('');
  return `<h3 class="gallery-section">${title}</h3><div class="gallery-grid">${cards}</div>`;
}

// Roles down the side, factions across the top, plus a "none" row and column. A unit with
// two roles shows up in both rows.
function crossoverGridHtml(p: Player): string {
  const owned = new Set(p.board.flatMap((u) => (u ? [u.defId] : [])));
  const ids = (kind: 'faction' | 'role') => Object.values(TRAITS).filter((t) => t.kind === kind).map((t) => t.id);
  const factions = [...ids('faction'), null];
  const roles = [...ids('role'), null];
  // A bearer sits in the column of the trait it carries (e.g. Plane Wanderers under Necromancer).
  const traitsOf = (u: UnitDef) => [...u.traits, ...(u.honorary ? [u.honorary.trait] : [])];
  const has = (traits: string[], id: string | null, kind: 'faction' | 'role') =>
    id === null ? !traits.some((t) => TRAITS[t].kind === kind) : traits.includes(id);
  const head = (id: string | null) =>
    id === null ? '<span class="grid-none">none</span>' : `<button class="grid-head" data-trait="${id}" title="${TRAITS[id].name}">${traitBadgeHtml(id)}<span>${TRAITS[id].name}</span></button>`;
  const cell = (role: string | null, faction: string | null) =>
    UNITS.filter((u) => !u.summon && has(traitsOf(u), role, 'role') && has(traitsOf(u), faction, 'faction'))
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
      .map((u) => {
        const bearer = u.honorary && u.honorary.trait === faction ? `${bearerBadgeHtml(u.honorary.trait)} ` : '';
        const note = bearer ? ` · ${TRAITS[u.honorary!.trait].name} bearer, not in shop` : '';
        return `<button class="grid-unit tier-${u.tier}${owned.has(u.id) ? ' owned' : ''}" data-unit-info="${u.id}" title="${u.tier}g${note}">${portraitHtml(u.id, 'tiny')}${bearer}${u.name}</button>`;
      })
      .join('');
  const rows = roles
    .map((r) => `<tr><th scope="row">${head(r)}</th>${factions.map((f) => `<td>${cell(r, f)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="crossover-wrap" data-keep-scroll="crossover"><table class="crossover">
    <colgroup><col class="role-col">${factions.map(() => '<col>').join('')}</colgroup>
    <thead><tr><th></th>${factions.map((f) => `<th scope="col">${head(f)}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="grid-legend">Colour = cost (${[1, 2, 3, 4, 5, 7].map((t) => `<span class="grid-unit tier-${t}">${t}g</span>`).join(' ')}) · bold = on your board · ${bearerBadgeHtml('necromancer')} = Plane Wanderer (Necromancer reward, not in shop) · click a trait or unit to open it</p>`;
}

// The dock along the bottom: leveling, the shop and the fight button, always in view so buying never
// hides the board. Drop a unit anywhere on it to sell.
export function shopDockHtml(p: Player, locked: boolean, chosen: Record<string, string>): string {
  const levelCost = levelUpCost(p);
  const levelBtn =
    levelCost === null
      ? `<button class="dock-btn" disabled><b>Max level</b></button>`
      : `<button class="dock-btn" data-action="levelUp" ${locked || p.gold < levelCost ? 'disabled' : ''}><b>Level up</b> <span>${levelCost}g <kbd>F</kbd></span></button>`;
  const lockTitle = p.shopLocked ? 'Locked: keeps this shop next round (click to unlock)' : 'Lock: keep this shop next round';
  return `<section class="dock${locked ? ' fighting' : ''}" data-sell>
    <div class="dock-side">
      ${levelBtn}
      <button class="dock-btn" data-action="reroll" ${locked ? 'disabled' : ''}><b>Reroll</b> <span>${REROLL_COST}g <kbd>D</kbd></span></button>
      <button class="dock-btn lock${p.shopLocked ? ' on' : ''}" data-action="toggleLock" title="${lockTitle}"><b>${p.shopLocked ? '🔒 Locked' : '🔓 Lock shop'}</b></button>
    </div>
    <div class="shop-cards${p.shopLocked ? ' locked' : ''}">${shopCardsHtml(p, locked, chosen)}</div>
    ${
      locked
        ? `<button data-action="skip" class="fight-btn skip">Skip <kbd>Space</kbd></button>`
        : `<button data-action="endTurn" class="fight-btn">⚔️ Fight! <kbd>Space</kbd></button>`
    }
  </section>`;
}

function shopCardsHtml(p: Player, locked: boolean, chosen: Record<string, string>): string {
  const counts = playerTraitCounts(p);
  return p.shop
    .map((id, slot) => {
      if (!id) return `<div class="shop-card empty"></div>`;
      if (isItemCard(id)) {
        const item = ITEMS[cardItem(id)];
        const tier = p.items.find((it) => it.id === item.id)?.tier ?? 0;
        return `<button class="shop-card item-card" data-action="buy" data-slot="${slot}" ${locked ? 'disabled' : ''} title="${item.name} tier ${tier + 1}: ${itemText(item, tier + 1)}">
          <span class="portrait shop-face">${item.icon}</span>
          <span class="shop-body">
            <span class="unit-name">${item.name}</span>
            <span class="traits"><span class="shop-trait">Tier ${tier} → ${tier + 1}</span></span>
          </span>
          <b class="cost">Free</b>
        </button>`;
      }
      const def = UNIT_BY_ID[id];
      const upgrade = findCopies(p, id, 1).length >= 2;
      const owned = [...p.board, ...p.bench].reduce((n, u) => n + (u?.defId === id ? copiesOf(u) : 0), 0);
      // Traits you already field: what buying (and fielding) this one would bring the count to.
      const fielded = p.board.some((u) => u?.defId === id);
      const traits = def.traits
        .map((t) => {
          const n = counts[t] ?? 0;
          const gain = n > 0 && !fielded ? `<em>${n}→${n + 1}</em>` : '';
          return `<span class="shop-trait${gain ? ' have' : ''}"><span class="t-name">${traitBadgeHtml(t)} ${TRAITS[t].name}</span>${gain}</span>`;
        })
        .join('');
      const tag = upgrade ? '<span class="up" title="Buying this makes a 2-star">★★</span>' : owned ? `<span class="owned">own ${owned}</span>` : '';
      return `<button class="shop-card tier-${def.tier}${upgrade ? ' upgrade' : ''}" data-action="buy" data-slot="${slot}" ${locked || p.gold < def.tier ? 'disabled' : ''}>
        ${portraitHtml(id, 'shop-face')}
        <span class="shop-body">
          <span class="unit-name">${isChosen(chosen, id) ? '👑 ' : ''}${def.name}</span>
          <span class="traits">${traits || '<span class="shop-trait none">no traits</span>'}</span>
        </span>
        <b class="cost">${def.tier}g</b>${tag}
      </button>`;
    })
    .join('');
}

export type RailPanel = 'synergy' | 'damage' | 'equipment';

const RAIL: { id: RailPanel; icon: string; name: string }[] = [
  { id: 'synergy', icon: '🧩', name: 'Synergies' },
  { id: 'damage', icon: '📊', name: 'Damage' },
  { id: 'equipment', icon: '🎒', name: 'Equipment' },
];

// The sidebar's icons. Equipment counts what's waiting for a hero, so new loot isn't missed while
// another panel is open.
export function railHtml(open: RailPanel | null, p: Player): string {
  const loose = p.items.filter((it) => it.holder === null).length + p.orbs.length + (p.mistOrbs ?? []).filter((o) => o.holder === null).length;
  const buttons = RAIL.map(({ id, icon, name }) => {
    const badge = id === 'equipment' && loose ? `<b class="rail-badge">${loose}</b>` : '';
    return `<button class="rail-btn${id === open ? ' on' : ''}" data-action="rail" data-panel="${id}" title="${name}" aria-label="${name}">${icon}${badge}</button>`;
  }).join('');
  return `<nav class="rail">${buttons}</nav>`;
}

// A Mist Shop orb by what it boosts. The Magic Orb is the other kind: always 🔮, whatever trait it's set to.
const orbName = (trait: string) => (TRAITS[trait].kind === 'faction' ? 'Faction Orb' : 'Role Orb');

// Something on its way to a slot: an item (uid), a Mist orb (uid) or an unused Magic Orb.
export type GearPick = { kind: 'item'; uid: number } | { kind: 'orb'; orb: number | 'magic' };

const samePick = (a: GearPick | null, b: GearPick) =>
  a?.kind === b.kind && (a.kind === 'item' ? a.uid === (b as { uid: number }).uid : a.orb === (b as { orb: number | 'magic' }).orb);

// The player's equipment on top, then every deployed hero with its slots. Equipping happens here:
// drag an item into a hero's slot, or back to the top to take it off. Clicking one shows what it does.
export function armoryHtml(p: Player, picked: GearPick | null = null, dragging: GearPick | null = null): string {
  const levels = playerTraits(p);
  const grants = auraGrants(p, levels);
  const units = [...p.board, ...p.bench];
  const nameOf = (uid: number | null) => {
    const u = units.find((x) => x?.uid === uid);
    return u ? UNIT_BY_ID[u.defId].name : null;
  };

  const itemChip = (it: Item, inSlot: boolean) => {
    const def = ITEMS[it.id];
    const tier = effectiveTier(it, levels);
    const holder = nameOf(it.holder);
    const grant = grants.get(it.uid);
    const state = !def.trait ? 'equipment' : tier ? `tier ${tier}` : `inactive: needs ${TRAITS[def.trait].name}`;
    const selected = samePick(picked, { kind: 'item', uid: it.uid });
    return `<div class="item-chip${tier ? '' : ' inactive'}${holder && !inSlot ? ' equipped' : ''}${selected ? ' selected' : ''}" data-item="${it.uid}"
      title="${def.name} (${state})${holder ? ` on ${holder}` : ''}. ${itemText(def, tier || it.tier)}${grant ? ` Now: ${auraText(grant)}.` : ''}">
      <span class="item-icon">${def.icon}</span>${def.trait ? `<b>T${tier || it.tier}</b>` : ''}
      ${grant && !inSlot ? `<small class="aura-line">+${grant.amount}</small>` : ''}
    </div>`;
  };
  const mistChip = (o: NonNullable<Player['mistOrbs']>[number], inSlot: boolean) => {
    const holder = nameOf(o.holder);
    const selected = samePick(picked, { kind: 'orb', orb: o.uid });
    return `<div class="item-chip orb-chip${holder && !inSlot ? ' equipped' : ''}${selected ? ' selected' : ''}" data-orb="${o.uid}" title="${orbName(o.trait)}: +1 ${TRAITS[o.trait].name}${holder ? ` on ${holder}` : ''}">
      <span class="item-icon">${traitBadgeHtml(o.trait)}</span>
    </div>`;
  };
  const magicChip = p.orbs.length
    ? `<div class="item-chip orb-chip magic-chip${samePick(picked, { kind: 'orb', orb: 'magic' }) ? ' selected' : ''}" data-orb="magic" title="Magic Orb: put it in a hero's orb slot, then pick a trait">
        <span class="item-icon">🔮</span>${p.orbs.length > 1 ? `<b>×${p.orbs.length}</b>` : ''}
      </div>`
    : '';
  const stash = [...p.items.map((it) => itemChip(it, false)), magicChip, ...(p.mistOrbs ?? []).map((o) => mistChip(o, false))].join('');

  const heroes = p.board
    .flatMap((u) => (u && !UNIT_BY_ID[u.defId].piece ? [u] : []))
    .map((u) => {
      const def = UNIT_BY_ID[u.defId];
      const mist = (p.mistOrbs ?? []).find((o) => o.holder === u.uid);
      const orb = mist
        ? mistChip(mist, true)
        : p.orb?.defId === def.id
          ? `<span class="magic-orb" title="Magic Orb: +1 ${TRAITS[p.orb.trait].name}, every ${def.name} you field">🔮${traitBadgeHtml(p.orb.trait)}</span>`
          : '';
      const held = heldBy(p, u.uid);
      const slots: string[] = held.flatMap((it) => [
        `<div class="gear-slot" data-gear-unit="${u.uid}">${itemChip(it, true)}</div>`,
        // An item that takes more than one slot fills the rest.
        ...Array.from({ length: (ITEMS[it.id].slots ?? 1) - 1 }, () => `<div class="gear-slot taken" data-gear-unit="${u.uid}"></div>`),
      ]);
      while (slots.length < MAX_ITEMS_PER_UNIT) slots.push(`<div class="gear-slot" data-gear-unit="${u.uid}"></div>`);
      return `<li class="gear-hero tier-${def.tier}">
        <button class="gear-who" data-select-unit="${u.uid}" title="${def.name}">
          ${portraitHtml(def.id, 'gear-face')}
          <span class="gear-name">${def.name}<i class="unit-star">${'★'.repeat(u.star)}</i></span>
        </button>
        <div class="gear-slot orb-slot" data-orb-unit="${u.uid}" title="Magic, faction or role orb">${orb}</div>
        <div class="gear-slots">${slots.join('')}</div>
      </li>`;
    })
    .join('');

  const moving = picked ?? dragging;
  return `<section class="armory${moving ? ` picking-${moving.kind}` : ''}">
    <div class="armory-stash">
      <h3>Equipment</h3>
      ${stash ? `<div class="armory-items">${stash}</div>` : '<p class="traits-empty">No equipment yet.</p>'}
    </div>
    <h3>Heroes</h3>
    ${heroes ? `<ul class="gear-heroes">${heroes}</ul><p class="traits-empty">Click an item to see what it does. Drag it into a slot to equip it; back up top takes it off.</p>` : '<p class="traits-empty">Deploy heroes to equip them.</p>'}
  </section>`;
}

export function hudHtml(state: GameState, p: Player, hp: number, opponentName: string | null): string {
  const need = xpToNext(p);
  const income = BASE_INCOME + interest(p.gold);
  const share = Math.max(0, Math.min(1, hp / START_HP));
  const monster = isMonsterRound(state.round);
  const free = p.level - boardCount(p);
  const benched = p.bench.some(Boolean);
  const stat = (label: string, value: string, title: string, cls = '') =>
    `<div class="hud-stat ${cls}" title="${title}"><small>${label}</small><span>${value}</span></div>`;
  const xp =
    need === null
      ? '<small>max</small>'
      : `<span class="xp-bar"><span style="width:${(p.xp / need) * 100}%"></span></span><small>${p.xp}/${need}</small>`;
  return `<header class="hud">
    ${stat('Round', `<b>${state.round}</b>${monster ? ' 👹 Monsters' : ''}`, monster ? 'Monster round: everyone fights monsters for equipment' : `Round ${state.round}`)}
    ${stat('HP', `<b>${hp}</b><span class="hp-bar"><span style="width:${share * 100}%"></span></span>`, 'Your HP: at 0 you are out')}
    ${stat('Gold', `<b class="gold">${p.gold}</b><small>+${income} next round</small>`, `+${income} next round, including interest`)}
    ${stat('Level', `<b>${p.level}</b> ${xp}`, need === null ? 'Max level' : `${p.xp}/${need} XP to level ${p.level + 1}`)}
    ${stat('Heroes', `<b>${boardCount(p)}/${p.level}${freeSlotCount(p) ? ` +${freeSlotCount(p)}` : ''}</b>${free > 0 && benched ? `<small class="warn">${free} free slot${free === 1 ? '' : 's'}</small>` : ''}`, 'Heroes on the board / how many you may field')}
    ${p.orbs.length ? stat('Orbs', `🔮 <b>${p.orbs.length}</b>`, 'Magic Orb ready: put it on a hero in the Equipment panel') : ''}
    ${opponentName ? `<div class="hud-stat vs" title="Fighting"><small>Fighting</small><span><b>${opponentName}</b></span></div>` : ''}
    <button class="hud-book" data-action="openGallery" title="All factions and roles">📖 Synergies</button>
  </header>`;
}

// Right-column card for one of the player's units: stats as it would fight right now.
export function unitDetailHtml(p: Player, uid: number, chosen: Record<string, string>): string {
  const area = p.board.some((u) => u?.uid === uid) ? 'board' : 'bench';
  const slots = area === 'board' ? p.board : p.bench;
  const cell = slots.findIndex((u) => u?.uid === uid);
  const u = slots[cell]!;
  const def = UNIT_BY_ID[u.defId];
  if (def.piece) return pieceDetailHtml(p, def);
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
    ...def.traits.map((id) => `<button class="chip" data-trait="${id}">${traitBadgeHtml(id)} ${TRAITS[id].name}</button>`),
    ...[...honorary, ...(def.honorary ? [def.honorary] : [])].map(
      (g) => `<button class="chip" data-trait="${g.trait}" title="Gets the bonuses, doesn't count">${bearerBadgeHtml(g.trait)} ${TRAITS[g.trait].name} bearer</button>`,
    ),
    ...(area === 'board' ? leadsOf(p, levels, uid) : []).map(
      (id) => `<button class="chip" data-trait="${id}">${TRAITS[id].leader!.icon} ${TRAITS[id].leader!.title}</button>`,
    ),
  ].join('');

  return `<section class="unit-detail tier-${def.tier}">
    <button class="close" data-action="closeUnit" aria-label="Close">×</button>
    <div class="detail-head">${portraitHtml(def.id, 'big')}<div>
      <h3>${isChosen(chosen, def.id) ? '👑 ' : ''}${def.name} <span class="unit-star">${'★'.repeat(u.star)}</span></h3>
      <p class="meta">${def.tier}g · ${position}${area === 'bench' ? ' · on bench' : ''}</p>
    </div></div>
    ${traits ? `<div class="chips">${traits}</div>` : ''}
    ${markKinds(p)
      .map((k) =>
        markedUid(p, k) === uid
          ? `<p class="orb-line">${MARKS[k].icon} ${MARKS[k].name}</p>`
          : (k === 'halo' || k === 'halo2') && autoHalo(p) === uid
          ? ''
          : `<button class="orb-use" data-action="mark" data-kind="${k}" data-unit="${uid}">${MARKS[k].icon} ${MARKS[k].action}</button>`,
      )
      .join('')}
    ${autoHalo(p) === uid ? `<p class="orb-line">${MARKS.halo.icon} Protected: the hero with the most items</p>` : ''}
    ${p.orb?.defId === def.id ? `<p class="orb-line">🔮 Magic Orb: +1 ${TRAITS[p.orb.trait].name}${area === 'bench' ? ' (when fielded)' : ''}</p>` : ''}
    ${(p.mistOrbs ?? [])
      .filter((o) => o.holder === uid)
      .map(
        (o) => `<p class="orb-line">${traitBadgeHtml(o.trait)} ${orbName(o.trait)}: +1 ${TRAITS[o.trait].name}${area === 'bench' ? ' (when fielded)' : ''}
          <button class="chip" data-action="unequipMistOrb" data-orb="${o.uid}" title="Back to the inventory">✕</button></p>`,
      )
      .join('')}
    <dl>
      ${row('HP', 'hp')}
      ${row('Attack', 'atk')}
      ${row('Magic attack', 'ap')}
      <dt>Attack speed</dt><dd>${perSec(attackInterval(s))}/s ${
        attackInterval(s) !== attackInterval(base) ? `<em>+${fmt((s.attackSpeed - base.attackSpeed) * 100)}%</em>` : ''
      }</dd>
      ${row('Range', 'range')}
      ${row('Armor', 'armor')}
      ${row('Magic resist', 'mr')}
      ${row('Mana', 'maxMana')}
      ${optional('Mana regen', 'manaRegen', (n) => `${fmt(n)}/s`)}
      ${optional('Damage amp', 'damageAmp', (n) => `${fmt(n * 100)}%`)}
      ${optional('Damage taken', 'damageTaken', (n) => `${fmt(n * 100)}%`)}
      ${optional('Armor shred', 'armorShred')}
      ${optional('Magic pen', 'magicPen', (n) => `${fmt(n * 100)}%`)}
      ${optional('Crit chance', 'critChance', (n) => `${fmt(n * 100)}%`)}
      ${optional('Skill damage', 'skillAmp', (n) => `${fmt(n * 100)}%`)}
      ${optional('Basic attack dmg', 'basicAmp', (n) => `${fmt(n * 100)}%`)}
      ${optional('Hit-again chance', 'hitAgain', (n) => `${fmt(n * 100)}%`)}
      ${optional('Starting shield', 'startShield', (n) => `${fmt(n * 100)}% HP`)}
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
  const before = playerTraitCounts(p);
  const rows = orbOptions(p.orbs[0], def.id)
    .map((id) => {
      const t = TRAITS[id];
      const after = traitCounts(p.board, { defId: def.id, trait: id }, fieldedMistOrbs(p))[id] ?? 0;
      const from = before[id] ?? 0;
      const bp = traitLevel(id, after) > traitLevel(id, from) ? ` · reaches ${t.breakpoints[traitLevel(id, after) - 1]}!` : '';
      const own = def.traits.includes(id) ? 'counts double' : 'random pick';
      // Not data-trait: that attribute means "open this trait's popup" to the click handler.
      return `<button class="orb-option" data-action="useOrb" data-orb-trait="${id}">
        <span class="trait-icon">${traitBadgeHtml(t.id)}</span>
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

// Gallery popup for any unit type: what it is, its numbers at every star, and its skill.
export function unitInfoHtml(defId: string, p: Player): string {
  const def = UNIT_BY_ID[defId];
  const stars = ([1, 2, 3] as const).map((star) => unitStats(def, star));
  const fmt = (n: number) => String(+n.toFixed(2));
  const row = (label: string, value: (s: Stats) => string) => `<tr><th>${label}</th>${stars.map((s) => `<td>${value(s)}</td>`).join('')}</tr>`;
  const chips = [...def.traits.map((id) => traitChipHtml(id)), def.honorary ? bearerChipHtml(def.honorary) : ''].join('');
  const position = `${def.range <= 1 ? 'Frontline · melee' : `Backline · range ${def.range}`} · ${def.attackType ?? 'physical'} attacks`;
  const reward = Object.values(p.rewardUnit ?? {}).includes(def.id);
  const where =
    def.shop === false ? (reward ? 'Your grave reward · not in the shop' : 'Not in the shop: a trait reward') : def.locked ? 'In your shop only once unlocked' : 'In the shop';
  const skill = def.skill
    ? `<h4>Skill: ${SKILLS[def.skill].name}</h4><p class="skill trait-desc">${descHtml(SKILLS[def.skill], 0)}</p>`
    : `<h4>Skill <small>placeholder</small></h4>
      <p class="skill trait-desc">At full mana, the next attack deals ${Math.round(stars[0].castMult * 100)}% magic attack
      (${stars.map((s) => `<span>${Math.round(s.ap * s.castMult)}</span>`).join('<i> / </i>')}) as magic damage.</p>`;
  return modalHtml(
    'closeUnitInfo',
    'trait-popup unit-info',
    `<h2 class="trait-title tier-${def.tier}">${portraitHtml(def.id, 'big')}<span class="unit-info-cost">${def.tier}g</span> ${def.name}</h2>
    <p class="meta">${position} · ${where}</p>
    <div class="unit-traits info-traits">${chips || '<span class="unit-tag">no traits</span>'}</div>
    <table class="unit-stats">
      <thead><tr><th></th><th>★</th><th>★★</th><th>★★★</th></tr></thead>
      <tbody>
        ${row('HP', (s) => fmt(s.hp))}
        ${row('Attack', (s) => fmt(s.atk))}
        ${row('Magic attack', (s) => fmt(s.ap))}
        ${row('Armor', (s) => fmt(s.armor))}
        ${row('Magic resist', (s) => fmt(s.mr))}
        ${row('Attack speed', (s) => `${(TICKS_PER_SECOND / attackInterval(s)).toFixed(2)}/s`)}
        ${row('Mana', (s) => fmt(s.maxMana))}
      </tbody>
    </table>
    ${skill}`,
  );
}

// The unit's skill, its current star's numbers highlighted; or the placeholder cast.
function skillHtml(skillId: string | undefined, star: number, s: Stats): string {
  if (!skillId) {
    return `<h4>Skill <small>placeholder</small></h4>
      <p class="skill">At full mana, the next attack deals ${Math.round(s.castMult * 100)}% magic attack (${Math.round(s.ap * s.castMult * (1 + s.skillAmp))}) as magic damage.</p>`;
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
    ? trait.mods({ level, member: true, cell: -1, chosen: false, stacks: 0, leader: false }).map(modText).join(', ')
    : `nothing until ${trait.name} is active`;
  const who = holder ? `${UNIT_BY_ID[holder.defId].name} ${'★'.repeat(holder.star)}` : 'nobody';
  return modalHtml(
    'closeBearer',
    'trait-popup',
    `<h2 class="trait-title"><span class="trait-icon">${bearerBadgeHtml(grant.trait)}</span> ${def.name} bearer <small>1/1</small></h2>
    <p class="trait-desc"><b>${who}</b> holds the ${def.icon} ${def.name}.</p>
    <ul class="bearer-facts">
      <li>Gets the ${traitBadgeHtml(trait.id)} ${trait.name} unit bonus: <b>${bonus}</b>.</li>
      <li>Does <b>not</b> count toward ${trait.name}.</li>
      ${aura ? `<li>Gives ${auraText(aura)}, to ${aura.receivers} unit${aura.receivers === 1 ? '' : 's'} now.</li>` : ''}
      ${def.forbidden ? `<li>${TRAITS[def.forbidden].name} units can't hold it.</li>` : ''}
    </ul>`,
  );
}

// What an item does, who holds it and who can. `actions`: offer to equip or take it off (not in a fight).
export function itemDetailHtml(p: Player, uid: number, actions: boolean, chosen: Record<string, string> = {}): string {
  const it = p.items.find((i) => i.uid === uid)!;
  const def = ITEMS[it.id];
  const levels = playerTraits(p);
  const tier = effectiveTier(it, levels);
  const holder = [...p.board, ...p.bench].find((u) => u?.uid === it.holder);
  const aura = auraGrants(p, levels, chosen).get(uid);
  const trait = def.trait ? TRAITS[def.trait] : null;
  const facts = [
    holder ? `Held by <b>${UNIT_BY_ID[holder.defId].name} ${'★'.repeat(holder.star)}</b>.` : 'Not equipped.',
    trait && !tier ? `<b>Inactive:</b> works once ${traitBadgeHtml(trait.id)} ${trait.name} is active.` : '',
    def.membersOnly ? `Only ${traitBadgeHtml(trait!.id)} ${trait!.name} units can hold it.` : '',
    def.forbidden ? `${traitBadgeHtml(def.forbidden)} ${TRAITS[def.forbidden].name} units can't hold it.` : '',
    def.slots && def.slots > 1 ? `Takes ${def.slots} item slots.` : '',
    aura ? `Gives ${auraText(aura)}, to ${aura.receivers} unit${aura.receivers === 1 ? '' : 's'} now.` : '',
  ].filter(Boolean);
  return modalHtml(
    'closeItem',
    'trait-popup',
    `<h2 class="trait-title"><span class="trait-icon">${def.icon}</span> ${def.name}${trait ? ` <small>tier ${tier || it.tier}</small>` : ''}</h2>
    <p class="meta">${trait ? `${trait.name} item` : def.exclusive ? 'Commander item' : def.basic ? 'Basic item' : 'Equipment'} · ${def.kind}</p>
    <p class="trait-desc">${itemText(def, tier || it.tier)}</p>
    <ul class="bearer-facts">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>
    ${actions ? `<div class="item-actions">
      <button class="primary" data-action="pickUpItem" data-item-uid="${uid}">${holder ? 'Move' : 'Equip'}</button>
      ${holder ? `<button data-action="takeOffItem" data-item-uid="${uid}">Take off</button>` : ''}
    </div>` : ''}`,
  );
}

// A player's active synergies, strongest first: icon and the breakpoint reached. Each opens its trait.
function synergyChipsHtml(p: Player): string {
  const counts = playerTraitCounts(p);
  const chips = Object.entries(playerTraits(p))
    .map(([id, lvl]) => ({ t: TRAITS[id], lvl, n: counts[id] ?? 0 }))
    .sort((a, b) => b.lvl - a.lvl || b.n - a.n || a.t.name.localeCompare(b.t.name))
    .map(({ t, lvl, n }) => `<button class="opp-trait" data-trait="${t.id}" title="${t.name} ${n} (level ${t.breakpoints[lvl - 1]})">${traitBadgeHtml(t.id)}<b>${t.breakpoints[lvl - 1]}</b></button>`)
    .join('');
  return chips ? `<span class="opp-traits">${chips}</span>` : '';
}

// --- Commanders ---

// The pick at the start of the game. It can't be dismissed: every player needs a commander.
export function commanderPickHtml(): string {
  const cards = Object.values(COMMANDERS)
    .map(
      (c) => `<button class="commander-option" data-action="pickCommander" data-commander="${c.id}">
        <span class="commander-portrait">${c.icon}</span>
        <b>${c.name}</b><small>${c.title}</small>
        <span class="commander-text">${c.desc}</span>
        <span class="commander-card-line">Card: ${c.card.icon} <b>${c.card.name}</b></span>
      </button>`,
    )
    .join('');
  return `<div class="overlay"><div class="dialog modal commander-pick">
    <h2 class="trait-title">Choose your commander</h2>
    <p class="meta">Your commander is you: it holds your HP, and its power works for you all game.</p>
    <div class="commander-options">${cards}</div>
  </div></div>`;
}

// The commander card pick (round 2). Each card shows what it does for this player.
export function cardOfferHtml(p: Player): string {
  const cards = (p.cardOffer ?? [])
    .map((id) => {
      const c = COMMANDERS[id];
      const face = cardFace(p, id);
      return `<button class="commander-option${face.self ? ' own' : ''}" data-action="pickCard" data-card="${id}">
        <span class="commander-portrait">${c.card.icon}</span>
        <b>${c.card.name}</b><small>${c.icon} ${c.name}'s card${face.self ? ' · yours: the upgrade' : ` · gives you ${c.name}'s power`}</small>
        <span class="commander-text">${face.desc}</span>
      </button>`;
    })
    .join('');
  return `<div class="overlay"><div class="dialog modal commander-pick">
    <h2 class="trait-title">Choose a commander card</h2>
    <p class="meta">Your own commander's card upgrades its power; another commander's card lends you that commander's power. Unpicked when the fight starts: the first one.</p>
    <div class="commander-options">${cards}</div>
  </div></div>`;
}

// The basic item pick (round 2): a few random basic items, take one.
export function itemOfferHtml(p: Player): string {
  const cards = (p.itemOffer ?? [])
    .map((id) => {
      const def = ITEMS[id];
      return `<button class="commander-option" data-action="pickItem" data-item-id="${id}">
        <span class="commander-portrait">${def.icon}</span>
        <b>${def.name}</b><small>${def.kind}</small>
        <span class="commander-text">${itemText(def, 1)}</span>
      </button>`;
    })
    .join('');
  return `<div class="overlay"><div class="dialog modal commander-pick">
    <h2 class="trait-title">${ITEMS[p.itemOffer?.[0] ?? '']?.basic ? 'Choose a basic item' : 'Equipment Chest: choose one'}</h2>
    <p class="meta">It goes to your items: equip it on any hero. Unpicked when the fight starts: the first one.</p>
    <div class="commander-options">${cards}</div>
  </div></div>`;
}

// You, beside the board: your commander, your HP, its power and its card.
export function commanderPanelHtml(p: Player, hp: number): string {
  if (!p.commander) return '';
  const c = COMMANDERS[p.commander];
  const card = p.commanderCard ? COMMANDERS[p.commanderCard] : null;
  const share = Math.max(0, Math.min(1, hp / START_HP));
  return `<section class="commander-panel">
    <div class="commander-head">
      <span class="commander-portrait">${c.icon}</span>
      <div><b>${c.name}</b><small>${c.title}</small></div>
      <span class="commander-hp" title="Your HP">❤️ ${hp}</span>
    </div>
    <div class="commander-hpbar"><span style="width:${share * 100}%"></span></div>
    <p class="commander-text clamp" title="${c.desc.replace(/"/g, '&quot;')}">${c.desc}</p>
    ${markKinds(p).map((k) => markLineHtml(p, k)).join('')}
    ${powersOf(p).protect ? autoHaloLineHtml(p) : ''}
    ${chestLineHtml(p)}
    ${card ? `<p class="commander-text"><b>${card.card.icon} ${card.card.name}</b>: ${cardFace(p, p.commanderCard!).desc}</p>` : p.cardOffer ? '<p class="meta">A commander card is waiting for your pick.</p>' : ''}
  </section>`;
}

// Progress toward the next Equipment Chest, once the player owns a chest item.
function chestLineHtml(p: Player): string {
  const rule = p.items.map((i) => ITEMS[i.id].chests).find(Boolean);
  if (!rule) return '';
  const { kills, earned } = p.chests ?? { kills: 0, earned: 0 };
  return `<p class="commander-text">Equipment Chests: <b>${earned}/${rule.max}</b>${earned < rule.max ? ` · next at ${kills}/${rule.kills} kills` : ''}</p>`;
}

// Who holds a commander mark (Kagura's umbrella or dance), or a nudge to place it.
function markLineHtml(p: Player, kind: MarkKind): string {
  const m = MARKS[kind];
  const uid = markedUid(p, kind);
  const u = uid === null ? null : [...p.board, ...p.bench].find((x) => x?.uid === uid);
  return u
    ? `<p class="commander-text">${m.icon} ${m.name}: <b>${UNIT_BY_ID[u.defId].name} ${'★'.repeat(u.star)}</b></p>`
    : `<p class="commander-text">${m.icon} ${m.name}: nobody yet. Open a unit to place it.</p>`;
}

// Angela's automatic halo: the fielded hero with the most items.
function autoHaloLineHtml(p: Player): string {
  const uid = autoHalo(p);
  const u = uid === null ? null : p.board.find((x) => x?.uid === uid);
  return `<p class="commander-text">${MARKS.halo.icon} Most items: <b>${u ? `${UNIT_BY_ID[u.defId].name} ${'★'.repeat(u.star)}` : 'nobody fielded'}</b></p>`;
}

// A commander's board piece (the Divine Beast): what it does and where it may stand.
function pieceDetailHtml(p: Player, def: UnitDef): string {
  const beast = beastOf(p);
  const where = beast?.frontRow ? 'Any row: from the front row it fires the 3 tiles ahead instead.' : 'The back two rows only.';
  return `<section class="unit-detail tier-${def.tier}">
    <button class="close" data-action="closeUnit" aria-label="Close">×</button>
    <h3>${def.name}</h3>
    <p class="meta">Commander piece · takes no slot · can't be sold · fires once when a fight starts</p>
    <p class="commander-text">${p.commander ? COMMANDERS[p.commander].desc : ''}</p>
    ${p.commanderCard ? `<p class="commander-text">${cardFace(p, p.commanderCard).desc}</p>` : ''}
    <p class="meta">Stands on: ${where}</p>
  </section>`;
}

export function playersHtml(others: Player[], shownHp: (p: Player) => number, opponentId: string | null): string {
  const rows = others
    .slice()
    .sort((a, b) => shownHp(b) - shownHp(a) || (a.place ?? 0) - (b.place ?? 0))
    .map((o) => {
      const hp = shownHp(o);
      const cls = [hp <= 0 ? 'out' : '', o.id === opponentId ? 'current' : ''].join(' ');
      const info = hp <= 0 ? `#${o.place}` : `${hp} HP · Lv ${o.level} · ${boardCount(o)} units`;
      const commander = o.commander ? `<span title="${COMMANDERS[o.commander].name}">${COMMANDERS[o.commander].icon}</span> ` : '';
      return `<li class="${cls}"><span class="opp-name">${commander}<span>${o.name}</span></span><span class="opp-info">${info}</span>${hp > 0 ? synergyChipsHtml(o) : ''}</li>`;
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
