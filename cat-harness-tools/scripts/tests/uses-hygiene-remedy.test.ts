import { describe, expect, test } from "bun:test";
import { checkUsesEditorialHygiene } from "../../pipeline/qa-checkers-uses";
import { buildContentGraph, parseUses } from "../../pipeline/content-graph";
import { walkBlocks } from "../../pipeline/qa-utils";
import { FOLIO_ROOT, hasFolio } from "./helpers";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * `uses-editorial-hygiene` reports a `uses[]` entry as transitively redundant
 * when another entry already reaches it. Which relation it walks to decide
 * that is the whole question.
 *
 * **Owner ruling 2026-08-24.** Sending a reader to a remark ABOUT B lets them
 * take B's assertions for granted, and follow the reference if they want more.
 * It does NOT mean they have read B's prerequisites. So an `interprets` edge
 * transmits nothing forward, and an entry reachable only through one is not
 * redundant — the reader still needs it named directly.
 *
 * That is also what the criterion was specified to do (bean
 * `folio-assistant-r0ax`, 2026-08-07: "transitive redundancy — A uses B, B
 * uses C, A uses C"). It walked the full editorial cone, which meant `uses`
 * until `i8ad` (2026-08-15) made `interprets` an editorial edge and silently
 * widened it.
 *
 * The widening was not marginal. Over qou 2026-08-24, before this fix: 374
 * blocks warned, carrying 594 reports, and ALL 594 were `interprets`-only —
 * not one ran through `uses`. Each also named `prune-transitive-deps.ts`,
 * which reduces `uses[]` alone and would have reported nothing for any of
 * them: a remedy that no-ops on 100 % of the findings it is offered for.
 *
 * Asserted generically over whatever folio is attached; no label is hardcoded.
 */
describe.skipIf(!hasFolio())("uses-editorial-hygiene redundancy walks `uses` only", () => {
  const contentDir = (): string => join(FOLIO_ROOT!, "folio");

  // Walks every block and builds the graph: seconds, not milliseconds.
  test("a warn fires iff a uses-only redundancy exists", () => {
    const g = buildContentGraph(contentDir(), FOLIO_ROOT!);
    let warned = 0;
    let interpretsOnlySuppressed = 0;

    for (const b of walkBlocks(contentDir())) {
      const r = checkUsesEditorialHygiene(b.ts);
      const direct = [...new Set(parseUses(readFileSync(b.ts, "utf-8")))];

      const redundantVia = (coneOf: (n: string) => Set<string>): boolean =>
        direct.some((u) =>
          direct.some((other) => other !== u && coneOf(other).has(u)),
        );
      const viaUses = redundantVia((n) => g.usesCone(n));
      const viaEditorial = redundantVia((n) => g.cone(n, "editorial"));

      // The ruling, as an invariant: `uses` decides, nothing else.
      if (r.result === "warn") {
        warned++;
        expect(viaUses).toBe(true);
      } else if (r.result === "pass") {
        expect(viaUses).toBe(false);
      }

      // The regression this guards: an interprets-only path must NOT warn.
      if (viaEditorial && !viaUses) {
        interpretsOnlySuppressed++;
        expect(r.result).not.toBe("warn");
      }
    }

    console.log(
      `  ${warned} block(s) warn on a uses-only redundancy; ` +
        `${interpretsOnlySuppressed} interprets-only path(s) correctly silent`,
    );
    // A folio where neither case occurs makes the assertions vacuous — say so
    // rather than reporting a silent pass over nothing.
    if (warned === 0 && interpretsOnlySuppressed === 0) {
      console.log("  (neither case present in this folio — invariant not exercised)");
    }
  }, 120_000);

  test("the remedy named is one that applies to every finding", () => {
    // `prune-transitive-deps.ts` reduces `uses[]`. Now that redundancy is
    // computed over `uses` alone, naming it is always actionable — which was
    // false for all 594 pre-fix findings.
    const g = buildContentGraph(contentDir(), FOLIO_ROOT!);
    for (const b of walkBlocks(contentDir())) {
      const r = checkUsesEditorialHygiene(b.ts);
      if (r.result !== "warn") continue;
      for (const h of r.hits) {
        const text = (h as { text?: string }).text ?? "";
        const m = text.match(/redundant "([^"]+)" — already reachable via "([^"]+)"/);
        if (!m) continue;
        const [, u, other] = m;
        expect(g.usesCone(other).has(u)).toBe(true);
        expect(text).toContain("run prune-transitive-deps.ts");
      }
    }
  }, 120_000);
});
