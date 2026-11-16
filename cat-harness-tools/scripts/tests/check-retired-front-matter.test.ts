/**
 * The retirement check, and the two ways it could pass without checking.
 *
 * The interesting assertions here are not "it finds a reintroduced key" —
 * that is one `Object.hasOwn`. They are the guards: a sweep that scanned
 * nothing must not read as clean, a retirement whose record has gone must
 * fail rather than quietly enforce a rule with no reasons, and the record
 * itself must not trip the check it exists to explain.
 *
 * @module scripts/tests/check-retired-front-matter.test
 */
import { HARNESS_ROOT } from "../lib/roots.ts";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, test } from "bun:test";

import { RETIRED, scan } from "../check-retired-front-matter.ts";
import { parseFrontMatter } from "../../schemas/kg/front-matter.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { corpusDirectoryForGraph } from "../../schemas/kg/harness-config.ts";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";

const INSTANCE = HARNESS_ROOT;
const REPO = repoRootFor(INSTANCE);

/**
 * A throwaway LAYER, declaring its own directories.
 *
 * The declaration is not scaffolding — it is the thing under test. `scan`
 * reads where to sweep from `harness.json` rather than from a list, so a
 * fixture without one exercises the fallback and not the path the real run
 * takes. `declare: false` is how the "resolved to nothing" case is reached.
 */
