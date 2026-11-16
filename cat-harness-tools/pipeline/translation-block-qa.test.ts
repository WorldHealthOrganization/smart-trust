/**
 * What the block-level translation sweep may and may not claim.
 *
 * Two of these tests are about a verdict NOT being written. That is the whole
 * design question here: a round trip cannot be run offline, and a block that
 * was never translated is not a block whose translation failed. Both gaps are
 * easy to fill with a plausible number, and a plausible number is what stops
 * anyone asking again.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  buildReport,
  type Glossary,
  invariantTokens,
  measureBlock,
  mergeCriteria,
  notOwnLine,
  readPrior,
} from "./translation-block-qa.ts";
import { clearQaCache, publishQa, type QaStoreOptions } from "../scripts/qa-store.ts";

function inTmp(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "trans-qa-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function po(pairs: Array<[string, string]>): string {
  return (
    'msgid ""\nmsgstr ""\n"Language: fr\\n"\n\n' +
    pairs.map(([id, str]) => `msgid "${id}"\nmsgstr "${str}"\n`).join("\n")
  );
}

describe("invariantTokens — what a translation may not silently drop", () => {
  const kindOf = (text: string, token: string) =>
    invariantTokens(text).find((t) => t.token === token)?.kind;

  test("acronyms, numbers and URLs are all found", () => {
    const text = "The CRDM gate ran 3 times; see https://phii.org/x for QA notes.";
    const tokens = invariantTokens(text).map((t) => t.token);
    expect(tokens).toContain("CRDM");
    expect(tokens).toContain("QA");
    expect(tokens).toContain("3");
    expect(tokens).toContain("https://phii.org/x");
  });

  test("a number or a URL is STRICT — it cannot legitimately change", () => {
    const text = "ran 3 times; see https://phii.org/x";
    expect(kindOf(text, "3")).toBe("strict");
    expect(kindOf(text, "https://phii.org/x")).toBe("strict");
  });

  test("an acronym is NOT strict, because a good translation localises it", () => {
    // `WHO` is `OMS` in French. Treating that as a dropped term made the
    // criterion fail four locales of `docs/index.md` on translations that were
    // correct — bean `pp93`.
    expect(kindOf("the WHO SMART Guidelines", "WHO")).toBe("acronym");
  });

  test("a number inside a URL does not demote the URL to an acronym", () => {
    expect(kindOf("see https://example.org/v2/spec", "https://example.org/v2/spec"))
      .toBe("strict");
  });

  test("an ordinary capitalised word is not an invariant token at all", () => {
    // Proper nouns are translated or transliterated all the time; requiring
    // them verbatim would make the criterion fire on correct translations.
    expect(invariantTokens("Public Health Informatics Institute")).toEqual([]);
  });
});

describe("measureBlock", () => {
  const md = "The CRDM gate is a checkpoint.\n";

  test("an empty msgstr is untranslated, not translated-to-nothing", () => {
    const m = measureBlock(md, "b.md", new Map([["The CRDM gate is a checkpoint.", "   "]]));
    expect(m.total).toBe(1);
    expect(m.translated).toBe(0);
  });

  test("a msgstr identical to its msgid is counted as an echo", () => {
    const m = measureBlock(
      md,
      "b.md",
      new Map([["The CRDM gate is a checkpoint.", "The CRDM gate is a checkpoint."]]),
    );
    expect(m.translated).toBe(1);
    expect(m.echoed).toBe(1);
  });

  test("a dropped acronym is a finding that quotes the translation", () => {
    const m = measureBlock(
      md,
      "b.md",
      new Map([["The CRDM gate is a checkpoint.", "La barrière est un point de contrôle."]]),
    );
    // An acronym, so it lands in the class the criterion WARNS about rather
    // than the one it fails on — it is still reported, and still quotes the
    // translation so a reader can judge whether it was localised or lost.
    expect(m.missingAcronyms).toHaveLength(1);
    expect(m.missingAcronyms[0]).toContain("CRDM");
    expect(m.missingAcronyms[0]).toContain("barrière");
    expect(m.missingStrict).toEqual([]);
  });

  test("a dropped NUMBER is strict — nothing localises a 3", () => {
    const m = measureBlock(
      "The gate ran 3 times.\n",
      "b.md",
      new Map([["The gate ran 3 times.", "La barrière a été exécutée plusieurs fois."]]),
    );
    expect(m.missingStrict).toHaveLength(1);
    expect(m.missingStrict[0]).toContain("3");
    expect(m.missingAcronyms).toEqual([]);
  });

  test("a real translation that keeps its terms is clean", () => {
    const m = measureBlock(
      md,
      "b.md",
      new Map([["The CRDM gate is a checkpoint.", "La barrière CRDM est un point de contrôle."]]),
    );
    expect(m.translated).toBe(1);
    expect(m.echoed).toBe(0);
    expect(m.missingStrict).toEqual([]);
    expect(m.missingAcronyms).toEqual([]);
  });
});

describe("buildReport — absence is absence", () => {
  test("no PO source at all: no report", () => {
    inTmp((dir) => {
      const md = join(dir, "b.md");
      writeFileSync(md, "The CRDM gate is a checkpoint.\n");
      expect(buildReport(md, "sec:b", "fr", [])).toBeUndefined();
    });
  });

  test("a PO that holds none of this block's strings: no report, NOT a 0% failure", () => {
    inTmp((dir) => {
      // The chapter-level PO resolves for every block on the page. A block whose
      // strings are not in it has not been translated — writing `fail` there
      // paints a 3%-translated site red and buries the translations that exist
      // and are broken.
      const md = join(dir, "b.md");
      writeFileSync(md, "The CRDM gate is a checkpoint.\n");
      const p = join(dir, "other.po");
      writeFileSync(p, po([["Some other sentence.", "Une autre phrase."]]));
      expect(buildReport(md, "sec:b", "fr", [p])).toBeUndefined();
    });
  });

  test("a translated block reports coverage, terms and echo — and NO round-trip verdict", () => {
    inTmp((dir) => {
      const md = join(dir, "b.md");
      writeFileSync(md, "The CRDM gate is a checkpoint.\n");
      const p = join(dir, "fr.po");
      writeFileSync(
        p,
        po([["The CRDM gate is a checkpoint.", "La barrière CRDM est un point de contrôle."]]),
      );
      const doc = buildReport(md, "sec:b", "fr", [p])!;

      expect(doc.label).toBe("trans:fr/b");
      // The block's own label is a DIFFERENT identity and is kept separately.
      expect(doc.block).toBe("sec:b");
      expect(doc.criteria["translation-coverage"]![0]!.result).toBe("pass");
      expect(doc.criteria["translation-coverage"]![0]!.metrics).toMatchObject({ pct: 100 });
      expect(doc.criteria["translation-terms-preserved"]![0]!.result).toBe("pass");
      expect(doc.criteria["translation-not-echo"]![0]!.result).toBe("pass");

      // The one that matters: declared, and deliberately unwitnessed. The only
      // offline back-translation is the PO read backwards, which returns the
      // source exactly and would score 1.0 on any similarity measure — a verdict
      // about the lookup table with a script's name on it.
      expect(doc.criteria["translation-semantic-roundtrip"]).toEqual([]);
    });
  });

  test("the PO is a hashed input, so editing the translation stales the verdict", () => {
    inTmp((dir) => {
      const md = join(dir, "b.md");
      writeFileSync(md, "The CRDM gate is a checkpoint.\n");
      const p = join(dir, "fr.po");
      writeFileSync(p, po([["The CRDM gate is a checkpoint.", "La barrière CRDM."]]));
      const first = buildReport(md, "sec:b", "fr", [p])!;
      writeFileSync(p, po([["The CRDM gate is a checkpoint.", "La barrière CRDM revue."]]));
      const second = buildReport(md, "sec:b", "fr", [p])!;
      expect(first.source_hashes.po).not.toBe(second.source_hashes.po);
      expect(first.criteria["translation-coverage"]![0]!.field_hash.po).not.toBe(
        second.criteria["translation-coverage"]![0]!.field_hash.po,
      );
    });
  });

  test("a partial translation warns, and says how much is missing", () => {
    inTmp((dir) => {
      const md = join(dir, "b.md");
      writeFileSync(md, "First sentence here.\n\nSecond sentence here.\n");
      const p = join(dir, "fr.po");
      writeFileSync(p, po([["First sentence here.", "Première phrase ici."]]));
      const doc = buildReport(md, "sec:b", "fr", [p])!;
      const cov = doc.criteria["translation-coverage"]![0]!;
      expect(cov.result).toBe("warn");
      expect(cov.metrics).toMatchObject({ translated: 1, total: 2, pct: 50 });
      expect(cov.notes).toContain("1 of 2");
    });
  });
});

describe("mergeCriteria — a re-run must not delete what it did not write", () => {
  const SELF = "pipeline/translation-block-qa.ts";
  const scriptEntry = (result: string, id = SELF) =>
    ({ field_hash: { md: "x" }, result, reviewer: { kind: "script", id }, reviewed_at: "t" }) as never;
  const agentEntry = (result: string) =>
    ({ field_hash: { md: "x" }, result, reviewer: { kind: "agent", id: "adjudicator" }, reviewed_at: "t" }) as never;

  test("the sweep replaces its OWN entries rather than stacking them", () => {
    // Append-only script entries turn a criterion into a log of one checker
    // arguing with itself — bean `oja4`.
    const out = mergeCriteria(
      { "translation-coverage": [scriptEntry("fail")] },
      { "translation-coverage": [scriptEntry("pass")] },
    );
    expect(out["translation-coverage"]).toHaveLength(1);
    expect(out["translation-coverage"]![0]!.result).toBe("pass");
  });

  test("an agent verdict on a criterion the sweep does not measure SURVIVES", () => {
    // The live failure this guards: the sweep writes `translation-semantic-
    // roundtrip: []` on every run. Clobbering would delete the round trip a
    // pair of agents produced, on the next unrelated re-run, silently.
    const out = mergeCriteria(
      { "translation-semantic-roundtrip": [agentEntry("pass"), agentEntry("n/a")] },
      { "translation-semantic-roundtrip": [] },
    );
    expect(out["translation-semantic-roundtrip"]).toHaveLength(2);
    expect(out["translation-semantic-roundtrip"]![0]!.result).toBe("pass");
  });

  test("an agent entry on a criterion the sweep DOES measure is kept, behind the fresh script one", () => {
    const out = mergeCriteria(
      { "translation-coverage": [agentEntry("warn")] },
      { "translation-coverage": [scriptEntry("pass")] },
    );
    expect(out["translation-coverage"]).toHaveLength(2);
    // First entry is the operative verdict everywhere in this repo, and the
    // fresh mechanical measurement leads on a criterion the script owns.
    expect(out["translation-coverage"]![0]!.reviewer!.kind).toBe("script");
    expect(out["translation-coverage"]![1]!.reviewer!.kind).toBe("agent");
  });

  test("another script's entry is not mistaken for this one's", () => {
    const out = mergeCriteria(
      { "translation-coverage": [scriptEntry("fail", "some/other-checker.ts")] },
      { "translation-coverage": [scriptEntry("pass")] },
    );
    expect(out["translation-coverage"]).toHaveLength(2);
  });

  test("a criterion only the existing sidecar has is carried through untouched", () => {
    const out = mergeCriteria({ "human-only-axis": [agentEntry("fail")] }, {});
    expect(out["human-only-axis"]).toHaveLength(1);
  });
});

/**
 * The glossary tells the checker how to read an ABSENT term — and cannot be
 * used to stop it checking.
 *
 * Bean `he0e`. `translation-terms-preserved` warned on every acronym missing
 * from a translation, because it cannot tell `WHO` -> `OMS` from `WHO` dropped.
 * `translations/<locale>/glossary.po` settles it: a pinned `msgstr` says what
 * the term must become, a `#, localised` flag says it is rendered in the target
 * language without pinning how.
 *
 * **The danger is obvious and is what most of this block tests.** A flag that
 * made a criterion pass unconditionally would be a mute button wearing a
 * glossary's clothes, so each case below asks what the glossary CANNOT do.
 */
