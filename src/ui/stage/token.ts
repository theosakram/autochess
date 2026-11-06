import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { ITEMS } from '../../game/items';
import { TRAITS } from '../../game/traits';
import { UNIT_BY_ID } from '../../game/units';
import { COLORS, FONT, mix, TIER_COLORS } from './theme';

export interface TokenSpec {
  defId: string;
  star: number;
  size: number; // cell size; the chip is drawn a little smaller, centred on (0, 0)
  crowned?: boolean;
  leads?: string[]; // traits this unit leads; each shows its leader icon
  orb?: string | null; // trait the player's Magic Orb boosts through this unit
  mistOrbs?: string[]; // traits of the Mist orbs it holds
  itemIds?: string[];
  foe?: boolean;
  selected?: boolean;
  target?: boolean; // can take the item currently picked up
  bars?: boolean; // hp and mana bars, for combat
}

export interface TokenView {
  root: Container;
  setBar(bar: 'hp' | 'mana' | 'shield', fraction: number): void; // shield: of max hp
  flash(color: number): Graphics; // a coloured overlay at full strength; fade its alpha to animate
}

const text = (value: string, size: number, fill: number, weight: '400' | '700' | '900' = '400') =>
  new Text({ text: value, style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight } });

// Shortens a label with an ellipsis until it fits `maxWidth`.
function fit(label: Text, maxWidth: number): void {
  while (label.width > maxWidth && label.text.length > 2) label.text = `${label.text.slice(0, -2)}…`;
}

export function makeToken(s: TokenSpec): TokenView {
  const def = UNIT_BY_ID[s.defId];
  const tier = TIER_COLORS[def.tier];
  const w = s.size - 6;
  const half = w / 2;
  const radius = Math.max(3, w * 0.08);
  const root = new Container();
  // The whole square is the click/drag target; decorations (outlines, icons, bars) never take part
  // in hit-testing, or a stroke-only outline on top can swallow the hit.
  root.hitArea = new Rectangle(-half, -half, w, w);
  root.interactiveChildren = false;

  // A leader (Astral's Sovereign) glows: a soft halo under the chip and a bright rim on it.
  const leads = (s.leads ?? []).length > 0;
  if (leads) {
    root.addChild(
      new Graphics()
        .roundRect(-half - 4, -half - 4, w + 8, w + 8, radius + 4)
        .stroke({ width: 6, color: COLORS.leader, alpha: 0.3 })
        .roundRect(-half - 1.5, -half - 1.5, w + 3, w + 3, radius + 1.5)
        .stroke({ width: 1.5, color: COLORS.leader, alpha: 0.9 }),
    );
  }
  root.addChild(
    new Graphics()
      .roundRect(-half, -half, w, w, radius)
      .fill(mix(COLORS.cell, tier, 0.25))
      .stroke({ width: 2, color: leads ? mix(tier, COLORS.leader, 0.6) : tier }),
  );
  if (s.foe) root.addChild(new Graphics().roundRect(-half + 2, -half + 2, w - 4, w - 4, radius).stroke({ width: 1, color: COLORS.foe }));
  if (s.selected || s.target) {
    root.addChild(
      new Graphics()
        .roundRect(-half - 3, -half - 3, w + 6, w + 6, radius + 3)
        .stroke({ width: 2, color: s.selected ? COLORS.selected : COLORS.accent }),
    );
  }

  const small = Math.max(8, w * 0.14);
  const corner = (value: string, x: number, y: number, ax: number, ay: number) => {
    const t = text(value, small, COLORS.text);
    t.anchor.set(ax, ay);
    t.position.set(x, y);
    root.addChild(t);
  };
  const barSpace = s.bars ? 9 : 0;
  const icons = def.traits.map((id) => TRAITS[id].icon).join('') + (def.honorary?.icon ?? '');
  if (icons) corner(icons, -half + 3, -half + 3 + barSpace, 0, 0);
  const badges = (s.orb ? '🔮' : '') + '🌫️'.repeat(s.mistOrbs?.length ?? 0) + (s.crowned ? '👑' : '') + (s.leads ?? []).map((id) => TRAITS[id].leader?.icon ?? '').join('');
  if (badges) corner(badges, half - 3, -half + 3 + barSpace, 1, 0);
  if (s.itemIds?.length) corner(s.itemIds.map((id) => ITEMS[id].icon).join(''), -half + 3, half - 3, 0, 1);

  const name = text(def.name, Math.max(9, w * 0.15), COLORS.text, '700');
  fit(name, w - 6);
  name.anchor.set(0.5);
  name.position.set(0, small * 0.2);
  root.addChild(name);
  const stars = text('★'.repeat(s.star), Math.max(8, w * 0.12), COLORS.accent);
  stars.anchor.set(0.5, 0);
  stars.position.set(0, name.y + name.height / 2);
  root.addChild(stars);

  // Combat bars along the top edge.
  const barW = w - 8;
  const bars: Record<'hp' | 'mana', Graphics> = { hp: new Graphics(), mana: new Graphics() };
  const barColor = { hp: s.foe ? COLORS.foe : COLORS.hp, mana: COLORS.mana };
  const barY = { hp: -half + 3, mana: -half + 8 };
  const frac = { hp: 1, mana: 0, shield: 0 };
  const draw = (bar: 'hp' | 'mana') => {
    const f = frac[bar];
    const h = bar === 'hp' ? 4 : 3;
    bars[bar].clear().rect(-barW / 2, barY[bar], barW, h).fill({ color: 0x000000, alpha: 0.5 });
    if (f > 0) bars[bar].rect(-barW / 2, barY[bar], barW * f, h).fill(barColor[bar]);
    // The shield sits right after the remaining hp, up to the bar's end.
    const sh = bar === 'hp' ? Math.min(frac.shield, 1 - f) : 0;
    if (sh > 0) bars.hp.rect(-barW / 2 + barW * f, barY.hp, barW * sh, h).fill(COLORS.shield);
  };
  const setBar = (bar: 'hp' | 'mana' | 'shield', fraction: number) => {
    frac[bar] = Math.max(0, Math.min(1, fraction));
    draw(bar === 'mana' ? 'mana' : 'hp');
  };
  if (s.bars) {
    root.addChild(bars.hp, bars.mana);
    setBar('hp', 1);
    setBar('mana', 0);
  }

  const overlay = new Graphics();
  overlay.alpha = 0;
  root.addChild(overlay);
  const flash = (color: number) => {
    overlay.clear().roundRect(-half, -half, w, w, radius).fill({ color, alpha: 0.55 });
    overlay.alpha = 1;
    return overlay;
  };

  return { root, setBar, flash };
}
