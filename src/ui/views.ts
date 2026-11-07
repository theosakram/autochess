import { skillIcon } from './skillIcons';
import { coreHolder, ESSENCE_ROLES, essenceBlock, essenceMods, essenceRoles } from '../game/essence';
import { ESSENCE_CORE } from '../game/items';
import type { TraitLevels } from '../game/traits';
import { bloodBlock, bloodStars } from '../game/blood';
import { blessBlock, blessedUnit } from '../game/twilight';
import { rewardText } from '../game/traits/format';
import { autoHalo, beastOf, cardFace, COMMANDERS, MARKS, markedUid, markKinds, powersOf, type MarkKind } from '../game/commanders';
import { BASE_REWARD, baseReward, CREEP_ROUND, MAX_INTEREST, stageOf, WIN_GOLD, isMonsterRound, REROLL_COST, roman, roundAt, roundLabel, STAGE_ONE_ROUNDS, STAGE_ROUNDS, stageRound, START_HP, TICKS_PER_SECOND } from '../game/config';
import { type AuraGrant, auraGrants, effectiveTier, fieldLeaders, fieldStats, heldBy, leadsOf } from '../game/inventory';
import { cardItem, EQUIPMENT_GROUPS, isItemCard, ITEMS, type ItemDef } from '../game/items';
import { MIST_WARES, mistCoins } from '../game/mistShop';
import { ALTAR_KEYS, altarOf, altarStatus, nextTier, offerBlock, type AltarKey } from '../game/altar';
import { orbOptions } from '../game/orb';
import { SKILLS } from '../game/skills';
import { copiesOf, findCopies } from '../game/merge';
import { MAX_ITEMS_PER_UNIT } from '../game/config';
import { boardCount, freeSlotCount, interest, roundIncome, streakBonus, levelUpCost, xpToNext } from '../game/player';
import { attackInterval, type StatKey, type StatMod, type Stats } from '../game/stats';
import { fieldedMistOrbs, playerTraitCounts, playerTraits, traitCounts, traitLevel, TRAITS, unitStats } from '../game/traits';
import type { BotLevel, GameState, Item, Player, UnitDef } from '../game/types';
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
    ${p.twilight?.trait === traitId && blessedUnit(p) ? `<p class="trait-stacks">🌗 Twilight Blessing: <b>${UNIT_BY_ID[blessedUnit(p)!.defId].name}</b> counts +1</p>` : ''}
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
// Luo Yi's Essence Altar, beside the board: the hero on it, and what its core gives.
export function essenceAltarHtml(p: Player): string {
  if (!powersOf(p).essence) return '';
  const hero = p.essence?.hero;
  const def = hero ? UNIT_BY_ID[hero.defId] : null;
  const holder = coreHolder(p);
  const body = hero
    ? `<div class="essence-hero">${portraitHtml(hero.defId, 'tiny')}<b>${def!.name}</b> ${starsHtml(hero)}</div>
      <p class="essence-roles">${essenceRoles(p).map((r) => `${traitBadgeHtml(r)} ${ESSENCE_ROLES[r].text}`).join('<br>') || 'No role effect (factions have none).'}</p>
      <p class="essence-holder">🔶 Core ${holder ? `on <b>${UNIT_BY_ID[holder.defId].name}</b>` : 'not on a fielded hero: put it on in 🎒 Equipment'}</p>
      <div class="essence-actions"><button data-action="openEssence">Swap</button><button data-action="essenceOut">Take out</button></div>`
    : `<p class="essence-empty">Empty. Put a hero on it to make an Essence Core.</p>
      <div class="essence-actions"><button class="primary" data-action="openEssence">Put a hero on</button></div>`;
  return `<section class="essence-altar"><h4>⛰️ Essence Altar</h4>${body}</section>`;
}

// What the core is giving now, for its item popup.
function essenceFacts(p: Player): string[] {
  const hero = p.essence?.hero;
  if (!hero) return [];
  const show: Partial<Record<string, string>> = { hp: 'HP', atk: 'attack', ap: 'magic attack', armor: 'armor', mr: 'magic resist' };
  const flat = new Map<string, number>();
  for (const m of essenceMods(p)) if (m.add && show[m.stat]) flat.set(m.stat, (flat.get(m.stat) ?? 0) + m.add);
  return [
    `Essence of <b>${UNIT_BY_ID[hero.defId].name} ${starsHtml(hero)}</b>${p.essence!.items.length ? ` and its ${p.essence!.items.map((i) => ITEMS[i.id].icon).join('')}` : ''}.`,
    [...flat].map(([k, v]) => `+${Math.round(v)} ${show[k]}`).join(', ') + (p.essence!.items.length ? ', and a share of the items\' other stats' : '') + '.',
    ...essenceRoles(p).map((r) => `${traitBadgeHtml(r)} ${ESSENCE_ROLES[r].text}.`),
  ];
}

