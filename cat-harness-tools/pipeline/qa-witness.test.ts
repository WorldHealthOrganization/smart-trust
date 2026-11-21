/**
 * The witness projection has one job the icon never had: saying whether a
 * verdict still holds. Everything below is about the ways that can be got
 * wrong quietly.
 *
 * The expensive failure is not `stale` reported as `fresh` — it is `unknown`
 * reported as `fresh`. A comparison that could not be made looks exactly like
 * one that succeeded unless the code refuses to guess, and a reader shown
 * "current" for a verdict nobody can date will act on it.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  digestsAgree,
  freshnessOf,
  readWitnessDoc,
  sidecarPaths,
  stateOf,
} from "./qa-witness.ts";
import { kgQaSidecarPath } from "../schemas/sdlc/kg-qa.ts";

function inTmp(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "qa-witness-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("digestsAgree — a prefix and a full digest of the same bytes are not a change", () => {
  const full = "23931aa74ec87d4cb28f1360c16558216da2e97cac523fd5e25c650416b17014";

  test("block-qa's 12-char prefix agrees with kg-qa's sha256:<64>", () => {
    // The families genuinely write different formats. Comparing them naively
    // marks every KG witness stale, which is a wall of false alarms in exactly
    // the panel built to make alarms trustworthy.
    expect(digestsAgree(full.slice(0, 12), "sha256:" + full)).toBe(true);
  });

  test("a real difference is still a difference", () => {
    expect(digestsAgree("aaaaaaaaaaaa", "sha256:" + full)).toBe(false);
  });

  test("a missing side is undefined, never agreement", () => {
    expect(digestsAgree(undefined, full)).toBeUndefined();
    expect(digestsAgree(full, undefined)).toBeUndefined();
    expect(digestsAgree("", full)).toBeUndefined();
  });
});

describe("freshnessOf — three states, and `unknown` is never `fresh`", () => {
  test("every recorded input matches the tree: fresh", () => {
    expect(freshnessOf({ md: "aaa", ts: "bbb" }, { md: "aaa", ts: "bbb" })).toEqual({
      freshness: "fresh",
    });
  });

  test("one input moved: stale, and it NAMES the input", () => {
    // "Something changed" sends a reader to re-run the whole sweep. "md changed"
    // tells them the prose moved and the Lean did not.
    expect(freshnessOf({ md: "aaa", ts: "bbb" }, { md: "zzz", ts: "bbb" })).toEqual({
      freshness: "stale",
      changed: ["md"],
    });
  });

  test("a file on disk the entry never hashed is `unknown`, not `fresh`", () => {
    const r = freshnessOf({ md: "aaa" }, { md: "aaa", lean: "ccc" });
    expect(r.freshness).toBe("unknown");
    expect(r.changed?.[0]).toContain("lean");
  });

  test("a DERIVED input the entry hashed is `partial`, not a missing file", () => {
    // `graph` is the chapter's edge set, not a path. Reporting it as "reviewed,
    // now missing on disk" put 1012 of 5424 witnesses into `unknown` on the
    // first corpus-wide run — a fifth of the panel alarming about a file that
    // never existed.
    const r = freshnessOf({ md: "aaa", graph: "ggg" }, { md: "aaa" });
    expect(r.freshness).toBe("partial");
    expect(r.notCompared?.[0]).toContain("graph");
    expect(r.changed).toBeUndefined();
  });

  test("`partial` is not `fresh`: it says how much was established, not that all was", () => {
    const r = freshnessOf({ md: "aaa", lean_statement: "sss" }, { md: "aaa" });
    expect(r.freshness).not.toBe("fresh");
    expect(r.freshness).toBe("partial");
  });

  test("a changed FILE outranks an unchecked derived input", () => {
    // A verdict that is definitely wrong must not be softened to "current on
    // files" by something nobody looked at.
    const r = freshnessOf({ md: "aaa", graph: "ggg" }, { md: "zzz" });
    expect(r.freshness).toBe("stale");
    expect(r.changed).toEqual(["md"]);
  });

  test("a genuinely missing FILE outranks an unchecked derived input", () => {
    const r = freshnessOf({ md: "aaa", graph: "ggg" }, {});
    expect(r.freshness).toBe("unknown");
  });

  test("a reviewed file that is gone is `unknown`, not `fresh`", () => {
    const r = freshnessOf({ md: "aaa" }, {});
    expect(r.freshness).toBe("unknown");
    expect(r.changed?.[0]).toContain("missing on disk");
  });

  test("an unresolved input cannot be outvoted by matching ones", () => {
    // The whole point: a partially-checkable entry hides whatever it could not
    // check, so it reports `unknown` rather than the majority verdict.
    const r = freshnessOf({ md: "aaa" }, { md: "aaa", ts: "bbb" });
    expect(r.freshness).toBe("unknown");
  });

  test("a stale input outranks an unresolved one", () => {
    // `stale` is actionable and `unknown` is not; reporting the weaker of the
    // two would bury a verdict that is definitely wrong.
    const r = freshnessOf({ md: "aaa" }, { md: "zzz", ts: "bbb" });
    expect(r.freshness).toBe("stale");
  });

  test("an entry with no hashes at all is `unknown`", () => {
    expect(freshnessOf({}, {}).freshness).toBe("unknown");
  });
});

describe("stateOf — a criterion with no verdict does not make a sidecar clean", () => {
  test("only `unknown` and `n/a` is `unswept`", () => {
    expect(stateOf({ fail: 0, warn: 0, pass: 0, na: 3, unknown: 2 })).toBe("unswept");
  });

  test("a pass alongside an unknown is still `pass`", () => {
    expect(stateOf({ fail: 0, warn: 0, pass: 1, na: 0, unknown: 4 })).toBe("pass");
  });

  test("fail outranks warn outranks pass", () => {
    expect(stateOf({ fail: 1, warn: 9, pass: 9, na: 0, unknown: 0 })).toBe("fail");
    expect(stateOf({ fail: 0, warn: 1, pass: 9, na: 0, unknown: 0 })).toBe("warn");
  });
});

describe("readWitnessDoc — block family", () => {
  function block(dir: string, mdBody: string, entryHash: Record<string, string>) {
    writeFileSync(join(dir, "b.md"), mdBody);
    writeFileSync(join(dir, "b.ts"), "export const x = 1;\n");
    writeFileSync(
      join(dir, "b.qa.json"),
      JSON.stringify({
        $schema: "block-qa/v1",
        label: "sec:b",
        kind: "prose",
        paths: { ts: "b.ts", md: "b.md" },
        source_hashes: entryHash,
        criteria: {
          "voice-status-leak": [
            {
              field_hash: entryHash,
              result: "fail",
              severity: "critical",
              evidence: "b.md:1: **Not yet implemented:**",
              reviewer: { kind: "script", id: "checker.ts", version: "v1", script_hash: "deadbeef" },
              reviewed_at: "2026-09-18T17:33:04.230Z",
              reviewed_sha: "efea5b8f6d19818dc8fa85baa031944564d72c87",
            },
            {
              field_hash: entryHash,
              result: "pass",
              reviewer: { kind: "human", id: "litlfred" },
              reviewed_at: "2026-09-17T09:00:00.000Z",
              reviewed_tree: "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
            },
          ],
        },
        updated_at: "2026-09-18T17:33:04.230Z",
      }),
    );
  }

  test("the FIRST entry is the verdict; the rest are still published as history", () => {
    inTmp((dir) => {
      block(dir, "body\n", { md: "x", ts: "y" });
      const doc = readWitnessDoc("block", join(dir, "b.md"), dir)!;
      expect(doc.criteria).toHaveLength(1);
      const c = doc.criteria[0]!;
      // A superseded review must not change the verdict...
      expect(c.result).toBe("fail");
      // ...and must not vanish either: "who said otherwise, and when" is the
      // audit trail the panel exists to show.
      expect(c.witnesses).toHaveLength(2);
      expect(c.witnesses[1]!.kind).toBe("human");
      expect(c.witnesses[1]!.id).toBe("litlfred");
    });
  });

  test("freshness is measured against the TREE, not the sidecar's own header", () => {
    inTmp((dir) => {
      // The entry's hashes are nonsense, so they cannot match the real files —
      // which is precisely the case a self-consistent sidecar hides.
      block(dir, "body\n", { md: "notthehash", ts: "notthehash" });
      const doc = readWitnessDoc("block", join(dir, "b.md"), dir)!;
      expect(doc.criteria[0]!.witnesses[0]!.freshness).toBe("stale");
      expect(doc.criteria[0]!.witnesses[0]!.changed).toEqual(["md", "ts"]);
    });
  });

  test("a legacy entry keeps its commit; a current one carries its tree (bean 69lr)", () => {
    inTmp((dir) => {
      block(dir, "body\n", { md: "x", ts: "y" });
      const [legacy, current] = readWitnessDoc("block", join(dir, "b.md"), dir)!.criteria[0]!.witnesses;
      expect(legacy!.sha).toBe("efea5b8f6d19818dc8fa85baa031944564d72c87");
      expect(legacy!.tree).toBeUndefined();
      expect(current!.tree).toBe("4b825dc642cb6eb9a060e54bf8d69288fbee4904");
      expect(current!.sha).toBeUndefined();
    });
  });

  test("evidence and severity reach the projection", () => {
    inTmp((dir) => {
      block(dir, "body\n", { md: "x", ts: "y" });
      const c = readWitnessDoc("block", join(dir, "b.md"), dir)!.criteria[0]!;
      expect(c.severity).toBe("critical");
      expect(c.evidence?.[0]).toContain("Not yet implemented");
    });
  });

  test("a sidecar that will not parse is undefined, not a crash", () => {
    inTmp((dir) => {
      writeFileSync(join(dir, "b.md"), "body\n");
      writeFileSync(join(dir, "b.qa.json"), "{ not json");
      expect(readWitnessDoc("block", join(dir, "b.md"), dir)).toBeUndefined();
    });
  });

  test("no sidecar is undefined — the caller decides `unswept` vs no icon", () => {
    inTmp((dir) => {
      writeFileSync(join(dir, "b.md"), "body\n");
      expect(readWitnessDoc("block", join(dir, "b.md"), dir)).toBeUndefined();
    });
  });
});

describe("readWitnessDoc — kg family keeps one auditor, and says what it does not know", () => {
  function kg(dir: string, sourceHash: string) {
    writeFileSync(join(dir, "p.bpmn"), "<definitions/>\n");
    // The results tree, not a `kg-qa/` sibling: verdicts moved there on
    // 2026-09-19 (bean `2634`). The path is taken from the shared function
    // rather than composed here, so this fixture cannot drift from what the
    // auditor writes and the projector reads.
    const sidecar = kgQaSidecarPath(dir, dir, "p");
    mkdirSync(dirname(sidecar), { recursive: true });
    writeFileSync(
      sidecar,
      JSON.stringify({
        $schema: "kg-qa/v1",
        subject: { kind: "process", id: "Process_X", path: "p.bpmn" },
        source_hash: sourceHash,
        criteria: {
          "activity-names-skill": {
            result: "fail",
            findings: [{ where: "Task_A", detail: "names no skill." }],
          },
          "decision-ref-resolves": { result: "n/a", findings: [] },
        },
        totals: { pass: 0, fail: 1, "n/a": 1, unknown: 0 },
      }),
    );
    // The auditor is recorded ONCE for the corpus, not in each sidecar. Write
    // the manifest the reader now consults; `kgNoManifest` below is the other
    // half, and the two together are why this is a fixture change rather than
    // a relaxed assertion.
    mkdirSync(join(dir, "skills"), { recursive: true });
    writeFileSync(
      join(dir, "test", "results", "kg-qa.manifest.json"),
      JSON.stringify({
        $schema: "kg-qa-manifest/v1",
        auditor: { script: "scripts/kg-audit.ts", script_hash: "sha256:abc", engine_version: "1" },
      }),
    );
  }

  test("one criterion, one witness — synthesised from the corpus manifest", () => {
    inTmp((dir) => {
      kg(dir, "sha256:whatever");
      const doc = readWitnessDoc("kg", join(dir, "p.bpmn"), dir)!;
      expect(doc.subject).toBe("process Process_X");
      // Worst first.
      expect(doc.criteria[0]!.id).toBe("activity-names-skill");
      expect(doc.criteria[0]!.witnesses).toHaveLength(1);
      expect(doc.criteria[0]!.witnesses[0]!.id).toBe("scripts/kg-audit.ts");
      expect(doc.criteria[0]!.evidence?.[0]).toContain("Task_A");
    });
  });

  test("no manifest says `unrecorded` rather than inventing a hash", () => {
    // The third state. An auditor identity that cannot be read is not the same
    // as one that is absent, and neither is a reason to emit a plausible hash
    // — the same rule this file already applies to the timestamp `kg-audit`
    // does not keep.
    inTmp((dir) => {
      kg(dir, "sha256:whatever");
      rmSync(join(dir, "test", "results", "kg-qa.manifest.json"));
      const w = readWitnessDoc("kg", join(dir, "p.bpmn"), dir)!.criteria[0]!.witnesses[0]!;
      expect(w.id).toBe("unrecorded");
      expect(w.scriptHash).toBeUndefined();
    });
  });

  test("kg-audit records no timestamp, so the witness carries none rather than one invented", () => {
    inTmp((dir) => {
      kg(dir, "sha256:whatever");
      const w = readWitnessDoc("kg", join(dir, "p.bpmn"), dir)!.criteria[0]!.witnesses[0]!;
      expect(w.at).toBeUndefined();
      expect(w.sha).toBeUndefined();
    });
  });

  test("a wrong source hash is stale, not fresh", () => {
    inTmp((dir) => {
      kg(dir, "sha256:0000000000000000000000000000000000000000000000000000000000000000");
      const w = readWitnessDoc("kg", join(dir, "p.bpmn"), dir)!.criteria[0]!.witnesses[0]!;
      expect(w.freshness).toBe("stale");
    });
  });
});

describe("readWitnessDoc — script family", () => {
  // No `*.script-qa.json` exists anywhere in this repo yet, so this family has
  // no live data to check the reader against. That is a reason to test it, not
  // to skip it: the first sidecar a script sweep writes must render, and the
  // only thing standing between here and there is that nobody has looked.
  test("a script sidecar reads, hashing the script itself", () => {
    inTmp((dir) => {
      mkdirSync(join(dir, "script-qa"), { recursive: true });
      writeFileSync(join(dir, "s.ts"), "export const x = 1;\n");
      writeFileSync(
        join(dir, "script-qa", "s.script-qa.json"),
        JSON.stringify({
          $schema: "script-qa/v1",
          script_path: "s.ts",
          language: "typescript",
          source_hash: "nothashed",
          updated_at: "2026-09-18T00:00:00.000Z",
          criteria: {
            does_not_default_to_float: [
              {
                field_hash: { script: "nothashed" },
                result: "warn",
                severity: "minor",
                reviewer: { kind: "script", id: "pipeline/script-sweep.ts" },
                reviewed_at: "2026-09-18T00:00:00.000Z",
              },
            ],
          },
        }),
      );
      const doc = readWitnessDoc("script", join(dir, "s.ts"), dir)!;
      expect(doc.subject).toBe("s.ts");
      expect(doc.state).toBe("warn");
      // The recorded hash is not the file's, so the verdict is stale — the same
      // rule as every other family, measured against the tree.
      expect(doc.criteria[0]!.witnesses[0]!.freshness).toBe("stale");
      expect(doc.criteria[0]!.witnesses[0]!.changed).toEqual(["script"]);
    });
  });
});

describe("sidecarPaths — translation is per locale, collected per block", () => {
  test("every locale's sidecar is found, in a stable order", () => {
    inTmp((dir) => {
      writeFileSync(join(dir, "b.md"), "body\n");
      for (const loc of ["fr", "ar", "es"]) {
        writeFileSync(join(dir, `b.${loc}.translation-qa.json`), "{}");
      }
      // A neighbouring block's sidecar must not be swept up with this one's.
      writeFileSync(join(dir, "other.fr.translation-qa.json"), "{}");
      const found = sidecarPaths("translation", join(dir, "b.md"), dir).map((p) => p.split("/").pop());
      expect(found).toEqual([
        "b.ar.translation-qa.json",
        "b.es.translation-qa.json",
        "b.fr.translation-qa.json",
      ]);
    });
  });

  test("a stem that is a prefix of another does not steal its sidecars", () => {
    inTmp((dir) => {
      writeFileSync(join(dir, "b.md"), "body\n");
      writeFileSync(join(dir, "b-extra.fr.translation-qa.json"), "{}");
      expect(sidecarPaths("translation", join(dir, "b.md"), dir)).toHaveLength(0);
    });
  });
});

describe("readWitnessDoc — translation family", () => {
  test("locales are merged into one view, each criterion tagged with its own", () => {
    inTmp((dir) => {
      writeFileSync(join(dir, "b.md"), "body\n");
      for (const loc of ["fr", "es"]) {
        writeFileSync(
          join(dir, `b.${loc}.translation-qa.json`),
          JSON.stringify({
            $schema: "translation-qa/v1",
            label: `trans:${loc}/b`,
            locale: loc,
            criteria: {
              "translation-coverage": [
                {
                  field_hash: { md: "x" },
                  result: "pass",
                  reviewer: { kind: "script", id: "translation-block-qa.ts" },
                  reviewed_at: "2026-09-18T20:18:26.590Z",
                },
              ],
              // Declared and unwitnessed: the sweep cannot establish it.
              "translation-semantic-roundtrip": [],
            },
          }),
        );
      }
      const doc = readWitnessDoc("translation", join(dir, "b.md"), dir)!;
      expect(doc.criteria).toHaveLength(4);
      expect(doc.counts.pass).toBe(2);
      // An empty entry array is `unknown` — a criterion the sidecar holds with
      // nobody's ruling on it — and it does not count as a pass.
      expect(doc.counts.unknown).toBe(2);
      const roundtrips = doc.criteria.filter((c) => c.id === "translation-semantic-roundtrip");
      expect(roundtrips.map((c) => c.locale).sort()).toEqual(["es", "fr"]);
      expect(roundtrips[0]!.witnesses).toHaveLength(0);
      // Two locales pass and two are unruled: the block is not "clean".
      expect(doc.state).toBe("pass");
    });
  });
});
