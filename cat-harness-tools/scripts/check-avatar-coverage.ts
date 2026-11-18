#!/usr/bin/env bun
/**
 * Every declared kind has an avatar — and every gap is a finding.
 *
 * @module scripts/check-avatar-coverage
 * @covers cat-harness — it reads the layer declaration's graph typologies and asks each for art; the
 *   avatars themselves are code in `schemas/content/avatars.ts`, as `gen-avatars-css` records
 *
 * ## Why this is a QA result and not an assertion
 *
 * The kind vocabulary is OPEN — `BASE_GRAPH_TYPOLOGIES` is an open registry and
 * an `fsh-guts` node's `kind` is deliberately a free string. So a missing
 * avatar is not a build error: it is a fact about how far the art has got,
 * and it must read as MISSING rather than as a blank the viewer silently
 * tolerates.
 *
 * The result is written, not only printed, so "never had art" and "lost its
 * art in the commit under review" can be told apart.
 *
 * ## The trash state is not checked per kind
 *
 * The trash state is DERIVED from the base glyph (see `schemas/content/avatars.ts`),
 * so it cannot be missing per kind. This asserts the derivation is in place
 * ONCE.
 *
 * Usage:
 *   bun run cat check:avatar-coverage          # report, write the sidecar, exit 0
 *   bun run cat check:avatar-coverage:check    # JUDGE: compute and judge, write nothing (the gate)
 *
 * Exit codes: the writer exits 0. Judge mode (`--check`): 0 clean
 * · 1 a declared kind has no avatar, or the trash state is not derived · 2 no
 * kind required at all (could not determine), an unknown flag, or a run that
 * threw.
 */
import { join } from "node:path";

