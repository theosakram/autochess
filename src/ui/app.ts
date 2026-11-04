import { applyAction, type Action } from '../game/actions';
import { BOARD_COLS, BOARD_ROWS, REROLL_COST, XP_COST } from '../game/config';
import { startRound } from '../game/game';
import { findCopies } from '../game/merge';
import { boardCount, xpToNext } from '../game/player';
import type { GameState, Loc, Unit } from '../game/types';
import { UNIT_BY_ID } from '../game/units';

// DOM renderer. Re-renders everything after each action; the board is small enough.
export function mountApp(root: HTMLElement, state: GameState, playerId: string): void {
  let toastTimer = 0;

  const me = () => state.players.find((p) => p.id === playerId)!;

  function dispatch(action: Action): void {
    const res = applyAction(state, playerId, action);
    if (!res.ok) toast(res.error);
    render();
  }

  function toast(msg: string): void {
    const el = root.querySelector<HTMLElement>('.toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800);
  }

  function unitHtml(u: Unit, loc: Loc): string {
    const def = UNIT_BY_ID[u.defId];
    return `<div class="unit tier-${def.tier}" draggable="true" data-area="${loc.area}" data-index="${loc.index}"
      title="${def.name} (${def.traits.join(', ')})">
      <span class="unit-name">${def.name}</span>
      <span class="unit-star">${'★'.repeat(u.star)}</span>
    </div>`;
  }

  function cellsHtml(slots: (Unit | null)[], area: Loc['area']): string {
    return slots
      .map((u, index) => `<div class="cell" data-area="${area}" data-index="${index}">${u ? unitHtml(u, { area, index }) : ''}</div>`)
      .join('');
  }

  // Opponent's half. Empty until combat exists; never a drop target.
  const enemyHalf = '<div class="cell enemy"></div>'.repeat(BOARD_COLS * BOARD_ROWS);

  function render(): void {
    const p = me();
    const need = xpToNext(p);

    const shop = p.shop
      .map((id, slot) => {
        if (!id) return `<div class="shop-card empty"></div>`;
        const def = UNIT_BY_ID[id];
        const upgrade = findCopies(p, id, 1).length >= 2 ? ' upgrade' : '';
        return `<button class="shop-card tier-${def.tier}${upgrade}" data-slot="${slot}" ${p.gold < def.tier ? 'disabled' : ''}>
          <span class="unit-name">${def.name}</span>
          <span class="traits">${def.traits.join(' · ')}</span>
          <span class="cost">${def.tier}g</span>
        </button>`;
      })
      .join('');

    const opponents = state.players
      .filter((o) => o.id !== playerId)
      .map((o) => `<li><span>${o.name}</span><span>Lv ${o.level} · ${o.gold}g · ${boardCount(o)} units</span></li>`)
      .join('');

    root.innerHTML = `
      <header class="hud">
        <span>Round <b>${state.round}</b></span>
        <span>Gold <b>${p.gold}</b></span>
        <span>Level <b>${p.level}</b> ${need === null ? '(max)' : `(${p.xp}/${need} xp)`}</span>
        <span>Board <b>${boardCount(p)}/${p.level}</b></span>
        <span>HP <b>${p.hp}</b></span>
      </header>
      <div class="layout">
        <main>
          <section class="board" style="--cols:${BOARD_COLS}">${enemyHalf}${cellsHtml(p.board, 'board')}</section>
          <section class="bench">${cellsHtml(p.bench, 'bench')}</section>
          <section class="shop" title="Drop a unit here to sell it">
            <div class="shop-cards">${shop}</div>
            <div class="shop-buttons">
              <button data-action="reroll">Reroll (${REROLL_COST}g) <kbd>D</kbd></button>
              <button data-action="buyXp">Buy XP (${XP_COST}g) <kbd>F</kbd></button>
              <button data-action="endTurn" class="primary">End turn <kbd>Space</kbd></button>
            </div>
          </section>
        </main>
        <aside class="opponents"><h3>Opponents</h3><ul>${opponents}</ul></aside>
      </div>
      <div class="toast"></div>`;
  }

  function endTurn(): void {
    startRound(state);
    render();
  }

  function locOf(el: HTMLElement): Loc {
    return { area: el.dataset.area as Loc['area'], index: Number(el.dataset.index) };
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLElement>('[data-action]');
    if (btn) {
      const a = btn.dataset.action;
      if (a === 'endTurn') endTurn();
      else if (a === 'reroll' || a === 'buyXp') dispatch({ type: a });
      return;
    }
    const card = target.closest<HTMLElement>('.shop-card[data-slot]');
    if (card) dispatch({ type: 'buy', slot: Number(card.dataset.slot) });
  });

  root.addEventListener('dragstart', (e) => {
    const unit = (e.target as HTMLElement).closest<HTMLElement>('.unit');
    if (!unit || !e.dataTransfer) return;
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
    if (e.key === 'd' || e.key === 'D') dispatch({ type: 'reroll' });
    else if (e.key === 'f' || e.key === 'F') dispatch({ type: 'buyXp' });
    else if (e.key === ' ') {
      e.preventDefault();
      endTurn();
    }
  });

  render();
}
