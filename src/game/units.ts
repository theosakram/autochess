import { deadeye } from './traits/deadeye';
import { dragonAltar } from './traits/dragonAltar';
import { phasewarper } from './traits/phasewarper';
import { scavenger } from './traits/scavenger';
import { skybringer } from './traits/skybringer';
import { stargazer } from './traits/stargazer';
import { storyweaver } from './traits/storyweaver';
import { undead } from './traits/undead';
import type { UnitDef } from './types';

const SG = stargazer.id;
const UD = undead.id;
const DA = dragonAltar.id;
const SB = skybringer.id;
const DE = deadeye.id;
const PW = phasewarper.id;
const SW = storyweaver.id;
const SV = scavenger.id;

export const UNITS: UnitDef[] = [
  { id: 'footman', name: 'Footman', tier: 1, traits: [], hp: 650, atk: 50, armor: 70, mr: 30, mana: 100, range: 1, attackTicks: 10 },
  { id: 'archer', name: 'Archer', tier: 1, traits: [], hp: 500, atk: 55, armor: 20, mr: 20, mana: 100, range: 4, attackTicks: 9 },
  { id: 'imp', name: 'Imp', tier: 1, traits: [], hp: 450, atk: 45, armor: 20, mr: 40, mana: 80, range: 3, attackTicks: 10 },
  { id: 'skeleton', name: 'Skeleton', tier: 1, traits: [UD], hp: 600, atk: 55, armor: 60, mr: 25, mana: 100, range: 1, attackTicks: 10 },
  { id: 'drakeling', name: 'Drakeling', tier: 1, traits: [DA], hp: 620, atk: 55, armor: 55, mr: 30, mana: 100, range: 1, attackTicks: 10 },
  { id: 'acolyte', name: 'Acolyte', tier: 1, traits: [SG], hp: 500, atk: 40, armor: 20, mr: 40, mana: 80, range: 3, attackTicks: 10 },
  { id: 'slinger', name: 'Slinger', tier: 1, traits: [DE], hp: 480, atk: 50, armor: 20, mr: 20, mana: 100, range: 4, attackTicks: 8 },
  { id: 'scrapper', name: 'Scrapper', tier: 1, traits: [SV], hp: 620, atk: 50, armor: 50, mr: 25, mana: 100, range: 1, attackTicks: 10 },
  { id: 'galekin', name: 'Galekin', tier: 1, traits: [SB], hp: 600, atk: 55, armor: 45, mr: 30, mana: 100, range: 1, attackTicks: 9 },

  { id: 'scalebearer', name: 'Scalebearer', tier: 2, traits: [DA], hp: 820, atk: 50, armor: 100, mr: 40, mana: 100, range: 1, attackTicks: 11 },
  { id: 'altarkeeper', name: 'Altar Keeper', tier: 2, traits: [DA], hp: 550, atk: 55, armor: 25, mr: 35, mana: 90, range: 3, attackTicks: 10 },
  { id: 'knight', name: 'Knight', tier: 2, traits: [], hp: 800, atk: 55, armor: 110, mr: 40, mana: 100, range: 1, attackTicks: 11 },
  { id: 'druid', name: 'Druid', tier: 2, traits: [SG], hp: 600, atk: 50, armor: 30, mr: 40, mana: 80, range: 3, attackTicks: 10 },
  { id: 'shaman', name: 'Shaman', tier: 2, traits: [SG], hp: 600, atk: 55, armor: 30, mr: 40, mana: 90, range: 3, attackTicks: 10 },
  { id: 'banshee', name: 'Banshee', tier: 2, traits: [UD], hp: 550, atk: 60, armor: 20, mr: 45, mana: 90, range: 3, attackTicks: 10 },
  { id: 'ghoul', name: 'Ghoul', tier: 2, traits: [UD], hp: 650, atk: 70, armor: 50, mr: 25, mana: 100, range: 1, attackTicks: 8 },
  { id: 'hawkeye', name: 'Hawkeye', tier: 2, traits: [DE], hp: 540, atk: 60, armor: 20, mr: 25, mana: 100, range: 4, attackTicks: 8 },
  { id: 'blinkblade', name: 'Blinkblade', tier: 2, traits: [PW], hp: 600, atk: 65, armor: 40, mr: 30, mana: 100, range: 1, attackTicks: 8 },
  { id: 'inkling', name: 'Inkling', tier: 2, traits: [SW], hp: 560, atk: 55, armor: 25, mr: 40, mana: 90, range: 3, attackTicks: 10 },
  { id: 'magpie', name: 'Magpie', tier: 2, traits: [SV], hp: 560, atk: 60, armor: 25, mr: 30, mana: 90, range: 3, attackTicks: 9 },
  { id: 'thunderhawk', name: 'Thunderhawk', tier: 2, traits: [SB], hp: 550, atk: 60, armor: 20, mr: 30, mana: 90, range: 4, attackTicks: 9 },

  { id: 'wyrmcaller', name: 'Wyrmcaller', tier: 3, traits: [DA], hp: 700, atk: 70, armor: 30, mr: 35, mana: 90, range: 3, attackTicks: 10 },
  { id: 'paladin', name: 'Paladin', tier: 3, traits: [], hp: 950, atk: 65, armor: 120, mr: 60, mana: 100, range: 1, attackTicks: 11 },
  { id: 'deathknight', name: 'Death Knight', tier: 3, traits: [UD], hp: 900, atk: 75, armor: 110, mr: 45, mana: 100, range: 1, attackTicks: 10 },
  { id: 'astromancer', name: 'Astromancer', tier: 3, traits: [SG], hp: 700, atk: 65, armor: 30, mr: 45, mana: 80, range: 3, attackTicks: 10 },
  { id: 'lich', name: 'Lich', tier: 3, traits: [UD, SG], hp: 700, atk: 70, armor: 30, mr: 50, mana: 90, range: 3, attackTicks: 10 },
  { id: 'marksman', name: 'Marksman', tier: 3, traits: [DE], hp: 680, atk: 75, armor: 25, mr: 30, mana: 100, range: 4, attackTicks: 9 },
  { id: 'duelist', name: 'Duelist', tier: 3, traits: [DE], hp: 820, atk: 75, armor: 60, mr: 35, mana: 100, range: 1, attackTicks: 8 },
  { id: 'riftmage', name: 'Rift Mage', tier: 3, traits: [PW], hp: 650, atk: 65, armor: 25, mr: 50, mana: 80, range: 3, attackTicks: 10 },
  { id: 'voidstalker', name: 'Voidstalker', tier: 3, traits: [PW], hp: 850, atk: 75, armor: 60, mr: 40, mana: 100, range: 1, attackTicks: 9 },
  { id: 'chronicler', name: 'Chronicler', tier: 3, traits: [SW], hp: 720, atk: 65, armor: 30, mr: 50, mana: 80, range: 3, attackTicks: 10 },
  { id: 'stormherald', name: 'Storm Herald', tier: 3, traits: [SB], hp: 700, atk: 65, armor: 25, mr: 50, mana: 80, range: 3, attackTicks: 10 },

  { id: 'drakerider', name: 'Drake Rider', tier: 4, traits: [DA], hp: 950, atk: 90, armor: 70, mr: 40, mana: 100, range: 1, attackTicks: 9 },
  { id: 'wyrm', name: 'Star Wyrm', tier: 4, traits: [SG], hp: 1000, atk: 85, armor: 70, mr: 50, mana: 100, range: 2, attackTicks: 10 },
  { id: 'wraith', name: 'Wraith', tier: 4, traits: [UD], hp: 850, atk: 100, armor: 45, mr: 30, mana: 100, range: 1, attackTicks: 8 },
  { id: 'bonesniper', name: 'Bone Sniper', tier: 4, traits: [UD, DE], hp: 780, atk: 95, armor: 25, mr: 35, mana: 100, range: 4, attackTicks: 9 },
  { id: 'fablesword', name: 'Fablesword', tier: 4, traits: [SW], hp: 1000, atk: 90, armor: 75, mr: 45, mana: 100, range: 1, attackTicks: 9 },
  { id: 'mythweaver', name: 'Mythweaver', tier: 4, traits: [SW], hp: 820, atk: 85, armor: 30, mr: 55, mana: 80, range: 3, attackTicks: 10 },
  { id: 'junkbaron', name: 'Junk Baron', tier: 4, traits: [SV], hp: 1050, atk: 85, armor: 80, mr: 40, mana: 100, range: 1, attackTicks: 10 },
  { id: 'tempestknight', name: 'Tempest Knight', tier: 4, traits: [SB], hp: 1000, atk: 80, armor: 100, mr: 60, mana: 100, range: 1, attackTicks: 11 },
  { id: 'skyreaver', name: 'Skyreaver', tier: 4, traits: [SB], hp: 800, atk: 95, armor: 25, mr: 35, mana: 100, range: 3, attackTicks: 8 },

  { id: 'abomination', name: 'Abomination', tier: 5, traits: [UD], hp: 1500, atk: 100, armor: 120, mr: 50, mana: 120, range: 1, attackTicks: 11 },
  { id: 'oracle', name: 'Oracle', tier: 5, traits: [SG], hp: 950, atk: 90, armor: 35, mr: 55, mana: 80, range: 4, attackTicks: 10 },
  { id: 'ancientdragon', name: 'Ancient Dragon', tier: 5, traits: [DA], hp: 1600, atk: 115, armor: 110, mr: 60, mana: 120, range: 2, attackTicks: 11 },
  { id: 'titan', name: 'Titan', tier: 5, traits: [], hp: 1400, atk: 110, armor: 130, mr: 50, mana: 120, range: 1, attackTicks: 11 },
  { id: 'deadshot', name: 'Deadshot', tier: 5, traits: [DE], hp: 1000, atk: 115, armor: 35, mr: 40, mana: 110, range: 5, attackTicks: 8 },
  { id: 'chronarch', name: 'Chronarch', tier: 5, traits: [PW], hp: 1100, atk: 100, armor: 40, mr: 60, mana: 100, range: 3, attackTicks: 9 },
  { id: 'thunderlord', name: 'Thunder Lord', tier: 5, traits: [SB], hp: 1500, atk: 110, armor: 80, mr: 70, mana: 110, range: 2, attackTicks: 10 },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
