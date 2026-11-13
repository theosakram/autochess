import { createGame } from '../game/game';
import type { BotLevel, Player, PowerTier } from '../game/types';
import {
  BUILDER_MAX_HEROES,
  type BuilderTab,
  type BuilderView,
  builderPlayer,
  copyBoard,
  cycleStar,
  emptyBoard,
  giveItem,
  giveOrb,
  type HeroFilter,
  NO_FILTER,
  orbBlock,
  itemBlock,
  moveHero,
  parseTeams,
  placeHero,
  removeHero,
  saveTeam,
  takeItem,
  takeOrb,
  teamBuilderHtml,
  TEAMS_KEY,
} from './teamBuilder';
import { layoutMasonry } from './masonry';
import { DIFFICULTIES, homeGalleryHtml, homeHtml, type HomeTab, itemInfoHtml, pickLevel, traitDetailHtml, unitInfoHtml } from './views';

// The screen before a game: Play, browse the gallery (heroes, commanders, items, synergies), or try out
// lineups in the Team Builder. Resolves with the bot difficulty once Play is clicked; by then its listeners
// are gone and `root` is empty. The difficulty picked and the saved teams are remembered.
const DIFFICULTY_KEY = 'autochess.difficulty';
const DRAFT_KEY = 'autochess.builderDraft'; // the board being built, kept on every change

