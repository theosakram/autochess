// Neutral, traitless units for tests and the balance tool: fillers and opponents that never
// switch a trait on. They're not part of the game: never in the shop or the pool. Importing this
// registers them in UNIT_BY_ID (tests get it via bunfig.toml's preload).
import type { UnitDef } from './types';
import { UNIT_BY_ID } from './units';

export const TEST_UNITS: UnitDef[] = [
  { id: 'footman', name: 'Footman', tier: 1, traits: [], hp: 650, atk: 50, ap: 30, armor: 70, mr: 30, mana: 100, range: 1, attackTicks: 10, shop: false },
  { id: 'archer', name: 'Archer', tier: 1, traits: [], hp: 500, atk: 55, ap: 55, armor: 20, mr: 20, mana: 100, range: 4, attackTicks: 9, shop: false },
  { id: 'imp', name: 'Imp', tier: 1, traits: [], hp: 450, atk: 45, ap: 45, armor: 20, mr: 40, mana: 80, range: 3, attackTicks: 10, shop: false },
  { id: 'knight', name: 'Knight', tier: 2, traits: [], hp: 800, atk: 55, ap: 33, armor: 110, mr: 40, mana: 100, range: 1, attackTicks: 11, shop: false },
  { id: 'paladin', name: 'Paladin', tier: 3, traits: [], hp: 950, atk: 65, ap: 39, armor: 120, mr: 60, mana: 100, range: 1, attackTicks: 11, shop: false },
  { id: 'titan', name: 'Titan', tier: 5, traits: [], hp: 1400, atk: 110, ap: 66, armor: 130, mr: 50, mana: 120, range: 1, attackTicks: 11, shop: false },
];

for (const u of TEST_UNITS) UNIT_BY_ID[u.id] = u;
