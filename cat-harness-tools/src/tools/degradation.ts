/**
 * What a skill can do when its capabilities are missing — the `degradation`
 * model, executed.
 *
 * ## The gap this closes
 *
 * 24 skill modules declare `requiredCapabilities` with a `degradation`
 * strategy each — 17 `fail`, 6 `fallback`, 1 `warn`. **Nothing read them.**
 * The only consumer was `scripts/generate-docs.ts`, which rendered them and
 * was never invoked in any commit since the root commit; it was retired to
 * `fsh-guts/` on 2026-09-20 (bean `folio-assistant-3w0i`), taking the count
 * of readers to zero. Bean `folio-assistant-ahvw`, owner's decision "b1":
 * enforce it rather than report it or retire it.
 *
 * `src/tools/capabilities.ts` executes the PROBES. This joins their results
 * to what each skill said it would do about them, which is the half that was
 * missing: a probe that nobody consults tells you a tool is absent and not
 * what follows from that.
 *
 * ## Why this is not "just run the skill and see"
 *
 * The integration contract in `docs/proposals/rag-document-ingestion.md` §5
 * rests on **absent tool ⇒ `n/a`, never a false pass** — a document nobody
 * parsed must not read as a document with nothing in it. Discovering
 * absence by running is exactly how that guarantee is lost: the run
 * produces an empty result and an empty result looks like a finding of
 * nothing. Deciding first, from the declaration, is what makes `n/a`
 * expressible.
 *
 * ## The four strategies, and what each MEANS here
 *
 * | strategy | verdict when the capability is absent |
 * |---|---|
 * | `fail` | `blocked` — the skill cannot run, and saying so is the point |
 * | `fallback` | `degraded` if the capability's `fallbackTo` is present, or a human lane takes over; else `blocked` |
 * | `warn` | `degraded` — runnable, with the absence named |
 * | `skip` | `partial` — this requirement is dropped, the skill still runs |
 *
 * `skip` and `warn` differ in what happens to the WORK, not in noise level:
 * `skip` drops the part of the skill that needed the tool, `warn` runs the
 * whole thing on the assumption the tool was optional. Both are `degraded`
 * to a caller that only asks "can this run", which is why the verdict
 * carries the reasons and not just a boolean.
 *
 * @module src/tools/degradation
 */
import type { Capability, CapabilityStatus } from "./capabilities.js";

/** What a skill declared about one capability it needs. */
export interface SkillCapabilityNeed {
  capabilityId: string;
  degradation: "fail" | "warn" | "skip" | "fallback";
}

/** A skill, as much of it as this join needs. */
export interface SkillNeeds {
  id: string;
  requiredCapabilities: SkillCapabilityNeed[];
}

/**
 * Can the skill run, and on what terms?
 *
 * Four states rather than a boolean, because "ran with less" and "did not
 * run" are the distinction the whole model exists to make, and collapsing
 * them is how an absent tool comes to look like a finding of nothing.
 */
export type SkillState = "ready" | "partial" | "degraded" | "blocked";

export interface SkillAvailability {
  skill: string;
  state: SkillState;
  /** One line per capability that is not simply present, in declaration order. */
  reasons: string[];
  /** Capabilities that are absent and whose strategy is `fail`. */
  blockedBy: string[];
  /** Substitutions actually in effect: `capabilityId → fallbackTo`. */
  usingFallback: { capabilityId: string; fallbackTo: string }[];
  /** Where a PERSON takes over because no capability can. */
  viaHuman: { capabilityId: string; roles: string[] }[];
}

/** Severity order, so a skill's state is the worst of its requirements. */
const RANK: Record<SkillState, number> = { ready: 0, partial: 1, degraded: 2, blocked: 3 };

function worse(a: SkillState, b: SkillState): SkillState {
  return RANK[b] > RANK[a] ? b : a;
}

/**
 * Join one skill's declarations to the probe results.
 *
 * An **undeclared** capability id is `blocked`, not ignored. A skill needing
 * something no capability declares cannot be shown to run, and treating the
 * gap as absence-of-requirement would turn a broken reference into a pass —
 * the `blv9` shape this repository keeps paying for.
 */
