import { BOARD_COLS, BOARD_ROWS, REROLL_COST, TICKS_PER_SECOND, XP_COST } from '../game/config';
import type { Fight } from '../game/game';
import { boardToGrid, GRID_H, GRID_W, gridIndex, viewPoint } from '../game/grid';
import { copiesOf, findCopies } from '../game/merge';
import { boardCount, xpToNext } from '../game/player';
import type { Stats } from '../game/stats';
import { activeTraits, TRAITS, traitCounts, traitLevel, traitTiles, unitStats } from '../game/traits';
import type { GameState, Loc, Player, Unit } from '../game/types';
import { UNIT_BY_ID, UNITS } from '../game/units';

// Pure HTML builders. No state, no DOM access: app.ts decides what to show.

export const traitNames = (ids: string[], sep = ', ') => ids.map((id) => TRAITS[id].name).join(sep);
const traitLabels = (ids: string[]) => ids.map((id) => `${TRAITS[id].icon} ${TRAITS[id].name}`).join(' · ');

// Inside of a unit chip, shared by board, bench and combat: trait icons, name, stars.
export function unitBodyHtml(defId: string, star: number, crowned = false): string {
  const def = UNIT_BY_ID[defId];
  return `<span class="unit-traits">${def.traits.map((id) => TRAITS[id].icon).join('')}</span>
    ${crowned ? '<span class="chosen-badge" title="Protagonist">👑</span>' : ''}
    <span class="unit-name">${def.name}</span>
    <span class="unit-star">${'★'.repeat(star)}</span>`;
}

const tileClass = (tiles: Map<number, string>, i: number) => (tiles.has(i) ? ` tile tile-${tiles.get(i)}` : '');

export function unitHtml(u: Unit, loc: Loc, selected = false, chosen: Record<string, string> = {}): string {
  const def = UNIT_BY_ID[u.defId];
  const traits = traitNames(def.traits);
  return `<div class="unit tier-${def.tier}${selected ? ' selected' : ''}" draggable="true" data-uid="${u.uid}" data-area="${loc.area}" data-index="${loc.index}"
    title="${def.name}${traits ? ` (${traits})` : ''}">
    ${unitBodyHtml(u.defId, u.star, isChosen(chosen, u.defId))}
  </div>`;
}

const isChosen = (chosen: Record<string, string>, defId: string) => Object.values(chosen).includes(defId);

export function slotsHtml(slots: (Unit | null)[], area: Loc['area'], selectedUid: number | null, chosen: Record<string, string>): string {
  const tiles = area === 'board' ? traitTiles(activeTraits(slots)) : new Map<number, string>();
  return slots
    .map(
      (u, index) =>
        `<div class="cell${tileClass(tiles, index)}" data-area="${area}" data-index="${index}">${u ? unitHtml(u, { area, index }, u.uid === selectedUid, chosen) : ''}</div>`,
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
export function traitsPanelHtml(board: (Unit | null)[]): string {
  const counts = traitCounts(board);
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
  return `<aside class="traits">${tiles || '<p class="traits-empty">No synergies yet</p>'}</aside>`;
}

// Fills a trait's {placeholders} with every level's value, the active level's highlighted.
function traitDescHtml(traitId: string, lvl: number): string {
  const t = TRAITS[traitId];
  const values = t.values();
  return t.desc.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key].map((v, i) => `<span class="${i === lvl - 1 ? 'on' : ''}">${v}</span>`).join('<i> / </i>'),
  );
}