export function essencePickHtml(p: Player): string {
  const options = [...p.board, ...p.bench]
    .flatMap((u) => (u && !essenceBlock(p, u.uid) ? [u] : []))
    .map((u) => {
      const def = UNIT_BY_ID[u.defId];
      const roles = def.traits.filter((t) => ESSENCE_ROLES[t]);
      return `<button class="chip" data-action="essenceIn" data-unit="${u.uid}" title="${roles.map((r) => `${TRAITS[r].name}: ${ESSENCE_ROLES[r].text}`).join('. ') || 'No role effect'}">${def.name} ${starsHtml(u)} <small>${roles.map((t) => TRAITS[t].icon).join(' ')}</small></button>`;
    });
  return modalHtml(
    'closeEssence',
    'trait-popup',
    `<h2 class="trait-title">⛰️ Essence Altar</h2>
    <p class="trait-desc">The hero leaves your board and becomes the Essence Core (its items go in with it). Whoever holds the core gets ${Math.round((powersOf(p).essence?.share ?? 0) * 100)}% of the hero's HP, attack, magic attack, armor, magic resist and items' stats, plus an effect for each of its roles. ${p.essence?.hero ? `${UNIT_BY_ID[p.essence.hero.defId].name} comes back to the picked hero's place.` : ''}</p>
    <div class="orb-options">${options.join('') || '<p class="meta">No hero to put on.</p>'}</div>`,
  );
}

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
          .map((u) => `<button class="chip" data-action="mistPick" data-choice="${u.uid}">${UNIT_BY_ID[u.defId].name} ${starsHtml(u)}</button>`)
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
  return `<p class="trait-stacks">${leader.icon} ${leader.title}: <b>${u ? `${UNIT_BY_ID[u.defId].name} ${starsHtml(u)}` : 'none yet'}</b></p>`;
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

// --- Home screen gallery (no game running: nothing is owned) ---

export type HomeTab = 'heroes' | 'commanders' | 'items' | 'synergies' | 'crossovers';
export const HOME_TABS: { id: HomeTab; label: string }[] = [
  { id: 'heroes', label: 'Heroes' },
  { id: 'commanders', label: 'Commanders' },
  { id: 'items', label: 'Items' },
  { id: 'synergies', label: 'Synergies' },
  { id: 'crossovers', label: 'Crossovers' },
];

// Bot difficulties on the home screen, in order.
export const DIFFICULTIES: { id: BotLevel; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Bots buy whatever they can afford and place it anywhere.' },
  { id: 'normal', label: 'Normal', hint: 'Bots build toward traits and star-ups, put tanks in front and manage their gold.' },
];

export function homeHtml(difficulty: BotLevel = 'normal'): string {
  const picks = DIFFICULTIES.map(
    (d) => `<button class="difficulty-btn${d.id === difficulty ? ' on' : ''}" data-action="difficulty" data-level="${d.id}">${d.label}</button>`,
  ).join('');
  return `<div class="home">
    <h1 class="home-title">Autochess</h1>
    <div class="home-buttons">
      <div class="difficulty">
        <small>Bot difficulty</small>
        <div class="difficulty-picks">${picks}</div>
        <p class="difficulty-hint">${DIFFICULTIES.find((d) => d.id === difficulty)!.hint}</p>
      </div>
      <button class="primary home-btn" data-action="play">▶ Play</button>
      <button class="home-btn" data-action="openGallery">📖 Gallery</button>
    </div>
  </div>`;
}

// `p` is a blank player: trait cards and unit popups need one, but nothing is on its board.
export function homeGalleryHtml(p: Player, tab: HomeTab): string {
  const tabs = HOME_TABS.map((t) => `<button class="gallery-tab${t.id === tab ? ' on' : ''}" data-action="homeTab" data-tab="${t.id}">${t.label}</button>`).join('');
  const body =
    tab === 'heroes' ? heroGalleryHtml()
    : tab === 'commanders' ? commanderGalleryHtml()
    : tab === 'items' ? itemGalleryHtml()
    : tab === 'crossovers' ? crossoverGridHtml(p)
    : gallerySection(p, {}, 'faction', 'Factions') + gallerySection(p, {}, 'role', 'Roles');
  return `<div class="dialog gallery home-gallery" data-keep-scroll="home-${tab}">
    <div class="home-gallery-head">
      <button data-action="home">← Back</button>
      <h2>📖 Gallery</h2>
    </div>
    <nav class="gallery-tabs">${tabs}</nav>
    ${body}
  </div>`;
}

// Every hero a player can own, by cost; then the ones only handed out.
function heroGalleryHtml(): string {
  const heroes = UNITS.filter((u) => !u.summon && !u.monster && !u.piece).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  const card = (u: UnitDef) =>
    `<button class="hero-card tier-${u.tier}" data-unit-info="${u.id}">
      ${portraitHtml(u.id, 'big')}
      <span class="hero-card-text">
        <b>${u.name}</b>
        <small>${u.tier}g · ${u.range <= 1 ? 'melee' : `range ${u.range}`}${u.skill ? ` · ${SKILLS[u.skill].name}` : ''}</small>
        <span class="hero-card-traits">${u.traits.map((id) => `${traitBadgeHtml(id)} ${TRAITS[id].name}`).join(' ')}</span>
      </span>
    </button>`;
  const section = (title: string, list: UnitDef[]) =>
    list.length ? `<h3 class="gallery-section">${title}</h3><div class="hero-grid">${list.map(card).join('')}</div>` : '';
  const inShop = heroes.filter((u) => u.shop !== false);
  const tiers = [...new Set(inShop.map((u) => u.tier))];
  return (
    tiers.map((t) => section(`${t} gold`, inShop.filter((u) => u.tier === t))).join('') +
    section('Not in the shop', heroes.filter((u) => u.shop === false))
  );
}

// A commander's two texts, folded: its innate power, and its card (both faces). Native <details> sharing a
// name, so opening one closes the other; no app state needed.
function commanderFoldsHtml(c: (typeof COMMANDERS)[string], scope: string): string {
  const group = `${scope}-${c.id}`;
  return `<div class="commander-folds">
    <details name="${group}"><summary>${c.icon} Power</summary><p class="commander-text">${c.desc}</p></details>
    <details name="${group}"><summary>${c.card.icon} Card: ${c.card.name}</summary>
      <p class="commander-text"><b>On ${c.name}:</b> ${c.card.selfDesc}</p>
      <p class="commander-text"><b>On another commander:</b> ${c.card.otherDesc ?? c.desc}</p>
    </details>
  </div>`;
}

function commanderGalleryHtml(): string {
  const cards = Object.values(COMMANDERS)
    .map(
      (c) => `<article class="gallery-card commander-entry">
        <h3 class="trait-title"><span class="commander-portrait">${c.icon}</span><span>${c.name}<br><small>${c.title}</small></span></h3>
        ${commanderFoldsHtml(c, 'gallery')}
      </article>`,
    )
    .join('');
  return `<p class="meta">Pick one at the start of a game. On round I-2 you pick a commander card: your own commander's card upgrades its power, another's lends you that power.</p>
    <div class="gallery-grid">${cards}</div>`;
}

// Every item, grouped by where it comes from. Tiered values show every tier.
function itemGalleryHtml(): string {
  const all = Object.values(ITEMS);
  const card = (def: ItemDef) =>
    `<article class="gallery-card item-entry">
      <h3 class="trait-title"><span class="trait-icon">${def.icon}</span> ${def.name} <small>${def.kind}${def.maxTier > 1 ? ` · ${def.maxTier} tiers` : ''}</small></h3>
      <p class="trait-desc">${descHtml(def, 0)}</p>
      ${def.membersOnly && def.trait ? `<p class="meta">Only ${TRAITS[def.trait].name} units can hold it.</p>` : ''}
      ${def.forbidden ? `<p class="meta">${TRAITS[def.forbidden].name} units can't hold it.</p>` : ''}
    </article>`;
  const section = (title: string, list: ItemDef[], note = '') =>
    list.length ? `<h3 class="gallery-section">${title}</h3>${note ? `<p class="meta">${note}</p>` : ''}<div class="gallery-grid">${list.map(card).join('')}</div>` : '';
  const traitIds = [...new Set(all.flatMap((i) => (i.trait ? [i.trait] : [])))];
  return (
    section('Basic items', all.filter((i) => i.basic), 'Round I-1\'s creeps drop them: pick one on I-2.') +
    EQUIPMENT_GROUPS.map((g, i) =>
      section(`${g.name} equipment`, all.filter((it) => !it.trait && !it.basic && !it.exclusive && it.group === g.id), i === 0 ? 'Dropped by the monsters on round 3 of every stage from II; anyone can hold them.' : ''),
    ).join('') +
    section('Commander items', all.filter((i) => i.exclusive)) +
    traitIds.map((t) => section(`${TRAITS[t].name} items`, all.filter((i) => i.trait === t))).join('')
  );
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

// The gold popover: what the end of this round pays, win or lose (or, on a monster round, either way). Counts
// the gold banked right now; spending it changes the interest.
function incomePopHtml(p: Player, round: number): string {
  const base = baseReward(round);
  const streak = p.streak ?? 0;
  const row = (label: string, value: number, note = '') =>
    `<div class="income-row"><span>${label}${note ? `<small>${note}</small>` : ''}</span><b>+${value}</b></div>`;
  const interestNote = (gold: number) => {
    const next = interest(gold) >= MAX_INTEREST ? '' : `, ${10 - (gold % 10)} more for +${interest(gold) + 2}`;
    return `${gold} banked${next}`;
  };
  const streakNote = (n: number) => (n === 0 ? 'no streak' : n > 0 ? `${n} win${n === 1 ? '' : 's'} in a row` : `${-n} loss${n === -1 ? '' : 'es'} in a row`);
  const stage = `Basic reward<small>stage ${roman(stageOf(round))}${stageOf(round) < BASE_REWARD.length ? `; stage ${roman(stageOf(round) + 1)}: ${baseReward(roundAt(stageOf(round) + 1, 1))}` : ''}</small>`;
  const baseRow = `<div class="income-row"><span>${stage}</span><b>+${base}</b></div>`;
  const block = (title: string, cls: string, gold: number, next: number, winGold: number) => {
    const total = winGold + base + interest(gold) + streakBonus(next);
    return `<section class="income-case ${cls}">
      <h4>${title}<b>+${total}</b></h4>
      ${winGold ? row('Win gold', winGold, 'right away, before interest') : ''}
      ${baseRow}
      ${row('Interest', interest(gold), interestNote(gold))}
      ${row(next > 0 ? 'Win streak' : next < 0 ? 'Lose streak' : 'Streak', streakBonus(next), streakNote(next))}
    </section>`;
  };
  const cases = isMonsterRound(round)
    ? block('After this round', 'even', p.gold, streak, 0) + '<p class="income-note">Monster round: no win gold, and your streak stays as it is.</p>'
    : block('If you win', 'win', p.gold + WIN_GOLD, Math.max(0, streak) + 1, WIN_GOLD) +
      block('If you lose', 'lose', p.gold, Math.min(0, streak) - 1, 0);
  return `<div class="income-pop" role="dialog">
    <header><b>Next round's gold</b><small>💰 ${p.gold} now · ${roundLabel(round)}</small></header>
    ${cases}
    <p class="income-note">Interest counts the gold you still hold when the round ends: spend it and it drops. A draw counts as a loss.</p>
  </div>`;
}

// Hand-drawn dock icons, 24x24 strokes in currentColor (tinted per button by CSS).
const DOCK_ICONS = {
  levelUp: '<path d="M6 13.5l6-6 6 6M6 19.5l6-6 6 6"/>',
  reroll: '<path d="M19.5 11A7.5 7.5 0 0 0 6.2 6.8M4.5 13a7.5 7.5 0 0 0 13.3 4.2"/><path d="M5 2.8v4.4h4.4M19 21.2v-4.4h-4.4"/>',
  locked: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  unlocked: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 6.7-1.4"/>',
};
const dockIcon = (name: keyof typeof DOCK_ICONS) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DOCK_ICONS[name]}</svg>`;

// The dock along the bottom: leveling, the shop and the fight button, always in view so buying never
// hides the board. Drop a unit anywhere on it to sell.
export function shopDockHtml(p: Player, round: number, locked: boolean, chosen: Record<string, string>, incomeOpen = false): string {
  const levelCost = levelUpCost(p);
  const levelBtn =
    levelCost === null
      ? `<button class="dock-icon level" disabled title="Max level">${dockIcon('levelUp')}<small>Max</small></button>`
      : `<button class="dock-icon level" data-action="levelUp" title="Level up: ${levelCost}g (F)" ${locked || p.gold < levelCost ? 'disabled' : ''}>${dockIcon('levelUp')}<small>${levelCost}g</small><kbd>F</kbd></button>`;
  const lockTitle = p.shopLocked ? 'Locked: keeps this shop next round (click to unlock)' : 'Lock: keep this shop next round';
  const income = roundIncome(p, round);
  const streak = p.streak ?? 0;
  const streakText = streak > 0 ? `${streak} win${streak === 1 ? '' : 's'} in a row` : streak < 0 ? `${-streak} loss${streak === -1 ? '' : 'es'} in a row` : 'no streak';
  const incomeTitle =
    `End of round: +${income.base} basic reward, +${income.interest} interest (2 per 10 gold banked, up to ${MAX_INTEREST}), ` +
    `+${income.streak} streak bonus (${streakText}). Winning a fight against a player also pays +${WIN_GOLD} right away.`;
  return `<section class="dock${locked ? ' fighting' : ''}" data-sell>
    <div class="dock-side">
      <div class="dock-gold" title="${incomeTitle}"><b>💰 ${p.gold}</b><small>+${income.total} next</small><button class="income-help${incomeOpen ? ' on' : ''}" data-action="toggleIncome" title="What next round pays">?</button></div>
      ${incomeOpen ? incomePopHtml(p, round) : ''}
      <div class="dock-icons">
        ${levelBtn}
        <button class="dock-icon reroll" data-action="reroll" title="Reroll: ${REROLL_COST}g (D)" ${locked ? 'disabled' : ''}>${dockIcon('reroll')}<small>${REROLL_COST}g</small><kbd>D</kbd></button>
        <button class="dock-icon lock${p.shopLocked ? ' on' : ''}" data-action="toggleLock" title="${lockTitle}">${dockIcon(p.shopLocked ? 'locked' : 'unlocked')}<small>${p.shopLocked ? 'Locked' : 'Lock'}</small></button>
      </div>
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
          <span class="gear-name">${def.name}<i class="unit-star">${starsHtml(u)}</i></span>
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

// Hand-drawn round icons, 24x24, filled with currentColor so CSS colours them (past / current / ahead).
const ROUND_ICONS = {
  // A sword, point up-right: blade, crossguard, grip, pommel.
  fight:
    '<path d="M20.5 3.5v4.2L11 17.2 6.8 13 16.3 3.5z"/><path d="M4.4 11.6 5.9 10.1 13.9 18.1 12.4 19.6z"/><path d="M7 15.6 8.4 17 4.9 20.5 3.5 19.1z"/><circle cx="3.6" cy="20.4" r="1.7"/>',
  // A horned monster head; eyes and fangs cut out (evenodd).
  monster:
    '<path fill-rule="evenodd" d="M4.5 3 8 8.2Q12 6.4 16 8.2L19.5 3 19 10.2Q20.6 12.4 20 15.6 19.2 20.6 12 21.5 4.8 20.6 4 15.6 3.4 12.4 5 10.2ZM7.6 11.6 11 13.4 7.6 15.2ZM16.4 11.6 13 13.4 16.4 15.2ZM9 17.4H15L14.2 19.2 13.1 18.2 12 19.5 10.9 18.2 9.8 19.2Z"/>',
};

// The current stage's rounds in a row: sword for a fight, monster for creeps or monsters. Past rounds dim,
// the current one gold.
// The player's streak, right of the stage legend: fights against players won (or lost) in a row, and its bonus.
function streakHtml(streak: number): string {
  const n = Math.abs(streak);
  if (streak === 0) return `<div class="hud-streak none" title="No streak: win or lose 2 fights against players in a row for a bonus"><small>Streak</small><b>—</b></div>`;
  const win = streak > 0;
  const title = `${n} ${win ? `win${n === 1 ? '' : 's'}` : `loss${n === 1 ? '' : 'es'}`} in a row: +${streakBonus(streak)} gold at the end of every round while it lasts`;
  return `<div class="hud-streak ${win ? 'win' : 'lose'}" title="${title}"><small>${win ? 'Win' : 'Lose'} streak</small><b>${win ? '🔥' : '💧'} ${n}</b></div>`;
}

function stageLegendHtml(round: number, streak: number): string {
  const { stage } = stageRound(round);
  const count = stage === 1 ? STAGE_ONE_ROUNDS : STAGE_ROUNDS;
  const icons = Array.from({ length: count }, (_, i) => {
    const r = roundAt(stage, i + 1);
    const kind = isMonsterRound(r) ? 'monster' : 'fight';
    const what = r === CREEP_ROUND ? 'Creeps: they drop a basic item pick' : kind === 'monster' ? 'Monsters: equipment, win or lose' : 'Fight another player';
    const state = r < round ? 'past' : r === round ? 'current' : 'ahead';
    return `<span class="legend-round ${state}" title="${roundLabel(r)} · ${what}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ROUND_ICONS[kind]}</svg></span>`;
  }).join('<span class="legend-link"></span>');
  const creeps = round === CREEP_ROUND;
  const monster = isMonsterRound(round);
  const title = creeps ? 'Creep round: everyone fights creeps; they drop a basic item pick' : monster ? 'Monster round: everyone fights monsters for equipment' : `Round ${roundLabel(round)} (stage ${roman(stage)})`;
  return `<div class="stage-legend"><div class="legend-round-label" title="${title}"><small>Round</small><b>${roundLabel(round)}</b></div><div class="legend-icons">${icons}</div>${streakHtml(streak)}</div>`;
}

