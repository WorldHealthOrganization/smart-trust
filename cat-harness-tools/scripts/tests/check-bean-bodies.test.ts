/**
 * Tests for the bean-body reader, and specifically for the `shadow-checklist`
 * detector added under bean `sfhr`.
 *
 * Each pins a DISCRIMINATION rather than the happy path, because the whole
 * difficulty here is that the defect and a legitimate idiom look almost
 * identical. Measured on this store before the rule was written:
 *
 * | candidate rule | findings | why it fails |
 * |---|---|---|
 * | more than one `## Done when` heading | 34 beans | the real `bbbl` case had NO second heading — the copy was appended bare |
 * | any checklist item below the canonical section | 57 beans | recording a NEW open item in a dated entry is this store's ordinary idiom |
 * | a later item that restates a canonical one | 33 beans | a progress note quoting the item it just satisfied reads the same |
 *
 * What separates them is an ASYMMETRY, and the bean says it outright: *"the
 * ticks were appended as a SECOND copy of the checklist at the foot of the
 * file, so the canonical `## Done when` still read 0 of 2 and any reader or
 * tool consulting it saw an untouched bean."* So the rule is: a later item
 * **ticked** while the canonical item it restates is **open**.
 *
 * @module scripts/tests/check-bean-bodies.test
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BLOCKER,
  checkBeanBodies,
  SHADOW_MIN_WORDS,
  checklistItems,
  insideQuotation,
  overlap,
  shadowedItems,
  splitChecklist,
  words,
} from "../check-bean-bodies.ts";

/** A bean body with a canonical section and whatever follows it. */
function body(canonical: string, after = ""): string {
  return `Some prose.\n\n## Done when\n${canonical}\n\n## Later\n${after}\n`;
}

describe("checklistItems", () => {
  test("an indented continuation belongs to its item", () => {
    const [item] = checklistItems("- [ ] the first half\n      and the second half");
    expect(item!.text).toBe("the first half and the second half");
    expect(item!.done).toBe(false);
  });

  test("reads both tick spellings and stops at a non-continuation line", () => {
    const items = checklistItems("- [x] done one\n- [X] done two\n\nprose\n- [ ] open");
    expect(items.map((i) => i.done)).toEqual([true, true, false]);
  });
});

describe("splitChecklist", () => {
  test("a bean with no `## Done when` has no checklist to compare", () => {
    expect(splitChecklist("just prose\n\n- [ ] a stray box")).toEqual({ canonical: [], later: [] });
  });

  test("the canonical section ends at the next heading", () => {
    const { canonical, later } = splitChecklist(body("- [ ] canonical one", "- [x] later one"));
    expect(canonical).toHaveLength(1);
    expect(later).toHaveLength(1);
  });
});


describe("splitChecklist — the separator that was missing", () => {
  // Found by USING the check on the next task, not by re-reading it: bean
  // `cvab` has both checklists and separates them with `---`, and the first
  // version did not report it. Measured across the store: 61 beans end their
  // canonical section with a rule, 141 with a heading. Reading only headings
  // folded the later list back into the canonical one, so a ticked duplicate
  // looked canonical and could never fire — blind to 61 beans while reporting
  // a clean run over them.
  test("a `---` rule ends the canonical section", () => {
    // Long enough to clear SHADOW_MIN_WORDS — a short item is declined on
    // purpose, and an earlier draft of this test failed for that reason.
    const item = "a check reads every fenced command in the entry documents";
    const b = `## Done when\n- [ ] ${item}\n\n---\n\n- [x] ${item}\n`;
    const { canonical, later } = splitChecklist(b);
    expect(canonical).toHaveLength(1);
    expect(later).toHaveLength(1);
    expect(shadowedItems(b)).toHaveLength(1);
  });

  test("whichever comes FIRST ends it — a rule before a heading", () => {
    const b = "## Done when\n- [ ] one\n\n---\n\n- [x] two\n\n## Later\n- [x] three\n";
    expect(splitChecklist(b).canonical).toHaveLength(1);
  });

  test("...and a heading before a rule", () => {
    const b = "## Done when\n- [ ] one\n\n## Later\n- [x] two\n\n---\n";
    expect(splitChecklist(b).canonical).toHaveLength(1);
  });

  test("a table's `|---|` is not a rule", () => {
    const b = "## Done when\n- [ ] the canonical thing here\n\n| a | b |\n|---|---|\n| x | y |\n";
    expect(splitChecklist(b).later).toEqual([]);
  });
});

