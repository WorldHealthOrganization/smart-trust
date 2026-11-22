/**
 * Tool profiles — a named set of tool releases a run selects as one.
 *
 * @module schemas/tool-profile
 * @graphNode schema
 *
 * A test scenario selects a profile (`default`, `ci-2026-10`,
 * `lean-4.35-test`) to load a different set of tool releases; a resolver (not
 * built yet) is to provision every release it names.
 *
 * ## A profile names tools, never a runtime
 *
 * Runtimes come in transitively, through each release's own `runtimes[]`.
 * A profile that named a JRE would pin java for every tool in it, and
 * different tools may need different javas. So:
 *
 * - **structurally**, every key of `tools` must equal the name of the release
 *   it maps to. `plantuml: "temurin-jre@21.0.4+7"` is refused by the schema;
 * - **against the graph**, {@link toolReleaseGraphProblems} refuses a profile
 *   whose ref resolves to a release declared `role: "runtime"` — a fact about
 *   OTHER files, which the schema alone cannot see.
 *
 * ## Why the graph checks live here
 *
 * They need both families, and `tool-release.ts` must not import this module
 * back. Everything a check needs to reject a profile or a dangling runtime ref
 * is in {@link toolReleaseGraphProblems}; `scripts/tool-releases.ts --check`
 * runs it over every declared directory.
 */
import { z } from "zod";

import {
  ToolNameSchema,
  ToolReleaseRefSchema,
  parseToolReleaseRef,
  toolReleaseRef,
  type ToolRelease,
} from "./tool-release";

/** The tag a tool-profile document carries, so it is identified by declaration. */
export const TOOL_PROFILE_SCHEMA_TAG = "folio-tool-profile/v1";

/** A tool profile, as a `folio-tool-profile/v1` document. */
export const ToolProfileSchema = z
  .object({
    $schema: z.literal(TOOL_PROFILE_SCHEMA_TAG),
    name: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "a profile name: lowercase letters, digits, `.`, `_` and `-`"),
    /** What the profile is for, for a reader choosing one. */
    description: z.string().min(1),
    /** Tool name → the release of it this profile selects. At least one: an empty profile provisions nothing and says so by not existing. */
    tools: z.record(ToolNameSchema, ToolReleaseRefSchema).refine((t) => Object.keys(t).length > 0, "a profile selects at least one tool"),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const [tool, ref] of Object.entries(p.tools)) {
      const { name } = parseToolReleaseRef(ref);
      if (name !== tool) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tools", tool],
          message: `\`${tool}\` maps to \`${ref}\`, a release of \`${name}\` — a profile key is the tool it selects, and a runtime is never named directly`,
        });
      }
    }
  });
export type ToolProfile = z.infer<typeof ToolProfileSchema>;

/** The identity a release is unique under: name, version and platform. */
function releaseKey(r: ToolRelease): string {
  const p = r.platform;
  return `${toolReleaseRef(r)} [${p ? `${p.os}-${p.arch}${p.distribution ? `-${p.distribution}` : ""}` : "any"}]`;
}

/**
 * Problems across the WHOLE set of releases and profiles a layer can see.
 *
 * What one file's schema cannot know, because the answer is in another file:
 *
 * 1. two records for one `name@version` on one platform — two answers to
 *    "which bytes";
 * 2. a `runtimes[]` ref that resolves to no release;
 * 3. a `runtimes[]` ref whose release declares no `entry.home` — injection
 *    sets `JAVA_HOME` to it, or puts `<home>/bin` on `PATH`, so without one
 *    there is nothing to inject. A `role: "tool"` release MAY be a runtime
 *    of another: graphviz is a tool in its own right, and PlantUML finds its
 *    `dot` through `PATH` (measured 2026-10-07: `plantuml -testdot` with
 *    only the two cached releases on `PATH` reports graphviz 16.1.0);
 * 4. a profile ref that resolves to no release;
 * 5. **a profile ref that resolves to a runtime** — the global pin by another
 *    name;
 * 6. two profiles with one name.
 *
 * Empty means none. A ref resolves when ANY platform's record matches it: the
 * resolver picks the host's, and a ref with no record for the host is the
 * resolver's `could-not-provision`, not a malformed graph.
 */
export function toolReleaseGraphProblems(releases: readonly ToolRelease[], profiles: readonly ToolProfile[]): string[] {
  const out: string[] = [];
  const byRef = new Map<string, ToolRelease[]>();
  const keys = new Set<string>();
  for (const r of releases) {
    const key = releaseKey(r);
    if (keys.has(key)) out.push(`release ${key} is recorded twice`);
    keys.add(key);
    const ref = toolReleaseRef(r);
    byRef.set(ref, [...(byRef.get(ref) ?? []), r]);
  }
  for (const r of releases) {
    for (const rt of r.runtimes) {
      const hits = byRef.get(rt.release);
      if (!hits) out.push(`release ${toolReleaseRef(r)} needs runtime ${rt.release}, which no record declares`);
      else if (hits.some((h) => h.entry.home === undefined))
        out.push(`release ${toolReleaseRef(r)} injects ${rt.release} by \`${rt.inject}\`, but that release declares no \`entry.home\` to inject`);
    }
  }
  const names = new Set<string>();
  for (const p of profiles) {
    if (names.has(p.name)) out.push(`profile \`${p.name}\` is declared twice`);
    names.add(p.name);
    for (const [tool, ref] of Object.entries(p.tools)) {
      const hits = byRef.get(ref);
      if (!hits) out.push(`profile \`${p.name}\` selects ${ref} for \`${tool}\`, which no record declares`);
      else if (hits.some((h) => h.role === "runtime"))
        out.push(`profile \`${p.name}\` names runtime ${ref} directly — a runtime comes in through the release that needs it, never from the profile`);
    }
  }
  return out;
}
