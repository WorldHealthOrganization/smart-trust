/**
 * TRANSITIONAL: where a piece of cat-harness's development material is, in
 * whichever layout the harness checkout has.
 *
 * @module scripts/lib/harness-layout
 *
 * cat-harness#991 step 23.2 (cat-harness#1014) moves the development material
 * into two opt-in named sub-graphs: `processes/sdlc/` → `sdlc/processes/`,
 * `skills/sdlc/` → `sdlc/skills/`, eight sdlc-core skills →
 * `work-plan/skills/work-plan/`, eleven Tool nodes `tools/<id>/` →
 * `work-plan/tools/<id>/`. The two repositories pin each other at `main`, so
 * until that PR merges this layer has to read BOTH layouts: written in the new
 * spelling, answered with whichever exists under the harness root.
 *
 * **Remove after cat-harness#1014 merges** (cat-harness#991 step 23): inline
 * the new paths, or better, read the declared `sdlc-processes`,
 * `sdlc-skills`, `work-plan-skills` and `work-plan-tools` entries.
 *
 * The same holds for the `library` sub-graph (owner, 2026-11-04, card
 * "Library cut" option 1): `skills/library/` → `library/skills/`,
 * `processes/library/` → `library/processes/`, and the corpus
 * `library/<group>/` → `library/corpus/<group>/`. Each move has its own
 * marker, so a harness that has made one move and not the other is read
 * right. Remove its entry once the library move is on both pins.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { HARNESS_ROOT } from "./roots.ts";

const WORK_PLAN_SKILLS = [
  "bean-blocking",
  "bean-coordination",
  "bean-drain",
  "idle-backlog",
  "todo-manager",
  "work-plan-restructure",
  "work-plan-store",
  "work-plan-store-git-branch",
];
const WORK_PLAN_TOOLS = [
  "beans-cli",
  "beans-manual",
  "bean-query",
  "bean-claim-check",
  "work-plan-prime",
  "workflow-start",
  "workflow-next",
  "workflow-complete",
  "workflow-gate",
  "workflow-list",
  "drain-queue",
];

/** One move: the file whose presence says it has been made, and its new-layout ↔ legacy prefixes, most specific first. */
interface Move {
  marker: readonly string[];
  prefixes: ReadonlyArray<readonly [string, string]>;
}

// declared-path-literal: the two layouts of each move, spelled once so every reader can be told which exists (transitional, cat-harness#991 step 23 and the library sub-graph).
const MOVES: readonly Move[] = [
  {
    marker: ["sdlc", "graph.json"],
    prefixes: [
      ...WORK_PLAN_SKILLS.map((s) => [`work-plan/skills/work-plan/${s}.md`, `skills/sdlc/sdlc-core/${s}.md`] as const),
      ...WORK_PLAN_TOOLS.map((t) => [`work-plan/tools/${t}/`, `tools/${t}/`] as const),
      ["sdlc/processes/", "processes/sdlc/"],
      ["sdlc/skills/", "skills/sdlc/"],
    ],
  },
  {
    marker: ["library", "graph.json"],
    prefixes: [
      ["library/skills/", "skills/library/"],
      ["library/processes/", "processes/library/"],
      ["library/corpus/", "library/"],
    ],
  },
];

function swapOne(rel: string, from: 0 | 1, prefixes: Move["prefixes"]): string | undefined {
  const to = from === 0 ? 1 : 0;
  const withSlash = rel.endsWith("/") ? rel : `${rel}/`;
  for (const p of prefixes) {
    if (rel.startsWith(p[from])) return p[to] + rel.slice(p[from].length);
    // The directory itself, written without its trailing slash.
    if (p[from].endsWith("/") && withSlash === p[from]) return p[to].slice(0, -1);
  }
  return undefined;
}

function swap(rel: string, from: 0 | 1): string {
  // Already in the spelling asked for: a new-layout path is never respelled
  // as if it were legacy (`library/processes/x` is not a corpus path).
  const to = from === 0 ? 1 : 0;
  const longest = (side: 0 | 1): number =>
    Math.max(0, ...MOVES.flatMap((m) => m.prefixes.filter((p) => rel.startsWith(p[side])).map((p) => p[side].length)));
  if (longest(to) > longest(from)) return rel;
  for (const m of MOVES) {
    const out = swapOne(rel, from, m.prefixes);
    if (out !== undefined) return out;
  }
  return rel;
}

/** A new-layout path, in the legacy spelling (unchanged when it did not move). */
export function legacyHarnessPath(rel: string): string {
  return swap(rel, 0);
}

/** A legacy path, in the new spelling (unchanged when it did not move). */
export function subgraphHarnessPath(rel: string): string {
  return swap(rel, 1);
}

function moveMade(m: Move, root: string): boolean {
  return existsSync(join(root, ...m.marker));
}

/** Which layout the harness at `root` has for the sdlc move: the named sub-graph folders, or the legacy groups. */
export function harnessLayout(root: string = HARNESS_ROOT): "subgraphs" | "legacy" {
  // declared-path-literal: the marker of the new layout, `sdlc/graph.json` (transitional).
  return moveMade(MOVES[0]!, root) ? "subgraphs" : "legacy";
}

/**
 * `rel`, written in the NEW layout, as the harness at `root` spells it: the
 * new path where its move has been made, the legacy one otherwise.
 */
export function harnessRel(rel: string, root: string = HARNESS_ROOT): string {
  for (const m of MOVES) {
    if (moveMade(m, root)) {
      // Already spelled for this move: leave it.
      if (m.prefixes.some(([now]) => rel.startsWith(now) || `${rel}/` === now)) return rel;
      continue;
    }
    const out = swapOne(rel, 0, m.prefixes);
    if (out !== undefined) return out;
  }
  return rel;
}

/** {@link harnessRel}, absolute under `root`. */
export function harnessPath(rel: string, root: string = HARNESS_ROOT): string {
  return join(root, harnessRel(rel, root));
}

/**
 * `text` with every new-layout path in it respelled for the harness at
 * `root`: unchanged where the sub-graphs exist, legacy otherwise. For a
 * fixture written in the new layout that names harness files.
 */
export function harnessLayoutText(text: string, root: string = HARNESS_ROOT): string {
  let out = text;
  for (const m of MOVES) {
    if (moveMade(m, root)) continue;
    for (const [now, before] of m.prefixes) out = out.split(now).join(before);
  }
  return out;
}
