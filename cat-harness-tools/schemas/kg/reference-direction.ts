/**
 * reference-direction.ts — does this PROSE reference follow the dependency arrow?
 *
 * If A depends on B (directly or through a chain), nothing in B may reference
 * A: B is lower and must not know what sits on top of it.
 * `bootstrap-tools/schemas/graph.test.ts` enforces this for ONE layer
 * (`bootstrap/`); this module is the same invariant over every declared
 * layer.
 *
 * ## One arrow — this does NOT recompute direction
 *
 * An import and a sentence are the SAME arrow. Direction is
 * {@link directionOf} in `layer-direction.ts`, shared with `check:partition`
 * (import edges) and `kg-detangle` (KG edges); this module asks the identical
 * question of a NAME OCCURRENCE in a file.
 *
 * ## Five verdicts
 *
 * `allowed`, `exempt`, `wrong-direction`, `names-repository` and
 * `undetermined` — mirroring `layer-direction.ts`, plus `names-repository`,
 * since a name (unlike an import path) can name a repository.
 *
 * `undetermined` means the tool declined to judge — never clean. Two things
 * land there:
 *
 *   - a layer that declares no `needs` (absent is nobody-has-said, never
 *     "may reach nothing" and never "may reach anything"), which
 *     `allowedFromNeeds` already reports; and
 *   - a bare mention of a name that is ALSO the repository's name, with
 *     nothing in the occurrence to tell the two apart (below).
 *
 * ## The repository-name collision, decided per occurrence
 *
 * A layer rooted AT the repository root shares its name with the
 * repository and the product, and every relative path resolves inside its
 * root, so the name alone cannot tell them apart. The occurrence usually can:
 * a URL is an address and `<owner>/<name>` is a repository slug. So
 * {@link NameCollision} is decided per OCCURRENCE:
 *
 *   - `"instance"` — the occurrence points INTO a directory the colliding
 *     layer declares, so it is a reference to the layer and is judged
 *     by the arrow like any other, `wrong-direction` included;
 *   - `"repository"` — it names the repository or the product address, and
 *     {@link ReferenceVerdict}'s `names-repository` says exactly that;
 *   - `"unknown"` — a bare prose mention, with no path and no URL. It stays
 *     `undetermined`; the ambiguity is real.
 *
 * The resolver is passed IN rather than derived here, so this module stays
 * free of paths and its tests need no tree on disk. Which occurrence shapes
 * map to which collision is the CALLER's question, because it is the caller
 * that read the declaration.
 *
 * @module schemas/reference-direction
 * @graphNode none — a classification function: it defines no schema
 */

import { directionOf, type LayerRule } from "./layer-direction.js";

/**
 * An exception to the rule. `reason` is required and `iwtn`'s `ALLOW` is why:
 * a permit with no reason is a hole, and a list of bare regexes is a list
 * nobody can audit a year later.
 */
export interface ReferenceExemption {
  /** Matches the LINE the occurrence sits on. Omitted means any line, and then `file` must be set. */
  pattern?: RegExp;
  /** Matches the FILE the occurrence sits in, repo-relative. Omitted means any file. */
  file?: RegExp;
  /** Why this is not a reference to the layer. Required. */
  reason: string;
  /** Limit to one target layer; omitted means any. */
  to?: string;
}

/** One bounded occurrence of a layer's name in a file. */
export interface Occurrence {
  file: string;
  line: number;
  /** The whole line, which is what an exemption matches against. */
  text: string;
  /** The layer the FILE belongs to. */
  from: string;
  /** The layer whose NAME was found. */
  to: string;
}

export type ReferenceVerdict =
  | { verdict: "allowed"; basis: string }
  | { verdict: "exempt"; basis: string; exemption: ReferenceExemption }
  | { verdict: "wrong-direction"; basis: string }
  /**
   * The string found names the REPOSITORY (or its published address), not the
   * layer that shares its name. A repository is not a layer, so no
   * direction is owed — which is a different statement from `allowed` (a
   * reference that follows the arrow), from `exempt` (a reference the arrow
   * refuses, excused) and from `undetermined` (a question declined). It gets
   * its own line in the report for that reason and is never folded into any
   * of the three.
   */
  | { verdict: "names-repository"; basis: string }
  | { verdict: "undetermined"; basis: string };