import { allAvatars, AVATARS, GENERIC, hasAvatar } from "../schemas/content/avatars.js";
import {
  BASE_GRAPH_TYPOLOGIES,
  defaultGraphTypologies,
  isPublishedGraphTypology,
  readDeclaration,
} from "../schemas/kg/cat-harness.js";
import { renderAvatarsCss } from "./gen-avatars-css.js";
import {
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  judging,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";

const ROOT = HARNESS_ROOT;

export interface CoverageGap {
  kind: string;
  where: string;
  note: string;
}

export interface Coverage {
  /** Kinds that must have art, from the registry and the layer. */
  required: string[];
  /** Those with none — each falls back to the question mark. */
  missing: CoverageGap[];
  /** Avatars declared for a kind nothing declares. Not a defect, but drift. */
  orphaned: string[];
  /** Kinds this layer itself declares, before inheritance. */
  declared: string[];
}

/**
 * Which kinds need art.
 *
 * The registry's kinds PLUS whatever this layer declares, because the two
 * differ: a layer may declare a kind the base registry never heard of,
 * and that is exactly the case an open vocabulary exists to allow.
 *
 * `fsh-guts` is included even though it is stripped from published graphs —
 * the VIEWER shows it, which is the whole of bean `7vhe`, and a kind whose
 * art is missing there is missing where a reader looks.
 */
export function requiredKinds(root: string = ROOT): { required: string[]; declared: string[] } {
  // THREE sources, unioned, and the first two are not the same thing.
  //
  // `defaultGraphTypologies` is a LIVE registry that modules write into on import,
  // so reading it alone makes this check's answer depend on what the calling
  // process happened to load. Measured: run from the CLI it saw 16 kinds and
  // reported full coverage; run inside the test suite it saw 17, and the
  // seventeenth was `folio` — the one renderable kind, with no avatar. A
  // check whose result changes with the importer is not a check.
  const registry = [...new Set([...Object.keys(BASE_GRAPH_TYPOLOGIES), ...defaultGraphTypologies.names()])];
  let declared: string[] = [];
  try {
    const d = readDeclaration(root);
    declared = [...new Set((d?.directories ?? []).flatMap((x) => x.graphTypologies ?? []))];
  } catch {
    // An unreadable declaration is the layer's problem to fix, not this
    // check's to guess around; the registry half still reports.
  }
  return { required: [...new Set([...registry, ...declared])].sort(), declared: declared.sort() };
}

export function coverage(root: string = ROOT): Coverage {
  const { required, declared } = requiredKinds(root);
  const missing: CoverageGap[] = [];
  for (const kind of required) {
    if (hasAvatar(kind)) continue;
    missing.push({
      kind,
      where: "schemas/content/avatars.ts",
      note:
        `no avatar is declared, so this kind renders as the generic question mark` +
        (isPublishedGraphTypology(kind) ? "" : " (an unpublished kind — still shown in the viewer)"),
    });
  }
  const orphaned = Object.keys(AVATARS)
    .filter((k) => !required.includes(k))
    .sort();
  return { required, missing, orphaned, declared };
}

/**
 * Is the trash state actually derived, rather than silently absent?
 *
 * Judged on what the renderer emits, not on `avatars.css` in the checkout:
 * the stylesheet is derived at publish time and ignored by git, so a gate
 * job's checkout never holds it, and reading it there failed on every run
 * with "the trash state is NOT derived". Whether the published copy matches
 * the renderer is `avatars:css:check`'s question.
 */
export function trashDerivationPresent(css: string = renderAvatarsCss()): boolean {
  return css.includes('[data-fa-trash="true"]') && css.includes("--fa-avatar-glyph");
}

/** The sidecar document. Pure, so the judge and the writer render ONE computation. */
export function avatarCoverageDocument(c: Coverage, derived: boolean): QaResult {
  return buildQaResult({
    script: "scripts/check-avatar-coverage.ts",
    scriptAbsPath: join(TOOLS_ROOT, "scripts", "check-avatar-coverage.ts"),
    subject: { kind: "avatars", id: "avatar-coverage" },
    families: {
      "kind-has-avatar": {
        summary:
          `Every declared kind has an avatar of its own. A kind with none renders as ` +
          `the generic question mark — deliberately a gap rather than a neutral mark, ` +
          `because a reader must be able to tell "no art yet" from "this is what it looks like".`,
        entries: c.missing,
      },
      "avatar-has-kind": {
        summary:
          `An avatar for a kind nothing declares. Not a defect — the vocabulary is open and ` +
          `a folio may declare it — but it is how a registry drifts away from the instances ` +
          `that use it, so it is reported rather than pruned.`,
        entries: c.orphaned.map((kind) => ({ kind, note: "declared by no directory in this instance" })),
      },
      "trash-state-derived": {
        summary:
          `The trash state is composed from the base glyph rather than drawn per kind, so ` +
          `its coverage cannot lag. Asserted ONCE: a per-kind criterion here could never ` +
          `fail, which would read as coverage while measuring nothing.`,
        entries: derived
          ? []
          : [{ note: "avatars.css carries no [data-fa-trash] rule — run `bun run cat avatars:css`" }],
      },
    },
  });
}

/**
 * Bean `bo44`'s four states. A kind with no avatar, or a trash state that is
 * not derived, is a finding; an EMPTY required set is `unknown` — a coverage
 * of nothing is not full coverage. Orphaned avatars are reported, never gated.
 */
export function judgeAvatarCoverage(c: Coverage, derived: boolean): Judgement {
  return judgementOf({ failing: c.missing.length + (derived ? 0 : 1), undetermined: c.required.length === 0 });
}

if (import.meta.main) {
  const check = judging();
  const GATE = "check:avatar-coverage";
  if (check) {
    const usage = judgeUsage(GATE, process.argv.slice(2), []);
    if (usage !== undefined) process.exit(usage);
  }
  let c: Coverage;
  let derived: boolean;
  try {
    c = coverage(ROOT);
    derived = trashDerivationPresent();
  } catch (e) {
    if (!check) throw e;
    process.exit(concludeJudgement({ gate: GATE, judgement: "error", detail: (e as Error).message }));
  }

  const doc = avatarCoverageDocument(c, derived);
  // Judge mode writes NOTHING (bean `bo44`). Until then `--check` wrote the
  // sidecar too, so the gate form was also a writer.
  if (!check) writeQaResult(ROOT, "avatar-coverage", doc);

  console.log(`Avatar coverage  (${c.required.length} kinds required, ${allAvatars().length} declared)`);
  console.log(`  ✓ ${c.required.length - c.missing.length} covered`);
  if (c.missing.length) {
    console.log(`  ✗ ${c.missing.length} with no avatar — each falls back to "${GENERIC.reads}":`);
    for (const m of c.missing) console.log(`      · ${m.kind}`);
  }
  if (c.orphaned.length) {
    console.log(`  · ${c.orphaned.length} avatar(s) for a kind this instance does not declare:`);
    for (const o of c.orphaned) console.log(`      · ${o}`);
  }
  console.log(derived ? "  ✓ the trash state is derived" : "  ✗ the trash state is NOT derived");

  if (check) {
    process.exit(
      concludeJudgement({
        gate: GATE,
        judgement: judgeAvatarCoverage(c, derived),
        detail: `${c.required.length} kind(s) required, ${c.missing.length} missing, trash ${derived ? "derived" : "NOT derived"}`,
        committed: { root: ROOT, stem: "avatar-coverage", fresh: doc, writer: "check:avatar-coverage" },
      }),
    );
  }
}
