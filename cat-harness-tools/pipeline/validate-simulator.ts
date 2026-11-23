/**
 * Does a simulator block's `html:` target actually exist?
 *
 * Bean `023p`. Before this, `validate.ts` contained **no reference to
 * `simulator` or `.html`** — a simulator block declared
 * `html: "simulators/x.html"` and nothing in the pipeline asked whether that
 * file was on disk. Measured 2026-09-19 on qou: two of eleven simulator
 * targets, `descent_rate_probe.html` and `multi_level_jet_sum.html`, existed
 * in neither repository, had been dangling on `main` before any branch touched
 * them, and `run-validate` exited **0** with three issues, none of them about
 * a simulator. Both dangling blocks passed clean.
 *
 * `SimulatorBlock`'s own doc comment claimed *"Pipeline validates: .html
 * companion exists"*. It did not. A documented check that does not run is
 * worse than an absent one, because a reader stops looking.
 *
 * ## Three states, and the third is the point
 *
 * - **present** — resolved and on disk. Silent.
 * - **absent** — resolved and not there. A finding.
 * - **could-not-determine** — an `http(s)` target, or a path that escapes the
 *   folio root. Reported as its own thing and **never rendered as clean**,
 *   which is the rule this repository applies to `ci-health`, `kg:audit` and
 *   `folioDir` alike.
 *
 * A remote simulator is a legitimate arrangement; this module cannot fetch it,
 * and silence would make "I did not look" indistinguishable from "I looked and
 * it was fine".
 *
 * ## `todo-html` is a claim, not a check
 *
 * Both qou cases carry `tags: [..., "todo-html", ...]`, recording an author's
 * intent to write the file later. Nothing read that tag, nothing reconciled it
 * against disk, and a block that LOST the tag while keeping the dead path was
 * reported by nobody.
 *
 * So a tagged block is reported as a **deferred stub** rather than dropped
 * from the count: an intentional absence is still an absence, and *how many
 * are deferred* is the number an author needs. It is a `warning`; an untagged
 * dangling target is an `error`.
 *
 * @module pipeline/validate-simulator
 */

import { existsSync } from "fs";
import { isAbsolute, relative, resolve } from "path";

import type { Block, ValidationIssue } from "../schemas/types.ts";

/** A simulator block, narrowed without importing the union's every member. */
interface SimulatorLike {
  kind: string;
  label?: string;
  html?: unknown;
  tags?: unknown;
}

/** The tag that records "the file is coming later". */
export const DEFERRED_TAG = "todo-html";

export type AssetState = "present" | "absent" | "undetermined";

/**
 * Classify one declared target against the folio root.
 *
 * Exported so the states can be tested without a corpus — the classification
 * is the part with rules, and the walk over blocks is the part without.
 */
export function classifyHtmlTarget(
  html: unknown,
  repoRoot: string,
): { state: AssetState; detail: string } {
  if (typeof html !== "string" || html.trim() === "") {
    return { state: "absent", detail: "no `html:` path is declared" };
  }
  const raw = html.trim();
  if (/^https?:\/\//i.test(raw)) {
    return {
      state: "undetermined",
      detail: `remote target \`${raw}\` — this check does not fetch, so its presence is UNKNOWN, not verified`,
    };
  }
  // Resolved against the REPO root, not the folio root, because that is what
  // `SimulatorBlock.html` documents: "relative to repo root". Measured on qou
  // before trusting the doc: the eleven declared targets are
  // `simulators/<x>.html` and the files sit at `<repo>/simulators/`, NOT under
  // the folio root at `<repo>/content/`.
  //
  // The first draft of this module resolved against `folioDir()` and the two
  // known-dangling cases still came back `absent` — the right answer for the
  // wrong reason. It would have reported the nine that DO exist as missing
  // too. Caught by checking where the files actually are rather than by
  // reading the two that confirmed what I expected.
  const abs = isAbsolute(raw) ? raw : resolve(repoRoot, raw);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith("..")) {
    return {
      state: "undetermined",
      detail: `\`${raw}\` resolves outside the repository — outside what this folio owns, so its presence is UNKNOWN`,
    };
  }
  return existsSync(abs)
    ? { state: "present", detail: rel }
    : { state: "absent", detail: `\`${raw}\` is not on disk (looked at ${rel})` };
}

/** Is this block tagged as a deliberate stub? */
export function isDeferred(block: SimulatorLike): boolean {
  return Array.isArray(block.tags) && block.tags.includes(DEFERRED_TAG);
}

export interface SimulatorAssetSummary {
  present: number;
  deferred: number;
  dangling: number;
  undetermined: number;
}

/**
 * Check every simulator block in `blocks`.
 *
 * `repoRoot` is the FOLIO's root — the same one `folioDir` resolves — because
 * `html:` is documented as relative to it.
 */
export function validateSimulatorAssets(
  blocks: Array<{ name: string; block: Block }>,
  repoRoot: string,
): { issues: ValidationIssue[]; summary: SimulatorAssetSummary } {
  const issues: ValidationIssue[] = [];
  const summary: SimulatorAssetSummary = { present: 0, deferred: 0, dangling: 0, undetermined: 0 };
  for (const { name, block } of blocks) {
    const b = block as unknown as SimulatorLike;
    if (b.kind !== "simulator") continue;

    const { state, detail } = classifyHtmlTarget(b.html, repoRoot);
    if (state === "present") {
      summary.present++;
      continue;
    }
    if (state === "undetermined") {
      summary.undetermined++;
      issues.push({
        level: "info",
        block: name,
        message:
          `Simulator asset NOT VERIFIED: ${detail}. Undetermined is not the same ` +
          `as present — nothing here has confirmed a reader will get a page.`,
        file: `${name}.ts`,
      });
      continue;
    }

    if (isDeferred(b)) {
      summary.deferred++;
      issues.push({
        level: "warning",
        block: name,
        message:
          `Simulator asset deferred: ${detail}. Tagged \`${DEFERRED_TAG}\`, so this ` +
          `is an intended stub — but it is still an absence, and the block renders ` +
          `with nothing to load.`,
        file: `${name}.ts`,
      });
      continue;
    }

    summary.dangling++;
    issues.push({
      level: "error",
      block: name,
      message:
        `Simulator asset MISSING: ${detail}. The block renders a frame whose ` +
        `content cannot load. Write the file, point \`html:\` at one that exists, ` +
        `or tag the block \`${DEFERRED_TAG}\` to record it as a deliberate stub.`,
      file: `${name}.ts`,
    });
  }

  return { issues, summary };
}
