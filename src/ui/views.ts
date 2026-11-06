import { BASE_INCOME, REROLL_COST, TICKS_PER_SECOND } from '../game/config';
import { type AuraGrant, auraGrants, effectiveTier, fieldLeaders, fieldStats, heldBy, leadsOf } from '../game/inventory';
import { cardItem, isItemCard, ITEMS, type ItemDef } from '../game/items';
import { MIST_WARES, mistCoins, orbBlock } from '../game/mistShop';
import { orbOptions } from '../game/orb';
import { SKILLS } from '../game/skills';
import { copiesOf, findCopies } from '../game/merge';
import { boardCount, freeSlotCount, interest, levelUpCost, xpToNext } from '../game/player';
import { attackInterval, type StatKey, type StatMod, type Stats } from '../game/stats';
import { fieldedMistOrbs, playerTraitCounts, playerTraits, traitCounts, traitLevel, TRAITS, unitStats } from '../game/traits';
import type { GameState, Item, Player, UnitDef } from '../game/types';
import { UNIT_BY_ID, UNITS } from '../game/units';

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
  // Units that carry a trait's bonuses themselves (e.g. the Plane Wanderer) get one too; it opens their card.
  const honoraryUnits = p.board
    .flatMap((u) => (u && UNIT_BY_ID[u.defId].honorary ? [u] : []))
    .map((u) => {
      const h = UNIT_BY_ID[u.defId].honorary!;
      return `<button class="trait-tile bearer${levels[h.trait] ? ' active' : ''}" data-select-unit="${u.uid}" title="${UNIT_BY_ID[u.defId].name}: ${TRAITS[h.trait].name} bonus, doesn't count">
        <span class="trait-icon">${h.icon}</span>
        <span class="trait-count">1/1</span>
      </button>`;
    })
    .join('');
  return `<aside class="traits">${tiles + bearers + honoraryUnits || '<p class="traits-empty">No synergies yet</p>'}</aside>`;
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
        <span class="unit-name"><button class="unit-link" data-unit-info="${u.id}">${u.name}</button>${u.shop === false ? ` <small class="unit-tag">${mine ? 'yours' : 'not in shop'}</small>` : ''}</span>
        <span class="unit-traits">${chips}</span>
      </li>`;
  };
  const byCost = (a: UnitDef, b: UnitDef) => a.tier - b.tier || a.name.localeCompare(b.name);
  const units = UNITS.filter((u) => u.traits.includes(traitId)).sort(byCost).map(row).join('');
  const bearers = UNITS.filter((u) => u.honorary?.trait === traitId).sort(byCost).map(row).join('');
  return `<${heading} class="trait-title"><span class="trait-icon">${t.icon}</span> ${t.name} <small>${t.kind} · ${n} on board</small></${heading}>
    <div class="trait-bps">${bps}</div>
    <p class="trait-desc">${descHtml(t, lvl)}</p>
    ${chosen[traitId] ? `<p class="trait-stacks">👑 This game: <b>${UNIT_BY_ID[chosen[traitId]].name}</b></p>` : ''}
    ${t.leader ? leaderLineHtml(traitId, p) : ''}
    ${p.orb?.trait === traitId ? `<p class="trait-stacks">🔮 Orb: <b>${UNIT_BY_ID[p.orb.defId].name}</b> counts +1</p>` : ''}
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
  const name = unit ? UNIT_BY_ID[unit].name : 'rolled when it first appears';
  const rewards = (rule.rewards ?? [])
    .map((r, i) => `<li class="${i < claimed ? 'done' : ''}">${r.at}: ${name} ${'★'.repeat(r.star)}${i < claimed ? ' ✓' : ''}</li>`)
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
      return `${TRAITS[o.trait].icon} ${holder ? `on ${UNIT_BY_ID[holder.defId].name}` : 'in inventory: open a unit to put it on'}`;
    }),
  ].filter(Boolean);
  return `<section class="side-shop">
    <button class="side-shop-head" data-trait="${t.id}">${t.icon} ${t.sideShop!.title}</button>
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
          .map((t) => `<button class="chip" data-action="mistPick" data-choice="${t.id}">${t.icon} ${t.name}</button>`);
  return modalHtml(
    'closeMistPick',
    'trait-popup',
    `<h2 class="trait-title">${w.icon} ${w.name} <small>${w.price} Mist coins</small></h2>
    <p class="trait-desc">${w.desc}</p>
    <div class="orb-options">${options.join('') || '<p class="meta">Nothing to pick.</p>'}</div>`,
  );
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
        <span class="grave-icon">${TRAITS[id].icon}</span>
        <b class="grave-count">${n}</b>
        <small>${next ? `next ${next.at}: ${'★'.repeat(next.star)}` : 'complete'}</small>
        ${reward ? `<span class="grave-unit" data-unit-info="${reward.id}" title="Your reward unit: click to see it">${reward.honorary?.icon ?? '🎁'} ${reward.name}</span>` : ''}
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
  `<button class="trait-chip bearer-chip" data-trait="${h.trait}" title="Gets the ${TRAITS[h.trait].name} bonus, doesn't count">${h.icon} ${TRAITS[h.trait].name} bearer</button>`;

// A small button naming a trait; clicking it opens that trait's popup.
const traitChipHtml = (id: string) =>
  `<button class="trait-chip" data-trait="${id}" title="${TRAITS[id].name}">${TRAITS[id].icon} ${TRAITS[id].name}</button>`;

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
    id === null ? '<span class="grid-none">none</span>' : `<button class="grid-head" data-trait="${id}" title="${TRAITS[id].name}">${TRAITS[id].icon}<span>${TRAITS[id].name}</span></button>`;
  const cell = (role: string | null, faction: string | null) =>
    UNITS.filter((u) => !u.summon && has(traitsOf(u), role, 'role') && has(traitsOf(u), faction, 'faction'))
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))
      .map((u) => {
        const bearer = u.honorary && u.honorary.trait === faction ? `${u.honorary.icon} ` : '';
        const note = bearer ? ` · ${TRAITS[u.honorary!.trait].name} bearer, not in shop` : '';
        return `<button class="grid-unit tier-${u.tier}${owned.has(u.id) ? ' owned' : ''}" data-unit-info="${u.id}" title="${u.tier}g${note}">${bearer}${u.name}</button>`;
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
  <p class="grid-legend">Colour = cost (${[1, 2, 3, 4, 5, 7].map((t) => `<span class="grid-unit tier-${t}">${t}g</span>`).join(' ')}) · bold = on your board · 🧭 = Plane Wanderer (Necromancer reward, not in shop) · click a trait or unit to open it</p>`;
}