describe("overlap", () => {
  test("containment, not equality — the real copies were not verbatim", () => {
    // `fgnw`'s appended copy dropped a parenthetical; `9x17`'s paraphrased.
    const a = words("`bun run cat health` reports claims without activity in the window");
    const b = words("`bun run cat health` (or the goal-review sweep) reports claims without activity in the window");
    expect(overlap(a, b)).toBe(1);
  });

  test("unrelated items do not overlap", () => {
    expect(overlap(words("render the navbar tile"), words("resolve a workflow path"))).toBeLessThan(0.3);
  });
});

describe("shadowedItems — the defect", () => {
  test("a later TICKED item restating an OPEN canonical one is the defect", () => {
    const found = shadowedItems(
      body(
        "- [ ] a check reads every fenced command in the entry documents and fails",
        "- [x] a check reads every fenced command in the entry documents and fails",
      ),
    );
    expect(found).toHaveLength(1);
  });

  test("...and it still fires when the copy paraphrases", () => {
    // `9x17`: "schema validation as its operation" for "schema validation and
    // profile check as DISTINCT operations". An equality test passes over it.
    const found = shadowedItems(
      body(
        "- [ ] a Tool node with schema validation and profile check as DISTINCT operations",
        "- [x] a Tool node with schema validation as its operation",
      ),
    );
    expect(found).toHaveLength(1);
  });
});

describe("shadowedItems — what it must NOT report", () => {
  test("a NEW open item below the section is the store's ordinary idiom", () => {
    // 57 of 323 beans do this. Reporting it would make the check unreadable.
    expect(
      shadowedItems(body("- [ ] the canonical thing", "- [ ] a different thing found later")),
    ).toEqual([]);
  });

  test("a progress note restating an item the canonical section ALREADY ticks", () => {
    // The note agrees with the canonical section, so there is nothing to fix.
    expect(
      shadowedItems(
        body(
          "- [x] a check reads every fenced command in the entry documents and fails",
          "- [x] a check reads every fenced command in the entry documents and fails — shipped",
        ),
      ),
    ).toEqual([]);
  });

  test("an UNTICKED later copy of an open canonical item", () => {
    // Redundant, but it tells the same story as the canonical section, so the
    // reader is not misled and this check does not own tidiness.
    expect(
      shadowedItems(body("- [ ] the canonical thing here", "- [ ] the canonical thing here")),
    ).toEqual([]);
  });

  test("a short item is too generic for overlap to mean anything", () => {
    const short = "- [ ] ship it";
    expect(words("ship it").length).toBeLessThan(SHADOW_MIN_WORDS);
    expect(shadowedItems(body(short, "- [x] ship it"))).toEqual([]);
  });

  test("a bean with no canonical section reports nothing", () => {
    expect(shadowedItems("prose\n\n- [x] a ticked item with no Done when heading here")).toEqual([]);
  });
});

/* ── The quotation guard's SCOPE, which `k59d` asked to be settled ────────
 *
 * `k59d`: *"The quotation guard covers a markdown table cell, or the guard's
 * stated scope says it does not and why — a workaround in one bean is not a
 * fix."* It does not, and these are the cases that say so.
 *
 * The decision is the corpus's, not taste's. Measured 2026-09-21 over every
 * bean body for `blocked on \`id\`` on a line beginning `|`: two hits, and
 * they point opposite ways — `k59d` quotes yg29 and marks it; `xgd8` asserts
 * its OWN live blocker in a cell. Treating a cell as a quotation would
 * silently exempt the second, which is the only kind that matters.
 */