export function hudHtml(state: GameState, p: Player, opponentName: string | null): string {
  const need = xpToNext(p);
  const free = p.level - boardCount(p);
  const benched = p.bench.some(Boolean);
  const stat = (label: string, value: string, title: string, cls = '') =>
    `<div class="hud-stat ${cls}" title="${title}"><small>${label}</small><span>${value}</span></div>`;
  const xp =
    need === null
      ? '<small>max</small>'
      : `<span class="xp-bar"><span style="width:${(p.xp / need) * 100}%"></span></span><small>${p.xp}/${need}</small>`;
  return `<header class="hud">
    <div class="hud-side hud-left">
    ${stat('Level', `<b>${p.level}</b> ${xp}`, need === null ? 'Max level' : `${p.xp}/${need} XP to level ${p.level + 1}`)}
    ${stat('Heroes', `<b>${boardCount(p)}/${p.level}${freeSlotCount(p) ? ` +${freeSlotCount(p)}` : ''}</b>${free > 0 && benched ? `<small class="warn">${free} free slot${free === 1 ? '' : 's'}</small>` : ''}`, 'Heroes on the board / how many you may field')}
    ${p.orbs.length ? stat('Orbs', `🔮 <b>${p.orbs.length}</b>`, 'Magic Orb ready: put it on a hero in the Equipment panel') : ''}
    </div>
    ${stageLegendHtml(state.round, p.streak ?? 0)}
    <div class="hud-side hud-right">
      ${opponentName ? `<div class="hud-stat vs" title="Fighting"><small>Fighting</small><span><b>${opponentName}</b></span></div>` : ''}
      <button class="hud-book" data-action="openGallery" title="All factions and roles">📖 Synergies</button>
    </div>
  </header>`;
}