// True if buying some card in the shop right now completes a merge.
const shopHasUpgrade = (p: Player) => p.shop.some((id) => id && !isItemCard(id) && findCopies(p, id, 1).length >= 2);

// The bar under the bench: opens the shop, levels up, fights. Drop a unit on it to sell.
export function shopBarHtml(p: Player, locked: boolean): string {
  const levelCost = levelUpCost(p);
  const levelBtn =
    levelCost === null
      ? `<button disabled title="Max level">🏅 max</button>`
      : `<button data-action="levelUp" title="Level up" ${locked || p.gold < levelCost ? 'disabled' : ''}>⏫ ${levelCost}g <kbd>F</kbd></button>`;
  const upgrade = shopHasUpgrade(p);
  return `<section class="shop-bar" data-sell title="Drop a unit here to sell it">
    <button data-action="openShop" class="shop-open${upgrade ? ' upgrade' : ''}" title="Open the shop">
      🛒 Shop${p.shopLocked ? ' 🔒' : ''}${upgrade ? ' <span class="up" title="A card in the shop makes a 2-star">★★</span>' : ''} <kbd>S</kbd>
    </button>
    ${levelBtn}
    ${
      locked
        ? `<button data-action="skip" class="primary" title="Skip fight">⏭️ <kbd>Space</kbd></button>`
        : `<button data-action="endTurn" class="primary" title="Fight!">⚔️ <kbd>Space</kbd></button>`
    }
  </section>`;
}