export interface AvailabilityOptions {
  /**
   * The role(s) that take over when no CAPABILITY can do the work.
   *
   * Injected rather than imported, and that is the point: the derivation
   * lives in `scripts/check-fallback-roles.ts` (`fallbackRoleFor`, the role
   * of a lane holding a task only a person can fill), and `src/` must not
   * depend on `scripts/`. Omitting it makes the human route invisible, so a
   * caller that omits it gets `blocked` where a person could in fact sign —
   * which is why `--check-deps` passes it.
   *
   * Bean `folio-assistant-85e8`: `qa-report-signing` declares `fallback`
   * with no `fallbackTo` ON PURPOSE. There is no second tool on an
   * air-gapped host; that is the whole case.
   */
  humanFallback?: (skillId: string) => readonly string[];
}

export function skillAvailability(
  skill: SkillNeeds,
  statuses: readonly CapabilityStatus[],
  capabilities: readonly Capability[],
  opts: AvailabilityOptions = {},
): SkillAvailability {
  const present = new Map(statuses.map((s) => [s.id, s.present]));
  const byId = new Map(capabilities.map((c) => [c.id, c]));
  const out: SkillAvailability = {
    skill: skill.id,
    state: "ready",
    reasons: [],
    blockedBy: [],
    usingFallback: [],
    viaHuman: [],
  };

  for (const need of skill.requiredCapabilities) {
    const known = present.has(need.capabilityId);
    if (known && present.get(need.capabilityId) === true) continue;

    if (!known) {
      out.state = worse(out.state, "blocked");
      out.blockedBy.push(need.capabilityId);
      out.reasons.push(
        `${need.capabilityId}: no capability declares this id, so its presence cannot be established`,
      );
      continue;
    }

    switch (need.degradation) {
      case "fail":
        out.state = worse(out.state, "blocked");
        out.blockedBy.push(need.capabilityId);
        out.reasons.push(`${need.capabilityId}: absent, and this skill declares \`fail\``);
        break;
      case "fallback": {
        const to = byId.get(need.capabilityId)?.fallbackTo;
        if (to && present.get(to) === true) {
          out.state = worse(out.state, "degraded");
          out.usingFallback.push({ capabilityId: need.capabilityId, fallbackTo: to });
          out.reasons.push(`${need.capabilityId}: absent, substituting ${to}`);
        } else {
          const lanes = opts.humanFallback?.(skill.id) ?? [];
          if (lanes.length > 0) {
            out.state = worse(out.state, "degraded");
            out.viaHuman.push({ capabilityId: need.capabilityId, roles: [...lanes] });
            out.reasons.push(
              `${need.capabilityId}: absent, and no capability substitutes — ` +
                `${lanes.join(" or ")} takes over`,
            );
          } else {
            out.state = worse(out.state, "blocked");
            out.blockedBy.push(need.capabilityId);
            out.reasons.push(
              to
                ? `${need.capabilityId}: absent, and its fallback ${to} is absent too`
                : `${need.capabilityId}: absent, no \`fallbackTo\`, and no human lane performs this skill`,
            );
          }
        }
        break;
      }
      case "warn":
        out.state = worse(out.state, "degraded");
        out.reasons.push(`${need.capabilityId}: absent, running anyway (\`warn\`)`);
        break;
      case "skip":
        out.state = worse(out.state, "partial");
        out.reasons.push(`${need.capabilityId}: absent, dropping the part that needs it (\`skip\`)`);
        break;
    }
  }
  return out;
}

/** Every skill's availability, in the order given. */
export function allSkillAvailability(
  skills: readonly SkillNeeds[],
  statuses: readonly CapabilityStatus[],
  capabilities: readonly Capability[],
  opts: AvailabilityOptions = {},
): SkillAvailability[] {
  return skills.map((s) => skillAvailability(s, statuses, capabilities, opts));
}

const ICON: Record<SkillState, string> = {
  ready: "✓",
  partial: "◐",
  degraded: "△",
  blocked: "✗",
};

/**
 * Human-readable report.
 *
 * `ready` skills are counted, not listed: the interesting output is what
 * cannot run and why, and a wall of ticks buries it.
 */
export function formatSkillAvailability(rows: readonly SkillAvailability[]): string {
  if (rows.length === 0) {
    // Stated, not implied. "Nothing to check" and "everything runs" are
    // different answers and must not print the same.
    return "  (no skill declares requiredCapabilities — nothing was checked)";
  }
  const notable = rows.filter((r) => r.state !== "ready");
  const lines: string[] = [];
  lines.push(`  ${rows.length - notable.length} of ${rows.length} skill(s) ready.`);
  for (const r of notable) {
    lines.push(`  ${ICON[r.state]} ${r.skill.padEnd(28)} ${r.state}`);
    for (const why of r.reasons) lines.push(`      ${why}`);
  }
  return lines.join("\n");
}

