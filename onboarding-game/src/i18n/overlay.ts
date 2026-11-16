import type { Moment, Phase, Role } from '../game/types';
import { lang } from './lang';
import { getIn, parsePath, setIn } from './path';
import { translatedUnder } from './strings';
import { typo } from './typography';

/**
 * Translation overlay for the scenario. scenario.ts stays English and is the source of truth; in another
 * language, each moment (a clone, before token filling) gets its strings replaced from the loaded
 * `scenario:<path>` strings (strings.ts). A path with no translation keeps the English.
 * Paths: `phases.A`, `roles.business.title`, and `<momentId>.<path into the moment>`.
 */
const SCENARIO = (): Record<string, string> => Object.fromEntries(translatedUnder('scenario:'));

export function localiseMoments(moments: Moment[]): Moment[] {
  if (lang() === 'en') return moments;
  const T = SCENARIO();
  const byId = new Map(moments.map(m => [m.id, m]));
  for (const [key, text] of Object.entries(T)) {
    const segs = parsePath(key);
    const m = byId.get(segs[0]);
    if (!m) continue;
    const rest = segs.slice(1);
    // terminal lines are code, not prose: leave their spacing alone
    const terminal = rest[0] === 'docs' && (getIn(m, rest.slice(0, 2)) as { kind?: string } | undefined)?.kind === 'terminal';
    setIn(m, rest, terminal ? text : typo(text));
  }
  return moments;
}

/** Phase names and role titles, in place (they are module-level objects the UI reads directly). */
export function localiseStatic(phases: Record<Phase, string>, roles: Record<Role, { name: string; title: string; initials: string; job?: string }>) {
  if (lang() === 'en') return;
  const T = SCENARIO();
  for (const p of Object.keys(phases) as Phase[]) {
    const v = T[`phases.${p}`];
    if (v) phases[p] = typo(v);
  }
  for (const r of Object.keys(roles) as Role[]) {
    for (const f of ['name', 'title', 'initials', 'job'] as const) {
      const v = T[`roles.${r}.${f}`];
      if (v) roles[r][f] = typo(v);
    }
  }
}
