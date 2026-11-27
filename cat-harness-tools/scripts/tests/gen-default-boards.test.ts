/**
 * Every instantiated harness above the floor owes a board, and it shows
 * everything.
 *
 * @module scripts/tests/gen-default-boards.test
 *
 * Owner, 2026-09-21: *"Any harness above bootsteap has a board filled with all
 * contents."* Two halves, and the tests that matter are the ones that would
 * pass for a generator writing a board for everything, or for nothing.
 *
 * The tests of this file that read the whole checkout (reads every
 * instantiated harness in the checkout, or the root `todos/` graph) live in
 * `test/gen-default-boards-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { BoardSchema } from "../../schemas/ui/board.js";
import { DECLARATION_SUFFIX } from "../../schemas/kg/cat-harness.js";
import { INDEX_CONFIG_SCHEMA } from "../../schemas/kg/index-config.js";
import { layerConfigFilename } from "../../schemas/kg/harness-config.js";
import { defaultBoard, harnessesOwedABoard } from "../gen-default-boards.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const REPO = resolve(ROOT, "..");

describe("who owes a board", () => {

  test("a DEPENDENCY is excluded too — instantiated is a different fact", () => {
    // "Only the instiatiated harnesses (not all dependent ones)".
    //
    // A FIXTURE since 2026-10-09. This read the real checkout and called a
    // candidate a dependency when it had no root `<name>.config.json`; in the
    // index checkout NO layer has one (the index lists them), so the rule
    // and its example came apart in the opposite direction from 2026-09-21's.
    // The rule is about the checkout's answer to "instantiated", and a fixture
    // states both answers — the root config set, and an index — without
    // depending on which layers some checkout happens to hold.
    const repo = mkdtempSync(join(tmpdir(), "boards-owed-"));
    try {
      for (const n of ["one", "two"]) {
        mkdirSync(join(repo, n));
        writeFileSync(join(repo, n, `${n}${DECLARATION_SUFFIX}`), JSON.stringify({ name: n, version: "0.1.0", directories: [] }));
      }
      writeFileSync(join(repo, layerConfigFilename("one")), "{}\n");
      expect(harnessesOwedABoard(repo, ["one", "two"])).toEqual(["one"]);
      writeFileSync(
        join(repo, "index.config.json"),
        JSON.stringify({ $schema: INDEX_CONFIG_SCHEMA, instances: [{ name: "two", source: { local: { at: "two" } } }] }),
      );
      expect(harnessesOwedABoard(repo, ["one", "two"])).toEqual(["two"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("the set is sorted, so it is a function of the declarations", () => {
    const owed = harnessesOwedABoard(REPO, ["who-iris", "cat-harness", "agent-skills"]);
    expect(owed).toEqual([...owed].sort());
  });
});

describe("what the board says", () => {
  test("'filled with all contents' is the ABSENT filter", () => {
    // The convergence worth keeping: `board.ts` chose no-filter-means-
    // everything because a stored selection needs a staleness check. So the
    // MINIMAL board is the TOTAL one, and the bean's "scaffold an empty board"
    // and the owner's "filled with all contents" are the same document.
    const doc = JSON.parse(defaultBoard("x", "X"));
    expect(doc.filter).toBeUndefined();
    expect(BoardSchema.parse(doc)).toEqual({ $schema: "folio-board/v1", id: "x", title: "X" });
  });
});