describe("the glossary is a reading rule, not a mute button", () => {
  const g = (entries: Record<string, { expected?: string; localised?: boolean }>): Glossary =>
    new Map(
      Object.entries(entries).map(([k, v]) => [k, { expected: v.expected, localised: !!v.localised }]),
    );

  const measure = (src: string, target: string, glossary: Glossary) =>
    measureBlock(src + "\n", "b.md", new Map([[src, target]]), glossary);

  test("a localised term absent from the translation PASSES, and says why", () => {
    const m = measure(
      "The WHO guidelines apply.",
      "Les lignes directrices de l'OMS s'appliquent.",
      g({ WHO: { localised: true } }),
    );
    expect(m.missingAcronyms).toEqual([]);
    expect(m.brokenGlossaryTerms).toEqual([]);
    expect(m.resolvedAcronyms).toHaveLength(1);
    expect(m.resolvedAcronyms[0]).toContain("WHO");
    expect(m.resolvedAcronyms[0]).toContain("localised");
  });

  test("a PINNED form present in the translation passes", () => {
    const m = measure(
      "The WHO guidelines apply.",
      "Les lignes directrices de l'OMS s'appliquent.",
      g({ WHO: { expected: "OMS" } }),
    );
    expect(m.resolvedAcronyms).toHaveLength(1);
    expect(m.brokenGlossaryTerms).toEqual([]);
  });

  test("a PINNED form that is ALSO absent FAILS — the glossary said what it should be", () => {
    const m = measure(
      "The WHO guidelines apply.",
      "Les lignes directrices s'appliquent.",
      g({ WHO: { expected: "OMS" } }),
    );
    expect(m.brokenGlossaryTerms).toHaveLength(1);
    expect(m.brokenGlossaryTerms[0]).toContain("OMS");
    expect(m.resolvedAcronyms).toEqual([]);
  });

  test("a VERBATIM term that was dropped still fails — the identity mapping bites", () => {
    // The case the whole mechanism has to keep catching: a standard's name
    // silently gone is exactly what a fluent mistranslation looks like.
    const m = measure(
      "The FHIR profile is normative.",
      "Le profil est normatif.",
      g({ FHIR: { expected: "FHIR" } }),
    );
    expect(m.brokenGlossaryTerms).toHaveLength(1);
    expect(m.brokenGlossaryTerms[0]).toContain("FHIR");
  });

  test("a term the glossary does not name still WARNS — silence is not permission", () => {
    const m = measure(
      "The CRDM gate is a checkpoint.",
      "La barrière est un point de contrôle.",
      g({ WHO: { localised: true } }),
    );
    expect(m.missingAcronyms).toHaveLength(1);
    expect(m.missingAcronyms[0]).toContain("CRDM");
  });

  test("an EMPTY entry — no form, no flag — is unfinished, not permission", () => {
    const m = measure(
      "The CRDM gate is a checkpoint.",
      "La barrière est un point de contrôle.",
      g({ CRDM: {} }),
    );
    expect(m.missingAcronyms).toHaveLength(1);
    expect(m.resolvedAcronyms).toEqual([]);
  });

  test("localised CANNOT forgive a number — no glossary speaks for strict tokens", () => {
    // The mute-button test. `strict` never consults the glossary at all, so an
    // entry naming a number cannot buy it a pass.
    const m = measure(
      "The gate ran 3 times.",
      "La barrière a été exécutée plusieurs fois.",
      g({ "3": { localised: true } }),
    );
    expect(m.missingStrict).toHaveLength(1);
    expect(m.missingStrict[0]).toContain("3");
    expect(m.resolvedAcronyms).toEqual([]);
  });

  test("localised CANNOT forgive a dropped URL either", () => {
    const m = measure(
      "See https://example.org/spec for details.",
      "Voir la spécification pour plus de détails.",
      g({ "https://example.org/spec": { localised: true } }),
    );
    expect(m.missingStrict).toHaveLength(1);
  });

  test("a glossary for ANOTHER locale is not consulted — the map is per-locale", () => {
    // `readGlossary` is called with one locale's file. An empty map is what a
    // locale with no glossary gets, and it must behave exactly as before.
    const m = measure(
      "The WHO guidelines apply.",
      "Las directrices se aplican.",
      new Map(),
    );
    expect(m.missingAcronyms).toHaveLength(1);
    expect(m.missingAcronyms[0]).toContain("WHO");
  });
});