describe("insideQuotation — what marks a quotation, and what does not", () => {
  const at = (line: string): number => {
    BLOCKER.lastIndex = 0;
    const m = BLOCKER.exec(line);
    if (!m) throw new Error(`the blocker pattern does not match: ${line}`);
    return m.index;
  };

  test("a plain assertion is not a quotation", () => {
    const line = "Blocked on `hqku` until that lands.";
    expect(insideQuotation(line, at(line))).toBe(false);
  });

  test("double quotes on the line mark one — this is the whole signal", () => {
    const line = 'yg29 says "blocked on `hqku`", which is completed.';
    expect(insideQuotation(line, at(line))).toBe(true);
  });

  test("an UNQUOTED table cell is an assertion, and must stay one", () => {
    // `xgd8`'s shape: a bean stating its own blocker in a cell. `slw1` was
    // `todo` when this was written, so that block is live and correctly
    // unflagged — but were it to close, this is the row that has to fail.
    const line = "| schemas into `library/`, both directions | — | blocked on `slw1`, see above |";
    expect(insideQuotation(line, at(line))).toBe(false);
  });

  test("a QUOTED table cell is read as a quotation, so the marking works", () => {
    // `k59d`'s shape, and the reason its double-quoting was never a
    // workaround: quoting what you quote is correct English AND the signal.
    const line = '| `yg29` | "blocked on `hqku`, and on the disposition" | completed |';
    expect(insideQuotation(line, at(line))).toBe(true);
  });

  test("a blockquote is NOT read — priced, not missed", () => {
    // Defensible to add: `>` is unambiguously a quotation in markdown. The
    // store contains ZERO of them, so implementing it would be building for a
    // case that does not exist. This test is the record of that choice, and
    // it is the one to flip if the form ever appears.
    const line = "> blocked on `hqku`";
    expect(insideQuotation(line, at(line))).toBe(false);
  });

  test("emphasis is not attribution", () => {
    const line = "*blocked on `hqku`* — its own words";
    expect(insideQuotation(line, at(line))).toBe(false);
  });
});

// ── The closed-bean question `sfhr` left open. Bean `sfhr`, issue #639. ─────

describe("closed beans are COUNTED, never failed", () => {
  const store = (beans: { id: string; status: string; archived?: boolean; body: string }[]) => {
    const root = mkdtempSync(join(tmpdir(), "beanbodies-closed-"));
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(
      join(root, "beans", "beans.json"),
      JSON.stringify({
        name: "fixture",
        directories: [{ id: "defs", path: "defs", graphs: ["bean-defs"], description: "fixture beans" }],
      }),
    );
    for (const b of beans) {
      const dir = b.archived ? join(root, "beans", "defs", "archive") : join(root, "beans", "defs");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${b.id}.md`),
        `---\n# ${b.id}\ntitle: '${b.id}'\nstatus: ${b.status}\ntype: task\n---\n\n${b.body}\n`,
      );
    }
    return root;
  };

  /**
   * The shape: a canonical item OPEN, and a later copy of it TICKED.
   *
   * Long enough to clear `SHADOW_MIN_WORDS` — a shorter item is ignored by the
   * rule on purpose, and a fixture below that floor tests nothing.
   */
  const ITEM = "the endpoint returns a declared content type for every locale";
  const SHADOW = `## Done when\n\n- [ ] ${ITEM}\n\n## Progress\n\n- [x] ${ITEM}\n`;

  test("a completed bean with the shape is counted, and does not fail", () => {
    const r = checkBeanBodies(store([{ id: "aaaa", status: "completed", body: SHADOW }]));
    expect(r.closedWithShadow).toBe(1);
    expect(r.problems).toEqual([]);
    expect(r.examined).toBe(0); // it is not among the beans scanned
  });

  test("an OPEN bean with the same body still fails — the rule is unchanged", () => {
    // The direction that matters: counting the closed ones must not weaken
    // the check that was already shipped.
    const r = checkBeanBodies(store([{ id: "bbbb", status: "in-progress", body: SHADOW }]));
    expect(r.problems.map((p) => p.kind)).toContain("shadow-checklist");
    expect(r.closedWithShadow).toBe(0);
  });

  test("an archived bean counts too — archived is closed, not invisible", () => {
    const r = checkBeanBodies(store([{ id: "cccc", status: "completed", archived: true, body: SHADOW }]));
    expect(r.closedWithShadow).toBe(1);
  });

  test("a closed bean WITHOUT the shape is not counted", () => {
    const clean = `## Done when\n\n- [x] ${ITEM}\n`;
    expect(checkBeanBodies(store([{ id: "dddd", status: "completed", body: clean }])).closedWithShadow).toBe(0);
  });

  test("an unreadable store reports 0 but also `store: false` — not a clean count", () => {
    // `closedWithShadow: 0` alone would read as "none there". The caller must
    // consult `store` first, and the report says "no bean store" rather than
    // printing a zero.
    const r = checkBeanBodies(mkdtempSync(join(tmpdir(), "beanbodies-nostore-")));
    expect(r.store).toBe(false);
    expect(r.closedWithShadow).toBe(0);
  });
});
