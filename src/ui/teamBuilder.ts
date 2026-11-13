import { BOARD_COLS, BOARD_ROWS, MAX_ITEMS_PER_UNIT, MAX_LEVEL } from '../game/config';
import { EQUIPMENT_GROUPS, ITEMS, type ItemDef } from '../game/items';
import { playerTraitCounts, traitLevel, TRAITS } from '../game/traits';
import type { Item, MistOrb, Player, Star, Unit, UnitDef } from '../game/types';
import { UNIT_BY_ID, UNITS } from '../game/units';
import { portraitHtml } from './portraits';
import { traitBadgeHtml } from './traitBadges';
import { itemIcon } from './itemIcons';

// Team Builder (home screen): place heroes on your own board, hand them items and orbs, see the synergies,
// save the lineup. Nothing here touches a game.

export const BUILDER_CELLS = BOARD_COLS * BOARD_ROWS;
export const BUILDER_MAX_HEROES = MAX_LEVEL;

export interface BuilderHero {
  defId: string;
  items: string[]; // item ids, at most MAX_ITEMS_PER_UNIT
  orb?: string; // a trait orb: the hero counts as a member of that trait too
  star?: number; // 1-3, for show (synergies don't care); 1 when missing
}
export type BuilderBoard = (BuilderHero | null)[]; // BUILDER_CELLS long, index = board cell
export interface SavedTeam {
  name: string;
  board: BuilderBoard;
}
export type BuilderTab = 'heroes' | 'items' | 'orbs';

export const emptyBoard = (): BuilderBoard => Array(BUILDER_CELLS).fill(null);
export const heroCount = (board: BuilderBoard) => board.filter(Boolean).length;
const copyHero = (h: BuilderHero): BuilderHero => ({ defId: h.defId, items: [...h.items], ...(h.orb && { orb: h.orb }), ...(h.star && h.star > 1 && { star: h.star }) });
export const copyBoard = (board: BuilderBoard): BuilderBoard => board.map((h) => (h ? copyHero(h) : null));

