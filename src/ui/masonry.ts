// Masonry for the synergy gallery: a grid of tiny rows where each card spans as many rows as it is tall,
// so columns fill evenly and cards stay in order left to right (CSS columns leave a column half empty
// when a few tall cards can't be split). Re-measured whenever a card changes size (level picks, resizes).
const ROW = 2; // px, matches .trait-gallery's grid-auto-rows
const GAP = 14; // px between cards, vertically

let observer: ResizeObserver | null = null;

const fit = (card: HTMLElement) => {
  card.style.gridRowEnd = `span ${Math.ceil((card.getBoundingClientRect().height + GAP) / ROW)}`;
};

// Call after every render that may have drawn a synergy gallery under `root`.
export function layoutMasonry(root: ParentNode): void {
  observer?.disconnect();
  observer = null;
  const cards = root.querySelectorAll<HTMLElement>('.trait-gallery > .trait-card');
  if (!cards.length) return;
  observer = new ResizeObserver((entries) => {
    for (const e of entries) fit(e.target as HTMLElement);
  });
  for (const card of cards) {
    fit(card);
    observer.observe(card);
  }
}
