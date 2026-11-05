import { phantomExecution } from './phantomExecution';
import { powerOfChaos } from './powerOfChaos';
import type { SkillDef } from './types';

export type { SkillApi, SkillDef, SkillFighter } from './types';
export { dashLine, PHANTOM_EXECUTION } from './phantomExecution';
export { POWER_OF_CHAOS } from './powerOfChaos';

// Every unit skill. A unit without one uses the placeholder cast (CAST_MULT x atk as magic).
export const SKILLS: Record<string, SkillDef> = Object.fromEntries([phantomExecution, powerOfChaos].map((s) => [s.id, s]));
