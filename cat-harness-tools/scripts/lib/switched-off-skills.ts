/**
 * Where a skill a check cannot find lives, when the root that mounted its
 * layer switched that part of the layer off (owner, 2026-11-12, cards
 * Q-OPTIN-DIRS A and Q-SKILL-TOOL-LINK B: a target in a switched-off group is
 * not judged here; it is judged where the group is switched on).
 *
 * @module scripts/lib/switched-off-skills
 * @graphNode none — a resolver shared by the checks that follow skill names
 *
 * One answer for every check that follows a skill name across layers —
 * `check:tools` (`satisfies`), `check:workflow-refs` (`<…:skill ref>` in a
 * diagram) and `kg:audit` (`role-skills-resolve`) — so the three cannot
 * disagree about the same name.
 *
 * ## A group the mount LEFT OUT is not unknowable
 *
 * A mount that switches a group off leaves its files out, so its skills
 * cannot be listed from disk. They can be listed from the layer's committed
 * skill index: `readme:sync` writes every skill of every opt-in group into
 * `SKILLS.md` (or the `skills:index` region of `AGENTS.md`) under a heading
 * marked `(opt-in \`<layer>.<group>\`)`, and `readme:sync:check` keeps it
 * current in the layer's own CI, where every group is on. So a name that the
 * layer's committed index places in a group the mount left out is HELD there,
 * by name, exactly as a group still on disk is — not a guess. Only a left-out
 * group the index does not list stays unknowable, and keeps the narrower pass
 * {@link judgeSkillRef} gives the layer's own refs.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { defaultEnabledSubgraphs } from "../../schemas/kg/cat-harness.js";
import { optInRootsOf } from "../../schemas/kg/opt-in-roots.js";
import { isSubgraphEnabled } from "../../schemas/kg/opt-in-subgraphs.js";
import { leftOutByMount } from "../../schemas/kg/remote-mount.js";
import { isSkillMd } from "../known-skills.js";

/** One directory's section of a committed skill index. */
export interface CommittedSkillPackage {
  /** The directory, relative to the layer root, without its trailing slash. */
  dir: string;
  /** The table rows, verbatim. */
  rows: string[];
  /** `<layer>.<group>` for a directory inside an opt-in sub-graph. */
  optIn?: string;
}

const PACKAGE_HEADING = /^\*\*`([^`]+)\/`\*\* \((\d+)\)(?: \(opt-in `([^`]+)`\))?\s*$/;
const ROW_NAME = /^\|\s*(?:\[)?`([^`]+)`/;

/**
 * The sections of a committed full skill index (`renderFullSkillIndex`'s
 * shape) in `text`, in order. A section whose row count does not match its
 * heading is dropped: a hand-edited index is not a record to trust.
 */
export function parseSkillIndex(text: string): CommittedSkillPackage[] {
  const lines = text.split("\n");
  const out: CommittedSkillPackage[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = PACKAGE_HEADING.exec(lines[i]!);
    if (!m) continue;
    const rows: string[] = [];
    let j = i + 1;
    while (j < lines.length && !lines[j]!.startsWith("|")) j++;
    j += 2; // the header row and its delimiter
    for (; j < lines.length && lines[j]!.startsWith("|"); j++) rows.push(lines[j]!);
    if (rows.length !== Number(m[2])) continue;
    out.push(m[3] === undefined ? { dir: m[1]!, rows } : { dir: m[1]!, rows, optIn: m[3] });
    i = j - 1;
  }
  return out;
}

/** The skill name a row of the index lists. */
export function skillOfRow(row: string): string | undefined {
  return ROW_NAME.exec(row)?.[1];
}

/** The layer's committed skill index: `SKILLS.md`, else the `AGENTS.md` region. Empty when it has none. */
export function committedSkillIndex(layer: string): CommittedSkillPackage[] {
  for (const f of ["SKILLS.md", "AGENTS.md"]) {
    const p = join(layer, f);
    if (!existsSync(p)) continue;
    const found = parseSkillIndex(readFileSync(p, "utf-8"));
    if (found.length > 0) return found;
  }
  return [];
}

/**
 * What the root that mounted each layer switched off, as far as a check can
 * see it.
 *
 * - `held`: skill name → the switched-off groups holding it — read from disk
 *   for a group still there, and from the layer's committed skill index for
 *   a group the mount left out.
 * - `leftOut`: layer root → its switched-off groups the mount LEFT OUT whose
 *   skills no committed index lists. Their skills cannot be named here.
 */
export function switchedOffSkillHomes(layers: readonly string[]): { held: Map<string, string[]>; leftOut: Map<string, string[]> } {
  const held = new Map<string, string[]>();
  const leftOut = new Map<string, string[]>();
  const hold = (name: string, group: string): void => {
    held.set(name, [...new Set([...(held.get(name) ?? []), group])]);
  };
  const walk = (dir: string, group: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, group);
      else if (e.name.endsWith(".md") && isSkillMd(p)) hold(e.name.slice(0, -3), group);
    }
  };
  for (const layer of layers) {
    let enabled;
    try {
      enabled = defaultEnabledSubgraphs(layer);
    } catch {
      continue; // an unreadable declaration is `check:harness-dirs`' finding
    }
    let index: CommittedSkillPackage[] | undefined;
    for (const g of optInRootsOf(layer)) {
      if (isSubgraphEnabled(enabled, g.id)) continue;
      if (existsSync(g.abs)) {
        walk(g.abs, g.id);
        continue;
      }
      if (!leftOutByMount(layer, g.abs)) continue;
      index ??= committedSkillIndex(layer);
      const listed = index.filter((p) => p.optIn === g.id);
      if (listed.length === 0) {
        leftOut.set(layer, [...(leftOut.get(layer) ?? []), g.id]);
        continue;
      }
      for (const p of listed) for (const r of p.rows) {
        const name = skillOfRow(r);
        if (name !== undefined) hold(name, g.id);
      }
    }
  }
  return { held, leftOut };
}

/**
 * Whether a skill name no visible layer holds is a defect HERE.
 *
 * - Held in a group the mounting root switched off (on disk, or listed by its
 *   layer's committed index): not judged — absent by consent, judged where
 *   the group is switched on.
 * - The referring layer's OWN left-out groups are unlisted: not judged — the
 *   skill may be in one, and nothing here can say. Any OTHER layer gets no
 *   such pass from them.
 * - Otherwise: dangling. A target in a group the root switched ON that is
 *   missing, and a name no layer declares, both land here.
 */
export function judgeSkillRef(
  skill: string,
  refLayer: string | undefined,
  off: { held: ReadonlyMap<string, readonly string[]>; leftOut: ReadonlyMap<string, readonly string[]> },
): { groups: string[]; reason: string } | undefined {
  const held = off.held.get(skill);
  if (held !== undefined) return { groups: [...held], reason: "held in an opt-in sub-graph the mounting root switched off" };
  const unseen = refLayer === undefined ? undefined : off.leftOut.get(refLayer);
  if (unseen !== undefined && unseen.length > 0) {
    return { groups: [...unseen], reason: "not visible here: the referring layer has opt-in sub-graphs the mount left out, and the skill may be in one; judged where they are switched on" };
  }
  return undefined;
}
