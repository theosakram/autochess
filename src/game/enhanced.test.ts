import { describe, expect, test } from 'bun:test';
import { unitMods } from './traits';
import { UNIT_BY_ID, UNITS } from './units';
import { TICKS_PER_SECOND } from './config';
import { BASIC_ITEMS, baseItemOf, BERSERKER_FURY, canEnhance, enhanceItem, enhancedId, enhancedVariant, EQUIPMENT, HAAS_CLAW, INSPIRE, isEnhanced, ITEMS, PURIFY, RETRIBUTION, SEA_HALBERD } from './items';
import { simulateCombat } from './combat';
import { countGifts, countPlunder, createGame } from './game';

describe('enhanced items (groundwork)', () => {
  test('an item with overrides gets an enhanced version: the base with the changes, id <base>+', () => {
    const base = ITEMS.waraxe;
    const v = enhancedVariant({ ...base, enhanced: { desc: 'Stronger.', mods: () => [{ stat: 'atk', add: 999 }] } })!;
    expect(v.id).toBe('waraxe+');
    expect(v.enhancedFrom).toBe('waraxe');
    expect(v.name).toBe(`Enhanced ${base.name}`);
    expect(v.desc).toBe('Stronger.');
    expect(v.mods(1)).toEqual([{ stat: 'atk', add: 999 }]);
    expect(v.icon).toBe(base.icon); // untouched fields stay the base's
    expect(v.enhanced).toBeUndefined();
    // Overrides can rename it.
    expect(enhancedVariant({ ...base, enhanced: { name: 'Axe of Ages' } })!.name).toBe('Axe of Ages');
  });

  test('an item without overrides has no enhanced version', () => {
    expect(enhancedVariant({ ...ITEMS.scythe, enhanced: undefined })).toBeNull();
    for (const id of Object.keys(ITEMS).filter((id) => !ITEMS[id].enhancedFrom && !ITEMS[id].enhanced)) {
      expect(canEnhance(id)).toBe(false);
      expect(ITEMS[enhancedId(id)]).toBeUndefined();
    }
  });

  test('every enhanced version in the game is registered beside its base; drops and picks stay base', () => {
    for (const def of Object.values(ITEMS).filter((d) => d.enhancedFrom)) {
      expect(def.id).toBe(enhancedId(def.enhancedFrom!));
      expect(ITEMS[def.enhancedFrom!].enhanced).toBeDefined();
      expect(isEnhanced(def.id)).toBe(true);
      expect(baseItemOf(def.id)).toBe(def.enhancedFrom!);
    }
    expect([...EQUIPMENT, ...BASIC_ITEMS].some(isEnhanced)).toBe(false);
  });

  test('enhancing an owned item swaps it for its enhanced version, once; never one that has none', () => {
    const item = { uid: 1, id: 'scythe+', tier: 1, holder: null }; // already enhanced: nothing further
    expect(enhanceItem(item)).toBe(false);
    expect(item.id).toBe('scythe+');
    const enhanceable = Object.keys(ITEMS).find(canEnhance);
    if (enhanceable) {
      const it = { uid: 2, id: enhanceable, tier: 1, holder: null };
      expect(enhanceItem(it)).toBe(true);
      expect(it.id).toBe(enhancedId(enhanceable));
      expect(enhanceItem(it)).toBe(false); // already enhanced
    }
  });
});

