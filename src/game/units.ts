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

export const UNITS: UnitDef[] = [
  { id: 'drakeling', name: 'Drakeling', tier: 1, traits: [DA, HU], hp: 620, atk: 55, ap: 33, armor: 55, mr: 30, mana: 60, range: 1, attackTicks: 10, skill: 'rendingbite' },
  { id: 'wisp', name: 'Wisp', tier: 1, traits: [SP, SV], hp: 620, atk: 50, ap: 30, armor: 50, mr: 25, mana: 60, range: 1, attackTicks: 10, skill: 'sappingtouch' },
  { id: 'prajurit', name: 'Prajurit', tier: 1, traits: [GW, FI], hp: 650, atk: 50, ap: 30, armor: 50, mr: 30, mana: 60, range: 1, attackTicks: 10, skill: 'prajuritsoath' },
  { id: 'kindler', name: 'Kindler', tier: 1, traits: [CF, WM], hp: 640, atk: 50, ap: 30, armor: 45, mr: 35, mana: 60, range: 1, attackTicks: 10, skill: 'kindletwice' },
  { id: 'boneadept', name: 'Bone Adept', tier: 1, traits: [NE, MA], hp: 480, atk: 22, ap: 45, armor: 15, mr: 40, mana: 60, range: 3, attackTicks: 10, attackType: 'magic', skill: 'gravewhisper' },
  { id: 'galekin', name: 'Galekin', tier: 1, traits: [SB, SG], hp: 520, atk: 55, ap: 33, armor: 20, mr: 30, mana: 40, range: 3, attackTicks: 9, skill: 'galeshot' },
  { id: 'stardustsquire', name: 'Stardust Squire', tier: 1, traits: [AS, DF], hp: 620, atk: 52, ap: 31, armor: 55, mr: 30, mana: 60, range: 1, attackTicks: 10, skill: 'starward' },
  { id: 'hazeguard', name: 'Hazeguard', tier: 1, traits: [MB, DN], hp: 640, atk: 50, ap: 30, armor: 50, mr: 30, mana: 20, range: 1, attackTicks: 10, skill: 'mistward' },

  { id: 'altarkeeper', name: 'Altar Keeper', tier: 2, traits: [DA, SG], hp: 550, atk: 55, ap: 55, armor: 25, mr: 35, mana: 40, range: 3, attackTicks: 10, skill: 'altarspark' },
  { id: 'banshee', name: 'Banshee', tier: 2, traits: [NE, HU], hp: 640, atk: 60, ap: 60, armor: 45, mr: 30, mana: 50, range: 1, attackTicks: 10, skill: 'mournfulshot' },
  { id: 'gloomshot', name: 'Gloomshot', tier: 2, traits: [SP, DE], hp: 540, atk: 60, ap: 36, armor: 20, mr: 25, mana: 70, range: 4, attackTicks: 8, skill: 'gloomvolley' },
  { id: 'shadewalker', name: 'Shadewalker', tier: 2, traits: [NE, PW], hp: 540, atk: 65, ap: 39, armor: 20, mr: 35, mana: 70, range: 3, attackTicks: 8, skill: 'shadebolts' },
  { id: 'inkling', name: 'Inkling', tier: 2, traits: [SW, FI], hp: 640, atk: 55, ap: 55, armor: 45, mr: 30, mana: 60, range: 1, attackTicks: 10, skill: 'inkedstrike' },
  { id: 'penari', name: 'Penari', tier: 2, traits: [GW, SV], hp: 560, atk: 60, ap: 60, armor: 20, mr: 35, mana: 70, range: 3, attackTicks: 9, skill: 'taripenyembuh' },
  { id: 'ashbinder', name: 'Ashbinder', tier: 2, traits: [CF, MA], hp: 560, atk: 30, ap: 60, armor: 20, mr: 40, mana: 80, range: 3, attackTicks: 9, attackType: 'magic', skill: 'ashstorm' },
  { id: 'pyreguard', name: 'Pyre Guard', tier: 2, traits: [CF, DE], hp: 560, atk: 64, ap: 38, armor: 20, mr: 30, mana: 60, range: 3, attackTicks: 9, skill: 'pyrefrenzy' },
  { id: 'thunderhawk', name: 'Thunderhawk', tier: 2, traits: [SB, DN], hp: 760, atk: 62, ap: 37, armor: 60, mr: 35, mana: 80, range: 1, attackTicks: 9, skill: 'thunderwhirl' },
  { id: 'cometlancer', name: 'Comet Lancer', tier: 2, traits: [AS, WM], hp: 640, atk: 65, ap: 39, armor: 45, mr: 30, mana: 60, range: 1, attackTicks: 9, skill: 'cometlunge' },
  { id: 'dwarapala', name: 'Dwarapala', tier: 2, traits: [MO, DF], hp: 780, atk: 48, ap: 29, armor: 90, mr: 50, mana: 60, range: 1, attackTicks: 11, skill: 'guardiansstrike' },

  { id: 'wyrmcaller', name: 'Wyrmcaller', tier: 3, traits: [DA, DE], hp: 700, atk: 70, ap: 42, armor: 30, mr: 35, mana: 70, range: 3, attackTicks: 10, skill: 'dragonlance' },
  { id: 'soulreaper', name: 'Soulreaper', tier: 3, traits: [SP, HU], hp: 900, atk: 75, ap: 75, armor: 110, mr: 45, mana: 80, range: 1, attackTicks: 10, skill: 'soulorbit' },
  { id: 'rarajonggrang', name: 'Rara Jonggrang', tier: 3, traits: [MO, PW, MA], hp: 720, atk: 35, ap: 70, armor: 30, mr: 50, mana: 80, range: 3, attackTicks: 9, attackType: 'magic', skill: 'tidalsurge' },
  { id: 'chronicler', name: 'Chronicler', tier: 3, traits: [SW, SG], hp: 720, atk: 65, ap: 65, armor: 30, mr: 50, mana: 80, range: 3, attackTicks: 10, skill: 'unfoldingtale' },
  { id: 'dalang', name: 'Dalang', tier: 3, traits: [GW, WM, DN], hp: 900, atk: 72, ap: 43, armor: 65, mr: 45, mana: 100, range: 1, attackTicks: 9, skill: 'puppetsnare' },
  { id: 'stormherald', name: 'Storm Herald', tier: 3, traits: [SB, PW], hp: 700, atk: 65, ap: 65, armor: 25, mr: 50, mana: 70, range: 3, attackTicks: 10, skill: 'stormflurry' },
  { id: 'nebulaseer', name: 'Nebula Seer', tier: 3, traits: [AS, SG, HU], hp: 860, atk: 65, ap: 65, armor: 55, mr: 40, mana: 80, range: 1, attackTicks: 10, skill: 'fallingstar' },
  { id: 'zodiacblade', name: 'Zodiac Blade', tier: 3, traits: [AS, DN], hp: 880, atk: 75, ap: 45, armor: 70, mr: 40, mana: 80, range: 1, attackTicks: 9, skill: 'zodiacslam' },
  { id: 'ashwarden', name: 'Ash Warden', tier: 3, traits: [CF, DF], hp: 950, atk: 60, ap: 36, armor: 115, mr: 55, mana: 100, range: 1, attackTicks: 11, skill: 'ashenwall' },
  { id: 'cryptwarden', name: 'Crypt Warden', tier: 3, traits: [NE, DF], hp: 880, atk: 68, ap: 41, armor: 80, mr: 80, mana: 100, range: 1, attackTicks: 10, skill: 'cryptseal' },
  { id: 'fogfist', name: 'Fogfist', tier: 3, traits: [MB, FI], hp: 860, atk: 72, ap: 43, armor: 55, mr: 35, mana: 30, range: 1, attackTicks: 8, skill: 'mistyjab' },
  { id: 'phantomblade', name: 'Phantom Blade', tier: 3, traits: [SP, FI], hp: 820, atk: 78, ap: 47, armor: 50, mr: 35, mana: 80, range: 1, attackTicks: 9, skill: 'phantomstep' },

  { id: 'drakerider', name: 'Drake Rider', tier: 4, traits: [DA, WM], hp: 950, atk: 90, ap: 54, armor: 70, mr: 40, mana: 100, range: 1, attackTicks: 9, skill: 'drakerend' },
  { id: 'wyrmfang', name: 'Wyrmfang', tier: 4, traits: [DA, FI], hp: 980, atk: 92, ap: 55, armor: 65, mr: 40, mana: 100, range: 1, attackTicks: 8, skill: 'wyrmfrenzy' },
  { id: 'mythweaver', name: 'Mythweaver', tier: 4, traits: [SW, MA], hp: 820, atk: 42, ap: 85, armor: 30, mr: 55, mana: 100, range: 3, attackTicks: 10, attackType: 'magic', skill: 'mythmadeflesh' },
  { id: 'graverobber', name: 'Grave Robber', tier: 4, traits: [NE, SV], hp: 1050, atk: 85, ap: 51, armor: 80, mr: 40, mana: 90, range: 1, attackTicks: 10, skill: 'shovelslam' },
  { id: 'senopati', name: 'Senopati', tier: 4, traits: [GW, DE], hp: 850, atk: 95, ap: 57, armor: 30, mr: 35, mana: 80, range: 4, attackTicks: 8, skill: 'commandersmark' },
  { id: 'resi', name: 'Resi', tier: 4, traits: [GW, SG], hp: 820, atk: 42, ap: 85, armor: 25, mr: 55, mana: 80, range: 3, attackTicks: 10, attackType: 'magic', skill: 'powerofchaos' },
  { id: 'pyromancer', name: 'High Pyromancer', tier: 4, traits: [CF, DN], hp: 1100, atk: 92, ap: 55, armor: 80, mr: 55, mana: 100, range: 1, attackTicks: 10, skill: 'pyreblast' },
  { id: 'ethersage', name: 'Ether Sage', tier: 4, traits: [SP, MA], hp: 800, atk: 40, ap: 80, armor: 25, mr: 60, mana: 60, range: 3, attackTicks: 10, attackType: 'magic', skill: 'etherbeam' },
  { id: 'tempestknight', name: 'Tempest Knight', tier: 4, traits: [SB, HU], hp: 1000, atk: 80, ap: 48, armor: 100, mr: 60, mana: 60, range: 1, attackTicks: 11, skill: 'stormpursuit' },
  { id: 'skyreaver', name: 'Skyreaver', tier: 4, traits: [SB, WM], hp: 1050, atk: 95, ap: 57, armor: 70, mr: 45, mana: 80, range: 1, attackTicks: 8, skill: 'skyreap' },
  { id: 'polaris', name: 'Polaris', tier: 4, traits: [AS, DE], hp: 800, atk: 95, ap: 57, armor: 25, mr: 35, mana: 90, range: 4, attackTicks: 8, skill: 'polarbarrage' },
  { id: 'taleshield', name: 'Taleshield', tier: 4, traits: [SW, DF], hp: 1150, atk: 78, ap: 47, armor: 120, mr: 70, mana: 100, range: 1, attackTicks: 11, skill: 'talesend' },

  { id: 'abomination', name: 'Abomination', tier: 5, traits: [CF, HU], hp: 1500, atk: 100, ap: 60, armor: 120, mr: 50, mana: 90, range: 1, attackTicks: 11, skill: 'rampage' },
  { id: 'mistoracle', name: 'Mist Oracle', tier: 5, traits: [MB, SG], hp: 950, atk: 90, ap: 90, armor: 35, mr: 55, mana: 60, range: 4, attackTicks: 10, skill: 'mistboomerang' },
  { id: 'ancientdragon', name: 'Ancient Dragon', tier: 5, traits: [DA, DF], hp: 1600, atk: 115, ap: 115, armor: 110, mr: 60, mana: 120, range: 1, attackTicks: 11, skill: 'dragonsdominion' },
  { id: 'arjuna', name: 'Arjuna', tier: 5, traits: [DE, MO], hp: 1000, atk: 115, ap: 69, armor: 35, mr: 40, mana: 90, range: 5, attackTicks: 8, skill: 'spiritarchers' },
  { id: 'batarakala', name: 'Batara Kala', tier: 5, traits: [GW, PW], hp: 1150, atk: 135, ap: 81, armor: 55, mr: 45, mana: 100, range: 1, attackTicks: 8, skill: 'phantomexecution' },
  { id: 'thunderlord', name: 'Thunder Lord', tier: 5, traits: [SB, FI], hp: 1500, atk: 110, ap: 66, armor: 90, mr: 70, mana: 100, range: 1, attackTicks: 10, skill: 'stormfists' },
  { id: 'empyrean', name: 'Empyrean', tier: 5, traits: [AS, MA], hp: 1000, atk: 52, ap: 105, armor: 35, mr: 65, mana: 90, range: 4, attackTicks: 10, attackType: 'magic', skill: 'starfallaegis' },
  { id: 'revenant', name: 'Revenant', tier: 5, traits: [NE, WM], hp: 1150, atk: 130, ap: 78, armor: 60, mr: 45, mana: 100, range: 1, attackTicks: 8, skill: 'undyingfury' },
  { id: 'wraithlord', name: 'Wraithlord', tier: 5, traits: [SP, DN], hp: 1400, atk: 115, ap: 69, armor: 80, mr: 60, mana: 100, range: 1, attackTicks: 9, skill: 'dreaddescent' },
  // Plane Wanderers: raised by the Necromancer grave (one per player, rolled once), never in the shop.
  { id: 'wanderingblade', name: 'Wandering Blade', tier: 5, traits: [FI], hp: 1250, atk: 120, ap: 72, armor: 60, mr: 45, mana: 80, range: 1, attackTicks: 8, honorary: { trait: NE, icon: '🧭' }, skill: 'bladedescent', shop: false, freeSlot: true },
  { id: 'wanderingeye', name: 'Wandering Eye', tier: 5, traits: [DE], hp: 950, atk: 120, ap: 72, armor: 30, mr: 40, mana: 90, range: 4, attackTicks: 8, honorary: { trait: NE, icon: '🧭' }, skill: 'wanderersvolley', shop: false, freeSlot: true },
  { id: 'wanderinghunter', name: 'Wandering Hunter', tier: 5, traits: [HU], hp: 1200, atk: 115, ap: 69, armor: 70, mr: 45, mana: 60, range: 1, attackTicks: 9, honorary: { trait: NE, icon: '🧭' }, skill: 'stalkersmark', shop: false, freeSlot: true },
  { id: 'wanderingbastion', name: 'Wandering Bastion', tier: 5, traits: [DN], hp: 1500, atk: 95, ap: 57, armor: 100, mr: 70, mana: 100, range: 1, attackTicks: 10, honorary: { trait: NE, icon: '🧭' }, skill: 'craterfall', shop: false, freeSlot: true },
  { id: 'wanderingseer', name: 'Wandering Seer', tier: 5, traits: [SG], hp: 950, atk: 50, ap: 110, armor: 30, mr: 60, mana: 90, range: 3, attackTicks: 10, attackType: 'magic', honorary: { trait: NE, icon: '🧭' }, skill: 'fatethread', shop: false, freeSlot: true },
  // Dropped by Mythweaver's Myth Made Flesh inside a fight; its hp and attack come from Mythweaver.
  { id: 'mythbeast', name: 'Myth Beast', tier: 4, traits: [], hp: 1, atk: 0, ap: 0, armor: 45, mr: 45, mana: 70, range: 1, attackTicks: 9, skill: 'beastmaul', shop: false, summon: true },
  // Summoned by Arjuna's Spirit Archers inside a fight; its hp and damage come from Arjuna.
  { id: 'spiritarcher', name: 'Spirit Archer', tier: 5, traits: [], hp: 1, atk: 0, ap: 0, armor: 30, mr: 30, mana: 100, range: 5, attackTicks: 10, shop: false, summon: true },
  // Monsters (see monsters.ts): only met in monster rounds.
  { id: 'mistwolf', name: 'Mist Wolf', tier: 1, traits: [], hp: 800, atk: 70, ap: 40, armor: 30, mr: 30, mana: 100, range: 1, attackTicks: 8, shop: false, monster: true },
  { id: 'stonegolem', name: 'Stone Golem', tier: 3, traits: [], hp: 1600, atk: 90, ap: 50, armor: 90, mr: 50, mana: 120, range: 1, attackTicks: 12, shop: false, monster: true },
  { id: 'elderdrake', name: 'Elder Drake', tier: 5, traits: [], hp: 3000, atk: 120, ap: 130, armor: 70, mr: 70, mana: 100, range: 2, attackTicks: 10, attackType: 'magic', shop: false, monster: true },
  // Lukas's Divine Beast (see commanders/): a board piece that fires once when a fight starts, never a fighter.
  { id: 'divinebeast', name: 'Divine Beast', tier: 5, traits: [], hp: 1, atk: 0, ap: 0, armor: 0, mr: 0, mana: 100, range: 1, attackTicks: 10, shop: false, freeSlot: true, piece: true },
  // The only 7-gold unit: in a player's shop (rolled with the 5-golds) once Spectre unlocks it for them.
  { id: 'eidolon', name: 'Eidolon', tier: 7, traits: [SP], hp: 1700, atk: 150, ap: 90, armor: 80, mr: 70, mana: 100, range: 1, attackTicks: 8, skill: 'spectralcataclysm', locked: true, shopTier: 5 },
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
