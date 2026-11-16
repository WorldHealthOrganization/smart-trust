/**
 * Initiation's last act is safe to repeat, and does not reformat the declaration.
 *
 * Two properties, and both are about a SECOND run rather than a first. A first
 * run is easy to get right and is not where this breaks.
 *
 * The tests of this file that read the whole checkout (reads every harness
 * card the checkout's live board carries) live in
 * `test/ensure-landing-sticky-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import type { ContentDirectory } from "../../schemas/kg/cat-harness.js";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FOLIO_DIRECTORY_ENTRY,
  declaresFolio,
  ensureLandingSticky,
  folioDirPath,
  insertDirectoryEntry,
  readLandingStickies,
  stickiesFor,
  stickyFile,
  toAsciiJson,
} from "../ensure-landing-sticky.js";
import { LandingStickySchema } from "../../schemas/content/landing-sticky.js";
import {
  contributingRoots,
  declaredContributions,
  initiationFromArgv,
  readerTextProblems,
} from "../ensure-landing-sticky.js";
import { InitiationSchema } from "../../schemas/content/sticky-contribution.js";
import { declarationPathIn } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

/**
 * The ids this fixture's declaration contributes.
 *
 * Named from the FIXTURE rather than imported from `schemas/`, because there is
 * no longer a constant to import: the board is composed from whatever the layers
 * declare, so a test's expected set comes from the declaration the test wrote.
 */
const LANDING_STICKY_ID = "landing";
const CAT_HARNESS_STICKY_ID = "cat-harness";
const SUBGRAPHS_STICKY_ID = "subgraphs";

/** A declaration in the committed style: ASCII-escaped, 2-space, prose comments. */
const DECL = `{
  "_comment": "An instance \\u2014 with an em dash, because the committed file escapes them.",
  "name": "a-folio",
  "description": "one line\\n\\n\\u00a0c@t-harness",
  "stickies": [
    {
      "id": "landing",
      "order": 10,
      "theme": { "themeId": "engineer" },
      "bodyFrom": "description",
      "onboardingLinks": true
    },
    {
      "id": "cat-harness",
      "order": 20,
      "theme": { "themeId": "grumpy-cat" },
      "body": "a cat"
    },
    {
      "id": "subgraphs",
      "order": 30,
      "theme": { "themeId": "engineer" },
      "body": "the graphs"
    }
  ],
  "directories": [
    {
      "id": "schemas",
      "path": "schemas/",
      "graphTypologies": [
        "schemas",
        "cat-harness"
      ]
    }
  ]
}
`;

function instance(decl = DECL): string {
  const root = mkdtempSync(join(tmpdir(), "landing-sticky-"));
  writeDeclaration(root, decl);
  return root;
}

