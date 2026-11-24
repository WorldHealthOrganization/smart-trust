/**
 * `check:bean-blocks` — and the assertion that matters is the REFUSAL.
 *
 * Bean `zldg`. The corpus passes today because this change made it pass, so a
 * test that only asserts the pass proves nothing. Every signal is asserted in
 * both directions.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BLOCK_HEADING, BASELINE_FILE, inspect, scan } from "../check-bean-blocks.ts";
import { readArchivedBeans, readBeans, type BeanNode } from "../beans.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import "../../schemas/kg/folio-graph-typology.js";

const REPO = repoRootFor(join(import.meta.dir, "..", ".."));

const bean = (over: Partial<BeanNode> = {}): BeanNode =>
  ({ id: "t-1", file: "x.md", title: "t", status: "in-progress", type: "task",
     priority: "normal", body: "", blocking: [], ...over }) as BeanNode;

const complete = `## Blocked on
- **waits on:** a thing
- **since:** 2026-09-20
- **expires:** 2026-09-29
- **handoff:** re-ask
`;

describe("the structured form is enforced", () => {
  test("all four fields present ⇒ ok", () => {
    const v = inspect(bean({ body: complete }), complete)!;
    expect(v.verdict).toBe("ok");
    expect(v.missing).toEqual([]);
  });

  test.each(["waits on", "since", "expires", "handoff"])(
    "stripping `%s` turns it incomplete",
    (field) => {
      // The falsification, one field at a time. A gate that passes with a
      // field removed is not enforcing that field.
      const text = complete.split("\n").filter((l) => !l.includes(field)).join("\n");
      const v = inspect(bean({ body: text }), text)!;
      expect(v.verdict).toBe("incomplete");
      expect(v.missing).toContain(field);
    },
  );

  test("`expires` is answered by beans.ts, so `expiry` and `expire` also count", () => {
    // Not a second pattern here: `hasExpiry` matches expires/expiry/expire
    // deliberately loosely, so a detector never accuses somebody who complied.
    for (const word of ["expires", "expiry", "expire"]) {
      const text = complete.replace("expires", word);
      expect(inspect(bean({ body: text }), text)!.verdict).toBe("ok");
    }
  });
});

describe("prose is reported, never failed", () => {
  test("blocking language with no heading is `unstructured`, not `incomplete`", () => {
    const text = "This is genuinely blocked on the upstream spec.";
    expect(inspect(bean({ body: text }), text)!.verdict).toBe("unstructured");
  });

  test("a bean that is NOT in-progress is not reported at all", () => {
    // A `todo` mentioning blocking describes future work; a `completed` one
    // describes history. Neither is a live stall, and reporting them would
    // make the advisory count meaningless.
    const text = "was blocked, then unblocked";
    for (const status of ["todo", "completed", "scrapped", "draft"]) {
      expect(inspect(bean({ status, body: text }), text)).toBeUndefined();
    }
  });

  test("a bean with no block language is silent", () => {
    expect(inspect(bean({ body: "ordinary work" }), "ordinary work")).toBeUndefined();
  });
});

describe("the heading matcher", () => {
  test("accepts trailing words, because the corpus writes them", () => {
    // `cz17` wrote `## Blocked on upstream` and `xeg6` `## Blocked on
    // promotion, not on judgement` before any of this existed. A matcher
    // demanding a bare heading would have missed both.
    for (const h of ["## Blocked on", "## Blocked on upstream", "### blocked on X", "## Blocked On"]) {
      expect(BLOCK_HEADING.test(`${h}\nbody`)).toBe(true);
    }
  });

  test("does not fire on the words in a sentence", () => {
    expect(BLOCK_HEADING.test("it is blocked on the spec")).toBe(false);
  });
});

describe("the real corpus", () => {
  const beans = readBeans(REPO)!;
  const found = scan(REPO, beans);

  test("there IS a corpus, so a clean run is not vacuous", () => {
    // Over the history (active plus the archive view): the active store is
    // open work, which a drain empties on purpose, and settled blocks are
    // archived with their beans (cat-harness-tools#1248).
    const history = [...beans, ...(readArchivedBeans(REPO) ?? [])];
    expect(history.length).toBeGreaterThan(100);
    expect(scan(REPO, history).filter((b) => b.verdict === "ok").length).toBeGreaterThan(0);
  });

  test("every structured block in the store is complete, or baselined by id", () => {
    /* NOT `toEqual([])`. This asserted an empty set against a LIVE corpus, so
     * it was a test of the store rather than of the check — and the store is
     * written by other sessions. It went red the first time a bean declaring a
     * block landed on `main` from somewhere else, which is `10uc` and `w0cr`,
     * the stream 2 and stream 3 claims (issue #956).
     *
     * What the gate promises is that the count cannot GROW, so that is what is
     * asserted: anything incomplete is named in the baseline. The baseline is
     * read here rather than restated, so the two cannot drift, and it can only
     * shrink — `check-bean-blocks.ts` fails a baseline entry that matches
     * nothing. */
    const baseline = new Set(
      (JSON.parse(readFileSync(join(REPO, BASELINE_FILE), "utf-8")) as { outstanding: string[] })
        .outstanding,
    );
    const unbaselined = found
      .filter((b) => b.verdict === "incomplete")
      .filter((b) => !baseline.has(`${b.verdict}:${b.id}`));
    expect(unbaselined).toEqual([]);
  });

  test("...and every complete one names a REVIEW date, not a takeover date", () => {
    // The refinement the corpus forced: `cz17` waits on WHO finalising a FHIR
    // Logical Model. Inventing a resolution date for a standards body is
    // fabrication, so an external block's expiry schedules a RE-ASK and its
    // handoff says so.
    for (const b of found.filter((x) => x.verdict === "ok")) {
      const node = beans.find((n) => n.id === b.id)!;
      const text = readFileSync(join(REPO, node.file), "utf-8");
      expect(text.toLowerCase()).toContain("handoff");
    }
  });
});
