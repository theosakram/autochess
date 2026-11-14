import { Container, Graphics, GraphicsContext, Text } from 'pixi.js';
import { EMOJI, emojiSvg } from '../icons/emoji';
import { FONT } from './theme';

// The board's version of iconize (icons/emoji.ts): a row of emoji as their drawings, `size` tall, with its
// anchor at (ax, ay) of the row like a Text's. An emoji with no drawing stays text.
const PARSED = new Map<string, GraphicsContext>();

export function emojiView(value: string, size: number, ax = 0.5, ay = 0.5): Container {
  const row = new Container();
  let x = 0;
  for (const [emoji] of value.matchAll(EMOJI)) {
    const svg = emojiSvg(emoji);
    let piece: Container;
    if (svg) {
      const g = new Graphics(PARSED.get(svg) ?? PARSED.set(svg, new GraphicsContext().svg(svg)).get(svg)!);
      if (svg.includes('viewBox="0 0 24 24"')) g.scale.set(size / 24); // the UI's own drawings: a 24 grid
      else {
        const b = g.getLocalBounds(); // an item's or a card's: fit it
        g.pivot.set(b.x, b.y);
        g.scale.set(size / Math.max(b.width, b.height, 1));
      }
      piece = g;
    } else {
      piece = new Text({ text: emoji, style: { fontFamily: FONT, fontSize: size * 0.85 } });
    }
    piece.position.set(x, 0);
    row.addChild(piece);
    x += size + size * 0.08;
  }
  const w = Math.max(0, x - size * 0.08);
  row.pivot.set(w * ax, size * ay);
  return row;
}