/**
 * What a target name colliding with the repository's name turned out to BE,
 * at one occurrence.
 *
 * Three values because there are three answers and collapsing any two loses
 * the distinction the collision was blocking. `undefined` from the resolver
 * is a fourth thing entirely — no collision at all — and not a member here,
 * so "the name does not collide" cannot be confused with "it collides and we
 * could not tell".
 */
export type NameCollision = "instance" | "repository" | "unknown";

/**
 * Every bounded occurrence of `name` in `text`, as 1-based line numbers.
 *
 * **Bounded, which is not a detail.** A name may be a prefix of another
 * layer's name — `bootstrap` of `bootstrap-tools` — so a
 * substring scan counts one occurrence twice and attributes the second to a
 * layer that was never named. That is not hypothetical: the 2026-09-23
 * measurement that opened this work reported 6,778 occurrences by substring
 * where the bounded count is 3,651, and the inflation was entirely this.
 *
 * A character adjacent to the name that could continue an identifier
 * (`[A-Za-z0-9_-]`) therefore disqualifies the match.
 */
export function occurrencesOf(text: string, name: string): { line: number; text: string }[] {
  const re = new RegExp(
    `(?<![A-Za-z0-9_-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_-])`,
  );
  const out: { line: number; text: string }[] = [];
  text.split("\n").forEach((line, i) => {
    if (re.test(line)) out.push({ line: i + 1, text: line });
  });
  return out;
}

/**
 * Classify one occurrence.
 *
 * `collision` asks about THIS OCCURRENCE of the target's name, not about the
 * name: `undefined` when the target's name does not collide with the
 * repository's, and otherwise which of the three things the occurrence turned
 * out to be ({@link NameCollision}).
 *
 * It is consulted BEFORE the direction rule for the two answers that make the
 * direction question moot rather than answerable-then-excused — which is also
 * why neither is an exemption. `"instance"` falls THROUGH, so a genuine
 * reference to a layer whose name collides is judged by the arrow like
 * every other: it can be `wrong-direction`, `allowed` or `exempt`. The blanket
 * that preceded this could reach none of those three.
 *
 * An exemption is consulted only for an occurrence the rule would refuse, so
 * one sitting on an allowed line is never "honoured". That is what lets a
 * caller report an exemption nothing needs as stale, exactly as
 * `layer-direction.ts` does with its permits.
 */
export function classifyReference(
  occ: Occurrence,
  rule: LayerRule,
  collision: (occ: Occurrence) => NameCollision | undefined,
  exemptions: readonly ReferenceExemption[] = [],
): ReferenceVerdict {
  const collides = collision(occ);
  if (collides === "repository") {
    return {
      verdict: "names-repository",
      basis: `the occurrence names the repository '${occ.to}' (or its published address) rather than the instance that shares its name, and a repository is not a layer, so no direction is owed`,
    };
  }
  if (collides === "unknown") {
    return {
      verdict: "undetermined",
      basis: `'${occ.to}' is also the repository's name — a name match cannot tell the instance from the repository`,
    };
  }
  const d = directionOf({ from: occ.from, to: occ.to }, occ.from, occ.to, rule);
  if (d.verdict !== "wrong-direction") {
    // `permitted` is `layer-direction`'s word for an import permit, which
    // this axis does not issue; it cannot arise from a rule built by
    // `allowedFromNeeds`, and mapping it to `allowed` keeps the two verdict
    // sets aligned without inventing a fifth state.
    return d.verdict === "permitted"
      ? { verdict: "allowed", basis: d.basis }
      : (d as ReferenceVerdict);
  }
  const ex = exemptions.find(
    (e) =>
      (e.to === undefined || e.to === occ.to) &&
      (e.file === undefined || e.file.test(occ.file)) &&
      (e.pattern === undefined || e.pattern.test(occ.text)),
  );
  if (ex) return { verdict: "exempt", basis: `exempt: ${ex.reason}`, exemption: ex };
  return {
    verdict: "wrong-direction",
    basis: `'${occ.from}' is depended on by '${occ.to}', so it may not name it`,
  };
}