// Popup for one trait: breakpoints, one description, and every unit that has it (yours highlighted).
// Title plus everything about a trait, measured against `board`. Shared by the single-trait
// popup and the gallery so the two never drift apart.
function traitCardHtml(traitId: string, p: Player, chosen: Record<string, string>, heading: 'h2' | 'h3'): string {
  const { board } = p;
  const t = TRAITS[traitId];
  const n = traitCounts(board)[traitId] ?? 0;
  const lvl = traitLevel(traitId, n);
  const owned = new Set(board.flatMap((u) => (u ? [u.defId] : [])));
  const bps = t.breakpoints.map((b, i) => `<span class="${i < lvl ? 'on' : ''}${i === lvl - 1 ? ' current' : ''}">${b}</span>`).join('');
  const units = UNITS.filter((u) => u.traits.includes(traitId))
    .sort((a, b) => a.tier - b.tier)
    .map((u) => `<li class="tier-${u.tier}${owned.has(u.id) ? ' owned' : ''}">${u.name} <small>${u.tier}g</small></li>`)
    .join('');
  return `<${heading} class="trait-title"><span class="trait-icon">${t.icon}</span> ${t.name} <small>${t.kind} · ${n} on board</small></${heading}>
    <div class="trait-bps">${bps}</div>
    <p class="trait-desc">${traitDescHtml(traitId, lvl)}</p>
    ${chosen[traitId] ? `<p class="trait-stacks">👑 This game: <b>${UNIT_BY_ID[chosen[traitId]].name}</b></p>` : ''}
    ${t.stacks ? `<p class="trait-stacks">Stacks: <b>${p.stacks[traitId] ?? 0}</b> / ${t.stacks.max}</p>` : ''}
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
  return `<section class="shop" title="Drop a unit here to sell it">
    <div class="shop-cards">${cards}</div>
    <div class="shop-buttons">
      <button data-action="reroll" ${disabled}>Reroll (${REROLL_COST}g) <kbd>D</kbd></button>
      <button data-action="buyXp" ${disabled}>Buy XP (${XP_COST}g) <kbd>F</kbd></button>
      ${
        locked
          ? `<button data-action="skip" class="primary">Skip fight <kbd>Space</kbd></button>`
          : `<button data-action="endTurn" class="primary">Fight! <kbd>Space</kbd></button>`
      }
    </div>
  </section>`;
}

export function hudHtml(state: GameState, p: Player, hp: number, opponentName: string | null): string {
  const need = xpToNext(p);
  return `<header class="hud">
    <span>Round <b>${state.round}</b></span>
    <span>HP <b>${hp}</b></span>
    <span>Gold <b>${p.gold}</b></span>
    <span>Level <b>${p.level}</b> ${need === null ? '(max)' : `(${p.xp}/${need} xp)`}</span>
    <span>Board <b>${boardCount(p)}/${p.level}</b></span>
    ${opponentName ? `<span class="vs">vs <b>${opponentName}</b></span>` : ''}
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
  // Bench units don't fight, so only fielded ones get trait bonuses. Chosen units are only picked in combat.
  const s = area === 'board' ? unitStats(def, u.star, { levels: activeTraits(p.board), cell, chosen, stacks: p.stacks }) : base;

  const fmt = (n: number) => String(+n.toFixed(2));
  const row = (label: string, key: keyof Stats, show = (n: number) => fmt(n)) => {
    const diff = s[key] - base[key];
    const bonus = Math.abs(diff) > 1e-9 ? `<em>${diff > 0 ? '+' : ''}${show(diff)}</em>` : '';
    return `<dt>${label}</dt><dd>${show(s[key])} ${bonus}</dd>`;
  };
  const optional = (label: string, key: keyof Stats, show?: (n: number) => string) => (s[key] ? row(label, key, show) : '');
  const perSec = (ticks: number) => (TICKS_PER_SECOND / ticks).toFixed(2);
  const position = def.range <= 1 ? 'Frontline · melee' : `Backline · range ${def.range}`;
  const traits = def.traits.map((id) => `<button class="chip" data-trait="${id}">${TRAITS[id].icon} ${TRAITS[id].name}</button>`).join('');

  return `<section class="unit-detail tier-${def.tier}">
    <button class="close" data-action="closeUnit" aria-label="Close">×</button>
    <h3>${isChosen(chosen, def.id) ? '👑 ' : ''}${def.name} <span class="unit-star">${'★'.repeat(u.star)}</span></h3>
    <p class="meta">${def.tier}g · ${position}${area === 'bench' ? ' · on bench' : ''}</p>
    ${traits ? `<div class="chips">${traits}</div>` : ''}
    <dl>
      ${row('HP', 'hp')}
      ${row('Attack', 'atk')}
      <dt>Attack speed</dt><dd>${perSec(s.attackTicks)}/s</dd>
      ${row('Range', 'range')}
      ${row('Armor', 'armor')}
      ${row('Magic resist', 'mr')}
      ${row('Mana', 'maxMana')}
      ${optional('Mana regen', 'manaRegen', (n) => `${fmt(n)}/s`)}
      ${optional('Damage amp', 'damageAmp', (n) => `${fmt(n * 100)}%`)}
      ${optional('Armor shred', 'armorShred')}
      ${optional('Crit chance', 'critChance', (n) => `${fmt(n * 100)}%`)}
      ${s.critChance ? row('Crit damage', 'critDamage', (n) => `${fmt(n * 100)}%`) : ''}
    </dl>
    <h4>Skill <small>placeholder</small></h4>
    <p class="skill">At full mana, the next attack deals ${Math.round(s.castMult * 100)}% attack (${Math.round(s.atk * s.castMult)}) as magic damage.</p>
    <p class="meta">Sells for ${def.tier * copiesOf(u)}g</p>
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
