import { applyAction, type Action } from '../game/actions';
import type { CombatEvent } from '../game/combat';
import { BOARD_COLS } from '../game/config';
import { isGameOver, resolveCombat, startRound, type Fight } from '../game/game';
import { TRAITS } from '../game/traits';
import { UNIT_BY_ID } from '../game/units';
import { isAlive } from '../game/player';
import type { GameState, Loc, Player } from '../game/types';
import { createMeter, meterHtml, recordEvent, type Meter } from './meter';
import { playFight, type Playback } from './playback';
import {
  armoryHtml,
  bearerDetailHtml,
  combatCellsHtml,
  enemyHalfHtml,
  galleryHtml,
  gameOverHtml,
  orbChoiceHtml,
  hudHtml,
  playersHtml,
  shopHtml,
  unitDetailHtml,
  slotsHtml,
  traitDetailHtml,
  traitsPanelHtml,
} from './views';

const TOAST_MS = 1800;

// Owns UI state and input. Re-renders everything after each action (the board is
// small); during combat the board is left to the playback to animate.
export function mountApp(root: HTMLElement, state: GameState, playerId: string): void {
  let toastTimer = 0;
  // Set while a fight is on screen; render() shows the combat view then.
  let combat: { fight: Fight; opponentId: string; playback: Playback | null } | null = null;
  // Combat damage is applied before playback, so show pre-fight hp until it ends.
  let hpBefore: Map<string, number> | null = null;
  // Damage of the fight on screen, or of the last one during prep.
  let meter: Meter | null = null;
  // Trait whose detail popup is open.
  let openTrait: string | null = null;
  // Unit whose Magic Orb choice is open.
  let orbFor: number | null = null;
  // Item whose bearer popup is open.
  let openBearer: number | null = null;
  let galleryOpen = false;
  // Own unit shown in the right column; cleared once it's no longer owned (sold, merged away).
  let selectedUid: number | null = null;
  // Item picked up from the item row, waiting for a unit to be clicked.
  let selectedItem: number | null = null;

  const me = () => state.players.find((p) => p.id === playerId)!;
  const shownHp = (p: Player) => hpBefore?.get(p.id) ?? p.hp;

  function dispatch(action: Action): void {
    // Only the shop lock can be toggled while a fight plays.
    if (combat && action.type !== 'toggleLock') return;
    const res = applyAction(state, playerId, action);
    if (!res.ok) toast(res.error);
    render();
  }

  function toast(msg: string, kind: 'error' | 'info' = 'error'): void {
    const el = root.querySelector<HTMLElement>('.toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('info', kind === 'info');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('show'), TOAST_MS);
  }

  function render(): void {
    const p = me();
    const opponent = combat && state.players.find((o) => o.id === combat!.opponentId);
    const boardInner = combat ? `${combatCellsHtml(combat.fight, playerId)}<div class="fighters"></div>` : `${enemyHalfHtml()}${slotsHtml(p.board, 'board', selectedUid, state.chosen, p.items, p.orb)}`;
    const over = !isAlive(p) || isGameOver(state);
    if (selectedUid !== null && ![...p.board, ...p.bench].some((u) => u?.uid === selectedUid)) selectedUid = null;

    if (selectedItem !== null && !p.items.some((i) => i.uid === selectedItem)) selectedItem = null;
    root.classList.toggle('has-selection', selectedUid !== null && !combat);
    root.classList.toggle('has-item-selection', selectedItem !== null && !combat);
    root.innerHTML = `
      ${hudHtml(state, p, shownHp(p), opponent?.name ?? null)}
      <div class="layout">
        ${traitsPanelHtml(p)}
        ${meterHtml(meter)}
        <main>
          <section class="board${combat ? ' combat' : ''}" style="--cols:${BOARD_COLS}">${boardInner}</section>
          <section class="bench">${slotsHtml(p.bench, 'bench', selectedUid, state.chosen, p.items, p.orb)}</section>
          ${armoryHtml(p, selectedItem)}
          ${shopHtml(p, combat !== null, state.chosen)}
        </main>
        <div class="side">
          ${selectedUid !== null ? unitDetailHtml(p, selectedUid, state.chosen) : ''}
          ${playersHtml(
            state.players.filter((o) => o.id !== playerId),
            shownHp,
            combat?.opponentId ?? null,
          )}
        </div>
      </div>
      ${openTrait ? traitDetailHtml(openTrait, p, state.chosen) : ''}
      ${galleryOpen ? galleryHtml(p, state.chosen) : ''}
      ${openBearer !== null && p.items.some((i) => i.uid === openBearer) ? bearerDetailHtml(p, openBearer, state.chosen) : ''}
      ${orbFor !== null && p.orbs.length ? orbChoiceHtml(p, orbFor) : ''}
      ${over ? gameOverHtml(p, state.players.length) : ''}
      <div class="toast"></div>`;
  }

  function endTurn(): void {
    if (combat || !isAlive(me()) || isGameOver(state)) return;
    hpBefore = new Map(state.players.map((p) => [p.id, p.hp]));
    const fights = resolveCombat(state);
    const fight = fights.find((f) => f.home === playerId || (f.away === playerId && !f.ghost));
    if (!fight) return nextRound();

    combat = { fight, opponentId: fight.home === playerId ? fight.away : fight.home, playback: null };
    meter = createMeter(fight, playerId);
    render();
    const live = meter;
    // Only the meter repaints per event; a full render would wipe the animated board.
    const onEvent = (e: CombatEvent) => {
      recordEvent(live, e);
      root.querySelector('.meter')!.outerHTML = meterHtml(live);
    };
    combat.playback = playFight(root.querySelector<HTMLElement>('.fighters')!, fight, playerId, onEvent, nextRound);
  }

  function nextRound(): void {
    if (meter) meter.live = false;
    combat = null;
    hpBefore = null;
    const orbsBefore = me().orbs.length;
    const bonuses = isAlive(me()) && !isGameOver(state) ? startRound(state) : [];
    render();
    if (me().orbs.length > orbsBefore) toast('🔮 You got a Magic Orb! Click a unit to use it.', 'info');
    const mine = bonuses
      .filter((b) => b.playerId === playerId)
      .map((b) => {
        const got = [b.looted && UNIT_BY_ID[b.looted].name, b.gold && `${b.gold} gold`].filter(Boolean).join(' + ');
        return got ? `${TRAITS[b.trait].icon} ${TRAITS[b.trait].name}: ${got}` : '';
      })
      .filter(Boolean);
    if (mine.length) toast(mine.join(' · '), 'info');
  }

  const skip = () => combat?.playback?.skip();

  // Where one of my units is, by uid.
  function unitLoc(uid: number): Loc | null {
    const p = me();
    for (const area of ['board', 'bench'] as const) {
      const index = (area === 'board' ? p.board : p.bench).findIndex((u) => u?.uid === uid);
      if (index >= 0) return { area, index };
    }
    return null;
  }

  function locOf(el: HTMLElement): Loc {
    return { area: el.dataset.area as Loc['area'], index: Number(el.dataset.index) };
  }

  function showTrait(id: string | null): void {
    openTrait = id;
    render();
  }

  function showGallery(open: boolean): void {
    galleryOpen = open;
    render();
  }

  function selectUnit(uid: number | null): void {
    selectedUid = uid === selectedUid ? null : uid;
    render();
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Click-to-equip: click an item chip to pick it up, then a unit to equip it.
    // Any other click puts it back down.
    const chip = target.closest<HTMLElement>('.item-chip');
    if (chip && !combat) {
      const uid = Number(chip.dataset.item);
      selectedItem = selectedItem === uid ? null : uid;
      selectedUid = null;
      return render();
    }
    if (selectedItem !== null) {
      const item = selectedItem;
      selectedItem = null;
      const unit = target.closest<HTMLElement>('.unit[data-uid]');
      if (unit) return dispatch({ type: 'equip', item, unit: Number(unit.dataset.uid) });
      return render();
    }
    // Click-to-move: with a unit selected, clicking an empty board or bench cell moves it there
    // (clicking another unit still switches the selection). Works where drag-and-drop doesn't.
    const cell = target.closest<HTMLElement>('.cell[data-area]');
    if (selectedUid !== null && cell && !target.closest('.unit') && !combat) {
      const from = unitLoc(selectedUid);
      selectedUid = null;
      if (from) return dispatch({ type: 'move', from, to: locOf(cell) });
    }
    // Any click outside the unit card dismisses it, then still does its own thing.
    // Units (which switch the card) and modal popups on top don't count as outside.
    if (selectedUid !== null && !target.closest('.unit-detail, .unit[data-uid], .overlay')) {
      selectedUid = null;
      render();
    }
    const bearer = target.closest<HTMLElement>('[data-bearer]');
    if (bearer) {
      openBearer = Number(bearer.dataset.bearer);
      return render();
    }
    const trait = target.closest<HTMLElement>('[data-trait]');
    if (trait) return showTrait(trait.dataset.trait!);
    // Clicks inside the popup stay put; only the backdrop or × closes it.
    // Inside a modal only its own buttons act; a click on blank space must not reach the backdrop's close.
    const modal = target.closest('.modal');
    const btn = target.closest<HTMLElement>('[data-action]');
    if (modal && !(btn && modal.contains(btn))) return;
    if (btn) {
      const a = btn.dataset.action;
      if (a === 'closeTrait') showTrait(null);
      else if (a === 'closeBearer') {
        openBearer = null;
        render();
      }
      else if (a === 'openOrb' || a === 'closeOrb') {
        orbFor = a === 'openOrb' ? Number(btn.dataset.unit) : null;
        render();
      } else if (a === 'useOrb') {
        const unit = orbFor!;
        orbFor = null;
        dispatch({ type: 'useOrb', unit, trait: btn.dataset.orbTrait! });
      }
      else if (a === 'openGallery' || a === 'closeGallery') showGallery(a === 'openGallery');
      else if (a === 'closeUnit') selectUnit(null);
      else if (a === 'endTurn') endTurn();
      else if (a === 'skip') skip();
      else if (a === 'newGame') location.reload();
      else if (a === 'reroll' || a === 'levelUp' || a === 'toggleLock') dispatch({ type: a });
      else if (a === 'unequip') dispatch({ type: 'unequip', item: Number(btn.dataset.item) });
      else if (a === 'sellUnit') {
        const from = unitLoc(Number(btn.dataset.uid));
        if (from) dispatch({ type: 'sell', from });
      }
      return;
    }
    const card = target.closest<HTMLElement>('.shop-card[data-slot]');
    if (card) return dispatch({ type: 'buy', slot: Number(card.dataset.slot) });
    // Browsers don't fire click after a drag, so this is a plain click.
    const unit = target.closest<HTMLElement>('.unit[data-uid]');
    if (unit) selectUnit(Number(unit.dataset.uid));
  });

  // Drags carry either a unit's location or { item: uid }.
  root.addEventListener('dragstart', (e) => {
    if (!e.dataTransfer || combat) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('.item-chip');
    if (item) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ item: Number(item.dataset.item) }));
      e.dataTransfer.effectAllowed = 'move';
      root.classList.add('dragging-item');
      return;
    }
    const unit = (e.target as HTMLElement).closest<HTMLElement>('.unit');
    if (!unit) return;
    e.dataTransfer.setData('text/plain', JSON.stringify(locOf(unit)));
    e.dataTransfer.effectAllowed = 'move';
    root.classList.add('dragging');
  });

  root.addEventListener('dragend', () => root.classList.remove('dragging', 'dragging-item'));

  root.addEventListener('dragover', (e) => {
    if ((e.target as HTMLElement).closest('.cell[data-area], .shop, .armory')) e.preventDefault();
  });

  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('dragging', 'dragging-item');
    const raw = e.dataTransfer?.getData('text/plain');
    if (!raw) return;
    const payload = JSON.parse(raw) as Loc | { item: number };
    const target = e.target as HTMLElement;
    if ('item' in payload) {
      const unit = target.closest('.cell[data-area]')?.querySelector<HTMLElement>('.unit');
      if (unit) dispatch({ type: 'equip', item: payload.item, unit: Number(unit.dataset.uid) });
      else if (target.closest('.armory')) dispatch({ type: 'unequip', item: payload.item });
      return;
    }
    const from = payload;
    const cell = target.closest<HTMLElement>('.cell[data-area]');
    if (cell) dispatch({ type: 'move', from, to: locOf(cell) });
    else if (target.closest('.shop')) dispatch({ type: 'sell', from });
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape' && openTrait) return showTrait(null);
    if (e.key === 'Escape' && galleryOpen) return showGallery(false);
    if (e.key === 'Escape' && openBearer !== null) {
      openBearer = null;
      return render();
    }
    if (e.key === 'Escape' && orbFor !== null) {
      orbFor = null;
      return render();
    }
    if (e.key === 'Escape' && selectedItem !== null) {
      selectedItem = null;
      return render();
    }
    if (e.key === 'Escape' && selectedUid !== null) return selectUnit(null);
    if (e.key === 'd' || e.key === 'D') dispatch({ type: 'reroll' });
    else if (e.key === 'f' || e.key === 'F') dispatch({ type: 'levelUp' });
    else if (e.key === ' ') {
      e.preventDefault();
      if (combat) skip();
      else endTurn();
    }
  });

  // Surface any uncaught error instead of failing silently, and expose state for the console.
  const report = (msg: string) => {
    console.error(msg);
    toast(`Error: ${msg}`);
  };
  window.addEventListener('error', (e) => report(e.message));
  window.addEventListener('unhandledrejection', (e) => report(String(e.reason)));
  (window as unknown as { autochess: unknown }).autochess = { state, playerId };

  render();
}