/* ── Bean 8wj1: the prior comes from the store, so the working copy cannot move a stored check ── */

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
function gitIn(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
}

const report = (note: string) => JSON.stringify({ $schema: "translation-qa/v1", note, criteria: {} });

/** A checkout whose results-tree sidecar `rel` is published to qa-reports `main/<sha>` as `published`. */
function storeFixture(base: string, rel: string, published: string | undefined) {
  const bare = join(base, "remote.git");
  gitIn(base, "init", "-q", "--bare", "-b", "main", bare);
  gitIn(bare, "config", "uploadpack.allowFilter", "true");
  gitIn(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const work = join(base, "work");
  mkdirSync(work);
  gitIn(work, "init", "-q", "-b", "main");
  const store = (n: string): QaStoreOptions => ({
    repoRoot: work,
    remote: `file://${bare}`,
    branch: "qa-reports",
    storeDir: join(base, `${n}.store.git`),
    sleep: () => {},
    log: () => {},
  });
  const out = join(work, rel);
  if (published !== undefined) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, published);
    publishQa({ ref: `main/${"a".repeat(40)}`, roots: [dirname(out)] }, store("writer"));
    rmSync(out);
    clearQaCache();
  }
  return { work, out, store };
}

describe("readPrior (bean 8wj1)", () => {
  const REL = "inst/test/results/translation-qa/x.fr.translation-qa.json";

  test("without a ref it is the working copy, present or absent", () => {
    inTmp((dir) => {
      const p = join(dir, "x.json");
      writeFileSync(p, report("disk"));
      const hit = readPrior(p, p, undefined);
      expect(hit.ok && (hit.doc as unknown as { note: string }).note).toBe("disk");
      const none = readPrior(undefined, p, undefined);
      expect(none.ok && none.doc).toBeUndefined();
    });
  });

  test(
    "with a ref the branch decides, and a different working copy is ignored",
    () => {
      inTmp((dir) => {
        const { out, store } = storeFixture(dir, REL, report("branch"));
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, report("disk"));
        const r = readPrior(out, out, "main", store("reader"));
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect((r.doc as unknown as { note: string }).note).toBe("branch");
          expect(r.from).toBe(`qa-reports:main/${"a".repeat(40)}`);
        }
      });
    },
    60_000,
  );

  test(
    "a sidecar the branch lacks has no prior, even with one on disk",
    () => {
      inTmp((dir) => {
        const { out, store } = storeFixture(dir, REL, report("branch"));
        const other = out.replace("x.fr", "y.fr");
        mkdirSync(dirname(other), { recursive: true });
        writeFileSync(other, report("disk"));
        const r = readPrior(other, other, "main", store("reader"));
        expect(r.ok && r.doc).toBeUndefined();
      });
    },
    60_000,
  );

  test(
    "a branch that cannot be read refuses rather than reading as no prior",
    () => {
      inTmp((dir) => {
        const { out, store } = storeFixture(dir, REL, undefined);
        const r = readPrior(undefined, out, "main", { ...store("reader"), remote: "file:///no/such/remote.git" });
        expect(r.ok).toBe(false);
      });
    },
    60_000,
  );
});

