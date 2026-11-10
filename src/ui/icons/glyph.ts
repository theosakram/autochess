// A one-path glyph (game-icons.net style, 512x512) as a themed icon: the glyph in `ink`, traced with a thin `rim`,
// on a `plate` colour drawn by whoever shows it.
//
// `ink: 'iridescent'` shimmers. HTML: a rainbow gradient (the img's class 'iridescent' animates its hue). The board:
// Pixi's SVG parser has no gradients, so it gets the rim and a white glyph apart (`board`) and cycles the glyph's tint.
export interface GlyphIcon {
  svg: string; // the HTML version (and the board's, unless `board` is set)
  plate: string;
  className?: string; // for the HTML img
  board?: { rim: string; ink: string }; // separate SVGs for the board: the rim, and the glyph to tint
}

const VIEW = 'viewBox="-10 -10 532 532"';
const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" ${VIEW} aria-hidden="true">${body}</svg>`;
const rimPath = (d: string, rim: string) => `<path d="${d}" fill="none" stroke="${rim}" stroke-width="20" stroke-linejoin="round"/>`;

const IRIDESCENT =
  '<defs><linearGradient id="ir" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#ff7ad9"/><stop offset="0.33" stop-color="#7af5ff"/>' +
  '<stop offset="0.66" stop-color="#b48cff"/><stop offset="1" stop-color="#ffe27a"/>' +
  '</linearGradient></defs>';

export function glyphIcon(d: string, colors: { ink: string; rim: string; plate: string }): GlyphIcon {
  if (colors.ink === 'iridescent') {
    return {
      svg: wrap(`${IRIDESCENT}${rimPath(d, colors.rim)}<path d="${d}" fill="url(#ir)"/>`),
      plate: colors.plate,
      className: 'iridescent',
      // The rim's box matches the glyph's (same path, same stroke), so the two line up when scaled alike.
      board: { rim: wrap(rimPath(d, colors.rim)), ink: wrap(`${rimPath(d, 'none')}<path d="${d}" fill="#ffffff"/>`) },
    };
  }
  return { svg: wrap(`${rimPath(d, colors.rim)}<path d="${d}" fill="${colors.ink}"/>`), plate: colors.plate };
}
