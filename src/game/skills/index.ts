import { phantomExecution } from './phantomExecution';
import { powerOfChaos } from './powerOfChaos';
import { commandersMark } from './commandersMark';
import { dragonLance } from './dragonLance';
import { fallingStar } from './fallingStar';
import { gloomVolley } from './gloomVolley';
import { mournfulShot } from './mournfulShot';
import { pyreFrenzy } from './pyreFrenzy';
import { rampage } from './rampage';
import { rendingBite } from './rendingBite';
import { soulOrbit } from './soulOrbit';
import { stormPursuit } from './stormPursuit';
import { starfallAegis } from './starfallAegis';
import type { SkillDef } from './types';

export type { SkillApi, SkillDef, SkillFighter } from './types';
export { dashLine, PHANTOM_EXECUTION } from './phantomExecution';
export { POWER_OF_CHAOS } from './powerOfChaos';
export { COMMANDERS_MARK } from './commandersMark';
export { DRAGON_LANCE } from './dragonLance';
export { FALLING_STAR } from './fallingStar';
export { GLOOM_VOLLEY, volleyShot } from './gloomVolley';
export { MOURNFUL_SHOT } from './mournfulShot';
export { PYRE_FRENZY } from './pyreFrenzy';
export { RAMPAGE } from './rampage';
export { RENDING_BITE } from './rendingBite';
export { orbCells, SOUL_ORBIT } from './soulOrbit';
export { STORM_PURSUIT } from './stormPursuit';
export { freeCellNextTo, pickEnemy } from './dashStrike';
export { STARFALL_AEGIS } from './starfallAegis';

// Every unit skill. A unit without one uses the placeholder cast (CAST_MULT x atk as magic).
export const SKILLS: Record<string, SkillDef> = Object.fromEntries([phantomExecution, powerOfChaos, starfallAegis, rendingBite, mournfulShot, fallingStar, soulOrbit, stormPursuit, rampage, gloomVolley, pyreFrenzy, dragonLance, commandersMark].map((s) => [s.id, s]));