// Tests call `scan(root, root)`: the fixture IS both the layer and the
// repository, and letting `repoRootFor` guess would report findings relative
// to the system temp directory.
function fixture(files: Record<string, string>, declare = true): string {
  const root = mkdtempSync(resolve(tmpdir(), "retired-fm-"));
  if (declare) {
    writeDeclaration(root, JSON.stringify({
        name: "fixture",
        directories: [
          { id: "skills", path: "skills/", graphTypologies: ["cat-harness"] },
          { id: "fsh-guts", path: "fsh-guts/", scope: "repository", graphTypologies: ["fsh-guts"] },
        ],
      }));
    // Every retirement's record has to exist, or `missingRecords` fires and
    // swamps the assertion the test is actually making.
    for (const r of RETIRED) {
      const abs = resolve(root, "fsh-guts", r.record);
      mkdirSync(resolve(abs, ".."), { recursive: true });
      writeFileSync(abs, "---\n$schema: folio-fsh-guts/v1\ntitle: fixture\nkind: retired-field\n---\n");
    }
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = resolve(root, rel);
    mkdirSync(resolve(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

describe("the registry", () => {
  test("there is something retired, or every assertion below is vacuous", () => {
    expect(RETIRED.length).toBeGreaterThan(0);
  });

  test("every entry names a record that exists", () => {
    // The check enforces this at runtime too. It is here as well because a
    // record deleted in the same commit that deletes a file would otherwise
    // only surface in CI, and the message it produces — a refusal with no
    // reasons — is the thing most likely to get the field re-added.
    const guts = corpusDirectoryForGraph(INSTANCE, "fsh-guts");
    expect(guts).toBeDefined();
    for (const r of RETIRED) {
      expect(`${r.key}: ${r.record}`).toBe(
        `${r.key}: ${Bun.file(resolve(guts!, r.record)).size > 0 ? r.record : "MISSING"}`,
      );
    }
  });

  test("every entry says WHY, not just what", () => {
    for (const r of RETIRED) {
      // A one-word `because` would make the error message a bare prohibition.
      expect(r.because.length).toBeGreaterThan(80);
    }
  });
});

describe("the sweep over the real tree", () => {
  const { findings, scanned, missingRecords } = scan(INSTANCE);

  test("is clean, and scanned enough files for that to mean anything", () => {
    expect(findings.map((f) => `${f.file}:${f.entry.key}`)).toEqual([]);
    expect(missingRecords).toEqual([]);
    expect(scanned).toBeGreaterThan(100);
  });

  test("the fsh-guts record does NOT trip the check it explains", () => {
    // `skill-roles-front-matter.md` quotes `roles: string[];` inside a code
    // fence and `roles: [ingestion-agent, …]` in prose. A grep-based check
    // would flag its own archaeology; reading parsed front matter does not.
    const record = RETIRED.find((r) => r.key === "roles")?.record;
    expect(record).toBeDefined();
    const abs = resolve(corpusDirectoryForGraph(INSTANCE, "fsh-guts")!, record!);
    return Bun.file(abs).text().then((t) => {
      expect(t).toContain("roles: string[];");
      expect(findings.some((f) => resolve(REPO, f.file) === abs)).toBe(false);
    });
  });
});

describe("the guards", () => {
  test("a reintroduced key is found, wherever in the front matter it sits", () => {
    const root = fixture({
      "skills/folio-core/a.md": "---\nname: a\nroles: [reader]\ndescription: x\n---\n\nbody\n",
      "skills/folio-core/b.md": "---\nname: b\nroles:\n  - collaborator\n  - owner\n---\n\nbody\n",
      "skills/folio-core/ok.md": "---\nname: ok\n---\n\nbody\n",
    });
    try {
      const { findings, scanned } = scan(root, root);
      // 3 fixture skills PLUS one record per retirement: `fixture()` writes a
      // `fsh-guts/` record for every RETIRED entry, and those are swept too —
      // scanned, but never findings, which the fsh-guts test above asserts
      // separately.
      //
      // Derived, not pinned. The literal `3` was written while a
      // `scope: "repository"` entry resolved to the tmpdir's PARENT and so
      // swept nothing of the fixture's own; it also grows by one every time a
      // field is retired, failing on the change that was correct.
      expect(scanned).toBe(3 + RETIRED.length);
      expect(findings.map((f) => f.file).sort()).toEqual([
        "skills/folio-core/a.md",
        "skills/folio-core/b.md",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a mention in the BODY is not a finding — only a declaration is", () => {
    const root = fixture({
      "skills/folio-core/a.md":
        "---\nname: a\n---\n\nThe retired field looked like this:\n\n```yaml\nroles: [reader, owner]\n```\n",
    });
    try {
      expect(scan(root, root).findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a sweep that scanned nothing reports zero scanned, so the caller can refuse it", () => {
    // The could-not-determine case. `scan` reports it rather than deciding;
    // `main` turns it into a non-zero exit, because "no retired keys found"
    // over an empty sweep is the third state rendered as a pass.
    const root = fixture({ "README.md": "# nothing here\n" }, false);
    try {
      const { findings, scanned } = scan(root, root);
      expect(findings).toEqual([]);
      expect(scanned).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a missing record is reported even when no file carries the key", () => {
    // The rule survives its own reasons going missing, and says so. Without
    // this the first symptom is an agent hitting a prohibition with nothing
    // behind it.
    //
    // The fixture declares its OWN `fsh-guts/` (no `scope: "repository"`, so
    // it resolves inside the fixture rather than beside it) and writes the
    // record of every retirement but the FIRST. A report of every key would
    // then mean the directory went unresolved, not that a record is missing.
    const root = fixture({ "skills/folio-core/a.md": "---\nname: a\n---\n\nbody\n" }, false);
    try {
      writeDeclaration(root, JSON.stringify({
        name: "fixture",
        directories: [
          { id: "skills", path: "skills/", graphTypologies: ["cat-harness"] },
          { id: "fsh-guts", path: "fsh-guts/", graphTypologies: ["fsh-guts"] },
        ],
      }));
      const [absent, ...present] = RETIRED;
      for (const r of present) {
        const abs = resolve(root, "fsh-guts", r.record);
        mkdirSync(resolve(abs, ".."), { recursive: true });
        writeFileSync(abs, "---\n$schema: folio-fsh-guts/v1\ntitle: fixture\nkind: retired-field\n---\n");
      }
      mkdirSync(resolve(root, "fsh-guts"), { recursive: true });
      expect(corpusDirectoryForGraph(root, "fsh-guts")).toBe(resolve(root, "fsh-guts"));
      const { findings, missingRecords } = scan(root, root);
      expect(findings).toEqual([]);
      expect(missingRecords.map((r) => r.key)).toEqual([absent!.key]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the graph-typology exemption", () => {
  test("`roles:` in a memory entry is NOT a finding — different kind, real reader", () => {
    // The failure that produced this exemption: the first `qif9` pass
    // excised the key from all 140 files, the 26 `folio-memory/v1` entries
    // included, and `agent-memory.test.ts` caught it — `memoryForRoles`
    // filters on `tags.roles`, so an untagged entry is visible to EVERY
    // lane and the CI lane stopped discriminating.
    const root = fixture({
      "skills/memory/m.md":
        "---\n$schema: folio-memory/v1\nid: m\nlabel: stable\nroles:\n  - build-pipeline\n---\n\nbody\n",
      "skills/folio-core/s.md": "---\nname: s\nroles: [reader]\n---\n\nbody\n",
    });
    try {
      const { findings, scanned } = scan(root, root);
      expect(scanned).toBe(2 + RETIRED.length);
      // Exactly one: the skill, not the memory entry.
      expect(findings.map((f) => f.file)).toEqual(["skills/folio-core/s.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the exemption matches the DECLARATION, not the directory", () => {
    // A memory entry sitting outside the memory graph is still exempt, and a
    // skill sitting inside it is still caught. Location is a coincidence of
    // the current layout; the declaration is the contract (#263).
    const root = fixture({
      "skills/folio-core/m.md":
        "---\n$schema: folio-memory/v1\nid: m\nroles:\n  - build-pipeline\n---\n\nbody\n",
      "skills/memory/s.md": "---\nname: s\nroles: [owner]\n---\n\nbody\n",
    });
    try {
      expect(scan(root, root).findings.map((f) => f.file)).toEqual(["skills/memory/s.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("on the REAL tree the exemption guards a non-empty set, and only that set", () => {
    // Two vacuity guards in one, and both have already fired in anger.
    //
    // Turning the exemption off must produce findings — otherwise it is
    // protecting nothing, either because the memory entries lost the axis or
    // because the sweep never reaches them. The first version of
    // `sweepRoots` used `skillMdDirs`, which enumerates skill PACKAGES;
    // `skills/memory/` is not one, so the exemption sat over a directory the
    // check never opened.
    //
    // And every finding it suppresses must BE a memory entry — an exemption
    // that also hid a skill would be the retirement quietly not applying.
    const saved = RETIRED[0]!.exceptSchemas;
    try {
      RETIRED[0]!.exceptSchemas = undefined;
      const off = scan(INSTANCE);
      expect(off.findings.length).toBeGreaterThan(0);
      for (const f of off.findings) {
        const { fm } = parseFrontMatter(readFileSync(resolve(REPO, f.file), "utf-8"));
        expect(`${f.file}: ${fm.$schema}`).toBe(`${f.file}: folio-memory/v1`);
      }
    } finally {
      RETIRED[0]!.exceptSchemas = saved;
    }
    expect(scan(INSTANCE).findings).toEqual([]);
  });
});
