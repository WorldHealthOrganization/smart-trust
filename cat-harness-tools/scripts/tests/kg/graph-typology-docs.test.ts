/**
 * The graph-typology table and the graph-typology registry must name the same kinds —
 * bean `5o3a`.
 *
 * **No check crossed from prose to code, and three clean merges went through the
 * gap.** #266 collapsed the kinds `workplan` and `process-state` into a single
 * `beans`, changed the registry, and left every *description* of it untouched:
 * the table in `directory-conventions.md` still listed both retired kinds at a
 * path that no longer existed, the registry's own doc comment opened "Five, and
 * deliberately none of them renderable" over a map of four, and `AGENTS.md`
 * described an intermediate state of #266's own branch. `AGENTS.md` designates
 * that skill the source of truth, so an agent following it would have written
 * `graph: "workplan"` and been refused by the registry it was told to trust.
 *
 * #269 fixed the layer. This is the guard, and nothing existing could have
 * been it: `gen-skill-docs --check` verifies the generated mirror matches its
 * hand-authored source, so it cannot notice that BOTH describe a registry they
 * no longer match.
 *
 * **The defect is live, not historical.** `kg` was renamed to `cat-harness` on
 * 2026-09-19 — the same class of change as #266, in a file this test now guards.
 *
 * ## Two decisions, and why they went this way
 *
 * **Both directions are hard.** A kind in the table that the registry lacks is
 * the measured defect. A kind in the registry the table omits is the same class
 * reversed, and it means every new kind must land with its prose in the same PR.
 * That is a policy choice rather than a bug fix, and it is priced at zero right
 * now: measured 2026-09-19, both directions were already clean, so this locks in
 * a property the corpus has rather than demanding work to reach it. Softening it
 * is one assertion.
 *
 * **Scoped to the table's first column, never a grep of the file.** #269's
 * rewrites deliberately name `workplan` and `process-state` in prose, to preserve
 * the superseded design and stop somebody re-proposing it; the same file also
 * explains at length that `kg:audit`, `kg-export` and the `kg` QA family keep
 * their names. A text search would read every one of those as a live claim. The
 * table is the machine-readable part, which is the argument for scoping there.
 */
import { describe, expect, test } from "bun:test";

import { defaultGraphTypologies } from "../../../schemas/kg/cat-harness.js";
// The table reader, its path and the set of names a row may carry all live in a
// module rather than here: `kind:register` asks the same question, and two
// parsers over one hand-written table drift the first time a column moves
// (bean `uoij`). This file keeps the ASSERTIONS and owns none of the reading —
// which is why `readFileSync`, `join`, `BASE_GRAPH_TYPOLOGIES` and
// `GRAPH_TYPOLOGY_ALIASES` are gone from it, and so is the document path.
import { documentedKinds, rebaseKindLinks, validKinds } from "../../kind-table.ts";
describe("the graph-typology table and the registry name the same kinds", () => {
  test("the table is found, and is not empty", () => {
    // Without this the two assertions below pass vacuously over `[]` — which is
    // exactly how #266's drift survived three green merges.
    expect(documentedKinds().length).toBeGreaterThan(5);
  });

  test("every kind in the table exists in the registry", () => {
    // The measured defect: the table named `workplan` and `process-state` after
    // the registry stopped knowing them, and the file is designated the source
    // of truth, so an agent would have written a declaration the loader refuses.
    const valid = validKinds();
    const unknown = documentedKinds().filter((k) => !valid.has(k));
    expect(unknown).toEqual([]);
  });

  test("every registered kind appears in the table", () => {
    // The reverse direction, hard by choice — see the header. Clean when written,
    // so this costs nothing today and stops a kind shipping undescribed.
    const documented = new Set(documentedKinds());
    const undocumented = defaultGraphTypologies.names().filter((k) => !documented.has(k));
    expect(undocumented).toEqual([]);
  });
});

describe("a kind description's links are rebased onto the table's page", () => {
  test("a link written from skills/kg/kg-core/ names the same file from docs/cat-harness/", () => {
    expect(rebaseKindLinks("see [`qa-witness`](../../../sdlc/skills/sdlc-core/qa-witness.md#scope)")).toBe(
      "see [`qa-witness`](../../sdlc/skills/sdlc-core/qa-witness.md#scope)",
    );
    expect(rebaseKindLinks("[`x`](../kg-core/schema-management.md)")).toBe("[`x`](../../skills/kg/kg-core/schema-management.md)");
  });

  test("an absolute URL, a site-rooted path and an anchor are left as they are", () => {
    const text = "[a](https://example.org/x.md) [b](/cat-harness/kind-table/) [c](#node-schemas)";
    expect(rebaseKindLinks(text)).toBe(text);
  });
});