// The heroes, items and orbs the builder offers. Pacquiao's gloves aren't items (used up, never held).
export const BUILDER_HEROES: UnitDef[] = UNITS.filter((u) => !u.summon && !u.monster && !u.piece).sort(
  (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
);
export const BUILDER_ITEMS: ItemDef[] = Object.values(ITEMS).filter((i) => !i.enhancedFrom);
const traitsOfKind = (kind: 'faction' | 'role') =>
  Object.values(TRAITS)
    .filter((t) => t.kind === kind)
    .sort((a, b) => a.name.localeCompare(b.name));

// --- Board edits (each returns a new board, or the same one when nothing changes) ---

// Puts a new hero on `cell` (replacing whoever's there), or on the first free cell. No room past the hero cap.
export function placeHero(board: BuilderBoard, defId: string, cell?: number): BuilderBoard {
  const at = cell ?? board.findIndex((h) => !h);
  if (at < 0 || at >= BUILDER_CELLS) return board;
  if (!board[at] && heroCount(board) >= BUILDER_MAX_HEROES) return board;
  const next = [...board];
  next[at] = { defId, items: [] };
  return next;
}

// Moves the hero on `from` to `to`, swapping with whoever's there.
export function moveHero(board: BuilderBoard, from: number, to: number): BuilderBoard {
  if (from === to || !board[from]) return board;
  const next = [...board];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function removeHero(board: BuilderBoard, cell: number): BuilderBoard {
  if (!board[cell]) return board;
  const next = [...board];
  next[cell] = null;
  return next;
}

const withHero = (board: BuilderBoard, cell: number, hero: BuilderHero): BuilderBoard => {
  const next = [...board];
  next[cell] = hero;
  return next;
};

// Why the hero on `cell` can't take this item, or null.
export function itemBlock(board: BuilderBoard, cell: number, itemId: string): string | null {
  const hero = board[cell];
  const def = ITEMS[itemId];
  if (!hero || !def) return 'Drop items on a hero';
  const unit = UNIT_BY_ID[hero.defId];
  if (hero.items.length >= MAX_ITEMS_PER_UNIT) return `${unit.name} already holds ${MAX_ITEMS_PER_UNIT} items`;
  if (def.membersOnly && def.trait && !unit.traits.includes(def.trait)) return `Only ${TRAITS[def.trait].name} heroes can hold ${def.name}`;
  if (def.forbidden && unit.traits.includes(def.forbidden)) return `${TRAITS[def.forbidden].name} heroes can't hold ${def.name}`;
  return null;
}

export function giveItem(board: BuilderBoard, cell: number, itemId: string): BuilderBoard {
  if (itemBlock(board, cell, itemId)) return board;
  return withHero(board, cell, { ...board[cell]!, items: [...board[cell]!.items, itemId] });
}

export function takeItem(board: BuilderBoard, cell: number, slot: number): BuilderBoard {
  const hero = board[cell];
  if (!hero || !hero.items[slot]) return board;
  return withHero(board, cell, { ...hero, items: hero.items.filter((_, i) => i !== slot) });
}

// Why the hero on `cell` can't take this trait's orb, or null. One orb per hero (a new one replaces it).
export function orbBlock(board: BuilderBoard, cell: number, trait: string): string | null {
  const hero = board[cell];
  // Any trait, its own included: like the game's orbs, it adds +1 to that trait either way.
  if (!hero || !TRAITS[trait]) return 'Drop orbs on a hero';
  return null;
}

export function giveOrb(board: BuilderBoard, cell: number, trait: string): BuilderBoard {
  if (orbBlock(board, cell, trait)) return board;
  return withHero(board, cell, { ...board[cell]!, orb: trait });
}

export function takeOrb(board: BuilderBoard, cell: number): BuilderBoard {
  const hero = board[cell];
  if (!hero?.orb) return board;
  const { orb: _, ...rest } = hero;
  return withHero(board, cell, rest);
}

// Steps the hero's stars 1 -> 2 -> 3 -> 1.
export function cycleStar(board: BuilderBoard, cell: number): BuilderBoard {
  const hero = board[cell];
  if (!hero) return board;
  return withHero(board, cell, { ...hero, star: ((hero.star ?? 1) % 3) + 1 });
}

// The board as a player's board, items and orbs (orbs as Mist orbs on their holders), for trait counts and
// the trait popups.
export function builderPlayer(base: Player, board: BuilderBoard): Player {
  const units: (Unit | null)[] = board.map((h, cell) => (h ? { uid: cell + 1, defId: h.defId, star: (h.star ?? 1) as Star } : null));
  let uid = 1000;
  const items: Item[] = board.flatMap((h, cell) => (h ? h.items.map((id) => ({ uid: uid++, id, tier: 1, holder: cell + 1 })) : []));
  const mistOrbs: MistOrb[] = board.flatMap((h, cell) => (h?.orb ? [{ uid: uid++, trait: h.orb, holder: cell + 1 }] : []));
  return { ...base, board: units, bench: [], items, orb: null, mistOrbs, twilight: undefined };
}

// --- Saving ---

// Saved teams from storage text; anything unreadable, or heroes, items and orbs that no longer exist, are dropped.
export function parseTeams(text: string | null): SavedTeam[] {
  try {
    const raw = JSON.parse(text ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((t): SavedTeam[] => {
      if (!t || typeof t.name !== 'string' || !Array.isArray(t.board)) return [];
      const board = emptyBoard();
      t.board.slice(0, BUILDER_CELLS).forEach((h: { defId?: unknown; items?: unknown; orb?: unknown; star?: unknown } | null, cell: number) => {
        if (!h || typeof h.defId !== 'string' || !UNIT_BY_ID[h.defId]) return;
        const items = Array.isArray(h.items) ? h.items.filter((id): id is string => typeof id === 'string' && !!ITEMS[id]) : [];
        board[cell] = { defId: h.defId, items: items.slice(0, MAX_ITEMS_PER_UNIT) };
        if (typeof h.orb === 'string' && !orbBlock(board, cell, h.orb)) board[cell]!.orb = h.orb;
        if (h.star === 2 || h.star === 3) board[cell]!.star = h.star;
      });
      return [{ name: t.name, board }];
    });
  } catch {
    return [];
  }
}

// Saves `board` as `name`, replacing a team of the same name.
export function saveTeam(teams: SavedTeam[], name: string, board: BuilderBoard): SavedTeam[] {
  const saved = { name, board: copyBoard(board) };
  const at = teams.findIndex((t) => t.name === name);
  return at < 0 ? [...teams, saved] : teams.map((t, i) => (i === at ? saved : t));
}

// --- Hero filters ---

export interface HeroFilter {
  faction: string | null;
  role: string | null;
  cost: number | null;
}
export const NO_FILTER: HeroFilter = { faction: null, role: null, cost: null };

export const filterHeroes = (f: HeroFilter): UnitDef[] =>
  BUILDER_HEROES.filter(
    (u) => (!f.faction || u.traits.includes(f.faction)) && (!f.role || u.traits.includes(f.role)) && (!f.cost || u.tier === f.cost),
  );

// --- View ---

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface BuilderView {
  board: BuilderBoard;
  tab: BuilderTab;
  filter: HeroFilter;
  filterOpen: boolean; // the filter panel is showing
  teams: SavedTeam[];
  name: string; // the name box's text
  selected: string; // the saved team last loaded or saved ('' = none)
  message: string; // last refusal (e.g. an item a hero can't hold) or confirmation
}

function boardHtml(board: BuilderBoard): string {
  const cells = board
    .map((h, cell) => {
      if (!h) return `<div class="tb-cell" data-cell="${cell}"></div>`;
      const u = UNIT_BY_ID[h.defId];
      const star = h.star ?? 1;
      const items = h.items
        .map((id, slot) => `<button class="tb-chip" data-action="tbTakeItem" data-cell="${cell}" data-slot="${slot}" title="${ITEMS[id].name} (click to remove)">${itemIcon(id)}</button>`)
        .join('');
      const orb = h.orb
        ? `<button class="tb-orb" data-action="tbTakeOrb" data-cell="${cell}" title="${TRAITS[h.orb].name} orb (click to remove)">${traitBadgeHtml(h.orb)}</button>`
        : '';
      return `<div class="tb-cell filled tier-${u.tier}" data-cell="${cell}">
        <button class="tb-stars s${star}" data-action="tbStar" data-cell="${cell}" title="Stars (click to change)">${'★'.repeat(star)}</button>
        ${orb}
        <div class="tb-unit" draggable="true" data-drag="board:${cell}" title="${u.name}: drag to move, drag off the board or right-click to remove">${portraitHtml(u.id, 'tb-face')}</div>
        <div class="tb-chips">${items}</div>
      </div>`;
    })
    .join('');
  return `<div class="tb-board" style="--cols:${BOARD_COLS}">${cells}</div>`;
}

function filterPanelHtml(f: HeroFilter): string {
  const chip = (key: keyof HeroFilter, value: string | number, label: string, title: string) =>
    `<button class="tb-filter${f[key] === value ? ' on' : ''}" data-action="tbFilter" data-key="${key}" data-value="${value}" title="${title}">${label}</button>`;
  const costs = [...new Set(BUILDER_HEROES.map((u) => u.tier))].map((c) => chip('cost', c, `💰${c}`, `${c} gold`)).join('');
  const traits = (kind: 'faction' | 'role') =>
    traitsOfKind(kind)
      .map((t) => chip(kind, t.id, `${traitBadgeHtml(t.id)}<small>${t.name}</small>`, t.name))
      .join('');
  return `<div class="tb-filter-panel">
    <div class="tb-filter-row"><b>Cost</b>${costs}</div>
    <div class="tb-filter-row"><b>Faction</b>${traits('faction')}</div>
    <div class="tb-filter-row"><b>Role</b>${traits('role')}</div>
  </div>`;
}

// The filter button and the filters in use (click one to drop it).
function filterBarHtml(v: BuilderView): string {
  const f = v.filter;
  const tag = (key: keyof HeroFilter, label: string) =>
    `<button class="tb-tag" data-action="tbFilter" data-key="${key}" data-value="${f[key]}" title="Remove this filter">${label}<i>✕</i></button>`;
  const tags = [
    f.cost ? tag('cost', `💰${f.cost}`) : '',
    f.faction ? tag('faction', `${traitBadgeHtml(f.faction)} ${TRAITS[f.faction].name}`) : '',
    f.role ? tag('role', `${traitBadgeHtml(f.role)} ${TRAITS[f.role].name}`) : '',
  ].join('');
  return `<div class="tb-filter-bar">
    <button class="tb-filter-btn${v.filterOpen ? ' on' : ''}" data-action="tbFilterOpen" title="Filter heroes">⏷ Filter</button>
    ${tags}
    ${tags ? '<button class="tb-tag clear" data-action="tbFilterClear">Clear filters</button>' : ''}
  </div>`;
}

function heroPoolHtml(board: BuilderBoard, f: HeroFilter): string {
  const on = new Set(board.flatMap((h) => (h ? [h.defId] : [])));
  const cards = filterHeroes(f)
    .map(
      (u) => `<div class="tb-hero tier-${u.tier}${on.has(u.id) ? ' in' : ''}" draggable="true" data-drag="hero:${u.id}" data-action="tbAdd" data-hero="${u.id}"
        title="${u.name} (${u.tier} gold) · ${u.traits.map((id) => TRAITS[id].name).join(', ')}">
      ${portraitHtml(u.id, 'tb-face')}
      <span class="tb-hero-cost">${u.tier}</span>
      <small class="tb-hero-name">${u.name}</small>
    </div>`,
    )
    .join('');
  return cards || '<p class="tb-empty">No hero matches these filters.</p>';
}

// Items by where they come from: basic, each equipment group, commander items, then each trait's items.
function itemPoolHtml(): string {
  const card = (i: ItemDef) =>
    `<div class="tb-pool-item" draggable="true" data-drag="item:${i.id}" title="${i.name}: drag onto a hero">
      <span class="tb-pool-icon">${itemIcon(i.id)}</span><small>${i.name}</small>
    </div>`;
  const section = (title: string, list: ItemDef[]) => (list.length ? `<h4 class="tb-pool-section">${title}</h4>${list.map(card).join('')}` : '');
  const all = BUILDER_ITEMS;
  const traitIds = [...new Set(all.flatMap((i) => (i.trait ? [i.trait] : [])))];
  return (
    section('Basic', all.filter((i) => i.basic)) +
    EQUIPMENT_GROUPS.map((g) => section(g.name, all.filter((i) => !i.trait && !i.basic && !i.exclusive && i.group === g.id))).join('') +
    section('Commander items', all.filter((i) => i.exclusive)) +
    traitIds.map((t) => section(`${TRAITS[t].name} items`, all.filter((i) => i.trait === t))).join('')
  );
}

// One orb per trait: dropped on a hero, it counts as a member of that trait too.
function orbPoolHtml(): string {
  const card = (id: string) =>
    `<div class="tb-pool-item" draggable="true" data-drag="orb:${id}" title="${TRAITS[id].name} orb: drag onto a hero to make it ${TRAITS[id].name} too">
      <span class="tb-pool-icon">${traitBadgeHtml(id)}</span><small>${TRAITS[id].name}</small>
    </div>`;
  return (
    '<p class="tb-pool-note">Drop an orb on a hero: it counts as that synergy too. One orb per hero.</p>' +
    `<h4 class="tb-pool-section">Factions</h4>${traitsOfKind('faction').map((t) => card(t.id)).join('')}` +
    `<h4 class="tb-pool-section">Roles</h4>${traitsOfKind('role').map((t) => card(t.id)).join('')}`
  );
}

// Every trait the board touches (orbs included), active first: icon, count / next goal, one bar per breakpoint.
function synergiesHtml(p: Player): string {
  const rows = Object.entries(playerTraitCounts(p))
    .map(([id, n]) => ({ id, n, lvl: traitLevel(id, n) }))
    .sort((a, b) => b.lvl - a.lvl || b.n - a.n || TRAITS[a.id].name.localeCompare(TRAITS[b.id].name))
    .map(({ id, n, lvl }) => {
      const t = TRAITS[id];
      const goal = t.breakpoints[lvl] ?? t.breakpoints[t.breakpoints.length - 1];
      const bars = t.breakpoints.map((bp, i) => `<i class="${i < lvl ? 'on' : ''}" title="${bp}"></i>`).join('');
      return `<button class="tb-trait${lvl ? ' active' : ''}" data-trait="${id}" title="${t.name}: ${t.breakpoints.join(' / ')}">
        <span class="tb-trait-icon">${traitBadgeHtml(id)}</span>
        <span class="tb-trait-text">
          <b>${n}/${goal}</b>
          <small>${t.name}</small>
          <span class="tb-bars">${bars}</span>
        </span>
      </button>`;
    })
    .join('');
  return rows || '<p class="tb-empty">Put heroes on the board to see their synergies.</p>';
}

function savedHtml(v: BuilderView): string {
  if (!v.teams.length) return '<p class="tb-empty">No saved teams yet.</p>';
  return v.teams
    .map(
      (t, i) => `<li class="${String(i) === v.selected ? 'on' : ''}">
        <button class="tb-load" data-action="tbLoad" data-index="${i}" title="Load">
          <b>${escapeHtml(t.name)}</b>
          <span>${t.board.flatMap((h) => (h ? [portraitHtml(h.defId, 'tiny')] : [])).join('')}</span>
        </button>
        <button class="tb-del" data-action="tbDelete" data-index="${i}" title="Delete">✕</button>
      </li>`,
    )
    .join('');
}

export function teamBuilderHtml(v: BuilderView, p: Player): string {
  const count = heroCount(v.board);
  const tab = (id: BuilderTab, icon: string, label: string) =>
    `<button class="tb-tab${v.tab === id ? ' on' : ''}" data-action="tbTab" data-tab="${id}"><span>${icon}</span>${label}</button>`;
  const pool = v.tab === 'heroes' ? heroPoolHtml(v.board, v.filter) : v.tab === 'items' ? itemPoolHtml() : orbPoolHtml();
  return `<div class="team-builder">
    <div class="tb-left">
      <header class="tb-head">
        <button class="tb-back" data-action="home" title="Back">‹</button>
        <form class="tb-name">
          <input name="teamName" placeholder="Untitled team" maxlength="40" value="${escapeHtml(v.name)}" title="Team name" />
          <span class="tb-pen">✏️</span>
        </form>
        <span class="tb-message">${escapeHtml(v.message)}</span>
        <span class="tb-count" title="Heroes on the board">🧍 ${count}<small>/${BUILDER_MAX_HEROES}</small></span>
      </header>
      <section class="tb-board-wrap">${boardHtml(v.board)}</section>
      ${v.tab === 'heroes' ? filterBarHtml(v) : '<div class="tb-filter-bar"></div>'}
      <section class="tb-pool">
        <nav class="tb-tabs">${tab('heroes', '🦸', 'Hero')}${tab('items', '🎒', 'Equipment')}${tab('orbs', '🔮', 'Orbs')}</nav>
        <div class="tb-pool-main">
          ${v.tab === 'heroes' && v.filterOpen ? filterPanelHtml(v.filter) : ''}
          <div class="tb-pool-list ${v.tab}" data-keep-scroll="tb-pool-${v.tab}">${pool}</div>
        </div>
      </section>
    </div>
    <aside class="tb-right">
      <div class="tb-actions">
        <button class="tb-icon-btn" data-action="tbClear" ${count ? '' : 'disabled'}><span>🗑️</span>Clear</button>
        <button class="tb-save" data-action="tbSave" ${count ? '' : 'disabled'}>Save</button>
      </div>
      <div class="tb-side">
        <div class="tb-traits" data-keep-scroll="tb-traits">${synergiesHtml(p)}</div>
        <hr />
        <h3>Saved teams</h3>
        <ul class="tb-saved" data-keep-scroll="tb-saved">${savedHtml(v)}</ul>
      </div>
    </aside>
  </div>`;
}

// --- In game: the Lineups panel (a saved team as a guide for shopping and placing) ---

export const TEAMS_KEY = 'autochess.builderTeams';
export const loadSavedTeams = (): SavedTeam[] => parseTeams(localStorage.getItem(TEAMS_KEY));

// A lineup's plan: board cell -> hero meant to stand there.
export const lineupGuide = (team: SavedTeam) => team.board.flatMap((h, cell) => (h ? [{ cell, defId: h.defId }] : []));

// Every saved team; `active` is the loaded one's name. Faces of heroes you own are lit, ✓ when already on their cell.
export function lineupPanelHtml(teams: SavedTeam[], active: string | null, p: Player): string {
  const owned = new Set([...p.board, ...p.bench].flatMap((u) => (u ? [u.defId] : [])));
  const rows = teams
    .map((t, i) => {
      const on = t.name === active;
      const faces = t.board
        .flatMap((h, cell) => {
          if (!h) return [];
          const placed = p.board[cell]?.defId === h.defId;
          const name = UNIT_BY_ID[h.defId].name;
          return [
            `<span class="lineup-face${owned.has(h.defId) ? ' owned' : ''}${placed ? ' placed' : ''}" title="${name}${placed ? ': in place' : owned.has(h.defId) ? ': owned' : ''}">${portraitHtml(h.defId, 'tiny')}</span>`,
          ];
        })
        .join('');
      return `<li class="${on ? 'on' : ''}">
        <button class="lineup-pick" data-action="loadLineup" data-index="${i}" title="${on ? 'Loaded: click to unload' : 'Load as a guide'}">
          <b>${on ? '👍 ' : ''}${escapeHtml(t.name)}</b>
          <span class="lineup-faces">${faces}</span>
        </button>
      </li>`;
    })
    .join('');
  return `<aside class="lineups">
    <h3>Lineups</h3>
    ${
      teams.length
        ? `<p class="lineups-hint">Load one: its heroes get a 👍 in the shop, and their cells glow on the board.</p><ul>${rows}</ul>`
        : '<p class="lineups-hint">No saved lineups. Make one in the Team Builder on the home screen.</p>'
    }
    ${active ? '<button class="lineups-unload" data-action="unloadLineup">Unload</button>' : ''}
  </aside>`;
}
