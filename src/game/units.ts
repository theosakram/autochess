import { astral } from './traits/astral';
import { cultOfFire } from './traits/cultOfFire';
import { dauntless } from './traits/dauntless';
import { deadeye } from './traits/deadeye';
import { defender } from './traits/defender';
import { dragonAltar } from './traits/dragonAltar';
import { fighter } from './traits/fighter';
import { gustiwana } from './traits/gustiwana';
import { hunter } from './traits/hunter';
import { mage } from './traits/mage';
import { mistbender } from './traits/mistbender';
import { mooneater } from './traits/mooneater';
import { spectre } from './traits/spectre';
import { necromancer } from './traits/necromancer';
import { phasewarper } from './traits/phasewarper';
import { scavenger } from './traits/scavenger';
import { skybringer } from './traits/skybringer';
import { stargazer } from './traits/stargazer';
import { storyweaver } from './traits/storyweaver';
import { weaponMaster } from './traits/weaponMaster';
import type { UnitDef } from './types';

const SG = stargazer.id;
const HU = hunter.id;
const MA = mage.id;
const DA = dragonAltar.id;
const SB = skybringer.id;
const DE = deadeye.id;
const PW = phasewarper.id;
const SW = storyweaver.id;
const SV = scavenger.id;
const GW = gustiwana.id;
const MO = mooneater.id;
const CF = cultOfFire.id;
const AS = astral.id;
const DF = defender.id;
const WM = weaponMaster.id;
const FI = fighter.id;
const DN = dauntless.id;
const NE = necromancer.id;
const MB = mistbender.id;
const SP = spectre.id;

