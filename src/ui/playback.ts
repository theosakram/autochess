import type { CombatEvent } from '../game/combat';
import { MOVE_TICKS, TICKS_PER_SECOND } from '../game/config';
import type { Fight } from '../game/game';
import { viewPoint, type Point, type Side } from '../game/grid';
import { UNIT_BY_ID } from '../game/units';
import { unitBodyHtml } from './views';

const TICK_MS = 1000 / TICKS_PER_SECOND;
const RESULT_MS = 1500;
const DASH_MS = 120;

export interface Playback {
  skip(): void;
}

interface FighterView {
  el: HTMLElement;
  maxHp: number;
  maxMana: number;
}

// Replays a fight's event log onto `layer`, viewer's side at the bottom. `onEvent` sees each
// event as it's shown. Calls onDone once the result banner has shown (or straight away when skipped twice).
export function playFight(
  layer: HTMLElement,
  fight: Fight,
  viewerId: string,
  onEvent: (e: CombatEvent) => void,
  onDone: () => void,
): Playback {
  const { result } = fight;
  const mySide: Side = fight.home === viewerId ? 0 : 1;
  const views = new Map<number, FighterView>();

  const place = (el: HTMLElement, p: Point) => {
    const v = viewPoint(p, mySide === 1);
    el.style.setProperty('--x', String(v.x));
    el.style.setProperty('--y', String(v.y));
  };
  const setBar = (id: number, bar: 'hp' | 'mana', value: number) => {
    const v = views.get(id)!;
    const max = bar === 'hp' ? v.maxHp : v.maxMana;
    v.el.querySelector<HTMLElement>(`.${bar}-fill`)!.style.width = `${(value / max) * 100}%`;
  };

  for (const f of result.fighters) {
    const def = UNIT_BY_ID[f.defId];
    const el = document.createElement('div');
    el.className = `fighter tier-${def.tier} ${f.side === mySide ? 'mine' : 'foe'}${f.onTile ? ' on-tile' : ''}`;
    el.style.transitionDuration = `${MOVE_TICKS * TICK_MS}ms`;
    el.innerHTML = `<div class="hp"><div class="hp-fill"></div></div>
      <div class="mana"><div class="mana-fill"></div></div>
      ${unitBodyHtml(
        f.defId,
        f.star,
        f.chosen !== null,
        f.items.map((i) => i.id),
        f.orb,
      )}`;
    place(el, f);
    layer.append(el);
    views.set(f.id, { el, maxHp: f.maxHp, maxMana: f.maxMana });
    setBar(f.id, 'mana', f.mana);
  }

  // Restarts a one-shot CSS animation class on a fighter.
  const flash = (id: number, ...classes: string[]) => {
    const { el } = views.get(id)!;
    el.classList.remove(...classes);
    void el.offsetWidth;
    el.classList.add(...classes);
  };
  const popDamage = (id: number, text: number | string, className: string) => {
    const dmg = document.createElement('span');
    dmg.className = `dmg ${className}`;
    dmg.textContent = String(text);
    dmg.addEventListener('animationend', () => dmg.remove());
    views.get(id)!.el.append(dmg);
  };

  const apply = (e: CombatEvent) => {
    onEvent(e);
    switch (e.type) {
      case 'move':
        place(views.get(e.id)!.el, e);
        break;
      case 'attack':
      case 'cast':
        flash(e.id, e.type === 'cast' ? 'casting' : 'attacking');
        setBar(e.target, 'hp', e.hp);
        setBar(e.id, 'mana', e.mana);
        setBar(e.target, 'mana', e.targetMana);
        popDamage(e.target, e.damage, e.type === 'cast' ? 'spell' : e.crit ? 'crit' : '');
        break;
      case 'effect':
        // Per-effect look comes from CSS: .struck.effect-<id> and .dmg.effect-<id>.
        flash(e.target, 'struck', `effect-${e.effect}`);
        setBar(e.target, 'hp', e.hp);
        popDamage(e.target, e.damage, e.crit ? 'crit' : `effect-${e.effect}`);
        break;
      case 'heal':
        setBar(e.id, 'hp', e.hp);
        popDamage(e.id, `+${e.amount}`, 'heal');
        break;
      case 'skill':
        flash(e.id, 'casting');
        setBar(e.id, 'mana', 0);
        break;
      case 'dash': {
        // A dash is a quick slide, not a walk.
        const { el } = views.get(e.id)!;
        el.style.transitionDuration = `${DASH_MS}ms`;
        place(el, e);
        window.setTimeout(() => (el.style.transitionDuration = `${MOVE_TICKS * TICK_MS}ms`), DASH_MS);
        break;
      }
      case 'buff':
        views.get(e.id)!.el.classList.add('buffed', `effect-${e.effect}`);
        break;
      case 'stun':
        views.get(e.id)!.el.classList.add('stunned');
        stunEnds.set(e.id, e.until);
        break;
      case 'trigger': {
        // Warps snap instantly instead of sliding like a walk.
        const { el } = views.get(e.id)!;
        el.style.transitionDuration = '0ms';
        place(el, e);
        void el.offsetWidth;
        el.style.transitionDuration = `${MOVE_TICKS * TICK_MS}ms`;
        flash(e.id, 'struck', `effect-${e.trait}`);
        setBar(e.id, 'hp', e.hp);
        if (e.heal) popDamage(e.id, `+${e.heal}`, 'heal');
        break;
      }
      case 'death':
        views.get(e.id)!.el.classList.add('dead');
        break;
    }
  };

  // Stunned fighters and the tick their stun wears off.
  const stunEnds = new Map<number, number>();
  const wakeUp = (all: boolean) => {
    for (const [id, until] of stunEnds) {
      if (!all && tick < until) continue;
      views.get(id)!.el.classList.remove('stunned');
      stunEnds.delete(id);
    }
  };

  let tick = 0;
  let next = 0;
  let finished = false;
  let doneTimer = 0;

  const timer = window.setInterval(() => {
    while (next < result.events.length && result.events[next].t <= tick) apply(result.events[next++]);
    wakeUp(false);
    if (++tick > result.ticks) finish();
  }, TICK_MS);

  function finish(): void {
    clearInterval(timer);
    wakeUp(true);
    finished = true;
    const won = result.winner === mySide;
    const banner = document.createElement('div');
    banner.className = `banner ${result.winner === null ? 'draw' : won ? 'win' : 'loss'}`;
    banner.textContent = result.winner === null ? 'Draw' : won ? 'Victory' : `Defeat  −${fight.damage} HP`;
    layer.append(banner);
    doneTimer = window.setTimeout(onDone, RESULT_MS);
  }

  return {
    skip() {
      if (finished) {
        clearTimeout(doneTimer);
        onDone();
        return;
      }
      while (next < result.events.length) apply(result.events[next++]);
      finish();
    },
  };
}