// Right-column card for one of the player's units: stats as it would fight right now.
export function unitDetailHtml(p: Player, uid: number, chosen: Record<string, string>, skillOpen = false): string {
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
  const pctS = (n: number) => `${fmt(n * 100)}%`;
  // One stat: its icon and number (the full name and any bonus in the tooltip; a bonus marks the number).
  const stat = (icon: string, label: string, key: keyof Stats, show = (n: number) => fmt(n)) => {
    const diff = s[key] - base[key];
    const bonus = Math.abs(diff) > 1e-9 ? ` (${diff > 0 ? '+' : ''}${show(diff)} from bonuses)` : '';
    return `<span class="stat-cell${bonus ? (diff > 0 ? ' up' : ' down') : ''}" title="${label}: ${show(s[key])}${bonus}"><i>${icon}</i>${show(s[key])}</span>`;
  };
  const optStat = (icon: string, label: string, key: keyof Stats, show?: (n: number) => string) => (s[key] ? stat(icon, label, key, show) : '');
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
      <h3>${isChosen(chosen, def.id) ? '👑 ' : ''}${def.name} <span class="unit-star">${starsHtml(u)}</span></h3>
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
    ${p.twilight?.trait && p.twilight.holder === uid ? `<p class="orb-line twilight-line">🌗 Twilight Blessing: +1 ${TRAITS[p.twilight.trait].name}${area === 'bench' ? ' (when fielded)' : ''}</p>` : ''}
    ${(p.mistOrbs ?? [])
      .filter((o) => o.holder === uid)
      .map(
        (o) => `<p class="orb-line">${traitBadgeHtml(o.trait)} ${orbName(o.trait)}: +1 ${TRAITS[o.trait].name}${area === 'bench' ? ' (when fielded)' : ''}
          <button class="chip" data-action="unequipMistOrb" data-orb="${o.uid}" title="Back to the inventory">✕</button></p>`,
      )
      .join('')}
    <div class="stat-grid">
      ${stat('❤️', 'HP', 'hp')}
      ${stat('🗡️', 'Attack', 'atk')}
      ${stat('✨', 'Magic attack', 'ap')}
      <span class="stat-cell" title="Attack speed${attackInterval(s) !== attackInterval(base) ? `: +${fmt((s.attackSpeed - base.attackSpeed) * 100)}%` : ''}"><i>⚡</i>${perSec(attackInterval(s))}/s${
        attackInterval(s) !== attackInterval(base) ? '<em>▲</em>' : ''
      }</span>
      ${stat('🎯', 'Range', 'range')}
      ${stat('🛡️', 'Armor', 'armor')}
      ${stat('💠', 'Magic resist', 'mr')}
      ${stat('💧', 'Mana', 'maxMana')}
      ${optStat('🔋', 'Mana regen', 'manaRegen', (n) => `${fmt(n)}/s`)}
      ${optStat('💥', 'Damage amp', 'damageAmp', pctS)}
      ${optStat('🔻', 'Damage taken', 'damageTaken', pctS)}
      ${optStat('🔨', 'Armor shred', 'armorShred')}
      ${optStat('🌀', 'Magic pen', 'magicPen', pctS)}
      ${optStat('🎲', 'Crit chance', 'critChance', pctS)}
      ${s.critChance ? stat('💢', 'Crit damage', 'critDamage', pctS) : ''}
      ${optStat('📜', 'Skill damage', 'skillAmp', pctS)}
      ${optStat('👊', 'Basic attack damage', 'basicAmp', pctS)}
      ${optStat('🔁', 'Hit-again chance', 'hitAgain', pctS)}
      ${optStat('🔰', 'Starting shield (of max HP)', 'startShield', pctS)}
      ${optStat('❣️', 'Lifesteal', 'lifesteal', pctS)}
      ${optStat('💞', 'Spell lifesteal', 'spellLifesteal', pctS)}
    </div>
    <div class="detail-kit">
      <div class="kit-part"><small>Skill</small>
        <button class="skill-btn${skillOpen ? ' on' : ''}" data-action="toggleSkill" title="${def.skill ? SKILLS[def.skill].name : 'Skill'}: click for details">${skillIcon(def.skill)}</button>
      </div>
      <div class="kit-part"><small>Items</small><div class="gear-slots">${detailSlots(p, uid, levels)}</div></div>
    </div>
    ${skillOpen ? `<div class="skill-pop">${skillHtml(def.skill, u.star, s)}</div>` : ''}
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
    return `<h4>✨ Skill <small>placeholder</small></h4>
      <p class="skill">At full mana, the next attack deals ${Math.round(s.castMult * 100)}% magic attack (${Math.round(s.ap * s.castMult * (1 + s.skillAmp))}) as magic damage.</p>`;
  }
  const skill = SKILLS[skillId];
  return `<h4>${skillIcon(skillId)} ${skill.name}</h4><p class="skill trait-desc">${skillDescHtml(skill, star, s)}</p>`;
}