export function showHome(root: HTMLElement): Promise<BotLevel> {
  const saved = localStorage.getItem(DIFFICULTY_KEY);
  let difficulty: BotLevel = DIFFICULTIES.find((d) => d.id === saved)?.id ?? 'normal';
  // Trait cards and unit popups read a player; this one owns nothing (in the builder: the board being built).
  const blank: Player = { ...createGame(0, [{ id: 'viewer', name: '', isBot: false }]).players[0], bench: [], board: [] };
  let view: 'home' | 'gallery' | 'builder' = 'home';
  let tab: HomeTab = 'heroes';
  let cardTier: PowerTier = 'blue'; // the Cards tab's tier pill
  let openUnit: string | null = null;
  let openTrait: string | null = null;
  let openItem: string | null = null; // item type whose info popup is open (from a trait card's item chips)
  const builder: BuilderView = { board: emptyBoard(), tab: 'heroes', filter: NO_FILTER, filterOpen: false, teams: parseTeams(localStorage.getItem(TEAMS_KEY)), name: '', selected: '', message: '' };
  const storeTeams = () => localStorage.setItem(TEAMS_KEY, JSON.stringify(builder.teams));
  // The draft: the board, name and selected save, restored on the next visit (checked like a saved team).
  const storeDraft = () =>
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: builder.name, board: builder.board, selected: builder.selected }));
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    const draft = raw && parseTeams(JSON.stringify([raw]))[0];
    if (draft) {
      builder.board = draft.board;
      builder.name = draft.name;
      builder.selected = typeof raw.selected === 'string' && builder.teams[Number(raw.selected)] ? raw.selected : '';
    }
  } catch {
    // a broken draft is just dropped
  }
  const scrolls = new Map<string, number>();
  const listeners = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    root.addEventListener(type, fn, { signal: listeners.signal });

  function render(): void {
    for (const el of root.querySelectorAll<HTMLElement>('[data-keep-scroll]')) scrolls.set(el.dataset.keepScroll!, el.scrollTop);
    const viewer = view === 'builder' ? builderPlayer(blank, builder.board) : blank;
    if (view === 'builder') storeDraft(); // every builder change renders, so the draft is always current
    root.innerHTML =
      (view === 'home' ? homeHtml(difficulty)
      : view === 'builder' ? teamBuilderHtml(builder, viewer)
      : homeGalleryHtml(viewer, tab, cardTier)) +
      (openTrait ? traitDetailHtml(openTrait, viewer, {}, false) : '') +
      (openUnit ? unitInfoHtml(openUnit, viewer) : '') +
      (openItem ? itemInfoHtml(openItem) : '');
    layoutMasonry(root);
    for (const el of root.querySelectorAll<HTMLElement>('[data-keep-scroll]')) el.scrollTop = scrolls.get(el.dataset.keepScroll!) ?? 0;
  }

  // Saves the board under the name box's name (same name: replaced).
  function save(): void {
    if (!builder.board.some(Boolean)) return;
    const name = builder.name.trim() || `Team ${builder.teams.length + 1}`;
    builder.teams = saveTeam(builder.teams, name, builder.board);
    builder.name = name;
    builder.selected = String(builder.teams.findIndex((t) => t.name === name));
    builder.message = `Saved “${name}”`;
    storeTeams();
    render();
  }

  // Team Builder edits: the board changes, any old refusal message goes.
  const edit = (board: BuilderView['board'], message = '') => {
    builder.board = board;
    builder.message = message;
    render();
  };

  return new Promise((resolve) => {
    on('click', (e) => {
      const target = e.target as HTMLElement;
      if (pickLevel(target)) return;
      const itemInfo = target.closest<HTMLElement>('[data-item-info]');
      if (itemInfo) {
        openItem = itemInfo.dataset.itemInfo!;
        return render();
      }
      const info = target.closest<HTMLElement>('[data-unit-info]');
      if (info) {
        openUnit = info.dataset.unitInfo!;
        return render();
      }
      const trait = target.closest<HTMLElement>('[data-trait]');
      if (trait) {
        openUnit = null;
        openTrait = trait.dataset.trait!;
        return render();
      }
      const btn = target.closest<HTMLElement>('[data-action]');
      // Clicks inside a popup's dialog (not its backdrop or close button) do nothing.
      if (!btn || (btn.classList.contains('overlay') && target.closest('.dialog'))) return;
      const a = btn.dataset.action;
      if (a === 'play') {
        listeners.abort();
        root.innerHTML = '';
        return resolve(difficulty);
      }
      if (a === 'difficulty') {
        difficulty = btn.dataset.level as BotLevel;
        localStorage.setItem(DIFFICULTY_KEY, difficulty);
        return render();
      }
      if (a === 'tbAdd') {
        const next = placeHero(builder.board, btn.dataset.hero!);
        return edit(next, next === builder.board ? `The board is full (${BUILDER_MAX_HEROES} heroes)` : '');
      }
      if (a === 'tbTakeItem') return edit(takeItem(builder.board, Number(btn.dataset.cell), Number(btn.dataset.slot)));
      if (a === 'tbTakeOrb') return edit(takeOrb(builder.board, Number(btn.dataset.cell)));
      if (a === 'tbStar') return edit(cycleStar(builder.board, Number(btn.dataset.cell)));
      if (a === 'tbClear') return edit(emptyBoard());
      if (a === 'tbSave') return save();
      if (a === 'tbLoad') {
        const t = builder.teams[Number(btn.dataset.index)];
        if (!t) return;
        builder.name = t.name;
        builder.selected = btn.dataset.index!;
        return edit(copyBoard(t.board), `Loaded “${t.name}”`);
      }
      if (a === 'openGallery') view = 'gallery';
      else if (a === 'openBuilder') view = 'builder';
      else if (a === 'tbTab') builder.tab = btn.dataset.tab as BuilderTab;
      else if (a === 'tbFilter') {
        // One pick per row; clicking the picked one again clears that row.
        const key = btn.dataset.key as keyof HeroFilter;
        const value = key === 'cost' ? Number(btn.dataset.value) : btn.dataset.value!;
        builder.filter = { ...builder.filter, [key]: builder.filter[key] === value ? null : value };
      } else if (a === 'tbFilterClear') builder.filter = NO_FILTER;
      else if (a === 'tbFilterOpen') builder.filterOpen = !builder.filterOpen;
      else if (a === 'tbDelete') {
        const i = Number(btn.dataset.index);
        builder.teams = builder.teams.filter((_, j) => j !== i);
        // Keep pointing at the same team the selection was on (or none, when that one went).
        const sel = Number(builder.selected);
        builder.selected = builder.selected === '' || sel === i ? '' : String(sel > i ? sel - 1 : sel);
        storeTeams();
      } else if (a === 'home') view = 'home';
      else if (a === 'homeTab') tab = btn.dataset.tab as HomeTab;
      else if (a === 'cardTier') cardTier = btn.dataset.tier as PowerTier;
      else if (a === 'closeUnitInfo') openUnit = null;
      else if (a === 'closeTrait') openTrait = null;
      else if (a === 'closeItemInfo') openItem = null;
      else return;
      render();
    });

    // Team Builder: right-click a hero on the board to take it off.
    on('contextmenu', (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.tb-cell.filled');
      if (!cell) return;
      e.preventDefault();
      edit(removeHero(builder.board, Number(cell.dataset.cell)));
    });

    // Team Builder drag and drop. Sources: "hero:<defId>", "item:<itemId>", "orb:<traitId>" (pool), "board:<cell>" (a placed
    // hero). Drops on a board cell place, move/swap or hand over the item or orb; a placed hero dropped off the board goes.
    let dragging: string | null = null;
    on('dragstart', (e) => {
      const src = (e.target as HTMLElement).closest<HTMLElement>('[data-drag]');
      if (!src) return;
      dragging = src.dataset.drag!;
      e.dataTransfer?.setData('text/plain', dragging);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      root.querySelector('.team-builder')?.classList.add(`dragging-${dragging.split(':')[0]}`);
    });
    on('dragover', (e) => {
      if (!dragging) return;
      e.preventDefault(); // anywhere: dropping a placed hero off the board removes it
      const cell = (e.target as HTMLElement).closest<HTMLElement>('.tb-cell');
      for (const el of root.querySelectorAll('.tb-cell.over')) if (el !== cell) el.classList.remove('over');
      cell?.classList.add('over');
    });
    on('drop', (e) => {
      e.preventDefault();
      const src = dragging;
      dragging = null;
      if (!src) return;
      const [kind, value] = src.split(':');
      const cellEl = (e.target as HTMLElement).closest<HTMLElement>('.tb-cell');
      const cell = cellEl ? Number(cellEl.dataset.cell) : -1;
      if (kind === 'board') return edit(cell < 0 ? removeHero(builder.board, Number(value)) : moveHero(builder.board, Number(value), cell));
      if (cell < 0) return render();
      if (kind === 'hero') {
        const next = placeHero(builder.board, value, cell);
        return edit(next, next === builder.board ? `The board is full (${BUILDER_MAX_HEROES} heroes)` : '');
      }
      if (kind === 'item') return edit(giveItem(builder.board, cell, value), itemBlock(builder.board, cell, value) ?? '');
      if (kind === 'orb') return edit(giveOrb(builder.board, cell, value), orbBlock(builder.board, cell, value) ?? '');
    });
    on('dragend', () => {
      if (!dragging) return;
      dragging = null;
      render(); // dropped nowhere useful: clear the highlights
    });

    // The name box keeps its text across renders; Enter in it saves too.
    on('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.name !== 'teamName') return;
      builder.name = el.value;
      storeDraft();
    });
    on('submit', (e) => {
      e.preventDefault();
      save();
    });

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return;
        if (openItem) openItem = null;
        else if (openUnit) openUnit = null;
        else if (openTrait) openTrait = null;
        else if (view !== 'home') view = 'home';
        else return;
        render();
      },
      { signal: listeners.signal },
    );
    render();
  });
}