/**
 * Load every skill module that declares `requiredCapabilities`.
 *
 * A dynamic `import()` of each candidate module, not a regex over its source,
 * and the difference matters: `check-fallback-roles.ts` reads source because it
 * must catch a value that is not a literal as a MISS, but here a non-literal is
 * perfectly good data and reading the evaluated object is the only way to get
 * it. `src/route-groups.ts` already loads declaration-named modules this way.
 *
 * A module that will not import is reported, not skipped. A broken skill is
 * a defect whose remedy is to fix it, and silently dropping it from the
 * report would make a broken skill read as one with nothing to require.
 *
 * ## IMPORTING IS RUNNING, and this function used to run the whole graph
 *
 * Bean `ymsu`, clause 1. The walk below reaches every `.ts` under every
 * declared knowledge-graph root, and a knowledge-graph root holds SCRIPTS as
 * well as declarations — `skills/graph-management/kg-detangle.ts` does its work
 * at module top level. So importing "each module to read a field off it" also
 * EXECUTED the detangler, which writes 28 committed sidecars under
 * `test/results/detangle/`.
 *
 * Measured 2026-09-30 on `origin/main` `e718627f198`: inside `bun run cat gates`,
 * `bun test` reached `src/tools/degradation.test.ts`, that file called this
 * function over the real corpus, and the runner's tree guard attributed the
 * repair of `folio-core.detangle.json` to `bun test` — 1140 lines before
 * `kg:detangle:check` read the same file and passed over it.
 *
 * The fix is to read the source FIRST and import only a file that names the
 * field this function exists to collect. That is not the regex-versus-import
 * trade the paragraph above rules on: the regex SELECTS a candidate, the import
 * still supplies the value, so a non-literal is read exactly as before. It is
 * also the predicate the `catch` below was already using to decide whether a
 * file was this function's business — now asked before the side effect instead
 * of after it.
 *
 * What it can miss, stated rather than left to be discovered: a module that
 * declares `requiredCapabilities` only through a re-export, or by composing the
 * key name at runtime. Neither exists in this corpus — measured by comparing
 * the skill count across the change, which is unchanged — and a skill that
 * hides its own declaration from a text search is a declaration problem rather
 * than a loader one.
 */
export async function loadSkillNeeds(
  dirs: readonly string[],
): Promise<{ skills: SkillNeeds[]; unreadable: { file: string; error: string }[] }> {
  const { readdirSync, statSync, existsSync } = await import("node:fs");
  const { join, resolve } = await import("node:path");
  const skills: SkillNeeds[] = [];
  const unreadable: { file: string; error: string }[] = [];
  const seen = new Set<string>();

  function walk(dir: string, out: string[] = []): string[] {
    if (!existsSync(dir)) return out;
    for (const e of readdirSync(dir)) {
      if (e.startsWith(".") || e === "node_modules") continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (e.endsWith(".ts") && !e.endsWith(".test.ts")) out.push(p);
    }
    return out;
  }

  for (const dir of dirs) {
    for (const file of walk(dir)) {
      // BEFORE the import, because the import is what runs the file (bean
      // `ymsu`, and the docblock above). A file that does not name the field
      // cannot contribute one, so loading it can only have side effects.
      //
      // An unreadable source is treated as a CANDIDATE rather than skipped:
      // "I could not read it" is not "it declares nothing", and the import
      // below will fail too and land it in `unreadable` where a reader sees it.
      const src = await Bun.file(file).text().catch(() => "requiredCapabilities");
      if (!/requiredCapabilities/.test(src)) continue;
      let mod: Record<string, unknown>;
      try {
        // ABSOLUTE. A relative specifier resolves against THIS module, not
        // the caller's cwd, so every import failed with "cannot find
        // module" — reported rather than swallowed, which is how it was
        // found in one run instead of reading as "no skill declares any".
        mod = (await import(resolve(file))) as Record<string, unknown>;
      } catch (e) {
        // Every file reaching here named the field, so a failure to import it
        // is always this function's business — the `LOOKS like a skill` filter
        // that used to live here has moved above the import.
        unreadable.push({ file, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      for (const v of Object.values(mod)) {
        if (!v || typeof v !== "object") continue;
        const d = v as Partial<SkillNeeds>;
        if (typeof d.id !== "string" || !Array.isArray(d.requiredCapabilities)) continue;
        // A skill may be exported from more than one module in an overlay;
        // first declaration wins, matching how `kgRoots` composes.
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        skills.push({ id: d.id, requiredCapabilities: d.requiredCapabilities });
      }
    }
  }
  return { skills, unreadable };
}