describe("the declaration is edited surgically, not re-serialised", () => {
  test("every byte outside the insertion is unchanged", () => {
    // The property that matters. `JSON.stringify` emits literal UTF-8 while the
    // committed file is ASCII-escaped, so a re-serialise would rewrite every em
    // dash in the declaration — a 115-line diff for a one-entry addition, and
    // the kind of change that silently normalises the NO-BREAK SPACE in
    // `description`.
    const next = insertDirectoryEntry(DECL, FOLIO_DIRECTORY_ENTRY);
    const removed = next
      .split("\n")
      .filter((l) => !DECL.split("\n").includes(l))
      .join("\n");
    // Everything the edit added mentions the folio and nothing else.
    expect(removed).toContain('"folio"');
    // And every original line survives, in order.
    const kept = next.split("\n").filter((l) => DECL.split("\n").includes(l));
    expect(kept.join("\n")).toContain('"_comment"');
    for (const line of DECL.trimEnd().split("\n")) {
      if (line.trim() === "}" || line.trim() === "},") continue;
      expect(next).toContain(line);
    }
  });

  test("the escapes survive verbatim", () => {
    const next = insertDirectoryEntry(DECL, FOLIO_DIRECTORY_ENTRY);
    expect(next).toContain("\\u2014");
    expect(next).toContain("\\u00a0");
    // ...and NOT as literal characters, which is what a re-serialise would give.
    expect(next).not.toContain("—");
    expect(next).not.toContain(" ");
  });

  test("the result is still valid JSON, with the entry present", () => {
    const parsed = JSON.parse(insertDirectoryEntry(DECL, FOLIO_DIRECTORY_ENTRY)) as {
      directories: ContentDirectory[];
    };
    expect(parsed.directories).toHaveLength(2);
    expect(declaresFolio(parsed)).toBe(true);
  });

  test("a second insertion is a NO-OP, byte for byte", () => {
    // Idempotency at the text level, not just "does not duplicate the entry".
    const once = insertDirectoryEntry(DECL, FOLIO_DIRECTORY_ENTRY);
    expect(insertDirectoryEntry(once, FOLIO_DIRECTORY_ENTRY)).toBe(once);
  });

  test("a bracket inside a prose comment does not shift the match", () => {
    // The `_comment` fields are long English prose and one of them will
    // eventually contain a bracket. A regex for the array's end would stop at
    // the wrong place; the matcher honours strings.
    const tricky = DECL.replace(
      '"An instance \\u2014 with an em dash, because the committed file escapes them."',
      '"Prose with a [bracket] and a nested ] in it."',
    );
    const parsed = JSON.parse(insertDirectoryEntry(tricky, FOLIO_DIRECTORY_ENTRY)) as {
      directories: unknown[];
    };
    expect(parsed.directories).toHaveLength(2);
  });

  test("an escaped quote inside a string does not end it early", () => {
    const tricky = DECL.replace('"a-folio"', '"a \\"quoted\\" name"');
    const parsed = JSON.parse(insertDirectoryEntry(tricky, FOLIO_DIRECTORY_ENTRY)) as {
      directories: unknown[];
    };
    expect(parsed.directories).toHaveLength(2);
  });

  test("an empty directories array is handled", () => {
    // No trailing `}` to put a comma after. Worth a case because the separator
    // is chosen from what the array already ends with.
    const empty = DECL.replace(/"directories": \[[\s\S]*?\n  \]/, '"directories": []');
    const parsed = JSON.parse(insertDirectoryEntry(empty, FOLIO_DIRECTORY_ENTRY)) as {
      directories: unknown[];
    };
    expect(parsed.directories).toHaveLength(1);
  });

  test("toAsciiJson escapes non-ASCII and leaves ASCII alone", () => {
    expect(toAsciiJson({ a: "—" }, 2)).toContain("\\u2014");
    expect(toAsciiJson({ a: "plain" }, 2)).toContain('"plain"');
  });
});

describe("running it twice changes nothing", () => {
  test("the second run reports `already` on both halves", () => {
    const root = instance();
    const first = ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    expect(first.declaredFolio).toBe("added");
    expect(first.stickies.map((s) => s.state)).toEqual(["written", "written", "written"]);
    expect(first.stickies.map((s) => s.id)).toEqual([
      LANDING_STICKY_ID,
      CAT_HARNESS_STICKY_ID,
      SUBGRAPHS_STICKY_ID,
    ]);

    // A LATER clock, deliberately: if `createdAt` were read from the clock
    // rather than from the file, this is the run that would show a diff.
    const second = ensureLandingSticky(root, "2027-01-01T00:00:00Z");
    expect(second.declaredFolio).toBe("already");
    expect(second.stickies.map((s) => s.state)).toEqual(["already", "already", "already"]);
  });

  test("the sticky's createdAt is the FIRST run's, not the second's", () => {
    const root = instance();
    ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    ensureLandingSticky(root, "2027-01-01T00:00:00Z");
    const written = JSON.parse(
      readFileSync(join(root, folioDirPath(JSON.parse(readFileSync(declarationPathIn(root)!, "utf8"))), stickyFile(LANDING_STICKY_ID)), "utf8"),
    ) as { createdAt: string };
    expect(written.createdAt).toBe("2026-09-20T00:00:00Z");
  });

  test("the declaration is written once and not grown", () => {
    const root = instance();
    ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    const after = readFileSync(declarationPathIn(root)!, "utf8");
    ensureLandingSticky(root, "2027-01-01T00:00:00Z");
    expect(readFileSync(declarationPathIn(root)!, "utf8")).toBe(after);
  });

  test("the sticky it writes is a valid LandingSticky", () => {
    const root = instance();
    ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    const decl = JSON.parse(readFileSync(declarationPathIn(root)!, "utf8")) as object;
    const raw = readFileSync(join(root, folioDirPath(decl), stickyFile(LANDING_STICKY_ID)), "utf8");
    expect(() => LandingStickySchema.parse(JSON.parse(raw))).not.toThrow();
  });

  test("the instance's own description is what the sticky carries", () => {
    const root = instance();
    ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    const decl = JSON.parse(readFileSync(declarationPathIn(root)!, "utf8")) as object;
    const s = LandingStickySchema.parse(
      JSON.parse(readFileSync(join(root, folioDirPath(decl), stickyFile(LANDING_STICKY_ID)), "utf8")),
    );
    // Including the NO-BREAK SPACE, which is part of the derivation chain rather
    // than incidental whitespace.
    expect(s.comment).toBe("one line\n\n c@t-harness");
  });

  test("`--check` reports without writing", () => {
    const root = instance();
    const before = readFileSync(declarationPathIn(root)!, "utf8");
    const report = ensureLandingSticky(root, "2026-09-20T00:00:00Z", { check: true });
    expect(report.declaredFolio).toBe("added");
    expect(readFileSync(declarationPathIn(root)!, "utf8")).toBe(before);
  });
});

