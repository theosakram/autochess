import { createGame } from '../game/game';
import type { BotLevel, Player } from '../game/types';
import { DIFFICULTIES, homeGalleryHtml, homeHtml, type HomeTab, traitDetailHtml, unitInfoHtml } from './views';

// The screen before a game: Play, or browse the gallery (heroes, commanders, items, synergies).
// Resolves with the bot difficulty once Play is clicked; by then its listeners are gone and `root` is empty.
// The difficulty picked is remembered for next time.
const DIFFICULTY_KEY = 'autochess.difficulty';

export function showHome(root: HTMLElement): Promise<BotLevel> {
  const saved = localStorage.getItem(DIFFICULTY_KEY);
  let difficulty: BotLevel = DIFFICULTIES.find((d) => d.id === saved)?.id ?? 'normal';
  // Trait cards and unit popups read a player; this one owns nothing.
  const viewer: Player = { ...createGame(0, [{ id: 'viewer', name: '', isBot: false }]).players[0], bench: [], board: [] };
  let view: 'home' | 'gallery' = 'home';
  let tab: HomeTab = 'heroes';
  let openUnit: string | null = null;
  let openTrait: string | null = null;
  const scrolls = new Map<string, number>();
  const listeners = new AbortController();

  function render(): void {
    for (const el of root.querySelectorAll<HTMLElement>('[data-keep-scroll]')) scrolls.set(el.dataset.keepScroll!, el.scrollTop);
    root.innerHTML =
      (view === 'home' ? homeHtml(difficulty) : homeGalleryHtml(viewer, tab)) +
      (openTrait ? traitDetailHtml(openTrait, viewer, {}, false) : '') +
      (openUnit ? unitInfoHtml(openUnit, viewer) : '');
    for (const el of root.querySelectorAll<HTMLElement>('[data-keep-scroll]')) el.scrollTop = scrolls.get(el.dataset.keepScroll!) ?? 0;
  }

  return new Promise((resolve) => {
    root.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
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
        if (a === 'openGallery') view = 'gallery';
        else if (a === 'home') view = 'home';
        else if (a === 'homeTab') tab = btn.dataset.tab as HomeTab;
        else if (a === 'closeUnitInfo') openUnit = null;
        else if (a === 'closeTrait') openTrait = null;
        else return;
        render();
      },
      { signal: listeners.signal },
    );
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return;
        if (openUnit) openUnit = null;
        else if (openTrait) openTrait = null;
        else if (view === 'gallery') view = 'home';
        else return;
        render();
      },
      { signal: listeners.signal },
    );
    render();
  });
}