// A skill's text at every star (this one highlighted), and where a value is a share of attack, magic attack or
// max HP, the number it comes to now: "80% (124) of attack".
function skillDescHtml(src: { desc: string; values(): Record<string, string[]> }, star: number, s: Stats): string {
  const values = src.values();
  const base: [RegExp, (s: Stats) => number][] = [
    [/^ of (?:its )?magic attack/, (x) => x.ap],
    [/^ of (?:its )?attack/, (x) => x.atk],
    [/^ of its max HP/, (x) => x.hp],
  ];
  return src.desc.replace(/\{(\w+)\}/g, (match: string, key: string, offset: number, whole: string) => {
    const after = whole.slice(offset + match.length);
    const shown = values[key].map((v, i) => `<span class="${i === star - 1 ? 'on' : ''}">${v}</span>`).join('<i> / </i>');
    const cur = values[key][star - 1];
    // A threshold ('left below 8% of its max HP') is the enemy's HP, not a number this hero has.
    const threshold = /below $/.test(whole.slice(0, offset));
    const rule = cur?.endsWith('%') && !threshold ? base.find(([re]) => re.test(after)) : undefined;
    if (!rule) return shown;
    // Skill damage gets the skill and damage bonuses, as in combat (before the target's defenses).
    const damage = /^[^.]*?damage/.test(after.slice(0, 60)) ? (1 + s.skillAmp) * (1 + s.damageAmp) : 1;
    const n = Math.round((parseFloat(cur) / 100) * rule[1](s) * damage);
    return `${shown} <b class="calc" title="Now, with this hero's stats">(${n})</b>`;
  });
}

