import { applyAction, type Action } from '../game/actions';
import { BOARD_COLS } from '../game/config';
import { isGameOver, resolveCombat, startRound, type Fight } from '../game/game';
import { TRAITS } from '../game/traits';
import { UNIT_BY_ID } from '../game/units';
import { isAlive } from '../game/player';
import type { GameState, Loc, Player } from '../game/types';
import { playFight, type Playback } from './playback';
import {
  combatCellsHtml,
  enemyHalfHtml,
  galleryHtml,
  gameOverHtml,
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
  // Trait whose detail popup is open.
  let openTrait: string | null = null;
  let galleryOpen = false;
  // Own unit shown in the right column; cleared once it's no longer owned (sold, merged away).
  let selectedUid: number | null = null;

  const me = () => state.players.find((p) => p.id === playerId)!;
  const shownHp = (p: Player) => hpBefore?.get(p.id) ?? p.hp;

  function dispatch(action: Action): void {
    if (combat) return;
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
    const boardInner = combat ? `${combatCellsHtml(combat.fight, playerId)}<div class="fighters"></div>` : `${enemyHalfHtml()}${slotsHtml(p.board, 'board', selectedUid, state.chosen)}`;
    const over = !isAlive(p) || isGameOver(state);
    if (selectedUid !== null && ![...p.board, ...p.bench].some((u) => u?.uid === selectedUid)) selectedUid = null;

    root.innerHTML = `
      ${hudHtml(state, p, shownHp(p), opponent?.name ?? null)}
      <div class="layout">
        ${traitsPanelHtml(p.board)}
        <main>
          <section class="board${combat ? ' combat' : ''}" style="--cols:${BOARD_COLS}">${boardInner}</section>
          <section class="bench">${slotsHtml(p.bench, 'bench', selectedUid, state.chosen)}</section>
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
    render();
    combat.playback = playFight(root.querySelector<HTMLElement>('.fighters')!, fight, playerId, nextRound);
  }

  function nextRound(): void {
    combat = null;
    hpBefore = null;
    const bonuses = isAlive(me()) && !isGameOver(state) ? startRound(state) : [];
    render();
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
    // Any click outside the unit card dismisses it, then still does its own thing.
    // Units (which switch the card) and modal popups on top don't count as outside.
    if (selectedUid !== null && !target.closest('.unit-detail, .unit[data-uid], .overlay')) {
      selectedUid = null;
      render();
    }
    const trait = target.closest<HTMLElement>('[data-trait]');
    if (trait) return showTrait(trait.dataset.trait!);
    // Clicks inside the popup stay put; only the backdrop or × closes it.
    // Clicks inside a modal stay put; only its backdrop or × closes it.
    if (target.closest('.modal') && !target.closest('.close')) return;
    const btn = target.closest<HTMLElement>('[data-action]');
    if (btn) {
      const a = btn.dataset.action;
      if (a === 'closeTrait') showTrait(null);
      else if (a === 'openGallery' || a === 'closeGallery') showGallery(a === 'openGallery');
      else if (a === 'closeUnit') selectUnit(null);
      else if (a === 'endTurn') endTurn();
      else if (a === 'skip') skip();
      else if (a === 'newGame') location.reload();
      else if (a === 'reroll' || a === 'buyXp') dispatch({ type: a });
      return;
    }
    const card = target.closest<HTMLElement>('.shop-card[data-slot]');
    if (card) return dispatch({ type: 'buy', slot: Number(card.dataset.slot) });
    // Browsers don't fire click after a drag, so this is a plain click.
    const unit = target.closest<HTMLElement>('.unit[data-uid]');
    if (unit) selectUnit(Number(unit.dataset.uid));
  });

  root.addEventListener('dragstart', (e) => {
    const unit = (e.target as HTMLElement).closest<HTMLElement>('.unit');
    if (!unit || !e.dataTransfer || combat) return;
    e.dataTransfer.setData('text/plain', JSON.stringify(locOf(unit)));
    e.dataTransfer.effectAllowed = 'move';
    root.classList.add('dragging');
  });

  root.addEventListener('dragend', () => root.classList.remove('dragging'));

  root.addEventListener('dragover', (e) => {
    if ((e.target as HTMLElement).closest('.cell[data-area], .shop')) e.preventDefault();
  });

  root.addEventListener('drop', (e) => {
    e.preventDefault();
    root.classList.remove('dragging');
    const raw = e.dataTransfer?.getData('text/plain');
    if (!raw) return;
    const from = JSON.parse(raw) as Loc;
    const target = e.target as HTMLElement;
    const cell = target.closest<HTMLElement>('.cell[data-area]');
    if (cell) dispatch({ type: 'move', from, to: locOf(cell) });
    else if (target.closest('.shop')) dispatch({ type: 'sell', from });
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape' && openTrait) return showTrait(null);
    if (e.key === 'Escape' && galleryOpen) return showGallery(false);
    if (e.key === 'Escape' && selectedUid !== null) return selectUnit(null);
    if (e.key === 'd' || e.key === 'D') dispatch({ type: 'reroll' });
    else if (e.key === 'f' || e.key === 'F') dispatch({ type: 'buyXp' });
    else if (e.key === ' ') {
      e.preventDefault();
      if (combat) skip();
      else endTurn();
    }
  });

  render();
}