describe('enhanced basic items', () => {
  const holder = (items: { id: string; tier: number }[]) => unitMods(UNIT_BY_ID.minos, { items });
  const sum = (mods: ReturnType<typeof holder>, stat: string, kind: 'add' | 'pct' = 'add') =>
    mods.filter((m) => m.stat === stat).reduce((n, m) => n + (m[kind] ?? 0), 0);

  test('Inspire, Purify, Revitalize, Aegis, Retribution have enhanced versions; trait items never', () => {
    for (const id of ['inspire', 'purify', 'revitalize', 'aegis', 'retribution']) expect(canEnhance(id)).toBe(true);
    expect(canEnhance('nosuchitem')).toBe(false);
  });

  test('Swift: +20% attack speed on top of the base (Inspire+, Purify+)', () => {
    expect(sum(holder([{ id: 'inspire+', tier: 2 }]), 'attackSpeed')).toBeCloseTo(INSPIRE.attackSpeed[1] + 0.2, 5);
    expect(sum(holder([{ id: 'purify+', tier: 1 }]), 'attackSpeed')).toBeCloseTo(PURIFY.attackSpeed + 0.2, 5);
    expect(ITEMS['inspire+'].desc).toContain('Swift (unique)');
  });

  test('Swift counts once however many items carry it', () => {
    const both = holder([{ id: 'inspire+', tier: 1 }, { id: 'purify+', tier: 1 }]);
    expect(sum(both, 'attackSpeed')).toBeCloseTo(INSPIRE.attackSpeed[0] + PURIFY.attackSpeed + 0.2, 5);
  });

  test('an item and its enhanced version are one item type: its unique counts once (the enhanced)', () => {
    const mods = holder([{ id: 'inspire', tier: 1 }, { id: 'inspire+', tier: 1 }]);
    expect(sum(mods, 'attackSpeed')).toBeCloseTo(INSPIRE.attackSpeed[0] + 0.2, 5);
  });

  test('Longevity: +20% max hp (Revitalize+, Aegis+); Onslaught: +20% damage (Retribution+)', () => {
    expect(sum(holder([{ id: 'revitalize+', tier: 1 }]), 'hp', 'pct')).toBeCloseTo(0.2, 5);
    expect(sum(holder([{ id: 'aegis+', tier: 1 }, { id: 'revitalize+', tier: 1 }]), 'hp', 'pct')).toBeCloseTo(0.2, 5);
    expect(sum(holder([{ id: 'retribution+', tier: 3 }]), 'damageAmp')).toBeCloseTo(RETRIBUTION.damage[2] + 0.2, 5);
    // Enhanced keeps the base's own effects.
    expect(ITEMS['aegis+'].sideShield).toEqual(ITEMS.aegis.sideShield);
    expect(ITEMS['revitalize+'].spring).toEqual(ITEMS.revitalize.spring);
  });
});

