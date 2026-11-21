/**
 * `library:viz`'s committed projection must not carry a measurement of the
 * MACHINE that built it — bean `65oe`.
 *
 * It did. `refScan.filesRead` counted the json files the reference scan read
 * ON DISK, so the value was a property of the checkout rather than of the
 * library, and committing it made the artefact unable to agree with itself:
 * measured across twelve commits on one branch, CI wrote 2540/2555, a cloud
 * container 2646–2663 and another container 2537/2538, alternating as each
 * side pushed. Each regenerated correctly; each saw the other as stale.
 *
 * Nothing caught it, and that is the reason for this file rather than a gate:
 * `library:viz` is one of the two inputs `regen` names as **UNGATED**, so the
 * churn was silent and a fully green head could carry a stale index.
 *
 * These tests fail if the field comes back, and — more usefully — if any NEW
 * key of the same kind is added beside it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "../../../test/support/site-fs.ts";
import { join, resolve } from "node:path";
import { siteDirFor } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";

// The site root is `siteDirFor`'s ANSWER, never the literal `docs` —
// `site-dir-single-answer` refuses a hardcoded one, and it caught this file
// doing it. It is right to: a test naming the output root by hand is one more
// place the answer can disagree with the declaration.
const HARNESS = resolve(HARNESS_ROOT);
const INDEX = join(HARNESS, siteDirFor(HARNESS), "assets", "library", "index.json");

/** Standing alone, the projection is not built: `library:viz` writes it at publish, and it is gitignored. */
const NOT_BUILT = (): boolean => siteNotBuilt("the library projection `library:viz` writes at publish (gitignored)", INDEX);

type Projection = { refScan?: Record<string, unknown> };

function projection(): Projection {
  return JSON.parse(readFileSync(INDEX, "utf-8")) as Projection;
}

describe("the library projection's refScan", () => {
  test.skipIf(NOT_BUILT())("still EXISTS — its presence is how a reader knows the scan ran", () => {
    // Absence is a third answer the viewer relies on ("nobody looked"), so
    // this must not be fixed by deleting refScan outright.
    expect(projection().refScan).toBeDefined();
  });

  test.skipIf(NOT_BUILT())("does not carry `filesRead`", () => {
    expect(projection().refScan).not.toHaveProperty("filesRead");
  });

  test.skipIf(NOT_BUILT())("carries `unreadable`, which is what makes a zero provisional", () => {
    const r = projection().refScan!;
    expect(r).toHaveProperty("unreadable");
    expect(Array.isArray(r.unreadable)).toBe(true);
  });

  test.skipIf(NOT_BUILT())("carries NOTHING ELSE — a new count would reintroduce the defect", () => {
    // The real guard. Banning one field name invites the next one; this fails
    // on any added key, so a future count has to come past this test and its
    // reasoning rather than past a denylist.
    expect(Object.keys(projection().refScan!).sort()).toEqual(["unreadable"]);
  });

  test.skipIf(NOT_BUILT())("`unreadable` names FILES, never a tally", () => {
    for (const u of (projection().refScan!.unreadable as unknown[])) {
      expect(typeof u).toBe("string");
    }
  });
});

describe("the schema refuses the field rather than merely omitting it", () => {
  test.skipIf(NOT_BUILT())("refScan is a STRICT object, so `filesRead` is rejected, not ignored", async () => {
    const { LibraryIndexSchema } = await import("../../../schemas/ui/site-indexes.ts") as {
      LibraryIndexSchema?: { shape?: Record<string, unknown> };
    };
    // Guard the import itself: a renamed export would make every assertion
    // below vacuous, which is the `dh4f` shape.
    expect(LibraryIndexSchema).toBeDefined();

    const good = projection();
    const bad = { ...good, refScan: { unreadable: [], filesRead: 2663 } };
    const schema = LibraryIndexSchema as unknown as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse(good).success).toBe(true);
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