// Every Defender and Dauntless unit attacks about 0.65 times a second: 15 ticks, the nearest the tick rate allows.
// Every Weapon Master attacks about 0.75 times a second (13 ticks), except Frank: it's also Dauntless, which wins.
// Every Stargazer, Hunter and Mage attacks about 0.75 times a second (13 ticks).
// Every Deadeye attacks about 0.8 times a second: 12 ticks (0.83), kept apart from the Weapon Masters' 13.
// Every ranged hero has range 4, except where set otherwise: Melina 12, Cici and Alice 2.
export const UNITS: UnitDef[] = [
  { id: 'siyunyin', name: 'Si Yun Yin', tier: 1, traits: [DA, HU], hp: 1840, atk: 110, ap: 110, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 13, skill: 'rendingbite', starStats: { hp: [1840, 3310, 5960], atk: [110, 165, 220], ap: [110, 165, 220] } },
  { id: 'phove', name: 'Phove', tier: 1, traits: [SP, SV], hp: 2030, atk: 105, ap: 105, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 15, skill: 'sappingtouch', starStats: { hp: [2030, 3655, 6575], atk: [105, 160, 210], ap: [105, 160, 210] } },
  // 0.75 attacks/sec at every star.
  { id: 'dyroth', name: 'Dyroth', tier: 1, traits: [GW, FI], hp: 1840, atk: 110, ap: 110, armor: 36, mr: 36, mana: 20, range: 1, attackTicks: 13, skill: 'prajuritsoath', starStats: { hp: [1840, 3310, 5960], atk: [110, 165, 220], ap: [110, 165, 220] } },
  { id: 'cici', name: 'Cici', tier: 1, traits: [CF, WM], hp: 1985, atk: 110, ap: 110, armor: 24, mr: 24, mana: 30, range: 2, attackTicks: 13, skill: 'kindletwice', starStats: { hp: [1985, 3575, 6435], atk: [110, 165, 220], ap: [110, 165, 220] } },
  { id: 'val', name: 'Val', tier: 1, traits: [NE, MA], hp: 1550, atk: 80, ap: 80, armor: 24, mr: 24, mana: 20, range: 4, attackTicks: 13, attackType: 'magic', skill: 'gravewhisper', starStats: { hp: [1550, 2790, 5020], atk: [80, 120, 160], ap: [80, 120, 160] } },
  { id: 'eudora', name: 'Eudora', tier: 1, traits: [SB, SG], hp: 1550, atk: 80, ap: 80, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 13, skill: 'galeshot', starStats: { hp: [1550, 2790, 5020], atk: [80, 120, 160], ap: [80, 120, 160] } },
  { id: 'minos', name: 'Minos', tier: 1, traits: [AS, DF], hp: 2030, atk: 105, ap: 105, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'starward', starStats: { hp: [2030, 3655, 6575], atk: [105, 160, 210], ap: [105, 160, 210] } },
  { id: 'uranus', name: 'Uranus', tier: 1, traits: [MB, DN], hp: 2030, atk: 105, ap: 105, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 15, skill: 'mistward', starStats: { hp: [2030, 3655, 6575], atk: [105, 160, 210], ap: [105, 160, 210] } },

  { id: 'luoyi', name: 'Luo Yi', tier: 2, traits: [DA, SG], hp: 1705, atk: 90, ap: 90, armor: 24, mr: 24, mana: 20, range: 4, attackTicks: 13, skill: 'altarspark', starStats: { hp: [1705, 3070, 5520], atk: [90, 130, 175], ap: [90, 130, 175] } },
  { id: 'natalie', name: 'Natalie', tier: 2, traits: [NE, HU], hp: 2025, atk: 120, ap: 120, armor: 36, mr: 36, mana: 20, range: 1, attackTicks: 13, skill: 'mournfulshot', starStats: { hp: [2025, 3645, 6550], atk: [120, 180, 240], ap: [120, 180, 240] } },
  { id: 'ginger', name: 'Ginger', tier: 2, traits: [SP, DE], hp: 1705, atk: 110, ap: 110, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 12, skill: 'gloomvolley', starStats: { hp: [1705, 2070, 5525], atk: [110, 165, 220], ap: [110, 165, 220] } },
  { id: 'harley', name: 'Harley', tier: 2, traits: [NE, PW], hp: 1705, atk: 90, ap: 90, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 8, attackType: 'magic', skill: 'shadebolts', starStats: { hp: [1705, 3070, 5520], atk: [90, 130, 175], ap: [90, 130, 175] } },
  // 0.75 attacks/sec at every star.
  { id: 'belle', name: 'Belle', tier: 2, traits: [SW, FI], hp: 2025, atk: 130, ap: 130, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 13, skill: 'inkedstrike', starStats: { hp: [2025, 3645, 6550], atk: [130, 195, 260], ap: [130, 195, 260] } },
  { id: 'angela', name: 'Angela', tier: 2, traits: [GW, SV], hp: 1705, atk: 90, ap: 90, armor: 24, mr: 24, mana: 40, range: 4, attackTicks: 9, skill: 'taripenyembuh', starStats: { hp: [1705, 3070, 5525], atk: [90, 130, 175], ap: [90, 130, 175] } },
  { id: 'zhuxin', name: 'Zhuxin', tier: 2, traits: [CF, MA], hp: 1705, atk: 90, ap: 90, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 13, attackType: 'magic', skill: 'ashstorm', starStats: { hp: [1705, 3070, 5520], atk: [90, 130, 175], ap: [90, 130, 175] } },
  { id: 'mia', name: 'Mia', tier: 2, traits: [CF, DE], hp: 1705, atk: 110, ap: 110, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 12, skill: 'pyrefrenzy', starStats: { hp: [1705, 3070, 5520], atk: [110, 165, 220], ap: [110, 165, 220] } },
  { id: 'balman', name: 'Balman', tier: 2, traits: [SB, DN], hp: 2235, atk: 115, ap: 115, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'thunderwhirl', starStats: { hp: [2235, 4020, 7225], atk: [115, 175, 230], ap: [115, 175, 230] } },
  { id: 'martin', name: 'Martin', tier: 2, traits: [AS, WM], hp: 2185, atk: 120, ap: 120, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 13, skill: 'cometlunge', starStats: { hp: [2185, 3935, 7075], atk: [120, 180, 240], ap: [120, 180, 240] } },
  { id: 'hilos', name: 'Hilos', tier: 2, traits: [MO, DF], hp: 2235, atk: 115, ap: 115, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'guardiansstrike', starStats: { hp: [2235, 4020, 7225], atk: [115, 175, 230], ap: [115, 175, 230] } },

  { id: 'wan', name: 'Wan', tier: 3, traits: [DA, DE], hp: 2170, atk: 140, ap: 140, armor: 24, mr: 24, mana: 20, range: 4, attackTicks: 12, skill: 'dragonlance', starStats: { hp: [2170, 3905, 7380], atk: [140, 210, 280], ap: [140, 210, 280] } },
  { id: 'saber', name: 'Saber', tier: 3, traits: [SP, HU], hp: 2575, atk: 155, ap: 155, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 13, skill: 'soulorbit', starStats: { hp: [2575, 4635, 8760], atk: [155, 230, 310], ap: [155, 230, 310] } },
  { id: 'kanina', name: 'Kanina', tier: 3, traits: [MO, PW, MA], hp: 2170, atk: 105, ap: 105, armor: 24, mr: 24, mana: 40, range: 4, attackTicks: 13, attackType: 'magic', skill: 'tidalsurge', starStats: { hp: [2170, 3905, 7380], atk: [105, 155, 210], ap: [105, 155, 210] } },
  { id: 'mathilda', name: 'Mathilda', tier: 3, traits: [SW, SG], hp: 2170, atk: 105, ap: 105, armor: 24, mr: 24, mana: 50, range: 4, attackTicks: 13, skill: 'unfoldingtale', starStats: { hp: [2170, 3905, 7380], atk: [105, 145, 195], ap: [105, 145, 195] } },
  { id: 'frank', name: 'Frank', tier: 3, traits: [GW, WM, DN], hp: 3065, atk: 135, ap: 135, armor: 36, mr: 36, mana: 80, range: 1, attackTicks: 15, skill: 'puppetsnare', starStats: { hp: [3065, 5525, 10440], atk: [135, 205, 275], ap: [135, 205, 275] } },
  { id: 'clint', name: 'Clint', tier: 3, traits: [SB, PW], hp: 2170, atk: 140, ap: 140, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 12, skill: 'stormflurry', starStats: { hp: [2170, 3905, 7380], atk: [140, 210, 280], ap: [140, 210, 280] } },
  { id: 'katarina', name: 'Katarina', tier: 3, traits: [AS, SG, HU], hp: 2575, atk: 145, ap: 145, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 13, skill: 'fallingstar', starStats: { hp: [2575, 4635, 8760], atk: [145, 200, 260], ap: [145, 200, 260] } },
  { id: 'hilman', name: 'Hilman', tier: 3, traits: [AS, DN], hp: 3295, atk: 135, ap: 135, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 15, skill: 'zodiacslam', starStats: { hp: [3295, 5935, 11210], atk: [135, 205, 275], ap: [135, 205, 275] } },
  { id: 'edith', name: 'Edith', tier: 3, traits: [CF, DF], hp: 2615, atk: 135, ap: 135, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'ashenwall', starStats: { hp: [2615, 4705, 8890], atk: [135, 205, 275], ap: [135, 205, 275] } },
  { id: 'tig', name: 'Tig', tier: 3, traits: [NE, DF], hp: 2615, atk: 135, ap: 135, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 15, skill: 'cryptseal', starStats: { hp: [2615, 4705, 8890], atk: [135, 205, 275], ap: [135, 205, 275] } },
  // 0.75 attacks/sec at every star.
  { id: 'aldo', name: 'Aldo', tier: 3, traits: [MB, FI], hp: 2575, atk: 145, ap: 145, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 13, skill: 'mistyjab', starStats: { hp: [2575, 4635, 8769], atk: [145, 215, 285], ap: [145, 215, 285] } },
  // 0.75 attacks/sec at every star.
  { id: 'pacquiao', name: 'Pacquiao', tier: 3, traits: [SP, FI], hp: 2370, atk: 145, ap: 145, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 13, skill: 'phantomstep', starStats: { hp: [2370, 4265, 8060], atk: [145, 215, 285], ap: [145, 215, 285] } },

  { id: 'suyu', name: 'Suyu', tier: 4, traits: [DA, WM], hp: 3830, atk: 195, ap: 195, armor: 36, mr: 36, mana: 40, range: 1, attackTicks: 13, skill: 'drakerend', starStats: { hp: [3830, 6890, 17030], atk: [195, 295, 410], ap: [195, 295, 410] } },
  // 0.75 attacks/sec at every star.
  { id: 'yang', name: 'Yang', tier: 4, traits: [DA, FI], hp: 3545, atk: 160, ap: 160, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 13, skill: 'wyrmfrenzy', starStats: { hp: [3545, 6380, 15770], atk: [160, 275, 410], ap: [160, 275, 410] } },
  { id: 'vex', name: 'Vex', tier: 4, traits: [SW, MA], hp: 3100, atk: 145, ap: 145, armor: 24, mr: 24, mana: 50, range: 4, attackTicks: 13, attackType: 'magic', skill: 'mythmadeflesh', starStats: { hp: [3100, 5580, 13795], atk: [145, 220, 325], ap: [145, 220, 325] } },
  { id: 'sora', name: 'Sora', tier: 4, traits: [NE, SV], hp: 3545, atk: 180, ap: 180, armor: 36, mr: 36, mana: 40, range: 1, attackTicks: 10, skill: 'shovelslam', starStats: { hp: [3545, 6380, 17345], atk: [180, 275, 410], ap: [180, 275, 410] } },
  { id: 'kari', name: 'Kari', tier: 4, traits: [GW, DE], hp: 3100, atk: 155, ap: 155, armor: 24, mr: 24, mana: 40, range: 4, attackTicks: 12, skill: 'commandersmark', starStats: { hp: [3100, 5580, 13795], atk: [155, 235, 405], ap: [155, 235, 405] } },
  { id: 'lunox', name: 'Lunox', tier: 4, traits: [GW, SG], hp: 3100, atk: 130, ap: 130, armor: 24, mr: 24, mana: 20, range: 4, attackTicks: 13, attackType: 'magic', skill: 'powerofchaos', starStats: { hp: [3100, 5580, 13795], atk: [130, 185, 295], ap: [130, 185, 295] } },
  { id: 'lola', name: 'Lola', tier: 4, traits: [CF, DN], hp: 4070, atk: 175, ap: 175, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'pyreblast', starStats: { hp: [4070, 7330, 18115], atk: [175, 260, 390], ap: [175, 260, 390], mana: [60, 60, 40] } },
  { id: 'gourd', name: 'Gourd', tier: 4, traits: [SP, MA], hp: 3100, atk: 130, ap: 130, armor: 24, mr: 24, mana: 30, range: 4, attackTicks: 13, attackType: 'magic', skill: 'etherbeam', starStats: { hp: [3100, 5580, 13795], atk: [130, 200, 295], ap: [130, 200, 295] } },
  { id: 'gufron', name: 'Gufron', tier: 4, traits: [SB, HU], hp: 3545, atk: 180, ap: 180, armor: 36, mr: 36, mana: 40, range: 1, attackTicks: 13, attackType: 'magic', skill: 'stormpursuit', starStats: { hp: [3545, 6380, 15770], atk: [180, 275, 410], ap: [180, 275, 410] } },
  { id: 'zhizong', name: 'Zhizong', tier: 4, traits: [SB, WM], hp: 3830, atk: 180, ap: 180, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 13, skill: 'skyreap', starStats: { hp: [3830, 6890, 17030], atk: [180, 275, 410], ap: [180, 275, 410] } },
  { id: 'irina', name: 'Irina', tier: 4, traits: [AS, DE], hp: 3350, atk: 165, ap: 165, armor: 24, mr: 24, mana: 75, range: 4, attackTicks: 12, skill: 'polarbarrage', starStats: { hp: [3350, 6025, 14900], atk: [165, 250, 370], ap: [165, 250, 370], mana: [75, 75, 70], attackTicks: [12, 12, 10] } },
  { id: 'altus', name: 'Altus', tier: 4, traits: [SW, DF], hp: 3770, atk: 175, ap: 175, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'talesend', starStats: { hp: [3770, 6785, 16775], atk: [175, 260, 390], ap: [175, 260, 390], mana: [60, 60, 40] } },

  { id: 'fanny', name: 'Fanny', tier: 5, traits: [CF, HU], hp: 4075, atk: 255, ap: 255, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 13, skill: 'rampage', starStats: { hp: [4075, 7335, 50535], atk: [255, 385, 820], ap: [255, 385, 820], mana: [50, 50, 20] } },
  { id: 'nana', name: 'Nana', tier: 5, traits: [MB, SG], hp: 3565, atk: 185, ap: 185, armor: 24, mr: 24, mana: 20, range: 4, attackTicks: 13, skill: 'mistboomerang', starStats: { hp: [3565, 6415, 44202], atk: [185, 285, 605], ap: [185, 285, 605] } },
  { id: 'balia', name: 'Balia', tier: 5, traits: [DA, DF], hp: 4250, atk: 230, ap: 230, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 15, skill: 'dragonsdominion', starStats: { hp: [4250, 7650, 52685], atk: [230, 345, 740], ap: [230, 345, 740], mana: [60, 60, 20] } },
  { id: 'melina', name: 'Melina', tier: 5, traits: [DE, MO], hp: 3365, atk: 220, ap: 220, armor: 24, mr: 24, mana: 20, range: 12, attackTicks: 12, skill: 'spiritarchers', starStats: { hp: [3365, 6415, 44205], atk: [220, 330, 705], ap: [220, 330, 705] } },
  { id: 'lance', name: 'Lance', tier: 5, traits: [GW, PW], hp: 4075, atk: 240, ap: 240, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 8, skill: 'phantomexecution', starStats: { hp: [4075, 7335, 50535], atk: [240, 365, 775], ap: [240, 365, 775], mana: [50, 50, 20] } },
  // 0.75 attacks/sec at every star.
  { id: 'balang', name: 'Balang', tier: 5, traits: [SB, FI], hp: 4075, atk: 215, ap: 215, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 13, skill: 'stormfists', starStats: { hp: [4075, 7335, 50535], atk: [215, 320, 680], ap: [215, 320, 680], mana: [50, 50, 20] } },
  { id: 'odette', name: 'Odette', tier: 5, traits: [AS, MA], hp: 3565, atk: 175, ap: 175, armor: 24, mr: 24, mana: 50, range: 4, attackTicks: 13, attackType: 'magic', skill: 'starfallaegis', starStats: { hp: [3565, 6415, 44205], atk: [175, 265, 565], ap: [175, 265, 565], mana: [50, 50, 20] } },
  { id: 'thamar', name: 'Thamar', tier: 5, traits: [NE, WM], hp: 4685, atk: 240, ap: 240, armor: 36, mr: 36, mana: 30, range: 1, attackTicks: 13, skill: 'undyingfury', starStats: { hp: [4685, 8435, 58115], atk: [240, 365, 775], ap: [240, 365, 775], mana: [30, 30, 20] } },
  // Range 2, but a frontliner: frontline armor and magic resist.
  { id: 'alice', name: 'Alice', tier: 5, traits: [SP, DN], hp: 3990, atk: 230, ap: 230, armor: 36, mr: 36, mana: 60, range: 2, attackTicks: 15, skill: 'dreaddescent', starStats: { hp: [3990, 7180, 53760], atk: [230, 345, 740], ap: [230, 345, 740], mana: [60, 60, 20] } },
  // Plane Wanderers: raised by the Necromancer grave (one per player, rolled once), never in the shop.
  { id: 'gatotkaca', name: 'Gatotkaca', tier: 5, traits: [FI], hp: 4075, atk: 215, ap: 215, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 13, honorary: { trait: NE, icon: '🧭' }, skill: 'bladedescent', shop: false, freeSlot: true, starStats: { hp: [4075, 7335, 50535], atk: [215, 320, 680], ap: [215, 320, 680], mana: [50, 50, 20] } },
  { id: 'moscow', name: 'Moscow', tier: 5, traits: [DE], hp: 3365, atk: 220, ap: 220, armor: 24, mr: 24, mana: 50, range: 4, attackTicks: 12, honorary: { trait: NE, icon: '🧭' }, skill: 'wanderersvolley', shop: false, freeSlot: true, starStats: { hp: [3365, 6415, 44205], atk: [220, 330, 705], ap: [220, 330, 705], mana: [50, 50, 20] } },
  { id: 'amon', name: 'Amon', tier: 5, traits: [HU], hp: 3900, atk: 235, ap: 235, armor: 36, mr: 36, mana: 40, range: 1, attackTicks: 13, honorary: { trait: NE, icon: '🧭' }, skill: 'stalkersmark', shop: false, freeSlot: true, starStats: { hp: [3900, 7020, 48000], atk: [235, 355, 760], ap: [235, 355, 760], mana: [40, 40, 20] } },
  { id: 'cyborg', name: 'Cyborg', tier: 5, traits: [DN], hp: 4400, atk: 230, ap: 230, armor: 36, mr: 36, mana: 40, range: 1, attackTicks: 15, honorary: { trait: NE, icon: '🧭' }, skill: 'craterfall', shop: false, freeSlot: true, starStats: { hp: [4400, 7920, 54000], atk: [230, 345, 740], ap: [230, 345, 740], mana: [40, 40, 20] } },
  { id: 'novaria', name: 'Novaria', tier: 5, traits: [SG], hp: 3200, atk: 165, ap: 165, armor: 24, mr: 24, mana: 50, range: 4, attackTicks: 13, attackType: 'magic', honorary: { trait: NE, icon: '🧭' }, skill: 'fatethread', shop: false, freeSlot: true, starStats: { hp: [3200, 5760, 40000], atk: [165, 250, 540], ap: [165, 250, 540], mana: [50, 50, 20] } },
  // Dropped by Vex's Myth Made Flesh inside a fight; its hp and attack come from Vex.
  { id: 'mythbeast', name: 'Myth Beast', tier: 4, traits: [], hp: 1, atk: 0, ap: 0, armor: 45, mr: 45, mana: 70, range: 1, attackTicks: 9, skill: 'beastmaul', shop: false, summon: true },
  // Summoned by Melina's Spirit Archers inside a fight; its hp and damage come from Melina.
  { id: 'spiritarcher', name: 'Spirit Archer', tier: 5, traits: [], hp: 1, atk: 0, ap: 0, armor: 30, mr: 30, mana: 100, range: 5, attackTicks: 10, shop: false, summon: true },
  // Monsters (see monsters.ts): only met in monster rounds.
  { id: 'mistwolf', name: 'Mist Wolf', tier: 1, traits: [], hp: 800, atk: 70, ap: 40, armor: 30, mr: 30, mana: 100, range: 1, attackTicks: 8, shop: false, monster: true },
  { id: 'stonegolem', name: 'Stone Golem', tier: 3, traits: [], hp: 1600, atk: 90, ap: 50, armor: 90, mr: 50, mana: 120, range: 1, attackTicks: 12, shop: false, monster: true },
  { id: 'elderdrake', name: 'Elder Drake', tier: 5, traits: [], hp: 3000, atk: 120, ap: 130, armor: 70, mr: 70, mana: 100, range: 2, attackTicks: 10, attackType: 'magic', shop: false, monster: true },
  // Lukas's Divine Beast (see commanders/): a board piece that fires once when a fight starts, never a fighter.
  { id: 'divinebeast', name: 'Divine Beast', tier: 5, traits: [], hp: 1, atk: 0, ap: 0, armor: 0, mr: 0, mana: 100, range: 1, attackTicks: 10, shop: false, freeSlot: true, piece: true },
  // The only 7-gold unit: in a player's shop (rolled with the 5-golds) once Spectre unlocks it for them.
  { id: 'bossalpha', name: 'Boss Alpha', tier: 7, traits: [SP], hp: 6500, atk: 370, ap: 370, armor: 36, mr: 36, mana: 50, range: 1, attackTicks: 10, skill: 'spectralcataclysm', locked: true, shopTier: 5, mergeSize: 4, starStats: { hp: [6500, 11700, 80000], atk: [370, 555, 1180], ap: [370, 555, 1180], mana: [50, 50, 20] } },
];

