import { powersOf, type MarkKind } from '../game/commanders';
import { applyAction, type Action } from '../game/actions';
import type { CombatEvent } from '../game/combat';
import { isGameOver, resolveCombat, startRound, type Fight } from '../game/game';
import { closeBox } from '../game/box';
import { isAlive } from '../game/player';
import { TRAITS } from '../game/traits';
import type { GameState, Loc, Player, PowerTier } from '../game/types';
import { UNIT_BY_ID } from '../game/units';
import { createMeter, meterHtml, recordEvent, type Meter, type MeterTab } from './meter';
import { MIST_WARES } from '../game/mistShop';
import type { AltarKey } from '../game/altar';
import { Stage, type Playback } from './stage/stage';
import {
  armoryHtml,
  boxHtml,
  termPopupHtml,
  bearerDetailHtml,
  galleryHtml,
  type GalleryTab,
  gameOverHtml,
  graveHtml,
  mistChoiceHtml,
  mirrorPickHtml,
  duplicatorPickHtml,
  enhancerPickHtml,
  glovePickHtml,
  poolHtml,
  johnnieOfferHtml,
  altarPickHtml,
  ritualPickHtml,
  blessPickHtml,
  essenceAltarHtml,
  essencePickHtml,
  bloodPickHtml,
  sideShopsHtml,
  hudHtml,
  roundTimerHtml,
  orbChoiceHtml,
  playersHtml,
  shopDockHtml,
  railHtml,
  type GearPick,
  type RailPanel,
  commanderPickHtml,
  cardOfferHtml,
  powerOfferHtml,
  factionOrbOfferHtml,
  itemDetailHtml,
  itemOfferHtml,
  commanderPanelHtml,
  type CommanderSection,
  traitDetailHtml,
  traitsPanelHtml,
  unitInfoHtml,
  unitDetailHtml,
} from './views';
import { lineupGuide, lineupPanelHtml, loadSavedTeams, type SavedTeam } from './teamBuilder';

const TOAST_MS = 1800;
const BOX_REVEAL_MS = 700; // between Box round picks shown