describe("a malformed sticky is repaired, not fatal", () => {
  test("initiation overwrites unparseable content", () => {
    // Refusing to run because the thing this script exists to write is broken
    // would be the one failure mode with no recovery.
    const root = instance();
    ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    const decl = JSON.parse(readFileSync(declarationPathIn(root)!, "utf8")) as object;
    const path = join(root, folioDirPath(decl), stickyFile(LANDING_STICKY_ID));
    writeFileSync(path, "{ not json");
    const report = ensureLandingSticky(root, "2027-01-01T00:00:00Z");
    // `updated` rather than `written`: the file was THERE, it was just garbage.
    // The state is read off file presence, not off whether the content parsed —
    // which is the honest distinction, since `--check` reports a present-but-
    // broken sticky as stale and a missing one as missing, and those want
    // different things from a reader.
    expect(report.stickies.find((s) => s.id === LANDING_STICKY_ID)?.state).toBe("updated");
    expect(() => LandingStickySchema.parse(JSON.parse(readFileSync(path, "utf8")))).not.toThrow();
  });

  test("an instance with no description falls back to its name", () => {
    // A landing page with no words is worse than one naming the layer, and
    // `summary` is `min(1)` so an empty description would refuse the node.
    const root = instance(DECL.replace(/  "description": "[^"]*",\n/, ""));
    const path = declarationPathIn(root)!;
    const s = stickiesFor(root, join(root, "nowhere"), "2026-09-20T00:00:00Z")[0]!;
    expect(s.comment).toBe("a-folio");
    expect(readFileSync(path, "utf8")).toContain('"name": "a-folio"');
  });

  /** A declaration carrying a folio entry at `path`, spelled with `key`. */
  function withFolioAt(path: string, key: "graphTypologies" | "graphs"): string {
    return DECL.replace(
      '"directories": [',
      `"directories": [\n    {\n      "id": "content",\n      "path": "${path}",\n      \n      "${key}": [\n        "folio"\n      ]\n    },`,
    );
  }

  test("a declaration that already declares a folio elsewhere is respected", () => {
    // Matched on the GRAPH TYPOLOGY, not on id or path: a layer may keep its
    // folio anywhere and call the entry what it likes.
    const root = instance(withFolioAt("authored/", "graphTypologies"));
    mkdirSync(join(root, "authored"), { recursive: true });
    const report = ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    expect(report.declaredFolio).toBe("already");
    expect(report.folioDir).toBe("authored/");
  });

  test("...including one still spelling the field the pre-2026-09-21 way", () => {
    // NOT a duplicate of the test above, and the difference is the whole point:
    // this module SPLICES TEXT, so it parses the declaration itself and
    // `ContentDirectorySchema`'s legacy-key preprocess never runs. Were the
    // alias not restated in `kindsOf`, a downstream folio spelling the field
    // `graphs` would read as declaring no folio — and `ensureLandingSticky`
    // would splice a SECOND folio entry into a declaration that has one.
    const root = instance(withFolioAt("authored/", "graphs"));
    mkdirSync(join(root, "authored"), { recursive: true });
    const report = ensureLandingSticky(root, "2026-09-20T00:00:00Z");
    expect(report.declaredFolio).toBe("already");
    expect(report.folioDir).toBe("authored/");
  });
});

describe("a nested instance contributes its own stickies", () => {
  /** A layer declaring a directory that is itself a layer — bootstrap's shape. */
  function nested(): string {
    const root = mkdtempSync(join(tmpdir(), "landing-nested-"));
    writeDeclaration(root, JSON.stringify(
        {
          name: "outer",
          description: "the outer layer",
          stickies: [
            { id: "landing", order: 10, theme: { themeId: "engineer" }, bodyFrom: "description" },
          ],
          // Mirrors the live shape rather than a convenient one: the declared
          // entry is the nested layer's GRAPH directory, one level inside it,
          // so `harness.json` is not in the directory named here. That is what
          // `bootstrap/skills/` looks like, and a composer that looked for a
          // declaration inside the declared directory would find nothing.
          directories: [{ id: "inner", path: "inner/skills/", graphTypologies: ["cat-harness"] }],
        },
        null,
        2,
      ),
    );
    mkdirSync(join(root, "inner", "skills"), { recursive: true });
    writeDeclaration(join(root, "inner"), JSON.stringify(
        {
          name: "inner",
          description: "the inner layer",
          stickies: [
            { id: "inner-card", order: 90, theme: { themeId: "pale-sage" }, bodyFrom: "description" },
          ],
          directories: [],
        },
        null,
        2,
      ));
    return root;
  }

  test("the nested instance is DISCOVERED, not named by the outer one", () => {
    // Hardcoding `bootstrap/` in the composer would put the layer list back in
    // the layer above — the ownership inversion this change undoes — and would go
    // stale the moment the split happens. What marks a layer is that it
    // declares itself.
    const root = nested();
    expect(contributingRoots(root)).toEqual([join(root, "inner"), root]);
  });

  test("a declared directory of the instance ITSELF is not a second contributor", () => {
    // `findInstanceRoot` walks up, so a plain subdirectory resolves to the
    // layer that declared it — which must not be read twice, or its own
    // stickies would collide with themselves.
    const root = mkdtempSync(join(tmpdir(), "landing-plain-"));
    writeDeclaration(root, JSON.stringify(
        { name: "only", directories: [{ id: "s", path: "sub/", graphTypologies: ["cat-harness"] }] },
        null,
        2,
      ));
    mkdirSync(join(root, "sub"), { recursive: true });
    expect(contributingRoots(root)).toEqual([root]);
  });

  test("both layers' cards are composed, each carrying its OWN description", () => {
    // The defect that would make the seam pointless: a board of one sentence
    // repeated, because every card read the root's description.
    const root = nested();
    const composed = declaredContributions(root);
    expect(composed.map((c) => c.contribution.id)).toEqual(["landing", "inner-card"]);
    expect(composed.map((c) => c.description)).toEqual(["the inner layer", "the outer layer"].reverse());
  });

  test("the nested layer's declared order places it, not its depth", () => {
    // Read order is inner-first (deepest first, as `resolveDirectories` does), so
    // an undeclared order would render the inner card ABOVE the outer's
    // description. `order` is what decides it.
    const root = nested();
    expect(declaredContributions(root).map((c) => c.contribution.order)).toEqual([10, 90]);
  });

  test("the written board holds one file per contributed sticky, each in its own instance's folio directory", () => {
    const root = nested();
    const report = ensureLandingSticky(root, "2026-09-20T00:00:00.000Z");
    expect(report.stickies.map((s) => s.id)).toEqual(["landing", "inner-card"]);
    for (const st of report.stickies) {
      const node = LandingStickySchema.parse(
        JSON.parse(readFileSync(join(root, st.path), "utf8")),
      );
      expect(node.id).toBe(st.id);
    }
    const outerDir = folioDirPath(JSON.parse(readFileSync(declarationPathIn(root)!, "utf8")));
    // Outer folio holds outer card only, NOT inner card
    expect(existsSync(join(root, outerDir, stickyFile("landing")))).toBe(true);
    expect(existsSync(join(root, outerDir, stickyFile("inner-card")))).toBe(false);

    // Inner folio holds inner card
    expect(existsSync(join(root, "inner", "folio", stickyFile("inner-card")))).toBe(true);
    // `contributedBy` is on the node, so "which layer put this here" is answerable
    // from the file rather than by re-deriving the composition.
    const inner = LandingStickySchema.parse(
      JSON.parse(readFileSync(join(root, "inner", "folio", stickyFile("inner-card")), "utf8")),
    );
    expect(inner.contributedBy).toBe("inner");

    // readLandingStickies reads from each layer's folio
    expect(readLandingStickies(root).map((s) => s.id)).toEqual(["landing", "inner-card"]);
  });

  test("an instance contributing NO stickies gets an empty board, not a default one", () => {
    // Absent means "this layer contributes none" rather than "unmigrated". A
    // default here would hand a cat back to a bare bootstrap.
    const root = mkdtempSync(join(tmpdir(), "landing-none-"));
    writeDeclaration(root, JSON.stringify({ name: "quiet", description: "no cards", directories: [] }, null, 2));
    expect(declaredContributions(root)).toEqual([]);
    expect(ensureLandingSticky(root, "2026-09-20T00:00:00.000Z").stickies).toEqual([]);
  });
});

describe("a sticky is an initiation RECEIPT", () => {
  /**
   * The owner, 2026-09-20: *"it is skill/tool to add sticky note at end of
   * harnes sinitialziation. (maybe create it a the beingnngin, update when
   * done, to show some status)"*.
   *
   * The pair is the design. Writing the card only at the END makes a crashed
   * initiation indistinguishable from one that never started — both are a card
   * that is simply absent, and "missing" is the least informative thing a
   * status board can say.
   */
  function instanceWithSticky(): string {
    const root = mkdtempSync(join(tmpdir(), "receipt-"));
    writeDeclaration(root, JSON.stringify(
        {
          name: "a-folio",
          description: "one line",
          stickies: [
            { id: "landing", order: 10, theme: { themeId: "engineer" }, bodyFrom: "description" },
            { id: "other", order: 20, theme: { themeId: "engineer" }, body: "another card" },
          ],
          directories: [],
        },
        null,
        2,
      ));
    return root;
  }

  const read = (root: string, id: string) =>
    LandingStickySchema.parse(
      JSON.parse(
        readFileSync(
          join(root, folioDirPath(JSON.parse(readFileSync(declarationPathIn(root)!, "utf8"))), stickyFile(id)),
          "utf8",
        ),
      ),
    );

  test("absent is NOT ok — a card nothing reported on carries no status", () => {
    // The third state, and the one that must never render green.
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T00:00:00.000Z");
    expect(read(root, "landing").initiation).toBeUndefined();
  });

  test("`--begin` marks it running, with a start time and no completion", () => {
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T01:00:00.000Z", {
      initiation: { harness: "a-folio", phase: "begin" },
    });
    const i = read(root, "landing").initiation!;
    expect(i.status).toBe("running");
    expect(i.startedAt).toBe("2026-09-20T01:00:00.000Z");
    expect(i.completedAt).toBeUndefined();
  });

  test("`--complete` PRESERVES the start time rather than overwriting it", () => {
    // Otherwise the pair becomes two readings of the same instant, and "how
    // long did initiation take" stops being answerable.
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T01:00:00.000Z", {
      initiation: { harness: "a-folio", phase: "begin" },
    });
    ensureLandingSticky(root, "2026-09-20T01:05:00.000Z", {
      initiation: { harness: "a-folio", phase: "complete" },
    });
    const i = read(root, "landing").initiation!;
    expect(i.status).toBe("ok");
    expect(i.startedAt).toBe("2026-09-20T01:00:00.000Z");
    expect(i.completedAt).toBe("2026-09-20T01:05:00.000Z");
  });

  test("a completion with no begin is recorded, not refused", () => {
    // An initiation that was never announced still finished, and losing that is
    // worse than a startedAt only as precise as the completion.
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T02:00:00.000Z", {
      initiation: { harness: "a-folio", phase: "complete" },
    });
    expect(read(root, "landing").initiation?.status).toBe("ok");
  });

  test("a failure carries what failed — the schema refuses one that does not", () => {
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T03:00:00.000Z", {
      initiation: { harness: "a-folio", phase: "complete", status: "failed", detail: "skills/ did not resolve" },
    });
    expect(read(root, "landing").initiation?.detail).toContain("skills/");
    expect(() =>
      InitiationSchema.parse({ status: "failed", startedAt: "x", completedAt: "y" }),
    ).toThrow();
  });

  test("a finished initiation must carry completedAt; only `running` may omit it", () => {
    expect(() => InitiationSchema.parse({ status: "ok", startedAt: "x" })).toThrow();
    expect(() => InitiationSchema.parse({ status: "running", startedAt: "x" })).not.toThrow();
  });

  test("EVERY card of that harness gets the status — one initiation, one harness", () => {
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T04:00:00.000Z", {
      initiation: { harness: "a-folio", phase: "complete" },
    });
    for (const id of ["landing", "other"]) expect(read(root, id).initiation?.status).toBe("ok");
  });

  test("a status survives a plain rebuild rather than being reset", () => {
    // The builder runs on every initiation and every --check. Dropping the
    // status would make a finished harness read as "never reported" the next
    // time anything touched the board.
    const root = instanceWithSticky();
    ensureLandingSticky(root, "2026-09-20T05:00:00.000Z", {
      initiation: { harness: "a-folio", phase: "complete" },
    });
    ensureLandingSticky(root, "2026-09-20T06:00:00.000Z");
    expect(read(root, "landing").initiation?.status).toBe("ok");
  });

  test("argv parsing: begin, complete, failure with a detail", () => {
    expect(initiationFromArgv(["--begin", "boot"])).toEqual({ harness: "boot", phase: "begin" });
    expect(initiationFromArgv(["--complete", "boot"])).toEqual({ harness: "boot", phase: "complete", status: "ok" });
    expect(initiationFromArgv(["--complete", "boot", "--failed", "--detail", "why"])).toEqual({
      harness: "boot", phase: "complete", status: "failed", detail: "why",
    });
    expect(initiationFromArgv(["--check"])).toBeUndefined();
  });
});