// Johnson's Johnnie: a 3-gold hero with one faction and one role, any pair; free to buy (worth nothing sold).
// One def per pair, all sharing the same stats and skill. Kept out of UNITS: they're nobody's until
// Johnson's pick, and they'd flood every hero list.
// Not every trait: Mistbender, Mooneater, Storyweaver, Phasewarper and Scavenger are left out.
const FACTIONS = [astral, cultOfFire, dragonAltar, gustiwana, necromancer, skybringer, spectre].map((t) => t.id);
const ROLES = [dauntless, deadeye, defender, fighter, hunter, mage, stargazer, weaponMaster].map((t) => t.id);
export const JOHNNIE_FACTIONS = FACTIONS;
export const JOHNNIE_ROLES = ROLES;
export const johnnieId = (faction: string, role: string) => `johnnie-${faction}-${role}`;
const JOHNNIE: Omit<UnitDef, 'id' | 'traits'> = {
  name: 'Johnnie', tier: 3, price: 0, johnnie: true, shop: false,
  hp: 2575, atk: 140, ap: 140, armor: 36, mr: 36, mana: 60, range: 1, attackTicks: 13, skill: 'partycrasher',
  starStats: { hp: [2575, 4635, 8760], atk: [140, 210, 280], ap: [140, 210, 280] },
};
// Attack speed follows the role, as for every hero (see the note above UNITS); 13 ticks otherwise.
const ROLE_TICKS: Record<string, number> = { [DF]: 15, [DN]: 15, [DE]: 12 };
export const JOHNNIES: UnitDef[] = FACTIONS.flatMap((f) =>
  ROLES.map((r) => ({ ...JOHNNIE, id: johnnieId(f, r), traits: [f, r], attackTicks: ROLE_TICKS[r] ?? JOHNNIE.attackTicks })),
);