// Owns UI state and input. The board and bench live on the Pixi stage; everything else is HTML,
// re-rendered region by region after each action so the canvas is never torn down.
export async function mountApp(root: HTMLElement, state: GameState, playerId: string): Promise<void> {
  let toastTimer = 0;
  // Set while a fight is on screen; the stage plays it and the shop is locked.
  let combat: { fight: Fight; opponentId: string; playback: Playback | null } | null = null;
  // Combat damage is applied before playback, so show pre-fight hp until it ends.
  let hpBefore: Map<string, number> | null = null;
  let shieldBefore = 0; // own commander shield before the fight, shown until it plays out
  // Damage of the fight on screen, or of the last one during prep.
  let meter: Meter | null = null;
  let meterTab: MeterTab = 'dealt';
  // Trait whose detail popup is open.
  let openTrait: string | null = null;
  // Unit whose Magic Orb choice is open.
  let orbFor: number | null = null;
  // Item whose bearer popup is open.
  let openBearer: number | null = null;
  // Item whose detail popup is open.
  let openItem: number | null = null;
  // Unit type whose info popup is open (from the gallery or a trait card).
  let openUnitInfo: string | null = null;
  // Mist Shop slot whose ware is waiting for a pick (Mirror: a unit; picked orbs: a trait).
  let mistPick: number | null = null;
  // The Mirror Device picker (Kaela's dice prizes) is open.
  let mirrorOpen = false;
  let duplicatorOpen = false;
  let enhancerOpen = false;
  let gloveOpen: string | null = null;
  let poolOpen = false; // the shop pool modal
  let termOpen: string | null = null; // a commander's glossary term popup (the underlined links in its texts)
  // The Box round: picks shown so far (bots' picks are revealed one at a time), and the timer showing the next.
  let boxShown = 0;
  let boxTimer = 0;
  let boxSelected: number | null = null; // the prize clicked, waiting for Take
  let boxFresh: number | null = null; // the prize whose pick was just revealed (its stamp animates once)
  let fightTick: number | null = null; // the fight replay's clock, for the round timer (null: shopping)
  // Which of Dyroth's altars has its hero picker open.
  let altarOpen: AltarKey | null = null;
  let ritualOpen: 'offer' | 'copy' | null = null; // Moscow's Shadow Altar picker
  let blessOpen = false; // Lunox's blessing picker
  let essenceOpen = false; // Luo Yi's altar picker
  let cardsHidden = false; // the card pick, minimized
  let denHidden = false; // Johnnie's Den, minimized
  let commanderPreview: string | null = null; // the commander looked at on the start-of-game pick
  let bloodOpen = false; // Alice's Blood Pact picker
  // The unfolded part of the commander panel (its power's text or its card's), if any.
  let commanderOpen: CommanderSection | null = null;
  let incomeOpen = false; // the gold popover in the dock
  let skillOpen = false; // the hero card's skill popover
  let skillFor: number | null = null; // which hero it was opened on
  let galleryOpen = false;
  // What the sidebar shows beside its icons; null when collapsed.
  let railPanel: RailPanel | null = 'synergy';
  // The saved Team Builder lineup loaded as a guide: its heroes get a thumbs up in the shop, their cells glow.
  let lineup: SavedTeam | null = null;
  let galleryTab: GalleryTab = 'cards';
  let cardTier: PowerTier = 'blue'; // the Cards tab's tier pill
  // Own unit shown in the right column; cleared once it's no longer owned (sold, merged away).
  let selectedUid: number | null = null;
  // Item or orb picked up in the Equipment panel, waiting for a slot to be clicked.
  let picked: GearPick | null = null;
  // One is being dragged: its slots light up.
  let draggingGear: GearPick | null = null;
  // A drag just ended; swallow the click the browser fires after it.
  let swallowClick = false;

  root.innerHTML = `
    <div class="slot" data-slot="hud"></div>
    <div class="layout">
      <div class="col-left">
        <div class="col-left-top">
          <div class="slot" data-slot="rail"></div>
          <div class="slot" data-slot="panel"></div>
        </div>
        <div class="slot" data-slot="commander"></div>
      </div>
      <main><section class="stage"></section></main>
      <div class="col col-right">
        <div class="col-scroll">
          <div class="slot" data-slot="side"></div>
          <div class="slot" data-slot="grave"></div>
        </div>
      </div>
    </div>
    <div class="slot" data-slot="shop"></div>
    <div class="slot" data-slot="overlays"></div>
    <div class="toast"></div>`;
  const slot = (name: string) => root.querySelector<HTMLElement>(`[data-slot="${name}"]`)!;

  const me = () => state.players.find((p) => p.id === playerId)!;
  const shownHp = (p: Player) => hpBefore?.get(p.id) ?? p.hp;

  function dispatch(action: Action): void {
    // Only the shop lock can be toggled while a fight plays.
    if (combat && action.type !== 'toggleLock') return;
    // Only the Box round's pick while it's open.
    if (state.box && action.type !== 'pickBox') return;
    const free = me().freeRerolls ?? 0;
    const res = applyAction(state, playerId, action);
    if (!res.ok) toast(res.error);
    else if (action.type === 'reroll' && (me().freeRerolls ?? 0) > Math.max(0, free - 1)) toast('💎 Premium Client: free refresh banked', 'info');
    render();
  }

  // A picked card flies from the dialog into its slot in the commander panel's card tray.
  // `a` is where the card was, measured before the pick re-rendered the dialog away (a detached card measures 0,0).
  function flyToTray(card: HTMLElement, a: DOMRect, slot: number): void {
    const to = traySlot(slot);
    if (!to) return;
    const b = to.getBoundingClientRect();
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add('card-fly');
    Object.assign(ghost.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.append(ghost);
    to.style.visibility = 'hidden';
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = b.width / a.width;
    ghost
      .animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.6 }], {
        duration: 550,
        easing: 'cubic-bezier(.5,0,.3,1)',
      })
      .finished.then(() => {
        ghost.remove();
        traySlot(slot)?.style.removeProperty('visibility');
      });
  }
  const traySlot = (i: number) => root.querySelector<HTMLElement>(`[data-card-slot="${i}"]`);

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
      picked = null;
      selectUnit(uid);
    },
    // An empty cell: move the selected unit there, or put a picked-up item back down.
    cellClick(to) {
      if (combat) return;
      if (picked) {
        picked = null;
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

  function renderPanel(): void {
    const p = me();
    const panel = slot('panel');
    // Repaints are rebuilds; a long panel stays where it was scrolled to.
    const scrolled = panel.firstElementChild?.scrollTop ?? 0;
    panel.innerHTML =
      railPanel === 'synergy' ? traitsPanelHtml(p)
      : railPanel === 'damage' ? meterHtml(meter, meterTab)
      : railPanel === 'equipment' ? armoryHtml(p, picked, draggingGear)
      : railPanel === 'lineup' ? lineupPanelHtml(loadSavedTeams(), lineup?.name ?? null, p)
      : '';
    if (panel.firstElementChild) panel.firstElementChild.scrollTop = scrolled;
  }

  const pickOf = (chip: HTMLElement): GearPick =>
    chip.dataset.orb ? { kind: 'orb', orb: chip.dataset.orb === 'magic' ? 'magic' : Number(chip.dataset.orb) } : { kind: 'item', uid: Number(chip.dataset.item) };

  // Puts an item or orb down on whatever is at `el`: a hero's slot, or the top of the panel to take
  // it off. Anywhere else, or the wrong kind of slot, leaves it where it was.
  function place(pick: GearPick, el: Element | null): void {
    const stash = el?.closest('.armory-stash');
    if (pick.kind === 'item') {
      const unit = el?.closest<HTMLElement>('[data-gear-unit]')?.dataset.gearUnit;
      if (unit) return dispatch({ type: 'equip', item: pick.uid, unit: Number(unit) });
      if (stash && me().items.find((i) => i.uid === pick.uid)?.holder != null) return dispatch({ type: 'unequip', item: pick.uid });
      return render();
    }
    const unit = el?.closest<HTMLElement>('[data-orb-unit]')?.dataset.orbUnit;
    if (unit && pick.orb === 'magic') {
      orbFor = Number(unit);
      return render();
    }
    if (pick.orb !== 'magic') {
      if (unit) return dispatch({ type: 'equipMistOrb', orb: pick.orb, unit: Number(unit) });
      const orb = pick.orb;
      if (stash && me().mistOrbs?.find((o) => o.uid === orb)?.holder != null) return dispatch({ type: 'unequipMistOrb', orb });
    }
    render();
  }

  function render(): void {
    const p = me();
    const opponent = combat && (combat.fight.monster ? { name: '👹 Monsters' } : state.players.find((o) => o.id === combat!.opponentId));
    // The fight is resolved before it plays: hold the end screen until its animation is done.
    const over = !combat && (!isAlive(p) || isGameOver(state));
    if (selectedUid !== null && !unitLoc(selectedUid)) selectedUid = null;
    if (skillFor !== selectedUid) skillOpen = false;
    if (picked?.kind === 'item' && !p.items.some((i) => i.uid === (picked as { uid: number }).uid)) picked = null;

    slot('hud').innerHTML = hudHtml(state, p, opponent?.name ?? null, combat ? fightTick ?? 0 : null);
    slot('rail').innerHTML = railHtml(railPanel, p);
    renderPanel();
    slot('shop').innerHTML = shopDockHtml(p, state.round, combat !== null, state.chosen, incomeOpen, state.pool, new Set(lineup ? lineupGuide(lineup).map((g) => g.defId) : []));
    slot('grave').innerHTML = `<div class="graves">${essenceAltarHtml(p)}${graveHtml(p)}${sideShopsHtml(p)}</div>`;
    // You, bottom left, right above your gold.
    slot('commander').innerHTML = `<div class="left-commander">${commanderPanelHtml(p, shownHp(p), state.round, commanderOpen, state.powerTiers, hpBefore ? shieldBefore : (p.shield ?? 0))}</div>`;
    slot('side').innerHTML = `<div class="side">
      ${playersHtml(
        state.players.filter((o) => o.id !== playerId),
        shownHp,
        combat?.opponentId ?? null,
      )}
      ${selectedUid !== null ? unitDetailHtml(p, selectedUid, state.chosen, skillOpen) : ''}
    </div>`;
    // Later entries sit on top: a trait opened from the gallery shows over it.
    // Overlays are rebuilt on every render; keep where each scrollable one was scrolled to.
    const scrolled = new Map<string, [number, number]>();
    for (const el of slot('overlays').querySelectorAll<HTMLElement>('[data-keep-scroll]')) scrolled.set(el.dataset.keepScroll!, [el.scrollTop, el.scrollLeft]);
    slot('overlays').innerHTML = [
      galleryOpen ? galleryHtml(p, state.chosen, galleryTab, state.powerTiers, cardTier) : '',
      openTrait ? traitDetailHtml(openTrait, p, state.chosen) : '',
      poolOpen ? poolHtml(p, state.pool) : '', // under a hero's info opened from it
      openUnitInfo ? unitInfoHtml(openUnitInfo, p) : '',
      openBearer !== null && p.items.some((i) => i.uid === openBearer) ? bearerDetailHtml(p, openBearer, state.chosen) : '',
      openItem !== null && p.items.some((i) => i.uid === openItem) ? itemDetailHtml(p, openItem, !combat, state.chosen) : '',
      orbFor !== null && p.orbs.length ? orbChoiceHtml(p, orbFor) : '',
      mistPick !== null && p.mistShop ? mistChoiceHtml(p, mistPick) : '',
      mirrorOpen && p.mirrors ? mirrorPickHtml(p) : '',
      duplicatorOpen && p.duplicators ? duplicatorPickHtml(p) : '',
      enhancerOpen && p.enhancers ? enhancerPickHtml(p) : '',
      gloveOpen && p.gloves?.includes(gloveOpen) ? glovePickHtml(p, gloveOpen) : '',
      altarOpen ? altarPickHtml(p, altarOpen) : '',
      ritualOpen ? ritualPickHtml(p, ritualOpen) : '',
      blessOpen && p.twilight?.holder === null ? blessPickHtml(p) : '',
      essenceOpen && powersOf(p).essence ? essencePickHtml(p) : '',
      bloodOpen && p.blood?.uses ? bloodPickHtml(p) : '',
      !p.commander ? commanderPickHtml(commanderPreview) : '',
      p.johnnie?.offer.length && !combat && !denHidden ? johnnieOfferHtml(p) : '',
      p.commander && p.cardOffer?.length && !combat && !cardsHidden ? cardOfferHtml(p) : '',
      p.commander && p.powerOffer && !p.cardOffer?.length && !combat && !cardsHidden ? powerOfferHtml(state, p) : '',
      p.commander && p.factionOrbOffer?.length && !p.powerOffer && !p.cardOffer?.length && !combat && !cardsHidden ? factionOrbOfferHtml(p) : '',
      // One pick at a time: the basic item after the commander card.
      p.commander && ((!p.cardOffer?.length && !p.powerOffer && !p.factionOrbOffer?.length) || cardsHidden) && p.itemOffer?.length && !combat ? itemOfferHtml(p) : '',
      boxOpen() ? boxHtml(state, p, boxShown, boxSelected, boxFresh) : '',
      termOpen ? termPopupHtml(termOpen) : '', // over whatever text opened it
      over ? gameOverHtml(p, state.players.length) : '',
    ].join('');
    // Show the next Box round pick after a beat.
    if (boxOpen() && boxShown < state.box!.picks.length && !boxTimer) {
      boxTimer = window.setTimeout(() => {
        boxTimer = 0;
        boxFresh = state.box?.picks[boxShown] ?? null;
        boxShown++;
        render();
      }, BOX_REVEAL_MS);
    }
    boxFresh = null; // animates on the render that revealed it only
    for (const el of slot('overlays').querySelectorAll<HTMLElement>('[data-keep-scroll]')) {
      const at = scrolled.get(el.dataset.keepScroll!);
      if (at) [el.scrollTop, el.scrollLeft] = at;
    }
    // While a fight plays the stage is busy; it shows the board again when the fight ends.
    if (!combat) stage.showPrep({ player: p, chosen: state.chosen, selectedUid, guide: lineup ? lineupGuide(lineup) : undefined });
  }

  // The Box round is on screen: after a stage's last fight, until Continue.
  const boxOpen = () => !!state.box && !combat && isAlive(me());

  function endTurn(): void {
    if (combat || state.box || !isAlive(me()) || isGameOver(state) || !me().commander) return;
    hpBefore = new Map(state.players.map((p) => [p.id, p.hp]));
    shieldBefore = me().shield ?? 0;
    const fights = resolveCombat(state);
    const fight = fights.find((f) => f.home === playerId || (f.away === playerId && !f.ghost));
    if (!fight) return nextRound();

    combat = { fight, opponentId: fight.home === playerId ? fight.away : fight.home, playback: null };
    selectedUid = null;
    picked = null;
    meter = createMeter(fight, playerId);
    render();
    const live = meter;
    // Only the meter repaints per event; nothing else changes mid-fight.
    const onEvent = (e: CombatEvent) => {
      recordEvent(live, e);
      if (railPanel === 'damage') renderPanel();
    };
    fightTick = 0;
    // The round timer ticks on its own, without redrawing the rest.
    const onTick = (tick: number) => {
      fightTick = tick;
      const el = document.getElementById('round-timer');
      const html = roundTimerHtml(tick);
      if (el && el.outerHTML !== html) el.outerHTML = html; // only when the second (or overtime) changes
    };
    combat.playback = stage.playFight(fight, playerId, onEvent, nextRound, onTick);
  }

  function nextRound(): void {
    const loot = combat?.fight.loot ?? 0;
    if (meter) meter.live = false;
    combat = null;
    hpBefore = null;
    denHidden = false;
    // A stage's last fight: the Box round first (Continue comes back here).
    if (boxOpen()) {
      boxShown = 0;
      boxSelected = null;
      return render();
    }
    const orbsBefore = me().orbs.length;
    const picks = (p: Player) => [p.cardOffer, p.powerOffer, p.factionOrbOffer];
    const picksBefore = picks(me());
    const bonuses = isAlive(me()) && !isGameOver(state) ? startRound(state) : [];
    // A new pick opens up again; picks still waiting from before stay as the player left them.
    if (picks(me()).some((o, i) => o && o !== picksBefore[i])) cardsHidden = false;
    render();
    if (me().orbs.length > orbsBefore) toast('🔮 You got a Magic Orb! Open 🎒 Equipment to use it.', 'info');
    if (loot) toast(`👹 Monster loot: pick ${loot} equipment, one at a time.`, 'info');
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
    // Likewise the skill popover.
    if (skillOpen && !target.closest('.skill-pop, [data-action="toggleSkill"]')) {
      skillOpen = false;
      render();
    }
    // Any click outside the gold popover closes it (and still does what it was for).
    if (incomeOpen && !target.closest('.income-pop, [data-action="toggleIncome"]')) {
      incomeOpen = false;
      render();
    }
    // The stage handles its own clicks (units and cells).
    if (target.closest('.stage')) return;
    // An item shows its details; unless one is already picked up and this is a slot to put it in.
    const chip = target.closest<HTMLElement>('.item-chip');
    if (chip?.dataset.item && !(picked && !combat && target.closest('[data-gear-unit]'))) {
      picked = null;
      selectedUid = null;
      openItem = Number(chip.dataset.item);
      return render();
    }
    // Click-to-equip: click an orb, or the popup's Equip, to pick it up, then a slot in the Equipment panel.
    if (!combat) {
      if (picked && target.closest('[data-gear-unit], [data-orb-unit]')) {
        const pick = picked;
        picked = null;
        return place(pick, target);
      }
      if (chip) {
        const next = pickOf(chip);
        picked = JSON.stringify(picked) === JSON.stringify(next) ? null : next;
        selectedUid = null;
        return render();
      }
      if (picked && target.closest('.armory-stash')) {
        const pick = picked;
        picked = null;
        return place(pick, target);
      }
    }
    // Any other click outside the unit card puts a picked-up item down and closes the card,
    // then still does its own thing. Modal popups on top don't count as outside.
    if ((picked || selectedUid !== null) && !target.closest('.unit-detail, .overlay')) {
      picked = null;
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
    // A button that carries a trait (Prime Selection's Take) does its action instead.
    const trait = target.closest<HTMLElement>('[data-trait]:not([data-action])');
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
      if (a === 'rail') {
        const panel = btn.dataset.panel as RailPanel;
        railPanel = railPanel === panel ? null : panel;
        slot('panel').innerHTML = '';
        render();
      } else if (a === 'loadLineup') {
        // Click the loaded one again to unload it.
        const t = loadSavedTeams()[Number(btn.dataset.index)];
        lineup = !t || t.name === lineup?.name ? null : t;
        render();
      } else if (a === 'unloadLineup') {
        lineup = null;
        render();
      } else if (a === 'meterTab') {
        meterTab = btn.dataset.tab as MeterTab;
        renderPanel();
      } else if (a === 'closeTrait') showTrait(null);
      else if (a === 'mistBuy') {
        const slot = Number(btn.dataset.slot);
        const ware = MIST_WARES[me().mistShop![slot]];
        if (ware.choose) {
          mistPick = slot;
          render();
        } else dispatch({ type: 'mistBuy', slot });
      } else if (a === 'unequipMistOrb') {
        dispatch({ type: 'unequipMistOrb', orb: Number(btn.dataset.orb) });
      } else if (a === 'mistPick') {
        const slot = mistPick!;
        mistPick = null;
        dispatch({ type: 'mistBuy', slot, choice: btn.dataset.choice! });
      } else if (a === 'hideDen' || a === 'showDen') {
        denHidden = a === 'hideDen';
        render();
      } else if (a === 'hideCards' || a === 'showCards') {
        cardsHidden = a === 'hideCards';
        render();
      } else if (a === 'previewCommander') {
        commanderPreview = btn.dataset.commander!;
        render();
      } else if (a === 'openMirror' || a === 'closeMirror') {
        mirrorOpen = a === 'openMirror';
        render();
      } else if (a === 'useMirror') {
        mirrorOpen = false;
        dispatch({ type: 'useMirror', unit: Number(btn.dataset.unit) });
      } else if (a === 'openDuplicator' || a === 'closeDuplicator') {
        duplicatorOpen = a === 'openDuplicator';
        render();
      } else if (a === 'useDuplicator') {
        duplicatorOpen = false;
        dispatch({ type: 'useDuplicator', item: Number(btn.dataset.item) });
      } else if (a === 'openEnhancer' || a === 'closeEnhancer') {
        enhancerOpen = a === 'openEnhancer';
        render();
      } else if (a === 'openTerm' || a === 'closeTerm') {
        termOpen = a === 'openTerm' ? (btn.dataset.term ?? null) : null;
        render();
      } else if (a === 'openPool' || a === 'closePool') {
        poolOpen = a === 'openPool';
        render();
      } else if (a === 'openGlove' || a === 'closeGlove') {
        gloveOpen = a === 'openGlove' ? (btn.dataset.glove ?? null) : null;
        render();
      } else if (a === 'useGlove') {
        gloveOpen = null;
        dispatch({ type: 'useGlove', glove: btn.dataset.glove!, unit: Number(btn.dataset.unit) });
      } else if (a === 'useEnhancer') {
        enhancerOpen = false;
        dispatch({ type: 'useEnhancer', item: Number(btn.dataset.item) });
      } else if (a === 'toggleSkill') {
        skillOpen = !skillOpen;
        skillFor = selectedUid;
        render();
      } else if (a === 'toggleIncome') {
        incomeOpen = !incomeOpen;
        render();
      } else if (a === 'commanderSection') {
        const section = btn.dataset.section as CommanderSection;
        commanderOpen = commanderOpen === section ? null : section;
        render();
      } else if (a === 'openBlood' || a === 'closeBlood') {
        bloodOpen = a === 'openBlood';
        render();
      } else if (a === 'bloodPact') {
        bloodOpen = false;
        dispatch({ type: 'bloodPact', unit: Number(btn.dataset.unit) });
      } else if (a === 'openEssence' || a === 'closeEssence') {
        essenceOpen = a === 'openEssence';
        render();
      } else if (a === 'essenceIn') {
        essenceOpen = false;
        dispatch({ type: 'essenceIn', unit: Number(btn.dataset.unit) });
      } else if (a === 'essenceOut') {
        dispatch({ type: 'essenceOut' });
      } else if (a === 'openBless' || a === 'closeBless') {
        blessOpen = a === 'openBless';
        render();
      } else if (a === 'bless') {
        blessOpen = false;
        dispatch({ type: 'bless', unit: Number(btn.dataset.unit) });
      } else if (a === 'openAltar') {
        altarOpen = btn.dataset.altar as AltarKey;
        render();
      } else if (a === 'closeAltar') {
        altarOpen = null;
        render();
      } else if (a === 'offer') {
        const altar = altarOpen!;
        altarOpen = null;
        dispatch({ type: 'offer', altar, unit: Number(btn.dataset.unit) });
      } else if (a === 'openRitual' || a === 'closeRitual') {
        ritualOpen = a === 'openRitual' ? (btn.dataset.mode as 'offer' | 'copy') : null;
        render();
      } else if (a === 'ritualOffer' || a === 'ritualCopy') {
        ritualOpen = null;
        dispatch({ type: a, unit: Number(btn.dataset.unit) });
      } else if (a === 'rollDice' || a === 'openTrove') {
        dispatch({ type: a });
      } else if (a === 'closeMistPick') {
        mistPick = null;
        render();
      } else if (a === 'closeUnitInfo') {
        openUnitInfo = null;
        render();
      }
      else if (a === 'closeItem') {
        openItem = null;
        render();
      } else if (a === 'pickUpItem') {
        openItem = null;
        picked = { kind: 'item', uid: Number(btn.dataset.itemUid) };
        render();
      } else if (a === 'takeOffItem') {
        openItem = null;
        dispatch({ type: 'unequip', item: Number(btn.dataset.itemUid) });
      } else if (a === 'closeBearer') {
        openBearer = null;
        render();
      } else if (a === 'closeOrb') {
        orbFor = null;
        render();
      } else if (a === 'useOrb') {
        const unit = orbFor!;
        orbFor = null;
        dispatch({ type: 'useOrb', unit, trait: btn.dataset.orbTrait! });
      } else if (a === 'openGallery' || a === 'closeGallery') showGallery(a === 'openGallery');
      else if (a === 'galleryTab') {
        galleryTab = btn.dataset.tab as GalleryTab;
        render();
      } else if (a === 'cardTier') {
        cardTier = btn.dataset.tier as PowerTier;
        render();
      }
      else if (a === 'closeUnit') selectUnit(null);
      else if (a === 'endTurn') endTurn();
      else if (a === 'skip') skip();
      else if (a === 'newGame') location.reload();
      else if (a === 'reroll' || a === 'levelUp' || a === 'toggleLock') dispatch({ type: a });
      else if (a === 'fullHouse') dispatch({ type: 'fullHouse', tier: Number(btn.dataset.tier) });
      else if (a === 'pickCommander') dispatch({ type: 'pickCommander', commander: btn.dataset.commander! });
      else if (a === 'enhance') dispatch({ type: 'enhance', trait: btn.dataset.enhance! });
      else if (a === 'claimEnhance') dispatch({ type: 'claimEnhance', level: Number(btn.dataset.level) });
      else if (a === 'pickJohnnie') dispatch({ type: 'pickJohnnie', johnnie: btn.dataset.johnnie! });
      else if (a === 'pickCard') {
        const from = btn.closest<HTMLElement>('.pick-card');
        const rect = from?.getBoundingClientRect();
        dispatch({ type: 'pickCard', card: btn.dataset.card! });
        if (from && rect && me().commanderCard) flyToTray(from, rect, 0);
      }
      else if (a === 'rerollCard') dispatch({ type: 'rerollCard', slot: Number(btn.dataset.slot) });
      else if (a === 'pickFactionOrb') dispatch({ type: 'pickFactionOrb', trait: btn.dataset.trait! });
      else if (a === 'rerollPower') dispatch({ type: 'rerollPower', slot: Number(btn.dataset.slot) });
      else if (a === 'pickPower') {
        const from = btn.closest<HTMLElement>('.pick-card');
        const rect = from?.getBoundingClientRect();
        const before = me().powerCards?.length ?? 0;
        const gold = me().gold;
        dispatch({ type: 'pickPower', card: btn.dataset.card! });
        if (from && rect && (me().powerCards?.length ?? 0) > before) flyToTray(from, rect, before + 1);
        if (me().gold > gold) toast(`💰 +${me().gold - gold} gold`, 'info');
      }
      else if (a === 'pickItem') dispatch({ type: 'pickItem', item: btn.dataset.itemId! });
      else if (a === 'boxSelect') {
        const i = Number(btn.dataset.prize);
        boxSelected = boxSelected === i ? null : i;
        render();
      } else if (a === 'pickBox' && boxSelected !== null) {
        const prize = boxSelected;
        boxSelected = null;
        dispatch({ type: 'pickBox', prize });
        // Your own pick shows at once, stamped.
        if (state.box && state.box.picks[boxShown] === prize) {
          boxShown++;
          boxFresh = prize;
          render();
        }
      }
      else if (a === 'boxDone') {
        closeBox(state);
        nextRound();
      }
      else if (a === 'mark') dispatch({ type: 'mark', kind: btn.dataset.kind as MarkKind, unit: Number(btn.dataset.unit) });
      else if (a === 'buy') dispatch({ type: 'buy', slot: Number(btn.dataset.slot) });
      else if (a === 'unequip') dispatch({ type: 'unequip', item: Number(btn.dataset.item) });
      else if (a === 'sellUnit') {
        const from = unitLoc(Number(btn.dataset.uid));
        if (from) dispatch({ type: 'sell', from });
      }
      return;
    }
  });

  window.addEventListener('keydown', (e) => {
    // Clickable non-buttons (a pick dialog's cards) take Enter and Space like buttons.
    const el = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && el.getAttribute?.('role') === 'button' && el.dataset.action) {
      e.preventDefault();
      return el.click();
    }
    // Nothing else until a commander is picked.
    if (e.repeat || !me().commander) return;
    if (e.key === 'Escape' && skillOpen) {
      skillOpen = false;
      return render();
    }
    if (e.key === 'Escape' && incomeOpen) {
      incomeOpen = false;
      return render();
    }
    if (e.key === 'Escape' && termOpen) {
      termOpen = null;
      return render();
    }
    if (e.key === 'Escape' && openUnitInfo) {
      openUnitInfo = null;
      return render();
    }
    if (e.key === 'Escape' && openTrait) return showTrait(null);
    if (e.key === 'Escape' && galleryOpen) return showGallery(false);
    if (e.key === 'Escape' && openItem !== null) {
      openItem = null;
      return render();
    }
    if (e.key === 'Escape' && openBearer !== null) {
      openBearer = null;
      return render();
    }
    if (e.key === 'Escape' && orbFor !== null) {
      orbFor = null;
      return render();
    }
    if (e.key === 'Escape' && picked) {
      picked = null;
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

  // Gear drag: pointer events (not the browser's drag-and-drop API, which is unreliable).
  // A ghost copy of the chip follows the pointer; drop it on a slot, or back at the top to take it off.
  // A press that barely moves stays a click (pick up, then click a slot).
  root.addEventListener('pointerdown', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.item-chip');
    if (!chip || combat || e.button !== 0) return;
    const pick = pickOf(chip);
    const start = { x: e.clientX, y: e.clientY };
    let ghost: HTMLElement | null = null;
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        ghost = chip.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        document.body.append(ghost);
        draggingGear = pick;
        picked = null;
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
      draggingGear = null;
      swallowClick = true;
      place(pick, document.elementFromPoint(ev.clientX, ev.clientY));
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