// Owner ruling 2026-11-05, "Move the checks": a content repository's PR checks
// must not fail on the harness's own translations (cat-harness-tools#1684).
describe("judge only the caller's own instance", () => {
  function instance(dir: string, name: string): string {
    const root = join(dir, name);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, `${name}.json`), JSON.stringify({ name }));
    return root;
  }

  test("unscoped (a local run): judges, as before", () => {
    inTmp((dir) => {
      expect(notOwnLine(instance(dir, "cat-harness"), {}, dir)).toBeUndefined();
    });
  });

  test("the caller is another instance: nothing of its own, a pass", () => {
    inTmp((dir) => {
      const line = notOwnLine(instance(dir, "cat-harness"), { CAT_GATE_OWN_INSTANCES: "content-ig" }, dir);
      expect(line).toContain("content-ig");
      expect(line).toContain("judged by their own CI");
    });
  });

  test("the caller is the harness: judges", () => {
    inTmp((dir) => {
      expect(notOwnLine(instance(dir, "cat-harness"), { CAT_GATE_OWN_INSTANCES: "cat-harness" }, dir)).toBeUndefined();
    });
  });

  test("own paths only: an instance outside them is not judged", () => {
    inTmp((dir) => {
      const env = { CAT_GATE_OWN_PATHS: "content-ig", CAT_GATE_FOREIGN_PATHS: "index/cat-harness" };
      mkdirSync(join(dir, "fa"), { recursive: true });
      expect(notOwnLine(instance(join(dir, "fa"), "cat-harness"), env, dir)).toBeDefined();
      expect(notOwnLine(instance(dir, "content-ig"), env, dir)).toBeUndefined();
    });
  });
});