// Turret of Guardians (a gold power card): a unit with one faction and one role (any pair, as Johnnie's) and a
// 4-gold hero's stats. Never walks and can't be moved by enemies; shoots across the board. Takes no board slot and
// can't be sold. Stars up with time (see turrets in powerCards), never by copies. Kept out of UNITS, like the Johnnies.
export const turretId = (faction: string, role: string) => `turret-${faction}-${role}`;
const TURRET: Omit<UnitDef, 'id' | 'traits'> = {
  name: 'Turret', tier: 4, price: 0, turret: true, rooted: true, freeSlot: true, shop: false,
  hp: 3100, atk: 145, ap: 145, armor: 24, mr: 24, mana: 60, range: 12, attackTicks: 13,
  starStats: { hp: [3100, 5580, 13795], atk: [145, 220, 325], ap: [145, 220, 325] },
};
const MAGIC_ROLES = new Set([mage.id, stargazer.id]);
export const TURRETS: UnitDef[] = FACTIONS.flatMap((f) =>
  ROLES.map((r) => ({ ...TURRET, id: turretId(f, r), traits: [f, r], attackTicks: ROLE_TICKS[r] ?? TURRET.attackTicks, ...(MAGIC_ROLES.has(r) && { attackType: 'magic' as const }) })),
);

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries([...UNITS, ...JOHNNIES, ...TURRETS].map((u) => [u.id, u]));

// Gold to buy a unit, and what one copy sells for.
export const unitPrice = (defId: string) => UNIT_BY_ID[defId].price ?? UNIT_BY_ID[defId].tier;
