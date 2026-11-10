import { Container, Graphics, GraphicsContext, Rectangle, Text } from 'pixi.js';
import { ITEMS } from '../../game/items';
import { TRAITS } from '../../game/traits';
import { UNIT_BY_ID } from '../../game/units';
import { portraitOf } from '../portraits';
import { badgeSvg, BEARER_BADGES, TRAIT_BADGES, type TraitBadge } from '../traitBadges';
import { bloodStars } from '../../game/blood';
import { BLOOD_STAR, COLORS, FONT, mix, STAR_COLORS, TIER_COLORS } from './theme';

export interface TokenSpec {
  defId: string;
  star: number;
  size: number; // cell size; the chip is drawn a little smaller, centred on (0, 0)
  crowned?: boolean;
  leads?: string[]; // traits this unit leads; each shows its leader icon
  orb?: string | null; // trait the player's Magic Orb boosts through this unit
  mistOrbs?: string[]; // traits of the Mist orbs it holds
  marks?: string[]; // icons of the commander marks it holds (Kagura's umbrella and dance)
  itemIds?: string[];
  foe?: boolean;
  selected?: boolean;
  bars?: boolean; // hp and mana bars, for combat
  hpBar?: boolean; // just the hp bar, full: the preparation board, to compare who's tankier
  maxHp?: number; // with bars or hpBar: a divider on the hp bar every HP_TICK hp
  copies?: number; // Alice's Blood Pact hero: red stars, the last one partly filled
  merc?: boolean; // Rogue Mercenary: a briefcase in the corner
  signature?: boolean; // a hero card's hero: a medal in the corner
}

export interface TokenView {
  root: Container;
  setBar(bar: 'hp' | 'mana' | 'shield', fraction: number): void; // shield: of max hp
  flash(color: number): Graphics; // a coloured overlay at full strength; fade its alpha to animate
}

const text = (value: string, size: number, fill: number, weight: '400' | '700' | '900' = '400') =>
  new Text({ text: value, style: { fontFamily: FONT, fontSize: size, fill, fontWeight: weight } });

// One parsed drawing per badge, shared by every token: a board rebuilds its tokens on each action.
const ICONS = new Map<TraitBadge, GraphicsContext>();
const iconOf = (b: TraitBadge) => ICONS.get(b) ?? ICONS.set(b, new GraphicsContext().svg(badgeSvg(b))).get(b)!;

// A round badge, centred on (0, 0): the same one the HTML side shows.
function drawBadge(b: TraitBadge, size: number): Container {
  const badge = new Container();
  const icon = new Graphics(iconOf(b));
  const scale = (size * 0.72) / 24;
  icon.scale.set(scale);
  icon.position.set(-12 * scale);
  badge.addChild(new Graphics().circle(0, 0, size / 2).fill(b.color).stroke({ width: 1, color: 0x000000, alpha: 0.5 }), icon);
  return badge;
}

// Fits a name to `maxWidth`: on two lines, then in smaller type, with an ellipsis as a last resort.
function fit(label: Text, maxWidth: number): void {
  if (label.width > maxWidth && label.text.includes(' ')) label.text = label.text.replace(/ (?=\S+$)/, '\n');
  while (label.width > maxWidth && label.style.fontSize > 7) label.style.fontSize -= 0.5;
  while (label.width > maxWidth && label.text.length > 2) label.text = `${label.text.slice(0, -2)}…`;
}