describe('enhanced physical equipment', () => {
  const holder = (items: { id: string; tier: number }[]) => unitMods(UNIT_BY_ID.minos, { items });
  const sum = (mods: ReturnType<typeof holder>, stat: string, kind: 'add' | 'pct' = 'add') =>
    mods.filter((m) => m.stat === stat).reduce((n, m) => n + (m[kind] ?? 0), 0);

  test('all seven can be enhanced', () => {
    for (const id of ['demonhuntersword', 'goldenstaff', 'waraxe', 'seahalberd', 'berserkerfury', 'bladeofdespair', 'haasclaw']) expect(canEnhance(id)).toBe(true);
  });

  test('Demon Hunter Sword: Engulf 2% -> 4%', () => {
    expect(ITEMS.demonhuntersword.engulf).toBe(0.02);
    expect(ITEMS['demonhuntersword+'].engulf).toBe(0.04);
    expect(ITEMS['demonhuntersword+'].desc).toContain('4%');
  });

  test('Golden Staff: Impulsive 2% -> 3.5% attack speed per hit', () => {
    expect(ITEMS.goldenstaff.stacking!.perStack).toEqual([{ stat: 'attackSpeed', add: 0.02 }]);
    expect(ITEMS['goldenstaff+'].stacking!.perStack).toEqual([{ stat: 'attackSpeed', add: 0.035 }]);
    expect(ITEMS['goldenstaff+'].stacking!.max).toBe(ITEMS.goldenstaff.stacking!.max);
  });

  test('War Axe: Fighting Spirit 4 -> 6 armor and mr per stack, 10% -> 30% damage at max', () => {
    expect(ITEMS.waraxe.stacking!.perStack.map((m) => m.add)).toEqual([4, 4]);
    expect(ITEMS.waraxe.stacking!.atMax).toEqual([{ stat: 'damageAmp', add: 0.1 }]);
    expect(ITEMS['waraxe+'].stacking!.perStack.map((m) => m.add)).toEqual([6, 6]);
    expect(ITEMS['waraxe+'].stacking!.atMax).toEqual([{ stat: 'damageAmp', add: 0.3 }]);
  });

  test('Blade of Despair: Despair 25% -> 50%', () => {
    expect(ITEMS.bladeofdespair.lowHpFury!.amp).toBe(0.25);
    expect(ITEMS['bladeofdespair+'].lowHpFury!.amp).toBe(0.5);
  });

  test('Sea Halberd+ Pierce, Berserker Fury+ Valiant, Haas Claw+ Frenzy', () => {
    const sea = holder([{ id: 'seahalberd+', tier: 1 }]);
    expect(sum(sea, 'armorPen')).toBeCloseTo(SEA_HALBERD.armorPen + 0.25, 5); // 40% + Pierce's 25%
    expect(sum(sea, 'atk', 'pct')).toBeCloseTo(SEA_HALBERD.atk + 0.15, 5);
    expect(sum(holder([{ id: 'berserkerfury+', tier: 1 }]), 'critChance')).toBeCloseTo(BERSERKER_FURY.critChance + 0.15, 5);
    const haas = holder([{ id: 'haasclaw+', tier: 1 }]);
    expect(sum(haas, 'lifesteal')).toBeCloseTo(HAAS_CLAW.lifesteal + 0.1, 5);
    expect(sum(haas, 'atk', 'pct')).toBeCloseTo(HAAS_CLAW.atk + 0.1, 5);
  });

  test('armor penetration: physical damage ignores that share of armor', () => {
    const state = createGame(1, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
    const hit = (item: string) => {
      const [a, b] = state.players;
      a.items = [{ uid: 1, id: item, tier: 1, holder: 10 }];
      b.items = [];
      a.board.fill(null);
      b.board.fill(null);
      a.board[3] = { uid: 10, defId: 'minos', star: 1 };
      b.board[3] = { uid: 11, defId: 'knight', star: 3 };
      const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
      return r.events.find((e) => e.type === 'attack' && r.fighters[e.id].side === 0) as { damage: number } | undefined;
    };
    const plain = hit('seahalberd')!.damage;
    const pierced = hit('seahalberd+')!.damage;
    expect(pierced).toBeGreaterThan(plain);
  });
});

describe('enhanced magic equipment', () => {
  test('Divine Glaive: 25% magic attack, 40% magic pen; enhanced adds Spellbreaker (25% magic pen, 15% magic attack)', () => {
    const mods = (id: string) => unitMods(UNIT_BY_ID.minos, { items: [{ id, tier: 1 }] });
    const sum = (m: ReturnType<typeof mods>, stat: string, kind: 'add' | 'pct' = 'add') => m.filter((x) => x.stat === stat).reduce((n, x) => n + (x[kind] ?? 0), 0);
    expect(sum(mods('divineglaive'), 'ap', 'pct')).toBeCloseTo(0.25, 5);
    expect(sum(mods('divineglaive'), 'magicPen')).toBeCloseTo(0.4, 5);
    expect(sum(mods('divineglaive+'), 'ap', 'pct')).toBeCloseTo(0.4, 5);
    expect(sum(mods('divineglaive+'), 'magicPen')).toBeCloseTo(0.65, 5);
    expect(ITEMS['divineglaive+'].desc).toContain('Spellbreaker (unique)');
  });

  test('Glowing Wand: Scorch 2.5% -> 5% max hp per second; the rest the same', () => {
    expect(ITEMS.glowingwand.scorch!.share).toBe(0.025);
    expect(ITEMS['glowingwand+'].scorch).toEqual({ ...ITEMS.glowingwand.scorch!, share: 0.05 });
    expect(ITEMS['glowingwand+'].desc).toContain('5%');
  });

  test('Ice Queen Wand: enhanced adds Extract (10% spell lifesteal, 10% magic attack); Ice Bound kept', () => {
    const mods = unitMods(UNIT_BY_ID.minos, { items: [{ id: 'icequeenwand+', tier: 1 }] });
    const sum = (stat: string, kind: 'add' | 'pct' = 'add') => mods.filter((x) => x.stat === stat).reduce((n, x) => n + (x[kind] ?? 0), 0);
    expect(sum('spellLifesteal')).toBeCloseTo(0.25, 5);
    expect(sum('ap', 'pct')).toBeCloseTo(0.25, 5);
    expect(ITEMS['icequeenwand+'].skillHex).toEqual(ITEMS.icequeenwand.skillHex);
  });

  test('Holy Crystal: 20% magic attack; Mystery 10% -> 30% skill damage (once, even with the base too)', () => {
    const sum = (items: { id: string; tier: number }[], stat: string, kind: 'add' | 'pct' = 'add') =>
      unitMods(UNIT_BY_ID.minos, { items }).filter((x) => x.stat === stat).reduce((n, x) => n + (x[kind] ?? 0), 0);
    expect(sum([{ id: 'holycrystal', tier: 1 }], 'ap', 'pct')).toBeCloseTo(0.2, 5);
    expect(sum([{ id: 'holycrystal', tier: 1 }], 'skillAmp')).toBeCloseTo(0.1, 5);
    expect(sum([{ id: 'holycrystal+', tier: 1 }], 'skillAmp')).toBeCloseTo(0.3, 5);
    expect(sum([{ id: 'holycrystal', tier: 1 }, { id: 'holycrystal+', tier: 1 }], 'skillAmp')).toBeCloseTo(0.3, 5);
  });
});

describe('enhanced armor', () => {
  test('Blade Armor: +50 armor and Vengeance; enhanced adds Defiance (+25 armor)', () => {
    const sum = (id: string) => unitMods(UNIT_BY_ID.minos, { items: [{ id, tier: 1 }] }).filter((x) => x.stat === 'armor').reduce((n, x) => n + (x.add ?? 0), 0);
    expect(sum('bladearmor')).toBe(50);
    expect(sum('bladearmor+')).toBe(75);
    expect(ITEMS['bladearmor+'].vengeance).toBe(ITEMS.bladearmor.vengeance);
  });

  test('Guardian Helmet: +15% max hp and Recovery; enhanced adds Titan (+20% max hp)', () => {
    const hp = (id: string) => unitMods(UNIT_BY_ID.minos, { items: [{ id, tier: 1 }] }).filter((x) => x.stat === 'hp').reduce((n, x) => n + (x.pct ?? 0), 0);
    expect(hp('guardianhelmet')).toBeCloseTo(0.15, 5);
    expect(hp('guardianhelmet+')).toBeCloseTo(0.35, 5);
    expect(ITEMS['guardianhelmet+'].regen).toBe(ITEMS.guardianhelmet.regen);
  });

  test('Antique Cuirass: Deter 4% for 3s -> 7% for 4s, up to 5 stacks either way', () => {
    expect(ITEMS.antiquecuirass.deter).toEqual({ effect: 'deter', perStack: 0.04, max: 5, seconds: 3 });
    expect(ITEMS['antiquecuirass+'].deter).toEqual({ effect: 'deter', perStack: 0.07, max: 5, seconds: 4 });
    expect(ITEMS['antiquecuirass+'].mods(1)).toEqual(ITEMS.antiquecuirass.mods(1));
  });

  test('Thunder Belt: +20 armor and magic resist; enhanced adds +20% max hp; Power of Thunder kept', () => {
    expect(ITEMS.thunderbelt.mods(1)).toEqual([{ stat: 'armor', add: 20 }, { stat: 'mr', add: 20 }]);
    expect(ITEMS['thunderbelt+'].mods(1)).toEqual([{ stat: 'armor', add: 20 }, { stat: 'mr', add: 20 }, { stat: 'hp', pct: 0.2 }]);
    expect(ITEMS['thunderbelt+'].thunder).toEqual(ITEMS.thunderbelt.thunder);
  });

  test('Oracle: +20 armor and magic resist; enhanced Magic Resist also gives the whole row +6% max hp', () => {
    expect(ITEMS.oracle.mods(1)).toEqual([{ stat: 'armor', add: 20 }, { stat: 'mr', add: 20 }]);
    expect(ITEMS['oracle+'].mods(1)).toEqual(ITEMS.oracle.mods(1));
    expect(ITEMS['oracle+'].rowBuff!.hpPct).toBe(0.06);

    const state = createGame(1, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
    const [a, b] = state.players;
    const maxHps = (items: string[]) => {
      for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
      a.board[3] = { uid: 1, defId: 'knight', star: 1 };
      a.board[0] = { uid: 2, defId: 'footman', star: 1 }; // same row
      a.board[10] = { uid: 3, defId: 'archer', star: 1 }; // row behind
      a.items = items.map((id, i) => ({ uid: 80 + i, id, tier: 1, holder: 1 }));
      b.board[3] = { uid: 5, defId: 'footman', star: 1 };
      const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
      return Object.fromEntries(r.fighters.filter((f) => f.side === 0).map((f) => [f.defId, f.maxHp]));
    };
    const plain = maxHps(['oracle']);
    const plus = maxHps(['oracle+']);
    expect(plus.knight).toBe(plain.knight + Math.round(plain.knight * 0.06));
    expect(plus.footman).toBe(plain.footman + Math.round(plain.footman * 0.06));
    expect(plus.archer).toBe(plain.archer);
    const both = maxHps(['oracle', 'oracle+']); // once, the enhanced one
    expect(both.footman).toBe(plus.footman);
  });

  test('Dominance Ice: Arctic Cold 1 cell, -25% attack speed; mana from hits +25% -> +50%', () => {
    expect(ITEMS.dominanceice.chill).toMatchObject({ radius: 1, attackSpeed: 0.25 });
    expect(ITEMS['dominanceice+'].chill).toEqual(ITEMS.dominanceice.chill);
    expect(ITEMS.dominanceice.hurtMana).toBe(0.25);
    expect(ITEMS['dominanceice+'].hurtMana).toBe(0.5);
    expect(ITEMS['dominanceice+'].mods(1)).toEqual([{ stat: 'mr', add: 50 }, { stat: 'hp', pct: 0.1 }]);
  });

  test('Ancient Wrath: Provocation 10 -> 18 armor and magic resist per enemy targeting it', () => {
    expect(ITEMS.ancientwrath.provoke).toMatchObject({ radius: 1, perTargeter: 10 });
    expect(ITEMS['ancientwrath+'].provoke).toMatchObject({ radius: 1, perTargeter: 18 });
    expect(ITEMS['ancientwrath+'].mods(1)).toEqual([{ stat: 'hp', pct: 0.15 }]);
  });

  test('Provocation taunts around the enemy in front, not around the holder', () => {
    const state = createGame(1, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
    const [a, b] = state.players;
    for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
    a.board[3] = { uid: 1, defId: 'knight', star: 2 };
    a.items = [{ uid: 90, id: 'ancientwrath+', tier: 1, holder: 1 }];
    b.board[3] = { uid: 3, defId: 'footman', star: 1 }; // in front
    b.board[10] = { uid: 4, defId: 'footman', star: 1 }; // right behind it: within 1 of the front one
    b.board[0] = { uid: 5, defId: 'footman', star: 1 }; // far corner of the front row: not
    const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    const holder = r.fighters.find((f) => f.side === 0)!;
    const foes = r.fighters.filter((f) => f.side === 1);
    const front = foes.reduce((x, y) => (Math.abs(x.x - holder.x) + Math.abs(x.y - holder.y) <= Math.abs(y.x - holder.x) + Math.abs(y.y - holder.y) ? x : y));
    const taunted = r.events.filter((e) => e.type === 'taunt' && e.by === holder.id && e.t === 0).map((e) => (e.type === 'taunt' ? e.id : -1));
    expect(taunted).toContain(front.id);
    for (const f of foes) expect(taunted.includes(f.id)).toBe(Math.max(Math.abs(f.x - front.x), Math.abs(f.y - front.y)) <= 1);
  });
});

describe('Vengeance on all damage', () => {
  const duel = (aItems: string[], bItems: string[], aUnit = 'knight', bUnit = 'zhuxin') => {
    const state = createGame(3, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
    const [a, b] = state.players;
    a.board.fill(null);
    b.board.fill(null);
    a.board[3] = { uid: 10, defId: aUnit, star: 2 };
    b.board[3] = { uid: 11, defId: bUnit, star: 2 };
    a.items = aItems.map((id, i) => ({ uid: 100 + i, id, tier: 1, holder: 10 }));
    b.items = bItems.map((id, i) => ({ uid: 200 + i, id, tier: 1, holder: 11 }));
    return simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
  };

  test("skill damage is sent back too, not only basic attacks", () => {
    const r = duel(['bladearmor'], []);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const foe = r.fighters.find((f) => f.side === 1)!.id;
    const skillHits = r.events.filter((e) => e.type === 'effect' && e.by === foe && e.target === me && e.damage > 0 && e.effect !== 'vengeance');
    expect(skillHits.length).toBeGreaterThan(0);
    const back = r.events.filter((e) => e.type === 'effect' && e.effect === 'vengeance');
    for (const s of skillHits) expect(back.some((v) => v.t === s.t)).toBe(true);
  });

  test('two Blade Armors facing each other: each hit is answered once, never bounced back', () => {
    const r = duel(['bladearmor'], ['bladearmor'], 'knight', 'knight');
    const back = r.events.filter((e) => e.type === 'effect' && e.effect === 'vengeance');
    const hits = r.events.filter((e) => (e.type === 'attack' || e.type === 'cast' || (e.type === 'effect' && e.effect !== 'vengeance')) && e.damage > 0);
    expect(back.length).toBeGreaterThan(0);
    expect(back.length).toBeLessThanOrEqual(hits.length);
  });
});

describe('enhanced trait and commander items', () => {
  test("Blangkon and Ruby's Cloak: base max hp 20% -> 40%; the rest the same", () => {
    for (const id of ['blangkon', 'redcloak']) {
      expect(ITEMS[id].mods(1)).toEqual([{ stat: 'hp', pct: 0.2 }]);
      expect(ITEMS[enhancedId(id)].mods(1)).toEqual([{ stat: 'hp', pct: 0.4 }]);
      expect(ITEMS[enhancedId(id)].desc).toContain('40%');
    }
    expect(ITEMS['blangkon+'].unique!(2)).toEqual(ITEMS.blangkon.unique!(2));
    expect(ITEMS['blangkon+'].opener!(3)).toEqual(ITEMS.blangkon.opener!(3));
    expect(ITEMS['redcloak+'].revive).toBe(ITEMS.redcloak.revive);
    expect(ITEMS['redcloak+'].rageMark).toEqual(ITEMS.redcloak.rageMark);
  });
});

describe('enhanced hybrid equipment', () => {
  test('Spellblade Talisman: Recharge 55% -> 80% starting mana; enhanced adds +15% skill damage', () => {
    expect(ITEMS.spellbladetalisman.startMana).toBe(0.55);
    expect(ITEMS['spellbladetalisman+'].startMana).toBe(0.8);
    expect(ITEMS.spellbladetalisman.mods(1)).toEqual([{ stat: 'atk', pct: 0.15 }, { stat: 'ap', pct: 0.15 }]);
    expect(ITEMS['spellbladetalisman+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.15 }, { stat: 'ap', pct: 0.15 }, { stat: 'skillAmp', add: 0.15 }]);
  });

  test('Winter Crown: Freeze restores 10% hp -> 25% hp and 10% mana', () => {
    expect(ITEMS.wintercrown.freeze).toEqual({ below: 0.25, seconds: 1, heal: 0.1 });
    expect(ITEMS['wintercrown+'].freeze).toEqual({ below: 0.25, seconds: 1, heal: 0.25, mana: 0.1 });
    expect(ITEMS['wintercrown+'].mods(1)).toEqual(ITEMS.wintercrown.mods(1));
  });

  test('Sheep Stick: enhanced sheep take 60% more damage while they are sheep', () => {
    expect(ITEMS.sheepstick.sheep!.vulnerable).toBeUndefined();
    expect(ITEMS['sheepstick+'].sheep).toEqual({ ...ITEMS.sheepstick.sheep!, vulnerable: 0.6 });
    // The opening sheep (the highest star) takes more from the first hit landed on it.
    const firstHitOnSheep = (item: string) => {
      const state = createGame(1, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
      const [a, b] = state.players;
      for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
      a.board[3] = { uid: 1, defId: 'knight', star: 1 };
      a.items = [{ uid: 80, id: item, tier: 1, holder: 1 }];
      b.board[3] = { uid: 2, defId: 'footman', star: 2 };
      const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
      const sheep = r.events.find((e) => e.type === 'stun' && e.effect === 'sheep')!;
      if (sheep.type !== 'stun') throw new Error();
      const hit = r.events.find((e) => e.type === 'attack' && e.target === sheep.id && e.t < sheep.until && e.damage > 0);
      return hit && hit.type === 'attack' ? hit.damage : 0;
    };
    const plain = firstHitOnSheep('sheepstick');
    const plus = firstHitOnSheep('sheepstick+');
    expect(plain).toBeGreaterThan(0);
    expect(plus / plain).toBeGreaterThan(1.5);
  });

  test('Thief Tool: enhanced adds +15% damage; Neat Pick and slots the same', () => {
    expect(ITEMS['thieftool+'].mods(1)).toEqual([...ITEMS.thieftool.mods(1), { stat: 'damageAmp', add: 0.15 }]);
    expect(ITEMS['thieftool+'].copies).toEqual(ITEMS.thieftool.copies);
    expect(ITEMS['thieftool+'].slots).toBe(3);
  });
});

describe('enhanced Purple Buff and trait items', () => {
  test('Purple Buff 10% -> 30% hybrid attack; Keris 20% -> 40%; Jimat both lifesteals 20% -> 30%; Pyre Offering adds +15% max hp', () => {
    expect(ITEMS['purplebuff+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.3 }, { stat: 'ap', pct: 0.3 }]);
    expect(ITEMS['purplebuff+'].castMana).toBe(ITEMS.purplebuff.castMana);
    expect(ITEMS['keris+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.4 }, { stat: 'ap', pct: 0.4 }]);
    expect(ITEMS['keris+'].pulse!(2)).toEqual(ITEMS.keris.pulse!(2));
    expect(ITEMS['jimat+'].mods(1)).toEqual([{ stat: 'lifesteal', add: 0.3 }, { stat: 'spellLifesteal', add: 0.3 }]);
    expect(ITEMS['jimat+'].unique!(4)).toEqual(ITEMS.jimat.unique!(4));
    expect(ITEMS.offering.mods(1)).toEqual([{ stat: 'atk', pct: 0.25 }, { stat: 'ap', pct: 0.25 }]);
    expect(ITEMS['offering+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.25 }, { stat: 'ap', pct: 0.25 }, { stat: 'hp', pct: 0.15 }]);
    expect(ITEMS['offering+'].aura!(3)).toEqual(ITEMS.offering.aura!(3));
    expect(ITEMS['offering+'].forbidden).toBe('cultoffire');
  });
});

describe('enhanced Ice Longbow', () => {
  test('+20% attack speed; Moonlight heals the lowest ally 20% -> 30% of its max hp on a kill', () => {
    expect(ITEMS.icelongbow.unique!(1)).toEqual([{ stat: 'attackSpeed', add: 0.2 }]);
    expect(ITEMS['icelongbow+'].unique!(1)).toEqual([{ stat: 'attackSpeed', add: 0.2 }]);
    expect(ITEMS.icelongbow.killHeal).toBe(0.2);
    expect(ITEMS['icelongbow+'].killHeal).toBe(0.3);
    expect(ITEMS['icelongbow+'].desc).toContain('Moonlight');
  });
});

describe("enhanced Kenzo's sash", () => {
  test('+50% attack and magic attack; enhanced adds +20% attack speed; Martial Arts the same', () => {
    expect(ITEMS.blacksash.mods(1)).toEqual([{ stat: 'atk', pct: 0.5 }, { stat: 'ap', pct: 0.5 }]);
    expect(ITEMS['blacksash+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.5 }, { stat: 'ap', pct: 0.5 }, { stat: 'attackSpeed', add: 0.2 }]);
    expect(ITEMS['blacksash+'].chests).toEqual(ITEMS.blacksash.chests);
  });
});

describe('Great Dragon Spear', () => {
  test('no stats; enhanced adds +20% attack and magic attack; not in the drop pool', () => {
    expect(ITEMS.greatdragonspear.mods(1)).toEqual([]);
    expect(ITEMS['greatdragonspear+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.2 }, { stat: 'ap', pct: 0.2 }]);
    expect(ITEMS['greatdragonspear+'].flurry).toEqual({ chance: 0.2, hits: 2 });
    expect(EQUIPMENT).not.toContain('greatdragonspear');
  });

  test('Dragon Flurry: about 1 in 5 basic attacks is followed by 2 extra attacks', () => {
    let first = 0;
    let extra = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const state = createGame(seed, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
      const [a, b] = state.players;
      for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
      a.board[3] = { uid: 1, defId: 'knight', star: 2 };
      a.items = [{ uid: 80, id: 'greatdragonspear', tier: 1, holder: 1 }];
      b.board[3] = { uid: 2, defId: 'knight', star: 2 };
      const r = simulateCombat({ rng: seed }, a, b, { traits: [false, false] });
      const me = r.fighters.find((f) => f.side === 0)!.id;
      const mine = r.events.filter((e) => e.type === 'attack' && e.id === me);
      const again = mine.filter((e) => e.type === 'attack' && e.again).length;
      first += mine.length - again;
      extra += again;
    }
    expect(first).toBeGreaterThan(60);
    expect(extra / first).toBeGreaterThan(0.2); // 0.4 expected (20% × 2)
    expect(extra / first).toBeLessThan(0.65);
  });

});

describe('enhanced Scythe', () => {
  test('attack and magic attack 20% -> 40%; Hunt the same; every item now has an enhanced version', () => {
    expect(ITEMS.scythe.mods(1)).toEqual([{ stat: 'atk', pct: 0.2 }, { stat: 'ap', pct: 0.2 }]);
    expect(ITEMS['scythe+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.4 }, { stat: 'ap', pct: 0.4 }]);
    expect(ITEMS['scythe+'].hunt).toEqual(ITEMS.scythe.hunt);
    for (const def of Object.values(ITEMS)) if (!def.enhancedFrom) expect(canEnhance(def.id)).toBe(true);
  });
});

describe('Supreme Blade', () => {
  test('+35% hybrid attack, +25% max hp; enhanced +55% / +30%; not in the drop pool', () => {
    expect(ITEMS.supremeblade.mods(1)).toEqual([{ stat: 'atk', pct: 0.35 }, { stat: 'ap', pct: 0.35 }, { stat: 'hp', pct: 0.25 }]);
    expect(ITEMS['supremeblade+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.55 }, { stat: 'ap', pct: 0.55 }, { stat: 'hp', pct: 0.3 }]);
    expect(ITEMS['supremeblade+'].gift).toEqual({ below: 0.18 });
    expect(EQUIPMENT).not.toContain('supremeblade');
  });

  test('the counter: +2% damage per execution, up to +36%', () => {
    const amp = (count: number) => unitMods(UNIT_BY_ID.minos, { items: [{ id: 'supremeblade', tier: 1, count }] }).filter((m) => m.stat === 'damageAmp').reduce((n, m) => n + (m.add ?? 0), 0);
    expect(amp(0)).toBe(0);
    expect(amp(5)).toBeCloseTo(0.1, 5);
    expect(amp(18)).toBeCloseTo(0.36, 5);
    expect(amp(40)).toBeCloseTo(0.36, 5);
  });

  test('Gift executes an adjacent enemy under 18%, and the execution adds to the owned blade\'s counter', () => {
    const state = createGame(1, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
    const [a, b] = state.players;
    for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
    a.board[3] = { uid: 1, defId: 'knight', star: 3 };
    a.items = [{ uid: 80, id: 'supremeblade', tier: 1, holder: 1, count: 2 }];
    b.board[3] = { uid: 2, defId: 'footman', star: 1 };
    b.board[4] = { uid: 3, defId: 'footman', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    const me = r.fighters.find((f) => f.side === 0)!;
    expect(me.items[0]).toMatchObject({ uid: 80, count: 2 });
    const gifts = r.events.filter((e) => e.type === 'effect' && e.effect === 'gift' && e.by === me.id);
    expect(gifts.length).toBeGreaterThan(0);
    countGifts(a, r, 0);
    expect(a.items[0].count).toBe(2 + gifts.length);
  });
});

describe("Plunderer's Claw", () => {
  test('+20% hybrid attack and max hp; enhanced 40/40; not in the drop pool', () => {
    expect(ITEMS.plundererclaw.mods(1)).toEqual([{ stat: 'atk', pct: 0.2 }, { stat: 'ap', pct: 0.2 }, { stat: 'hp', pct: 0.2 }]);
    expect(ITEMS['plundererclaw+'].mods(1)).toEqual([{ stat: 'atk', pct: 0.4 }, { stat: 'ap', pct: 0.4 }, { stat: 'hp', pct: 0.4 }]);
    expect(ITEMS['plundererclaw+'].plunder).toEqual(ITEMS.plundererclaw.plunder);
    expect(EQUIPMENT).not.toContain('plundererclaw');
  });

  test('no damage until 26 gold plundered, then +25%', () => {
    const amp = (count: number) => unitMods(UNIT_BY_ID.minos, { items: [{ id: 'plundererclaw', tier: 1, count }] }).filter((m) => m.stat === 'damageAmp').reduce((n, m) => n + (m.add ?? 0), 0);
    expect(amp(0)).toBe(0);
    expect(amp(25)).toBe(0);
    expect(amp(26)).toBeCloseTo(0.25, 5);
  });

  const hookFight = (count: number) => {
    const state = createGame(1, [{ id: 'a', name: '', isBot: false }, { id: 'b', name: '', isBot: false }]);
    const [a, b] = state.players;
    for (const p of state.players) { p.board.fill(null); p.bench.fill(null); p.items = []; }
    a.board[3] = { uid: 1, defId: 'knight', star: 1 };
    a.items = [{ uid: 80, id: 'plundererclaw', tier: 1, holder: 1, count }];
    const prey = UNITS.find((u) => u.tier === 4 && u.shop !== false && !u.piece)!;
    b.board[3] = { uid: 2, defId: prey.id, star: 1 }; // nearest
    b.board[20] = { uid: 3, defId: 'footman', star: 1 };
    const r = simulateCombat({ rng: 1 }, a, b, { traits: [false, false] });
    return { a, r, prey };
  };

  test('at the start, hooks the nearest enemy: stunned 1.5s; gold = its cost, after the fight', () => {
    const { a, r, prey } = hookFight(0);
    const me = r.fighters.find((f) => f.side === 0)!.id;
    const hook = r.events.find((e) => e.type === 'effect' && e.effect === 'plunder' && e.by === me)!;
    if (hook.type !== 'effect') throw new Error();
    expect(hook.t).toBe(0);
    expect(r.fighters.find((f) => f.id === hook.target)!.defId).toBe(prey.id);
    const stun = r.events.find((e) => e.type === 'stun' && e.effect === 'plunder')!;
    if (stun.type !== 'stun') throw new Error();
    expect(stun.until - stun.t).toBe(1.5 * TICKS_PER_SECOND);
    const gold = a.gold;
    countPlunder(a, r, 0);
    expect(a.gold - gold).toBe(4);
    expect(a.items[0].count).toBe(4);
  });

  test('stops at 26 gold in all: the last hook pays only what is left, then nothing', () => {
    const { a, r } = hookFight(24);
    const gold = a.gold;
    countPlunder(a, r, 0);
    expect(a.gold - gold).toBe(2);
    expect(a.items[0].count).toBe(26);
    countPlunder(a, r, 0);
    expect(a.gold - gold).toBe(2);
  });
});
