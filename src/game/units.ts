import type { UnitDef } from './types';

export const UNITS: UnitDef[] = [
  { id: 'footman', name: 'Footman', tier: 1, traits: ['Human', 'Warrior'] },
  { id: 'archer', name: 'Archer', tier: 1, traits: ['Elf', 'Ranger'] },
  { id: 'imp', name: 'Imp', tier: 1, traits: ['Demon', 'Mage'] },
  { id: 'grunt', name: 'Grunt', tier: 1, traits: ['Orc', 'Warrior'] },
  { id: 'acolyte', name: 'Acolyte', tier: 1, traits: ['Human', 'Priest'] },

  { id: 'knight', name: 'Knight', tier: 2, traits: ['Human', 'Knight'] },
  { id: 'druid', name: 'Druid', tier: 2, traits: ['Elf', 'Druid'] },
  { id: 'shaman', name: 'Shaman', tier: 2, traits: ['Orc', 'Mage'] },
  { id: 'rogue', name: 'Rogue', tier: 2, traits: ['Elf', 'Assassin'] },

  { id: 'paladin', name: 'Paladin', tier: 3, traits: ['Human', 'Knight'] },
  { id: 'berserker', name: 'Berserker', tier: 3, traits: ['Orc', 'Warrior'] },
  { id: 'warlock', name: 'Warlock', tier: 3, traits: ['Demon', 'Mage'] },

  { id: 'wyrm', name: 'Wyrm', tier: 4, traits: ['Dragon', 'Mage'] },
  { id: 'shadowblade', name: 'Shadowblade', tier: 4, traits: ['Demon', 'Assassin'] },

  { id: 'titan', name: 'Titan', tier: 5, traits: ['Giant', 'Warrior'] },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