// The hero card's item slots, as in the Equipment panel: click an item for its details; with an item picked up,
// click a slot to equip it here.
function detailSlots(p: Player, uid: number, levels: TraitLevels): string {
  const slots: string[] = heldBy(p, uid).flatMap((it) => {
    const def = ITEMS[it.id];
    const tier = effectiveTier(it, levels);
    const chip = `<div class="item-chip${tier ? '' : ' inactive'}" data-item="${it.uid}" title="${def.name}${def.trait ? ` (${tier ? `tier ${tier}` : 'inactive'})` : ''}. ${itemText(def, tier || it.tier)}"><span class="item-icon">${def.icon}</span>${def.trait ? `<b>T${tier || it.tier}</b>` : ''}</div>`;
    return [`<div class="gear-slot" data-gear-unit="${uid}">${chip}</div>`, ...Array.from({ length: (def.slots ?? 1) - 1 }, () => `<div class="gear-slot taken" data-gear-unit="${uid}"></div>`)];
  });
  while (slots.length < MAX_ITEMS_PER_UNIT) slots.push(`<div class="gear-slot" data-gear-unit="${uid}"></div>`);
  return slots.join('');
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
  const who = holder ? `${UNIT_BY_ID[holder.defId].name} ${starsHtml(holder)}` : 'nobody';
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
    holder ? `Held by <b>${UNIT_BY_ID[holder.defId].name} ${starsHtml(holder)}</b>.` : 'Not equipped.',
    trait && !tier ? `<b>Inactive:</b> works once ${traitBadgeHtml(trait.id)} ${trait.name} is active.` : '',
    def.membersOnly ? `Only ${traitBadgeHtml(trait!.id)} ${trait!.name} units can hold it.` : '',
    def.forbidden ? `${traitBadgeHtml(def.forbidden)} ${TRAITS[def.forbidden].name} units can't hold it.` : '',
    def.slots && def.slots > 1 ? `Takes ${def.slots} item slots.` : '',
    aura ? `Gives ${auraText(aura)}, to ${aura.receivers} unit${aura.receivers === 1 ? '' : 's'} now.` : '',
  ].filter(Boolean);
  if (def.id === ESSENCE_CORE) facts.unshift(...essenceFacts(p));
  return modalHtml(
    'closeItem',
    'trait-popup',
    `<h2 class="trait-title"><span class="trait-icon">${def.icon}</span> ${def.name}${trait ? ` <small>tier ${tier || it.tier}</small>` : ''}</h2>
    <p class="meta">${trait ? `${trait.name} item` : def.exclusive ? 'Commander item' : def.basic ? 'Basic item' : `${EQUIPMENT_GROUPS.find((g) => g.id === def.group)?.name ?? ''} equipment`.trim()} · ${def.kind}</p>
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
      (c) => `<div class="commander-option commander-choice">
        <span class="commander-portrait">${c.icon}</span>
        <b>${c.name}</b><small>${c.title}</small>
        ${commanderFoldsHtml(c, 'pick')}
        <button class="primary commander-choose" data-action="pickCommander" data-commander="${c.id}">Choose</button>
      </div>`,
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
      const group = def.group ? EQUIPMENT_GROUPS.find((g) => g.id === def.group)!.name : def.kind;
      return `<button class="commander-option" data-action="pickItem" data-item-id="${id}">
        <span class="commander-portrait">${def.icon}</span>
        <b>${def.name}</b><small>${group}</small>
        <span class="commander-text">${itemText(def, 1)}</span>
      </button>`;
    })
    .join('');
  return `<div class="overlay"><div class="dialog modal commander-pick">
    <h2 class="trait-title">${p.offerFrom === 'basic' || ITEMS[p.itemOffer?.[0] ?? '']?.basic ? 'Choose a basic item' : p.offerFrom === 'loot' ? `Monster loot: choose one${p.loot ? ` (${p.loot} more after this)` : ''}` : 'Equipment Chest: choose one'}</h2>
    <p class="meta">It goes to your items: equip it on any hero. Unpicked when the fight starts: the first one.</p>
    <div class="commander-options">${cards}</div>
  </div></div>`;
}

// You, beside the board: your commander, your HP, its power and its card.
// Which part of the commander panel is unfolded: the innate power's text, or the card's. Null: both folded.
export type CommanderSection = 'innate' | 'card';

// Its status lines and buttons always show; the two descriptions fold away behind tabs (one open at a time).
export function commanderPanelHtml(p: Player, hp: number, round = 0, open: CommanderSection | null = null): string {
  if (!p.commander) return '';
  const c = COMMANDERS[p.commander];
  const card = p.commanderCard ? COMMANDERS[p.commanderCard] : null;
  const share = Math.max(0, Math.min(1, hp / START_HP));
  const tab = (section: CommanderSection, label: string) =>
    `<button class="commander-tab${open === section ? ' on' : ''}" data-action="commanderSection" data-section="${section}" aria-expanded="${open === section}">${label} <span class="caret">${open === section ? '▴' : '▾'}</span></button>`;
  const tabs = [
    tab('innate', `${c.icon} Power`),
    card ? tab('card', `${card.card.icon} ${card.card.name}`) : p.cardOffer ? '<span class="commander-tab waiting">🂠 Card: pick one</span>' : '',
  ].join('');
  const body =
    open === 'innate'
      ? `<p class="commander-text">${c.desc}</p>`
      : open === 'card' && card
        ? `<p class="commander-text">${cardFace(p, p.commanderCard!).desc}</p>`
        : '';
  return `<section class="commander-panel">
    <div class="commander-head">
      <span class="commander-portrait">${c.icon}</span>
      <div><b>${c.name}</b><small>${c.title}</small></div>
      <span class="commander-hp" title="Your HP">❤️ ${hp}</span>
    </div>
    <div class="commander-hpbar"><span style="width:${share * 100}%"></span></div>
    <div class="commander-tabs">${tabs}</div>
    ${body ? `<div class="commander-fold">${body}</div>` : ''}
    ${markKinds(p).map((k) => markLineHtml(p, k)).join('')}
    ${powersOf(p).protect ? autoHaloLineHtml(p) : ''}
    ${chestLineHtml(p)}
    ${tricksterLineHtml(p)}
    ${twilightLineHtml(p)}
    ${p.echo ? `<p class="commander-card-line">🏔️ Earthen Echo: ${portraitHtml(p.echo.defId, 'tiny')} ${UNIT_BY_ID[p.echo.defId].name} <b>${p.echo.given}/${powersOf(p).echo?.total ?? p.echo.given}</b></p>` : ''}
    ${bloodLineHtml(p)}
    ${bountyLineHtml(p)}
    ${groveHtml(p, round)}
    ${altarsHtml(p, round)}
  </section>`;
}

// Progress toward the next Equipment Chest, once the player owns a chest item.
function chestLineHtml(p: Player): string {
  const rule = p.items.map((i) => ITEMS[i.id].chests).find(Boolean);
  if (!rule) return '';
  const { kills, earned } = p.chests ?? { kills: 0, earned: 0 };
  return `<p class="commander-text">Equipment Chests: <b>${earned}/${rule.max}</b>${earned < rule.max ? ` · next at ${kills}/${rule.kills} kills` : ''}</p>`;
}

// Kaela's Treasure Grove: points on a track to the max, Roll (once a round) and Open (cash in), what the
// latest roll did and the latest prize; plus any Mirror Devices waiting for a unit.
function groveHtml(p: Player, round: number): string {
  const power = powersOf(p).trove;
  const mirrors = p.mirrors
    ? `<button class="grove-btn" data-action="openMirror">👥 Use Mirror Device${p.mirrors > 1 ? ` ×${p.mirrors}` : ''}</button>`
    : '';
  const last = p.luck?.last ? `<p class="commander-text">🍀 Last prize: <b>${p.luck.last}</b></p>` : '';
  if (!power) return last + mirrors;
  const t = p.trove ?? { points: 0, rolledRound: 0, opens: 0, lastRoll: null, bust: false };
  const spent = t.opens >= power.opens;
  const pips = Array.from({ length: power.max }, (_, i) => `<span class="${i < t.points ? 'on' : ''}"></span>`).join('');
  const rolled = t.rolledRound === round;
  const rollNote = rolled && t.lastRoll !== null ? (t.bust ? `Rolled ${t.lastRoll}: bust, back to 0!` : `Rolled ${t.lastRoll}.`) : '';
  return `<div class="grove">
    <p class="commander-text">🌳 <b>Treasure Grove</b> · ${t.points}/${power.max} points · worth ${power.value[t.points]} gold · ${power.opens - t.opens} open${power.opens - t.opens === 1 ? '' : 's'} left</p>
    <div class="grove-track">${pips}</div>
    ${rollNote ? `<p class="commander-text">${rollNote}</p>` : ''}
    <div class="grove-actions">
      <button class="grove-btn" data-action="rollDice" ${rolled || spent ? 'disabled' : ''}>🎲 Roll${rolled ? 'ed' : ''}</button>
      <button class="grove-btn" data-action="openTrove" ${spent || t.points <= 0 ? 'disabled' : ''}>💰 Open Trove</button>
    </div>
  </div>${last}${mirrors}`;
}

// Mirror Device (won from the Lucky Dice): pick one of your units to copy.
export function mirrorPickHtml(p: Player): string {
  const options = [...p.board, ...p.bench]
    .flatMap((u) => (u && UNIT_BY_ID[u.defId].shop !== false ? [u] : []))
    .map((u) => `<button class="chip" data-action="useMirror" data-unit="${u.uid}">${UNIT_BY_ID[u.defId].name} ${starsHtml(u)}</button>`);
  return modalHtml(
    'closeMirror',
    'trait-popup',
    `<h2 class="trait-title">👥 Mirror Device</h2>
    <p class="trait-desc">${MIST_WARES.mirror.desc}</p>
    <div class="orb-options">${options.join('') || '<p class="meta">Nothing to copy.</p>'}</div>`,
  );
}

// Dyroth's altars beside the board: each says when it's ready and opens a hero picker; then the latest
// offering and what it gave.
// An altar's countdown to its next use: one rune per round of its cycle, lit for every round already waited.
// When they fill, a use is banked (the badge) and the runes start over. Uses stack.
function altarRunesHtml(every: number, uses: number, next: number, round: number): string {
  const left = Math.max(0, next - round);
  const lit = Math.max(0, Math.min(every, every - left));
  const runes = Array.from({ length: every }, (_, i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join('');
  const title = `${uses ? `${uses} use${uses === 1 ? '' : 's'} ready. ` : ''}Next use on round ${roundLabel(next)} (${left} more round${left === 1 ? '' : 's'})`;
  return `<span class="altar-count" title="${title}"><span class="altar-runes">${runes}</span><b class="altar-uses${uses ? ' ready' : ''}">×${uses}</b></span>`;
}

function altarsHtml(p: Player, round: number): string {
  const rows = ALTAR_KEYS.flatMap((key) => {
    const altar = altarOf(p, key);
    if (!altar) return [];
    const { uses, next } = altarStatus(p, key, round);
    const what = `${altar.gifts === 'traits' ? '2 heroes (its faction, its role)' : '1 random hero'}`;
    return [
      `<div class="altar">
        <p class="commander-text altar-line"><span>${altar.icon} <b>${altar.name}</b> · a hero for ${what}, 1 cost up, +${altar.xp} XP</span>${altarRunesHtml(altar.every, uses, next, round)}</p>
        <button class="grove-btn" data-action="openAltar" data-altar="${key}" ${uses ? '' : 'disabled'}>${altar.icon} Offer a hero${uses > 1 ? ` (${uses})` : ''}</button>
      </div>`,
    ];
  });
  const last = p.altarLast && altarOf(p, p.altarLast.key)
    ? `<p class="commander-text">Last offering: ${UNIT_BY_ID[p.altarLast.offered].name} → <b>${p.altarLast.gifts.map((id) => UNIT_BY_ID[id].name).join(', ') || 'nothing left in the pool'}</b></p>`
    : '';
  return rows.join('') + (rows.length ? last : '');
}

// The hero picker for one of Dyroth's altars: every unit it would take, with what cost it turns into.
export function altarPickHtml(p: Player, key: AltarKey): string {
  const altar = altarOf(p, key)!;
  const options = [...p.board, ...p.bench]
    .flatMap((u) => (u && !offerBlock(UNIT_BY_ID[u.defId]) ? [u] : []))
    .map((u) => {
      const def = UNIT_BY_ID[u.defId];
      return `<button class="chip" data-action="offer" data-unit="${u.uid}" title="${traitNames(def.traits)}">${def.name} ${starsHtml(u)} <small>${def.tier}g → ${nextTier(def.tier)}g</small></button>`;
    });
  return modalHtml(
    'closeAltar',
    'trait-popup',
    `<h2 class="trait-title">${altar.icon} ${altar.name}</h2>
    <p class="trait-desc">${altar.gifts === 'traits' ? 'The hero is gone; you get a 1-star hero of the next cost up sharing its faction, and one sharing its role.' : 'The hero is gone; you get a random 1-star hero of the next cost up.'} Its copies go back to the pool, its items to your inventory.</p>
    <div class="orb-options">${options.join('') || '<p class="meta">No hero to offer.</p>'}</div>`,
  );
}

// Ruby's card: gold earned so far from Cloak and Scythe wearers left standing.
function bountyLineHtml(p: Player): string {
  const rule = powersOf(p).survivorGold;
  if (!rule) return '';
  return `<p class="commander-text">💵 Bounty: <b>${p.survivorGold ?? 0}/${rule.max}</b> gold · +${rule.gold} per wearer standing after a fight</p>`;
}

// Nana: knockouts she can still survive, and her damage-gold progress.
// A unit's stars: plain ★ text, or for a Blood Pact hero red drawn stars with the last one partly filled.
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>';
export function starsHtml(u: { star: number; copies?: number }): string {
  if (u.copies === undefined) return '★'.repeat(u.star);
  const { full, frac } = bloodStars(u.copies);
  const stars = Array.from({ length: full }, () => `<span class="bstar">${STAR_SVG}</span>`);
  if (frac > 0) stars.push(`<span class="bstar part"><span class="bfill" style="width:${Math.round(frac * 100)}%">${STAR_SVG}</span>${STAR_SVG}</span>`);
  return `<span class="blood-stars" title="Blood Pact: ${u.copies} copies">${stars.join('')}</span>`;
}

// Alice's Blood Pacts: uses waiting (button) and the heroes under one.
function bloodLineHtml(p: Player): string {
  const blood = p.blood;
  if (!blood) return '';
  const heroes = blood.blessed.map((id) => {
    const u = [...p.board, ...p.bench].find((x) => x?.defId === id && x.copies !== undefined);
    return `${UNIT_BY_ID[id].name} ${u ? `${starsHtml(u)} <small>${u.copies}/13</small>` : '<small>(none owned)</small>'}`;
  });
  return `<div class="altar">
    <p class="commander-text">🦇 <b>Blood Pact</b>${heroes.length ? ` · ${heroes.join(' · ')}` : ''}</p>
    ${blood.uses ? `<button class="grove-btn" data-action="openBlood">🦇 Use a Blood Pact${blood.uses > 1 ? ` (${blood.uses})` : ''}</button>` : ''}
  </div>`;
}

// Picking the hero for a Blood Pact.
export function bloodPickHtml(p: Player): string {
  const options = [...p.board, ...p.bench]
    .flatMap((u) => (u && !bloodBlock(p, u.uid) ? [u] : []))
    .map((u) => `<button class="chip" data-action="bloodPact" data-unit="${u.uid}">${UNIT_BY_ID[u.defId].name} ${starsHtml(u)}</button>`);
  return modalHtml(
    'closeBlood',
    'trait-popup',
    `<h2 class="trait-title">🦇 Blood Pact</h2>
    <p class="trait-desc">You get one more copy of the hero, and from now on its copies pile into one hero instead of merging three at a time: 1 copy 1 star, 3 copies 2 stars, 9 copies 3 stars, then 4 more copies (each +10% attack, magic attack and max HP) up to 13. Every copy raises its stats. Its stars turn red.</p>
    <div class="orb-options">${options.join('') || '<p class="meta">No hero to take it.</p>'}</div>`,
  );
}

// Lunox's Twilight Blessing: waiting to be placed (button), or where it went and what it rolled; his card's
// progress toward its gold.
function twilightLineHtml(p: Player): string {
  const tw = p.twilight;
  if (!tw) return '';
  if (tw.holder === null) {
    return `<div class="altar">
      <p class="commander-text">🌗 <b>Twilight Blessing</b> · bless a hero: +1 to one of its traits, rolled at random</p>
      <button class="grove-btn" data-action="openBless">🌗 Bless a hero</button>
    </div>`;
  }
  const unit = blessedUnit(p);
  const trait = TRAITS[tw.trait!];
  const where = unit ? `<b>${UNIT_BY_ID[unit.defId].name}</b> → +1 ${trait.icon} <b>${trait.name}</b>` : `lost (the hero is gone) · it was +1 ${trait.name}`;
  const gifts = tw.gifts?.length ? ` · gave ${tw.gifts.map((id) => UNIT_BY_ID[id].name).join(', ')}` : '';
  const rule = powersOf(p).twilightGold;
  const goal = rule
    ? ` · ${tw.paid ? `<b>${rule.gold} gold paid</b>` : `${trait.name} <b>${Math.min(rule.count, playerTraitCounts(p)[tw.trait!] ?? 0)}/${rule.count}</b> for ${rule.gold} gold`}`
    : '';
  return `<p class="commander-text">🌗 Blessed: ${where}${gifts}${goal}</p>`;
}

// Picking the hero for Lunox's blessing: any of yours, board or bench, with the traits it may roll.
export function blessPickHtml(p: Player): string {
  const options = [...p.board, ...p.bench]
    .flatMap((u) => (u && !blessBlock(p, u.uid) ? [u] : []))
    .map((u) => {
      const def = UNIT_BY_ID[u.defId];
      return `<button class="chip" data-action="bless" data-unit="${u.uid}" title="Rolls one of: ${traitNames(def.traits)}">${def.name} ${starsHtml(u)} <small>${def.traits.map((t) => TRAITS[t].icon).join(' ')}</small></button>`;
    });
  return modalHtml(
    'closeBless',
    'trait-popup',
    `<h2 class="trait-title">🌗 Twilight Blessing</h2>
    <p class="trait-desc">One of the hero's own traits is rolled at random; that hero counts +1 toward it while fielded, on top of any Magic Orb. It stays with this very hero: sell it and the blessing is gone.${powersOf(p).twilight?.heroes ? ` You also get ${powersOf(p).twilight!.heroes} random 1- or 2-cost heroes of the rolled trait.` : ''}</p>
    <div class="orb-options">${options.join('') || '<p class="meta">No hero to bless.</p>'}</div>`,
  );
}

function tricksterLineHtml(p: Player): string {
  const pw = powersOf(p);
  const parts: string[] = [];
  if (pw.deathSaves) {
    const left = pw.deathSaves - (p.deathsSaved ?? 0);
    parts.push(left > 0 ? `Survives <b>${left}</b> more knockout${left === 1 ? '' : 's'}` : 'No knockout saves left');
  }
  if (pw.hurtGold) {
    const h = pw.hurtGold;
    const { taken, paid } = p.hurt ?? { taken: 0, paid: 0 };
    parts.push(`Damage gold: <b>${paid}/${h.times}</b>${paid < h.times ? ` · next at ${taken}/${(paid + 1) * h.every} damage` : ''}`);
  }
  return parts.length ? `<p class="commander-text">${parts.join(' · ')}</p>` : '';
}

// Who holds a commander mark (Kagura's umbrella or dance), or a nudge to place it.
function markLineHtml(p: Player, kind: MarkKind): string {
  const m = MARKS[kind];
  const uid = markedUid(p, kind);
  const u = uid === null ? null : [...p.board, ...p.bench].find((x) => x?.uid === uid);
  return u
    ? `<p class="commander-text">${m.icon} ${m.name}: <b>${UNIT_BY_ID[u.defId].name} ${starsHtml(u)}</b></p>`
    : `<p class="commander-text">${m.icon} ${m.name}: nobody yet. Open a unit to place it.</p>`;
}

// Angela's automatic halo: the fielded hero with the most items.
function autoHaloLineHtml(p: Player): string {
  const uid = autoHalo(p);
  const u = uid === null ? null : p.board.find((x) => x?.uid === uid);
  return `<p class="commander-text">${MARKS.halo.icon} Most items: <b>${u ? `${UNIT_BY_ID[u.defId].name} ${starsHtml(u)}` : 'nobody fielded'}</b></p>`;
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