// The shop popup: the cards, lock, reroll and level up. It stays open while you buy.
export function shopPopupHtml(p: Player, locked: boolean, chosen: Record<string, string>): string {
  return modalHtml(
    'closeShop',
    'shop-popup',
    `<h2 class="trait-title">🛒 Shop <small>💰 ${p.gold}g</small></h2>
    ${shopHtml(p, locked, chosen)}`,
  );
}

export function shopHtml(p: Player, locked: boolean, chosen: Record<string, string>): string {
  const counts = playerTraitCounts(p);
  const cards = p.shop
    .map((id, slot) => {
      if (!id) return `<div class="shop-card empty"></div>`;
      if (isItemCard(id)) {
        const item = ITEMS[cardItem(id)];
        const tier = p.items.find((it) => it.id === item.id)?.tier ?? 0;
        return `<button class="shop-card item-card" data-action="buy" data-slot="${slot}" ${locked ? 'disabled' : ''} title="${item.name} tier ${tier + 1}: ${itemText(item, tier + 1)}">
          <span class="shop-top"><b class="cost">Free</b><span class="owned">upgrade</span></span>
          <span class="unit-name">${item.icon} ${item.name}</span>
          <span class="traits"><span class="shop-trait">Tier ${tier} → ${tier + 1}</span></span>
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
          return `<span class="shop-trait${gain ? ' have' : ''}"><span class="t-name">${TRAITS[t].icon} ${TRAITS[t].name}</span>${gain}</span>`;
        })
        .join('');
      return `<button class="shop-card tier-${def.tier}${upgrade ? ' upgrade' : ''}" data-action="buy" data-slot="${slot}" ${locked || p.gold < def.tier ? 'disabled' : ''}>
        <span class="shop-top"><b class="cost">${def.tier}g</b>${upgrade ? '<span class="up" title="Buying this makes a 2-star">★★</span>' : owned ? `<span class="owned">own ${owned}</span>` : ''}</span>
        <span class="unit-name">${isChosen(chosen, id) ? '👑 ' : ''}${def.name}</span>
        <span class="traits">${traits || '<span class="shop-trait none">no traits</span>'}</span>
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
  return `<section class="shop${p.shopLocked ? ' locked' : ''}">
    <div class="shop-cards">${cards}</div>
    <div class="shop-buttons">
      ${lockBtn}
      <button data-action="reroll" title="Reroll the shop" ${disabled}>🔄 ${REROLL_COST}g <kbd>D</kbd></button>
      ${levelBtn}
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
      return `<div class="item-chip${tier ? '' : ' inactive'}${holder ? ' equipped' : ''}${it.uid === selectedItem ? ' selected' : ''}" data-item="${it.uid}"
        title="${def.name} (${state}). ${itemText(def, tier || it.tier)}${grant ? ` Now: ${auraText(grant)}.` : ''}">
        <span class="item-icon">${def.icon}</span><b>T${tier || it.tier}</b>
        ${holder ? `<small>${UNIT_BY_ID[holder.defId].name}</small>` : ''}
        ${grant ? `<small class="aura-line">+${grant.amount}</small>` : ''}
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
    ${stat('♟️', 'Units on board / max', `<b>${boardCount(p)}/${p.level}${freeSlotCount(p) ? ` +${freeSlotCount(p)}` : ''}</b>`)}
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
    ...[...honorary, ...(def.honorary ? [def.honorary] : [])].map(
      (g) => `<button class="chip" data-trait="${g.trait}" title="Gets the bonuses, doesn't count">${g.icon} ${TRAITS[g.trait].name} bearer</button>`,
    ),
    ...(area === 'board' ? leadsOf(p, levels, uid) : []).map(
      (id) => `<button class="chip" data-trait="${id}">${TRAITS[id].leader!.icon} ${TRAITS[id].leader!.title}</button>`,
    ),
  ].join('');

  return `<section class="unit-detail tier-${def.tier}">
    <button class="close" data-action="closeUnit" aria-label="Close">×</button>
    <h3>${isChosen(chosen, def.id) ? '👑 ' : ''}${def.name} <span class="unit-star">${'★'.repeat(u.star)}</span></h3>
    <p class="meta">${def.tier}g · ${position}${area === 'bench' ? ' · on bench' : ''}</p>
    ${traits ? `<div class="chips">${traits}</div>` : ''}
    ${p.orb?.defId === def.id ? `<p class="orb-line">🔮 Orb: +1 ${TRAITS[p.orb.trait].icon} ${TRAITS[p.orb.trait].name}${area === 'bench' ? ' (when fielded)' : ''}</p>` : ''}
    ${p.orbs.length ? `<button class="orb-use" data-action="openOrb" data-unit="${uid}">🔮 Use Magic Orb</button>` : ''}
    ${(p.mistOrbs ?? [])
      .filter((o) => o.holder === uid)
      .map(
        (o) => `<p class="orb-line">🌫️ Mist orb: +1 ${TRAITS[o.trait].icon} ${TRAITS[o.trait].name}${area === 'bench' ? ' (when fielded)' : ''}
          <button class="chip" data-action="unequipMistOrb" data-orb="${o.uid}" title="Back to the inventory">✕</button></p>`,
      )
      .join('')}
    ${(p.mistOrbs ?? [])
      .filter((o) => o.holder !== uid)
      .map((o) => {
        const block = orbBlock(p, uid);
        const from = [...p.board, ...p.bench].find((u) => u?.uid === o.holder);
        return `<button class="orb-use" data-action="equipMistOrb" data-orb="${o.uid}" data-unit="${uid}" ${block ? `disabled title="${block}"` : ''}>🌫️ ${from ? 'Move' : 'Put'} Mist orb here: +1 ${TRAITS[o.trait].icon} ${TRAITS[o.trait].name}${from ? ` (from ${UNIT_BY_ID[from.defId].name})` : ''}</button>`;
      })
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
    `<h2 class="trait-title tier-${def.tier}"><span class="unit-info-cost">${def.tier}g</span> ${def.name}</h2>
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

// A player's active synergies, strongest first: icon and the breakpoint reached. Each opens its trait.
function synergyChipsHtml(p: Player): string {
  const counts = playerTraitCounts(p);
  const chips = Object.entries(playerTraits(p))
    .map(([id, lvl]) => ({ t: TRAITS[id], lvl, n: counts[id] ?? 0 }))
    .sort((a, b) => b.lvl - a.lvl || b.n - a.n || a.t.name.localeCompare(b.t.name))
    .map(({ t, lvl, n }) => `<button class="opp-trait" data-trait="${t.id}" title="${t.name} ${n} (level ${t.breakpoints[lvl - 1]})">${t.icon}<b>${t.breakpoints[lvl - 1]}</b></button>`)
    .join('');
  return chips ? `<span class="opp-traits">${chips}</span>` : '';
}

export function playersHtml(others: Player[], shownHp: (p: Player) => number, opponentId: string | null): string {
  const rows = others
    .slice()
    .sort((a, b) => shownHp(b) - shownHp(a) || (a.place ?? 0) - (b.place ?? 0))
    .map((o) => {
      const hp = shownHp(o);
      const cls = [hp <= 0 ? 'out' : '', o.id === opponentId ? 'current' : ''].join(' ');
      const info = hp <= 0 ? `#${o.place}` : `${hp} HP · Lv ${o.level} · ${boardCount(o)} units`;
      return `<li class="${cls}"><span class="opp-name">${o.name}</span><span class="opp-info">${info}</span>${hp > 0 ? synergyChipsHtml(o) : ''}</li>`;
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
