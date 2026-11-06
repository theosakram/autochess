import type { StatKey } from '../stats';
import type { SkillApi, SkillFighter } from './types';

// Runs `fn` with `stat` raised by `add` on `f`, then takes it back: e.g. lifesteal on just these hits.
export function withStat<T>(api: SkillApi, f: SkillFighter, stat: StatKey, add: number, effect: string, fn: () => T): T {
  api.buff(f, [{ stat, add }], Infinity, effect, f);
  try {
    return fn();
  } finally {
    api.unbuff(f, effect);
  }
}
