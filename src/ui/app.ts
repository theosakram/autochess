import { applyAction, type Action } from '../game/actions';
import type { CombatEvent } from '../game/combat';
import { isGameOver, resolveCombat, startRound, type Fight } from '../game/game';
import { isAlive } from '../game/player';
import { TRAITS } from '../game/traits';
import type { GameState, Loc, Player } from '../game/types';
import { UNIT_BY_ID } from '../game/units';
import { createMeter, meterHtml, recordEvent, type Meter } from './meter';
import { MIST_WARES } from '../game/mistShop';
import { Stage, type Playback } from './stage/stage';
import {
  armoryHtml,
  bearerDetailHtml,
  galleryHtml,
  type GalleryTab,
  gameOverHtml,
  graveHtml,
  mistChoiceHtml,
  sideShopsHtml,
  hudHtml,
  orbChoiceHtml,
  playersHtml,
  shopBarHtml,
  shopPopupHtml,
  traitDetailHtml,
  traitsPanelHtml,
  unitInfoHtml,
  unitDetailHtml,
} from './views';

const TOAST_MS = 1800;

// Owns UI state and input. The board and bench live on the Pixi stage; everything else is HTML,
// re-rendered region by region after each action so the canvas is never torn down.
export async function mountApp(root: HTMLElement, state: GameState, playerId: string): Promise<void> {
  let toastTimer = 0;
  // Set while a fight is on screen; the stage plays it and the shop is locked.
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
  // Unit type whose info popup is open (from the gallery or a trait card).
  let openUnitInfo: string | null = null;
  // Mist Shop slot whose ware is waiting for a pick (Mirror: a unit; picked orbs: a trait).
  let mistPick: number | null = null;
  let galleryOpen = false;
  // The shop popup (cards, lock, reroll) is open.
  let shopOpen = false;
  let galleryTab: GalleryTab = 'cards';
  // Own unit shown in the right column; cleared once it's no longer owned (sold, merged away).
  let selectedUid: number | null = null;
  // Item picked up from the item row, waiting for a unit to be clicked.
  let selectedItem: number | null = null;
  // An item chip is being dragged: units light up as targets.
  let draggingItem = false;
  // A drag just ended; swallow the click the browser fires after it.
  let swallowClick = false;

  root.innerHTML = `
    <div class="slot" data-slot="hud"></div>
    <div class="layout">
      <div class="slot" data-slot="traits"></div>
      <div class="slot" data-slot="meter"></div>
      <main>
        <div class="stage-wrap">
          <section class="stage"></section>
        </div>
        <div class="slot" data-slot="armory"></div>
        <div class="slot" data-slot="shop"></div>
        <div class="slot" data-slot="grave"></div>
      </main>
      <div class="slot" data-slot="side"></div>
    </div>
    <div class="slot" data-slot="overlays"></div>
    <div class="toast"></div>`;
  const slot = (name: string) => root.querySelector<HTMLElement>(`[data-slot="${name}"]`)!;

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
    const el = root.querySelector<HTMLElement>('.toast')!;
    el.textContent = msg;
    el.classList.toggle('info', kind === 'info');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('show'), TOAST_MS);
  }

  // Where one of my units is, by uid.
  function unitLoc(uid: number): Loc | null {
    const p = me();
    for (const area of ['board', 'bench'] as const) {
      const index = (area === 'board' ? p.board : p.bench).findIndex((u) => u?.uid === uid);
      if (index >= 0) return { area, index };
    }
    return null;
  }

  const stage = await Stage.create(root.querySelector<HTMLElement>('.stage')!, {
    unitClick(uid) {
      if (combat) return;
      if (selectedItem !== null) {
        const item = selectedItem;
        selectedItem = null;
        return dispatch({ type: 'equip', item, unit: uid });
      }
      selectUnit(uid);
    },
    // An empty cell: move the selected unit there, or put a picked-up item back down.
    cellClick(to) {
      if (combat) return;
      if (selectedItem !== null) {
        selectedItem = null;
        return render();
      }
      if (selectedUid === null) return;
      const from = unitLoc(selectedUid);
      selectedUid = null;
      if (from) dispatch({ type: 'move', from, to });
      else render();
    },
    drop(from, to) {
      if (to === 'sell') dispatch({ type: 'sell', from });
      else dispatch({ type: 'move', from, to });
    },
    dragging(on) {
      root.classList.toggle('dragging', on);
    },
  });

  function render(): void {
    const p = me();
    const opponent = combat && state.players.find((o) => o.id === combat!.opponentId);
    const over = !isAlive(p) || isGameOver(state);
    if (selectedUid !== null && !unitLoc(selectedUid)) selectedUid = null;
    if (selectedItem !== null && !p.items.some((i) => i.uid === selectedItem)) selectedItem = null;

    slot('hud').innerHTML = hudHtml(state, p, shownHp(p), opponent?.name ?? null);
    slot('traits').innerHTML = traitsPanelHtml(p);
    slot('meter').innerHTML = meterHtml(meter);
    slot('armory').innerHTML = armoryHtml(p, selectedItem);
    slot('shop').innerHTML = shopBarHtml(p, combat !== null);
    slot('grave').innerHTML = `<div class="graves">${graveHtml(p)}${sideShopsHtml(p)}</div>`;
    slot('side').innerHTML = `<div class="side">
      ${selectedUid !== null ? unitDetailHtml(p, selectedUid, state.chosen) : ''}
      ${playersHtml(
        state.players.filter((o) => o.id !== playerId),
        shownHp,
        combat?.opponentId ?? null,
      )}
    </div>`;
    // Later entries sit on top: a trait opened from the gallery shows over it.
    // Overlays are rebuilt on every render; keep where each scrollable one was scrolled to.
    const scrolled = new Map<string, [number, number]>();
    for (const el of slot('overlays').querySelectorAll<HTMLElement>('[data-keep-scroll]')) scrolled.set(el.dataset.keepScroll!, [el.scrollTop, el.scrollLeft]);
    slot('overlays').innerHTML = [
      shopOpen ? shopPopupHtml(p, combat !== null, state.chosen) : '',
      galleryOpen ? galleryHtml(p, state.chosen, galleryTab) : '',
      openTrait ? traitDetailHtml(openTrait, p, state.chosen) : '',
      openUnitInfo ? unitInfoHtml(openUnitInfo, p) : '',
      openBearer !== null && p.items.some((i) => i.uid === openBearer) ? bearerDetailHtml(p, openBearer, state.chosen) : '',
      orbFor !== null && p.orbs.length ? orbChoiceHtml(p, orbFor) : '',
      mistPick !== null && p.mistShop ? mistChoiceHtml(p, mistPick) : '',
      over ? gameOverHtml(p, state.players.length) : '',
    ].join('');
    for (const el of slot('overlays').querySelectorAll<HTMLElement>('[data-keep-scroll]')) {
      const at = scrolled.get(el.dataset.keepScroll!);
      if (at) [el.scrollTop, el.scrollLeft] = at;
    }
    // While a fight plays the stage is busy; it shows the board again when the fight ends.
    if (!combat) stage.showPrep({ player: p, chosen: state.chosen, selectedUid, pickingItem: selectedItem !== null || draggingItem });
  }

  function endTurn(): void {
    if (combat || !isAlive(me()) || isGameOver(state)) return;
    hpBefore = new Map(state.players.map((p) => [p.id, p.hp]));
    const fights = resolveCombat(state);
    const fight = fights.find((f) => f.home === playerId || (f.away === playerId && !f.ghost));
    if (!fight) return nextRound();

    combat = { fight, opponentId: fight.home === playerId ? fight.away : fight.home, playback: null };
    shopOpen = false;
    selectedUid = null;
    selectedItem = null;
    meter = createMeter(fight, playerId);
    render();
    const live = meter;
    // Only the meter repaints per event; nothing else changes mid-fight.
    const onEvent = (e: CombatEvent) => {
      recordEvent(live, e);
      slot('meter').innerHTML = meterHtml(live);
    };
    combat.playback = stage.playFight(fight, playerId, onEvent, nextRound);
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
    // The stage handles its own clicks (units and cells).
    if (target.closest('.stage')) return;
    // Click-to-equip: click an item chip to pick it up, then a unit on the stage.
    const chip = target.closest<HTMLElement>('.item-chip');
    if (chip && !combat) {
      const uid = Number(chip.dataset.item);
      selectedItem = selectedItem === uid ? null : uid;
      selectedUid = null;
      return render();
    }
    // Any other click outside the unit card puts a picked-up item down and closes the card,
    // then still does its own thing. Modal popups on top don't count as outside.
    if ((selectedItem !== null || selectedUid !== null) && !target.closest('.unit-detail, .overlay')) {
      selectedItem = null;
      selectedUid = null;
      render();
    }
    const unitTile = target.closest<HTMLElement>('[data-select-unit]');
    if (unitTile) return selectUnit(Number(unitTile.dataset.selectUnit));
    const bearer = target.closest<HTMLElement>('[data-bearer]');
    if (bearer) {
      openBearer = Number(bearer.dataset.bearer);
      return render();
    }
    const info = target.closest<HTMLElement>('[data-unit-info]');
    if (info) {
      openUnitInfo = info.dataset.unitInfo!;
      return render();
    }
    const trait = target.closest<HTMLElement>('[data-trait]');
    if (trait) {
      // A trait opened from a unit's info replaces it, so it isn't hidden underneath.
      openUnitInfo = null;
      return showTrait(trait.dataset.trait!);
    }
    // Inside a modal only its own buttons act; a click on blank space must not reach the backdrop's close.
    const modal = target.closest('.modal');
    const btn = target.closest<HTMLElement>('[data-action]');
    if (modal && !(btn && modal.contains(btn))) return;
    if (btn) {
      const a = btn.dataset.action;
      if (a === 'closeTrait') showTrait(null);
      else if (a === 'mistBuy') {
        const slot = Number(btn.dataset.slot);
        const ware = MIST_WARES[me().mistShop![slot]];
        if (ware.choose) {
          mistPick = slot;
          render();
        } else dispatch({ type: 'mistBuy', slot });
      } else if (a === 'equipMistOrb') {
        dispatch({ type: 'equipMistOrb', orb: Number(btn.dataset.orb), unit: Number(btn.dataset.unit) });
      } else if (a === 'unequipMistOrb') {
        dispatch({ type: 'unequipMistOrb', orb: Number(btn.dataset.orb) });
      } else if (a === 'mistPick') {
        const slot = mistPick!;
        mistPick = null;
        dispatch({ type: 'mistBuy', slot, choice: btn.dataset.choice! });
      } else if (a === 'closeMistPick') {
        mistPick = null;
        render();
      } else if (a === 'closeUnitInfo') {
        openUnitInfo = null;
        render();
      }
      else if (a === 'closeBearer') {
        openBearer = null;
        render();
      } else if (a === 'openOrb' || a === 'closeOrb') {
        orbFor = a === 'openOrb' ? Number(btn.dataset.unit) : null;
        render();
      } else if (a === 'useOrb') {
        const unit = orbFor!;
        orbFor = null;
        dispatch({ type: 'useOrb', unit, trait: btn.dataset.orbTrait! });
      } else if (a === 'openGallery' || a === 'closeGallery') showGallery(a === 'openGallery');
      else if (a === 'galleryTab') {
        galleryTab = btn.dataset.tab as GalleryTab;
        render();
      }
      else if (a === 'closeUnit') selectUnit(null);
      else if (a === 'endTurn') endTurn();
      else if (a === 'skip') skip();
      else if (a === 'newGame') location.reload();
      else if (a === 'reroll' || a === 'levelUp' || a === 'toggleLock') dispatch({ type: a });
      else if (a === 'openShop' || a === 'closeShop') {
        shopOpen = a === 'openShop';
        render();
      } else if (a === 'buy') dispatch({ type: 'buy', slot: Number(btn.dataset.slot) });
      else if (a === 'unequip') dispatch({ type: 'unequip', item: Number(btn.dataset.item) });
      else if (a === 'sellUnit') {
        const from = unitLoc(Number(btn.dataset.uid));
        if (from) dispatch({ type: 'sell', from });
      }
      return;
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Escape' && openUnitInfo) {
      openUnitInfo = null;
      return render();
    }
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
    // The shop sits under every other popup, so it closes last.
    if (e.key === 'Escape' && shopOpen) {
      shopOpen = false;
      return render();
    }
    if (e.key === 'Escape' && selectedItem !== null) {
      selectedItem = null;
      return render();
    }
    if (e.key === 'Escape' && selectedUid !== null) return selectUnit(null);
    if ((e.key === 's' || e.key === 'S') && !combat) {
      shopOpen = !shopOpen;
      render();
    } else if (e.key === 'd' || e.key === 'D') dispatch({ type: 'reroll' });
    else if (e.key === 'f' || e.key === 'F') dispatch({ type: 'levelUp' });
    else if (e.key === ' ') {
      e.preventDefault();
      if (combat) skip();
      else endTurn();
    }
  });

  // Item drag: pointer events (not the browser's drag-and-drop API, which is unreliable).
  // A ghost copy of the chip follows the pointer; drop on a unit to equip, on the item row to unequip.
  // A press that barely moves stays a click (pick up, then click a unit).
  root.addEventListener('pointerdown', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.item-chip');
    if (!chip || combat || e.button !== 0) return;
    const item = Number(chip.dataset.item);
    const start = { x: e.clientX, y: e.clientY };
    let ghost: HTMLElement | null = null;
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        ghost = chip.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        document.body.append(ghost);
        draggingItem = true;
        selectedItem = null;
        render();
      }
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!ghost) return;
      ghost.remove();
      draggingItem = false;
      swallowClick = true;
      const loc = stage.locAtClient(ev.clientX, ev.clientY);
      const p = me();
      const unit = loc && (loc.area === 'board' ? p.board : p.bench)[loc.index];
      const overRow = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest('.armory');
      if (unit) dispatch({ type: 'equip', item, unit: unit.uid });
      else if (overRow) dispatch({ type: 'unequip', item });
      else render();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  root.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
    },
    true,
  );
  // Clicks that never come (drag released off-page) must not swallow the next real one.
  window.addEventListener('pointerdown', () => (swallowClick = false), true);

  // Surface any uncaught error instead of failing silently, and expose state for the console.
  const report = (msg: string) => {
    console.error(msg);
    toast(`Error: ${msg}`);
  };
  window.addEventListener('error', (e) => report(e.message));
  window.addEventListener('unhandledrejection', (e) => report(String(e.reason)));
  (window as unknown as { autochess: unknown }).autochess = { state, playerId, stage };

  render();
}