/**
 * A harness sticky shows the same text as the landing page: bean `ob3m` finding 3.
 *
 * The owner, 2026-10-01: *"Stickies show the same text as the landing page"*.
 * The landing's harness section shows the declaration's `summary` and its
 * `alsoWritten` spellings. Before this, a sticky read the declaration's
 * `description`, and the folio-assistant card opened with the reason its name
 * was chosen.
 */
describe("a harness sticky shows the landing's text, not the author's (ob3m 3)", () => {
  const RATIONALE = "NAMED `a-folio-checkout` because two declarations shared a name.";
  const declWith = (bodyFrom: "summary" | "description") => `{
  "name": "a-folio",
  "summary": "A one-line gloss for a reader.",
  "alsoWritten": ["a-f0lio", "a@folio"],
  "description": ${JSON.stringify(RATIONALE)},
  "stickies": [
    { "id": "landing", "order": 10, "theme": { "themeId": "engineer" }, "bodyFrom": "${bodyFrom}" }
  ],
  "directories": []
}
`;

  test("`bodyFrom: summary` writes the summary and the Also written list, and no rationale", () => {
    const root = instance(declWith("summary"));
    ensureLandingSticky(root, "2026-10-01T00:00:00.000Z");
    const card = LandingStickySchema.parse(
      JSON.parse(readFileSync(join(root, "folio", stickyFile("landing")), "utf8")),
    );
    expect(card.comment).toBe("A one-line gloss for a reader.\n\nAlso written: `a-f0lio`, `a@folio`");
    expect(card.comment).not.toContain("NAMED");
    expect(readerTextProblems(root)).toEqual([]);
  });

  test("a card that shows the description when a summary is declared is a finding", () => {
    const root = instance(declWith("description"));
    ensureLandingSticky(root, "2026-10-01T00:00:00.000Z");
    const problems = readerTextProblems(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(join("folio", stickyFile("landing")));
    expect(problems[0]).toContain('use `bodyFrom: "summary"`');
  });

  test("no summary falls back to the description, as the landing does", () => {
    const root = instance(`{
  "name": "a-folio",
  "description": "Only a description.",
  "stickies": [
    { "id": "landing", "order": 10, "theme": { "themeId": "engineer" }, "bodyFrom": "summary" }
  ],
  "directories": []
}
`);
    ensureLandingSticky(root, "2026-10-01T00:00:00.000Z");
    const card = JSON.parse(readFileSync(join(root, "folio", stickyFile("landing")), "utf8")) as { comment: string };
    expect(card.comment).toBe("Only a description.");
    expect(readerTextProblems(root)).toEqual([]);
  });
});