// HP per divider on a combat hp bar: big units read as big. Too crowded (under HP_TICK_GAP px apart), each
// divider stands for 5x more, drawn gold so a boss still reads as huge.
const HP_TICK = 2000;
const HP_TICK_GAP = 4;

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
  // The plate and rim are the hero's cost, and the big picture is who it is.
  root.addChild(
    new Graphics()
      .roundRect(-half, -half, w, w, radius)
      .fill(mix(COLORS.bg, tier, 0.7))
      .stroke({ width: Math.max(2, w * 0.035), color: leads ? mix(tier, COLORS.leader, 0.6) : tier }),
  );
  // In a fight, sides must read instantly: a thick frame in the side's own colour.
  if (s.bars || s.foe) {
    root.addChild(
      new Graphics()
        .roundRect(-half - 2, -half - 2, w + 4, w + 4, radius + 2)
        .stroke({ width: 3, color: s.foe ? COLORS.foe : COLORS.ally }),
    );
  }
  if (s.selected) {
    root.addChild(
      new Graphics()
        .roundRect(-half - 3, -half - 3, w + 6, w + 6, radius + 3)
        .stroke({ width: 3, color: COLORS.selected }),
    );
  }

  const hpH = Math.max(5, w * 0.07);
  const manaH = Math.max(3, w * 0.045);
  const barSpace = s.bars ? hpH + manaH + 3 : s.hpBar ? hpH + 2 : 0;

  const nameSize = Math.max(9, w * 0.13);
  const name = new Text({ text: def.name, style: { fontFamily: FONT, fontSize: nameSize, fill: COLORS.text, fontWeight: '700', align: 'center', lineHeight: nameSize * 1.05 } });
  fit(name, w - 6);
  const ribbonH = name.height + 3;
  const ribbonTop = half - ribbonH;
  root.addChild(
    new Graphics()
      .roundRect(-half + 1, ribbonTop, w - 2, ribbonH - 1, radius)
      .fill({ color: s.foe ? mix(0x000000, COLORS.foe, 0.55) : 0x000000, alpha: 0.72 }),
  );
  name.anchor.set(0.5);
  name.position.set(0, ribbonTop + ribbonH / 2 - 0.5);
  root.addChild(name);

  const faceTop = -half + barSpace;
  const face = text(portraitOf(s.defId), (ribbonTop - faceTop) * 0.74, 0xffffff);
  face.anchor.set(0.5);
  face.position.set(0, (faceTop + ribbonTop) / 2);
  root.addChild(face);

  const small = Math.max(9, w * 0.14);
  const corner = (value: string, x: number, y: number, ax: number, ay: number) => {
    const t = text(value, small, COLORS.text);
    t.anchor.set(ax, ay);
    t.position.set(x, y);
    root.addChild(t);
  };
  if (w > 60) {
    const size = small * 1.3;
    [...def.traits.map((id) => TRAIT_BADGES[id]), ...(def.honorary ? [BEARER_BADGES[def.honorary.trait]] : [])].forEach((b, i) => {
      const badge = drawBadge(b, size);
      badge.position.set(-half + 3 + size / 2 + i * (size + 1), -half + 3 + barSpace + size / 2);
      root.addChild(badge);
    });
  }
  const badges = (s.marks ?? []).join('') + (s.orb ? '🔮' : '') + '🌫️'.repeat(s.mistOrbs?.length ?? 0) + (s.crowned ? '👑' : '') + (s.merc ? '💼' : '') + (s.signature ? '🏅' : '') + (s.leads ?? []).map((id) => TRAITS[id].leader?.icon ?? '').join('');
  if (badges) corner(badges, half - 3, -half + 3 + barSpace, 1, 0);
  if (s.itemIds?.length) corner(s.itemIds.map((id) => ITEMS[id].icon).join(''), -half + 3, ribbonTop - 1, 0, 1);

  if (s.copies !== undefined) {
    // Blood Pact: drawn stars, so the partial one can be filled part way (left to right).
    const { full, frac } = bloodStars(s.copies);
    const r = Math.max(5, w * 0.075);
    const count = full + (frac > 0 ? 1 : 0);
    const row = new Container();
    for (let i = 0; i < count; i++) {
      const fill = i < full ? 1 : frac;
      const cx = -(count - 1 - i) * r * 2.05;
      const pts = starPoints(cx, 0, r);
      row.addChild(new Graphics().poly(pts).fill({ color: 0x2a0a10 }).stroke({ color: 0x000000, width: 2 }));
      const lit = new Graphics().poly(pts).fill({ color: BLOOD_STAR });
      if (fill < 1) {
        const mask = new Graphics().rect(cx - r, -r, r * 2 * fill, r * 2).fill({ color: 0xffffff });
        row.addChild(mask);
        lit.mask = mask;
      }
      row.addChild(lit);
      row.addChild(new Graphics().poly(pts).stroke({ color: 0xffb3b3, width: 1, alpha: 0.6 }));
    }
    row.position.set(half - 3 - r, ribbonTop - r + 1);
    root.addChild(row);
  } else {
    const stars = new Text({
      text: '★'.repeat(s.star),
      style: { fontFamily: FONT, fontSize: Math.max(11, w * 0.17), fill: STAR_COLORS[s.star] ?? COLORS.accent, fontWeight: '900', stroke: { color: 0x000000, width: 3 } },
    });
    stars.anchor.set(1, 1);
    stars.position.set(half - 3, ribbonTop + 2);
    root.addChild(stars);
  }

  // Combat bars along the top edge.
  const barW = w - 8;
  const bars: Record<'hp' | 'mana', Graphics> = { hp: new Graphics(), mana: new Graphics() };
  const barColor = { hp: s.foe ? COLORS.foe : COLORS.hp, mana: COLORS.mana };
  const barY = { hp: -half + 2, mana: -half + 3 + hpH };
  const frac = { hp: 1, mana: 0, shield: 0 };
  const draw = (bar: 'hp' | 'mana') => {
    const f = frac[bar];
    const h = bar === 'hp' ? hpH : manaH;
    // The shield sits right after the remaining hp. When hp + shield is more than max hp, both shrink
    // to fit, so a shield on a healthy unit still shows.
    const shield = bar === 'hp' ? frac.shield : 0;
    const scale = f + shield > 1 ? 1 / (f + shield) : 1;
    bars[bar].clear().rect(-barW / 2, barY[bar], barW, h).fill({ color: 0x000000, alpha: 0.5 });
    if (f > 0) bars[bar].rect(-barW / 2, barY[bar], barW * f * scale, h).fill(barColor[bar]);
    if (shield > 0) bars.hp.rect(-barW / 2 + barW * f * scale, barY.hp, barW * shield * scale, h).fill(COLORS.shield);
    if (bar === 'hp' && s.maxHp) {
      // Across hp and shield both: past max hp when the shield overflows it.
      let step = HP_TICK;
      while ((barW * scale * step) / s.maxHp < HP_TICK_GAP) step *= 5;
      for (let hp = step; hp < s.maxHp * Math.max(1, f + shield); hp += step) bars.hp.rect(-barW / 2 + (barW * scale * hp) / s.maxHp - 1, barY.hp, 2, h);
      bars.hp.fill(step === HP_TICK ? { color: 0x000000, alpha: 0.85 } : { color: COLORS.leader, alpha: 0.9 });
    }
  };
  const setBar = (bar: 'hp' | 'mana' | 'shield', fraction: number) => {
    frac[bar] = Math.max(0, Math.min(1, fraction));
    draw(bar === 'mana' ? 'mana' : 'hp');
  };
  if (s.bars || s.hpBar) {
    root.addChild(bars.hp);
    if (s.bars) root.addChild(bars.mana);
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

// A five-pointed star's outline around (cx, cy), outer radius r, point up.
function starPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  return pts;
}
