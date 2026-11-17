/**
 * Tests for the subgraph-coverage axis (bean `2krx`).
 *
 * The bean names the falsifier and it is the shape of this file: **a subgraph
 * with all three is not reported, and removing any one of them makes it
 * appear.** A test that only checked "findings exist" would pass against an
 * axis that reports everything unconditionally, which is the one failure mode
 * an advisory check is most likely to have and least likely to be caught in.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  auditInstance,
  serialisationsProducerDeclared,
  auditAll,
  formatReport,
  CRITERIA,
  VISUALISER_EXEMPT_INSTANCES,
  readmeFinding,
  ownDocsFinding,
} from "../check-subgraph-coverage";
import {
  INSTANCE_README_ROLE,
  directoryOwesSerialisations,
  owesSerialisations,
  owesVisualiser,
  GraphTypologyRegistry,
  resolveCoveragePath,
  siteDirFor,
} from "../../schemas/kg/cat-harness.ts";

/**
 * The REAL repository's audit, made once per root and shared by every test
 * that reads it (bean `lpcs`, measured 2026-10-15). `auditAll` over the index
 * took 6.7–7.4 s per call on both the base and head sides of a pull request,
 * so each of the seven tests that ran it on its own was a coin-flip against
 * bun's 5 s default timeout and went red on PRs that touched nothing here
 * (cat-harness-tools#337, #360). The same shape as
 * `check-declaration-filename.test.ts`: share the result, and give the one
 * test that pays for it a measured budget.
 */
const CORPUS_TIMEOUT = 60_000;
const realAudits = new Map<string, ReturnType<typeof auditAll>>();
function realAuditAll(repo: string): ReturnType<typeof auditAll> {
  let r = realAudits.get(repo);
  if (!r) realAudits.set(repo, (r = auditAll(repo)));
  return r;
}
import { writeDeclaration } from "../../test/support/instance-fixture.js";

/**
 * A throwaway layer whose one directory carries `coverage`.
 *
 * **`realTargets` are written at the REPOSITORY root (`base`), not under the
 * layer**, because that is where a `coverage.*` value resolves — the
 * owner's ruling of 2026-09-21 on bean `yt7j`, and what all 45 coverage paths
 * in this repository already do. The fixture wrote them under the layer
 * while `targetExists` accepted either root, so it was passing against the
 * fallback rather than against the convention; eight tests turned red the
 * moment the fallback came out, which is the evidence that they were.
 */
function instance(
  coverage: unknown,
  opts: { name?: string; realTargets?: string[]; graphTypologies?: string[] } = {},
): { root: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), "coverage-"));
  const root = join(base, opts.name ?? "inst");
  mkdirSync(join(root, "thing"), { recursive: true });
  for (const t of opts.realTargets ?? []) {
    const abs = resolve(base, t);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, "x");
  }
  // A governing skill is declared by the SKILL since #1168 B7b, not by the
  // directory: a fixture asking for `skill: "x"` gets a skill file whose
  // front matter names the directory's kinds, and the directory names none.
  const { skill, docs, ...rest } = (coverage ?? {}) as Record<string, unknown>;
  const kinds = opts.graphTypologies ?? ["cat-harness"];
  // Likewise the docs page (#1168 B7c): a fixture asking for `docs: "x.md"`
  // gets that page declaring the directory's kinds under `documents:`. Only
  // when the page is meant to exist — a fixture naming a page it never
  // writes is asking for an undocumented directory. The page sits INSIDE the
  // layer, since a kind claim reaches only from a layer in reach.
  if (typeof docs === "string" && (opts.realTargets ?? []).includes(docs)) {
    const abs = join(root, docs);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `---\ntitle: doc\ndocuments:\n${kinds.map((k) => `  - ${k}\n`).join("")}---\n# doc\n`);
  }
  if (typeof skill === "string") {
    mkdirSync(join(root, "skills"), { recursive: true });
    writeFileSync(
      join(root, "skills", `${skill}.md`),
      `---\nname: ${skill}\ngraph-typologies:\n${kinds.map((k) => `  - ${k}\n`).join("")}---\n# ${skill}\n`,
    );
  }
  writeDeclaration(root, JSON.stringify({
      name: opts.name ?? "inst",
      directories: [
        {
          id: "thing",
          path: "thing/",
          graphTypologies: kinds,
          ...(coverage === undefined ? {} : { coverage: rest }),
        },
      ],
    }));
  return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

describe("the falsifier the bean asks for", () => {
  it("a subgraph with all four declared and resolving is NOT reported", () => {
    const { root, cleanup } = instance(
      { visualiser: "viz.html", docs: "doc.md", skill: "some-skill", serialisations: "thing.jsonld" },
      { realTargets: ["viz.html", "doc.md", "thing.jsonld"] },
    );
    const r = auditInstance(root);
    expect(r.verdict).toBe("checked");
    expect(r.findings).toEqual([]);
    cleanup();
  });

  it.each([...CRITERIA])("removing `%s` alone makes exactly that one appear", (missing) => {
    const full: Record<string, string> = {
      visualiser: "viz.html",
      docs: "doc.md",
      skill: "some-skill",
      serialisations: "thing.jsonld",
    };
    delete full[missing];
    const { root, cleanup } = instance(full, {
      realTargets: ["viz.html", "doc.md", "thing.jsonld"],
    });
    const r = auditInstance(root, undefined, { serialisationsProducer: true });
    expect(r.findings.map((f) => f.criterion)).toEqual([missing]);
    // SERIALISATIONS are owed by every declared directory, so a missing one
    // is an unmet obligation rather than an unanswered question. The other
    // three are minor here because this fixture's kind owes none of them.
    expect(r.findings[0]?.severity).toBe(missing === "serialisations" ? "major" : "minor");
    cleanup();
  });
});

describe("declared-but-missing is a different problem from undeclared", () => {
  it("a target that does not resolve is MAJOR, not minor", () => {
    // The distinction is the point: somebody claiming a renderer that is not
    // there is a defect, while nobody having said yet is a backlog item. An
    // axis that merged them would rank a typo alongside 20 unwritten viewers.
    const { root, cleanup } = instance({
      visualiser: "nope.html",
      docs: "doc.md",
      skill: "some-skill",
    });
    const r = auditInstance(root);
    const viz = r.findings.filter((f) => f.criterion === "visualiser");
    expect(viz).toHaveLength(1);
    expect(viz[0]?.severity).toBe("major");
    expect(viz[0]?.detail).toContain("does not resolve");
    // `bsay`: the distinction now has to be readable WITHOUT parsing prose,
    // because the exit rule acts on it. `severity` cannot carry it — both
    // kinds are `major` — which is exactly why `--strict` could not separate
    // them and the 20-item backlog held two broken refs hostage.
    expect(viz[0]?.unmet).toBe("unresolvable");
    cleanup();
  });

  it("an UNDECLARED criterion is tagged `undeclared`, so the two never collapse", () => {
    // The other half of the same assertion. Without it, `unmet` could be the
    // constant "unresolvable" and every test above would still pass while the
    // new exit rule failed the whole backlog.
    const { root, cleanup } = instance({ docs: "doc.md", skill: "some-skill" });
    const viz = auditInstance(root).findings.filter((f) => f.criterion === "visualiser");
    expect(viz).toHaveLength(1);
    expect(viz[0]?.unmet).toBe("undeclared");
    cleanup();
  });

  it("a bare id with no path separator is not reported as a missing file", () => {
    // A skill or tool is named by id, and checking an id against the
    // filesystem would have the axis report "missing" about something it never
    // looked for. Resolving ids is the KG audit's job.
    const { root, cleanup } = instance({
      visualiser: "viz.html",
      docs: "doc.md",
      skill: "library-ingestion",
    });
    const r = auditInstance(root);
    expect(r.findings.map((f) => f.criterion)).not.toContain("skill");
    cleanup();
  });
});

describe("exemption carries a reason and is honoured", () => {
  it("an exempt criterion is not a finding, and its reason is kept", () => {
    const { root, cleanup } = instance(
      {
        docs: "doc.md",
        skill: "s",
        serialisations: "thing.jsonld",
        exempt: { visualiser: "read by an agent at session start; a human page would be pointless" },
      },
      { realTargets: ["doc.md", "thing.jsonld"] },
    );
    const r = auditInstance(root);
    expect(r.findings).toEqual([]);
    expect(r.exempted).toHaveLength(1);
    expect(r.exempted[0]?.criterion).toBe("visualiser");
    expect(r.exempted[0]?.reason).toContain("session start");
    cleanup();
  });

  it("the reason reaches the report — a waiver nobody sees is a silence list", () => {
    const { root, cleanup } = instance(
      {
        docs: "doc.md",
        skill: "s",
        serialisations: "thing.jsonld",
        exempt: { visualiser: "BECAUSE-THIS-STRING" },
      },
      { realTargets: ["doc.md", "thing.jsonld"] },
    );
    expect(formatReport([auditInstance(root)])).toContain("BECAUSE-THIS-STRING");
    cleanup();
  });
});

describe("serialisations take no waiver — harnesses cannot override being in the KG", () => {
  it("a waiver smuggled past the schema is IGNORED, not honoured", () => {
    // `SubgraphCoverageSchema.exempt` has no `serialisations` key, so `tsc`
    // stops this at the type level and a declaration carrying it does not
    // parse. This pins the RUNTIME half: if one ever reached the checker —
    // through a cast, a hand-written JSON file, or a future schema change
    // made without reading the ruling — it must still not suppress the
    // finding. The owner, 2026-09-20: "harnesses cannot override there being
    // in the KG."
    const { root, cleanup } = instance(
      {
        visualiser: "viz.html",
        docs: "doc.md",
        skill: "s",
        exempt: { serialisations: "we would rather not" },
      } as unknown,
      { realTargets: ["viz.html", "doc.md"] },
    );
    const r = auditInstance(root, undefined, { serialisationsProducer: true });
    expect(r.findings.map((f) => f.criterion)).toEqual(["serialisations"]);
    expect(r.findings[0]?.severity).toBe("major");
    // And it is not quietly filed as an exemption either.
    expect(r.exempted.map((e) => e.criterion)).not.toContain("serialisations");
    cleanup();
  });
});

describe("bootstrap's exemption is by layer, and is a second criterion not a hole", () => {
  it("bootstrap is never asked for a visualiser", () => {
    const { root, cleanup } = instance(undefined, { name: "bootstrap" });
    const r = auditInstance(root, undefined, { serialisationsProducer: true });
    // `serialisations` is present even here, and that is the ruling rather
    // than an oversight: bootstrap is excused a visualiser precisely because
    // its json/jsonld "is its existence", so it cannot be excused that.
    expect(r.findings.map((f) => f.criterion).sort()).toEqual(["docs", "serialisations", "skill"]);
    cleanup();
  });

  it("any other instance with the same shape IS asked", () => {
    const { root, cleanup } = instance(undefined, { name: "not-bootstrap" });
    const r = auditInstance(root, undefined, { serialisationsProducer: true });
    expect(r.findings.map((f) => f.criterion).sort()).toEqual([
      "docs", "serialisations", "skill", "visualiser",
    ]);
    cleanup();
  });

  it("the exemption is announced in the report rather than applied silently", () => {
    const { root, cleanup } = instance(undefined, { name: "bootstrap" });
    expect(formatReport([auditInstance(root)])).toContain("exempt from `visualiser`");
    cleanup();
  });

  it("is keyed on the instance NAME, so a relocation keeps it", () => {
    expect(VISUALISER_EXEMPT_INSTANCES.has("bootstrap")).toBe(true);
    expect(VISUALISER_EXEMPT_INSTANCES.has("cat-harness")).toBe(false);
  });

  it("AT LEAST ONE exempt name matches a real instance — a rename must not revoke it", () => {
    // The failure this pins actually happened: `bootstrap` was renamed to
    // `bootstrap` on main while this branch was open. A set holding only
    // the old name matches nothing, the owner's exemption silently stops
    // firing, and the only symptom is one extra minor finding among fifty.
    // Asserting against the layers discovery really finds turns that
    // silence into a failure.
    const repo = resolve(import.meta.dir, "..", "..", "..");
    const real = realAuditAll(repo).map((r) => r.instance);
    const matched = [...VISUALISER_EXEMPT_INSTANCES].filter((n) => real.includes(n));
    expect(matched.length).toBeGreaterThan(0);
  }, CORPUS_TIMEOUT);
});

describe("an unmet OBLIGATION outranks an unanswered question", () => {
  // The owner, 2026-09-20: a directory a layer declares or initiates and
  // writes to — `beans/`, `todos/`, `fsh-guts/` — owes a visualiser "as
  // requiement of handler". So a missing one there is a promise unkept, not a
  // question nobody has answered, and the axis has to rank them apart.

  it("a kind that OWES a visualiser and has none is MAJOR", () => {
    const { root, cleanup } = instance(
      { docs: "doc.md", skill: "some-skill" },
      { realTargets: ["doc.md"], graphTypologies: ["beans"] },
    );
    const viz = auditInstance(root).findings.filter((f) => f.criterion === "visualiser");
    expect(viz).toHaveLength(1);
    expect(viz[0]?.severity).toBe("major");
    expect(viz[0]?.detail).toContain("owes one");
    cleanup();
  });

  it("a SELF-RENDERING kind with none is minor — it never owed one", () => {
    // `docs` is `renderable`, so its pages ARE the view. Reporting it as an
    // unmet obligation would demand a second rendering of the same thing.
    const { root, cleanup } = instance(
      { docs: "doc.md", skill: "some-skill" },
      { realTargets: ["doc.md"], graphTypologies: ["docs"] },
    );
    const viz = auditInstance(root).findings.filter((f) => f.criterion === "visualiser");
    expect(viz).toHaveLength(1);
    expect(viz[0]?.severity).toBe("minor");
    cleanup();
  });

  it("the obligation does NOT key on `holds`, because fsh-guts moved category", () => {
    // The load-bearing case, and the one that falsified the first design.
    // "holds: state owes a visualiser" covers beans and todos and MISSES
    // `fsh-guts`, which the owner names in the same sentence — `mhh9`
    // reclassified it from `state` to `context` the same day. A rule derived
    // from `holds` would have silently stopped requiring it.
    //
    // Asserted together so the pair cannot drift: both owe one, and they do
    // not share a `holds` value.
    for (const kind of ["beans", "fsh-guts"]) {
      const { root, cleanup } = instance(
        { docs: "doc.md", skill: "some-skill" },
        { realTargets: ["doc.md"], graphTypologies: [kind] },
      );
      const viz = auditInstance(root).findings.filter((f) => f.criterion === "visualiser");
      expect({ kind, severity: viz[0]?.severity }).toEqual({ kind, severity: "major" });
      cleanup();
    }
  });

  it("an UNKNOWN kind owes one by default — tested on the function, not a fixture", () => {
    // Tested directly because it cannot be reached through a declaration: the
    // schema rejects an unregistered graph typology, so `auditInstance` never sees
    // one. The branch is still the load-bearing default — a kind nobody has
    // classified must not escape the obligation by being unmentioned — and a
    // test routed through a fixture would have quietly asserted nothing.
    expect(owesVisualiser("a-kind-invented-for-this-test")).toBe(true);
  });

  it("the three layers land where the owner's parenthetical puts them", () => {
    // "not part of the static KG" is the discriminator, so `content` is the
    // only layer exempt. Asserted as a table so a kind changing layer shows up
    // here rather than as a severity that quietly moved.
    expect({
      state: owesVisualiser("beans"),
      context: owesVisualiser("fsh-guts"),
      derived: owesVisualiser("library"),
      content: owesVisualiser("schemas"),
      renderable: owesVisualiser("docs"),
    }).toEqual({ state: true, context: true, derived: true, content: false, renderable: false });
  });

  it("a RENDERABLE kind is exempt even when it is not content", () => {
    // Found by a surviving mutation: deleting the `renderable` branch broke
    // nothing, because every renderable kind today is ALSO `holds: "content"`
    // and the second check covered for the first. A branch no test can reach
    // is a claim nobody has checked, so this builds the case that separates
    // them — a renderable kind that is not content — rather than leaving the
    // line as untested intent.
    const registry = new GraphTypologyRegistry({
      "live-board": {
        renderable: true,
        holds: "state",
        summary: "A state graph that renders itself. Hypothetical, and the point.",
      },
    });
    // Exempt because it renders itself, NOT because of its layer: `state`
    // would otherwise owe one, which is what makes this case discriminating.
    expect(owesVisualiser("live-board", registry)).toBe(false);
    expect(owesVisualiser("beans")).toBe(true);
  });

  it("a declared visualiser that resolves is not a finding, whatever the kind owes", () => {
    // Vacuity guard. Without it, a bug making every visualiser finding major
    // would pass all four tests above.
    const { root, cleanup } = instance(
      { visualiser: "viz.html", docs: "doc.md", skill: "some-skill", serialisations: "thing.jsonld" },
      { realTargets: ["viz.html", "doc.md", "thing.jsonld"], graphTypologies: ["beans"] },
    );
    expect(auditInstance(root).findings.filter((f) => f.criterion === "visualiser")).toHaveLength(0);
    cleanup();
  });
});

describe("could not determine is never a clean run", () => {
  it("an unreadable declaration is undetermined, not zero findings", () => {
    const base = mkdtempSync(join(tmpdir(), "coverage-bad-"));
    const root = join(base, "broken");
    mkdirSync(root, { recursive: true });
    writeDeclaration(root, "{ not json", "broken");
    const r = auditInstance(root);
    expect(r.verdict).toBe("undetermined");
    expect(r.reason).toBeDefined();
    expect(formatReport([r])).toContain("not a clean run");
    rmSync(base, { recursive: true, force: true });
  });
});

describe("this repository", () => {
  it("is audited across every instance discovery finds", () => {
    // Against the REAL repo, like `layerRootsIn`'s own test: a fixture
    // would keep passing if the axis silently stopped seeing a layer.
    const repo = resolve(import.meta.dir, "..", "..", "..");
    const rs = realAuditAll(repo);
    expect(rs.map((r) => r.instance)).toContain("cat-harness");
    expect(rs.map((r) => r.instance)).toContain("bootstrap");
    expect(rs.every((r) => r.verdict === "checked")).toBe(true);
  }, CORPUS_TIMEOUT);
});

describe("every instance needs a starting README OF ITS OWN (bean `ie9l`)", () => {
  const decl = (assets: unknown) => ({ assets }) as Parameters<typeof readmeFinding>[1];

  it("an instance with its own instance-readme is clean", () => {
    const base = mkdtempSync(join(tmpdir(), "readme-"));
    writeFileSync(join(base, "README.md"), "#");
    expect(
      readmeFinding(base, decl([{ role: "instance-readme", src: "README.md" }]), false),
    ).toBeUndefined();
    rmSync(base, { recursive: true, force: true });
  });

  it("declaring no instance-readme at all is MAJOR", () => {
    const r = readmeFinding("/nowhere", decl([]), false);
    expect(r?.severity).toBe("major");
    expect(r?.detail).toContain("What this instance IS, for a reader");
  });

  it("BORROWING the repository's README is MAJOR — the case check-declared-assets cannot see", () => {
    // That gate verifies an asset RESOLVES, and a repository-scoped README
    // resolves perfectly. What is wrong is that one file is doing two jobs,
    // which is a question about ownership rather than existence.
    const r = readmeFinding(
      "/repo/cat-harness",
      decl([{ role: "instance-readme", src: "README.md", scope: "repository" }]),
      false,
    );
    expect(r?.severity).toBe("major");
    expect(r?.detail).toContain("two jobs");
  });

  it("...but the repository ROOT may legitimately own the repository's README", () => {
    // The falsifier for the rule above: if it fired on the root too, the check
    // would be demanding every layer avoid a file only one of them can own.
    const base = mkdtempSync(join(tmpdir(), "readme-root-"));
    writeFileSync(join(base, "README.md"), "#");
    expect(
      readmeFinding(base, decl([{ role: "instance-readme", src: "README.md", scope: "repository" }]), true),
    ).toBeUndefined();
    rmSync(base, { recursive: true, force: true });
  });

  it("a declared README that is not on disk is MAJOR", () => {
    const base = mkdtempSync(join(tmpdir(), "readme-gone-"));
    const r = readmeFinding(base, decl([{ role: "instance-readme", src: "README.md" }]), false);
    expect(r?.severity).toBe("major");
    expect(r?.detail).toContain("not there");
    rmSync(base, { recursive: true, force: true });
  });

  it("this repository has no README offender left", () => {
    // It had exactly two — the root declared no assets at all, and cat-harness
    // borrowed the root's README. Issue #592 split them, so every layer now
    // owns its own. Asserted as EMPTY rather than deleted: a list that went to
    // zero and a check that stopped looking are indistinguishable from a
    // deleted test, and this is the fix's only durable witness.
    const repo = resolve(import.meta.dir, "..", "..", "..");
    const offenders = realAuditAll(repo).filter((r) => r.readme !== undefined).map((r) => r.instance);
    expect(offenders.sort()).toEqual([]);
  }, CORPUS_TIMEOUT);

  it("the AGENT half is asked about too, and no instance is mute any more", () => {
    // Measured 2026-09-20 when the criterion was added: ten of eleven
    // layers declared `instance-readme` and TWO declared
    // `agent-instructions`. Eight were readable by a person and mute to an
    // agent — including `folio-assistant-core`, which HAD an AGENTS.md on disk
    // and did not declare it (a finding, not an exemption: an undeclared file
    // is one no checker has a reason to look at — the `v8gh` property).
    //
    // All eight were written and declared. Asserted as EMPTY rather than
    // deleted, for the same reason as the README list above: a list that went
    // to zero and a check that stopped looking are indistinguishable once the
    // assertion is gone, and this is the fix's only durable witness.
    const repo = resolve(import.meta.dir, "..", "..", "..");
    const mute = realAuditAll(repo).filter((r) => r.agentInstructions !== undefined).map((r) => r.instance);
    expect(mute.sort()).toEqual([]);
  }, CORPUS_TIMEOUT);
});

describe("the own-docs axis — an instance owes documentation of its own", () => {
  // Bean `op30`. `<instance>/docs/` is the layer's SOURCE documentation. A
  // handler's rendering of a subject — `<base>/cat-harness/docs/<subject>/` —
  // is documentation ABOUT that subject, and an axis that conflated the two
  // would pass a repository where half the documentation is missing.

  /**
   * A REAL layer root — with a declaration, so `siteDirFor` resolves.
   *
   * A bare temp directory is not a weaker fixture, it is a different case:
   * `siteDirFor` throws on one, which is the UNKNOWN state rather than the
   * missing-docs state. Both are exercised, separately and on purpose.
   */
  function inst(opts: { docs?: boolean } = {}): string {
    const root = mkdtempSync(join(tmpdir(), "op30-"));
    writeDeclaration(root, JSON.stringify({ name: "probe", directories: [] }));
    // `siteDirFor`, not the literal — the same rule the code under test
    // follows, and the guard that fires on the string does not exempt tests.
    if (opts.docs) mkdirSync(join(root, siteDirFor(root)), { recursive: true });
    return root;
  }

  it("reports an instance with no docs/ of its own", () => {
    const f = ownDocsFinding(inst(), {});
    expect(f?.severity).toBe("minor");
    expect(f?.detail).toContain("no `docs/` of its own");
  });

  it("says nothing about an instance that has one", () => {
    expect(ownDocsFinding(inst({ docs: true }), {})).toBeUndefined();
  });

  it("is MINOR, never major — it fires on most of the corpus on the day it lands", () => {
    // The severity is the staging. A check that fires on ten of twelve
    // subjects as a defect is one people learn to skim, and then the real
    // finding beside it goes unread too.
    expect(ownDocsFinding(inst(), {})?.severity).toBe("minor");
  });

  it("honours a declared exemption, and reads it from the DECLARATION", () => {
    // Never from an instance-name literal in the checker — the rule that kept
    // bootstrap's visualiser exemption alive through a rename.
    const exempt = {
      renderExemption: {
        of: ["own-docs" as const],
        reason: "the floor layer documents itself in its json/jsonld",
        owes: "bootstrap.jsonld",
      },
    };
    expect(ownDocsFinding(inst(), exempt)).toBeUndefined();
  });

  it("an exemption from a DIFFERENT obligation does not excuse this one", () => {
    const other = {
      renderExemption: {
        of: ["visualiser" as const],
        reason: "it is the navbar footer",
        owes: "bootstrap.jsonld",
      },
    };
    expect(ownDocsFinding(inst(), other)).toBeDefined();
  });

  it("an instance with no declaration ARGUMENT is still asked the question", () => {
    // `undefined` is not an exemption. A layer that declares nothing has
    // not been excused; it has said nothing.
    expect(ownDocsFinding(inst(), undefined)).toBeDefined();
    expect(ownDocsFinding(inst({ docs: true }), undefined)).toBeUndefined();
  });

  it("an UNRESOLVABLE site root is reported as unknown, never as satisfied", () => {
    // The third state, and the one the first draft got wrong: it returned
    // `undefined` on the throw, which reads as "has documentation". A bare
    // directory has no declaration, so `siteDirFor` cannot answer — and
    // "cannot answer" is not "yes".
    const bare = mkdtempSync(join(tmpdir(), "op30-bare-"));
    const f = ownDocsFinding(bare, {});
    expect(f).toBeDefined();
    expect(f?.detail).toContain("UNKNOWN");
    expect(f?.detail).not.toContain("has no `docs/` of its own");
  });

  it("is reported as its own line, separate from the README axis", () => {
    // They were argued for as separate because the satisfying sets were
    // disjoint. Measured 2026-09-21 they are not — every layer declares a
    // README, so docs is a strict subset. They stay separate for the reason
    // that survives: "can a reader enter" and "is there anything to read once
    // inside" are different questions.
    // The shared audit, with the corpus budget: this test ran its own
    // `auditAll` under bun's 5 s default, the coin-flip `lpcs` removed from
    // the others (it went red on cat-harness-tools#451, which made the audit a
    // little slower).
    const report = formatReport(realAuditAll(resolve(".")));
    expect(report).toContain("no `docs/` OF THEIR OWN");
    expect(report).toContain("advisory, not gated");
  }, CORPUS_TIMEOUT);
});


describe("coverage.* resolves against the REPOSITORY root and nothing else — bean `yt7j`", () => {
  // The owner's ruling of 2026-09-21. Before it, `targetExists` tried the
  // layer root and fell back to the repository root, accepting either —
  // which reads as tolerance and is the opposite: a path incorrect in its
  // declared base passed anyway through the other, so the axis could not
  // enforce the convention its own schema documents.

  it("a target at the repository root resolves", () => {
    const { root, cleanup } = instance({ visualiser: "viz.html" }, { realTargets: ["viz.html"] });
    expect(auditInstance(root).findings.filter((f) => f.criterion === "visualiser")).toEqual([]);
    cleanup();
  });

  it("THE FALSIFICATION: a target that exists ONLY under the instance is a finding", () => {
    // The fallback's removal has to be provable, not asserted. This fixture
    // plants the file where the old code would have found it and nowhere else;
    // if the layer root is still being tried, this test goes green and says
    // nothing.
    const base = mkdtempSync(join(tmpdir(), "coverage-inst-only-"));
    const root = join(base, "inst");
    mkdirSync(join(root, "thing"), { recursive: true });
    writeFileSync(join(root, "viz.html"), "x"); // under the LAYER, not the repo
    writeDeclaration(root, JSON.stringify({
        name: "inst",
        directories: [
          {
            id: "thing",
            path: "thing/",
            graphTypologies: ["cat-harness"],
            coverage: { visualiser: "viz.html" },
          },
        ],
      }));
    const viz = auditInstance(root).findings.filter((f) => f.criterion === "visualiser");
    expect(viz).toHaveLength(1);
    expect(viz[0]?.severity).toBe("major");
    expect(viz[0]?.detail).toContain("does not resolve");
    rmSync(base, { recursive: true, force: true });
  });

  it("resolveCoveragePath composes from the root it is handed, and checks nothing", () => {
    // It does not verify existence on purpose: a caller asking "does this
    // resolve" needs to say WHERE it looked, and folding the question in here
    // would hand every consumer a bare boolean instead.
    expect(resolveCoveragePath("/repo", "cat-harness/docs/x.html")).toBe(
      "/repo/cat-harness/docs/x.html",
    );
    expect(resolveCoveragePath("/repo/", "a/b.md")).toBe("/repo/a/b.md");
  });

  it("a governing skill is found by its declaration, never looked up as a path", () => {
    // The skill names the kind it governs (#1168 B7b); nothing about it is a
    // path, so "missing" here would be the axis lying about what it looked at.
    const { root, cleanup } = instance({ skill: "some-skill" });
    expect(auditInstance(root).findings.filter((f) => f.criterion === "skill")).toEqual([]);
    cleanup();
  });
});

describe("the repository root is recognised as itself — bean `yt7j`", () => {
  // `isRoot` was `resolve(root) === resolve(repoRootFor(root))`: a directory
  // compared with its own PARENT, equal only at the filesystem root. So the
  // guard "the repository root legitimately owns the repository's files" could
  // never fire for the one layer it exists for. Latent rather than visible
  // — this repository's root declaration carries no `scope: "repository"`
  // asset today — which is exactly why it needs a test rather than a sighting.

  /** A layer declaring one asset, optionally repository-scoped. */
  function withAsset(scope: string | undefined): { root: string; cleanup: () => void } {
    const base = mkdtempSync(join(tmpdir(), "coverage-root-"));
    const root = join(base, "inst");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "README.md"), "x");
    writeDeclaration(root, JSON.stringify({
        name: "inst",
        directories: [],
        assets: [
          { id: "inst-readme", role: INSTANCE_README_ROLE, src: "README.md", ...(scope ? { scope } : {}) },
        ],
      }));
    return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
  }

  it("an instance BELOW the root borrowing a repository-scoped asset is a finding", () => {
    const { root, cleanup } = withAsset("repository");
    const r = auditInstance(root, join(root, ".."));
    expect(r.readme?.severity).toBe("major");
    expect(r.readme?.detail).toContain("one file doing two jobs");
    cleanup();
  });

  it("the repository root declaring the same asset is NOT a finding", () => {
    // The whole point of the guard, and what the broken formula suppressed.
    const { root, cleanup } = withAsset("repository");
    expect(auditInstance(root, root).readme).toBeUndefined();
    cleanup();
  });

  it("an unscoped asset is fine either way, which is why this stayed latent", () => {
    const { root, cleanup } = withAsset(undefined);
    expect(auditInstance(root, root).readme).toBeUndefined();
    expect(auditInstance(root, join(root, "..")).readme).toBeUndefined();
    cleanup();
  });
});


describe("this repository declares nothing that fails to resolve — bean `bsay`", () => {
  const repo = resolve(".");

  it("no declaration in this repository points at a missing target", () => {
    // The ratchet. Two were broken when this landed and both were the same
    // shape — an id renamed, and a `coverage.visualiser` ref keyed on the id
    // left behind: `skills` still named `…/index/skills/cat-harness/` after
    // `iwtn` renamed that id from `cat-harness`, and `swimlane-glossary` named
    // `…/glossary/glossary/`. Both were REPORTED the whole time and the check
    // exited 0, because `--strict` fails on the 20-item `undeclared` backlog
    // too and so could not be turned on.
    const unresolvable = realAuditAll(repo)
      .flatMap((r) => r.findings.filter((f) => f.unmet === "unresolvable"))
      .map((f) => `${f.instance}/${f.directory}/${f.criterion}: ${f.detail}`);
    expect(unresolvable).toEqual([]);
  }, CORPUS_TIMEOUT);

  it("and the check is still REPORTING findings, so the line above is not vacuous", () => {
    // Without this, an `auditAll` that returned nothing at all would satisfy
    // the assertion above — the failure mode an advisory axis is most likely
    // to have, as this file's own header says.
    const undeclared = realAuditAll(repo).flatMap((r) => r.findings.filter((f) => f.unmet === "undeclared"));
    expect(undeclared.length).toBeGreaterThan(0);
  }, CORPUS_TIMEOUT);
});

/**
 * `coverage.process` — asked ONLY of a directory that declares one.
 *
 * The falsifier here is the mirror of the bean's: declaring nothing must NOT
 * appear, and declaring a name that resolves to nothing must. An axis that
 * reported the first would put every directory in the report, which is the
 * wall this check's own header says somebody switches off.
 *
 * Fixture layers in a temporary directory; nothing walks the real corpus.
 */
function processInstance(opts: { process?: string; withDiagram?: boolean }): {
  root: string;
  cleanup: () => void;
} {
  const base = mkdtempSync(join(tmpdir(), "coverage-process-"));
  const root = join(base, "inst");
  mkdirSync(join(root, "thing"), { recursive: true });
  mkdirSync(join(root, "processes"), { recursive: true });
  if (opts.withDiagram) {
    writeFileSync(
      join(root, "processes", "demo-flow.bpmn"),
      `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn:process id="Process_Demo" name="Demo flow" />
</bpmn:definitions>
`,
    );
  }
  writeDeclaration(
    root,
    JSON.stringify({
      name: "inst",
      directories: [
        { id: "processes", path: "processes/", graphTypologies: ["processes"] },
        {
          id: "thing",
          path: "thing/",
          graphTypologies: ["cat-harness"],
          ...(opts.process === undefined ? {} : { coverage: { process: opts.process } }),
        },
      ],
    }),
  );
  return { root, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

describe("coverage.process is a declared-only criterion", () => {
  it("declaring NO process is not a finding — a directory owes none", () => {
    const { root, cleanup } = processInstance({});
    expect(auditInstance(root).findings.map((f) => f.criterion)).not.toContain("process");
    cleanup();
  });

  it("declaring one that resolves is not a finding either", () => {
    const { root, cleanup } = processInstance({ process: "demo-flow", withDiagram: true });
    expect(auditInstance(root).findings.map((f) => f.criterion)).not.toContain("process");
    cleanup();
  });

  it("declaring one that names no diagram is MAJOR and `unresolvable`", () => {
    const { root, cleanup } = processInstance({ process: "demo-flow", withDiagram: false });
    const f = auditInstance(root).findings.filter((x) => x.criterion === "process");
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("major");
    expect(f[0]?.unmet).toBe("unresolvable");
    cleanup();
  });

  it("the message names the DIRECTORY and the PROCESS, so the repair is locatable", () => {
    const { root, cleanup } = processInstance({ process: "demo-flow", withDiagram: false });
    const f = auditInstance(root).findings.find((x) => x.criterion === "process")!;
    expect(f.directory).toBe("thing");
    expect(f.detail).toContain("demo-flow");
    expect(f.detail).toContain("thing/");
    cleanup();
  });
});

describe("only a node-graph kind owes serialisations (owner, Q-SER-2 A, 2026-11-12)", () => {
  // The kinds named in the ruling, classified as the layers that declare them
  // do. A registry of its own, because several are declared above this layer
  // and the default registry is whatever the checkout mounts.
  const registry = new GraphTypologyRegistry({
    attestations: { renderable: false, holds: "state", summary: "Attestation records: a store's running state." },
    "todo-items": { renderable: false, holds: "state", summary: "Todo items: a store's running state." },
    "public-comments": { renderable: false, holds: "state", summary: "Public comments: a store's running state." },
    code: { renderable: false, holds: "content", serialised: false, summary: "Source code." },
    docs: { renderable: true, holds: "content", serialised: false, summary: "Built documentation pages." },
    glossary: { renderable: false, holds: "content", summary: "Glossary terms: graph nodes." },
  });

  it.each([
    ["attestations (state)", ["attestations"], false],
    ["id-lookup (code)", ["code"], false],
    ["docs (built pages)", ["docs"], false],
    ["glossary (a node graph)", ["glossary"], true],
    ["an unregistered kind", ["no-such-kind"], true],
    ["[todo-items, public-comments] (both state)", ["todo-items", "public-comments"], false],
    ["[state, content]: one kind owes, so the directory owes", ["attestations", "glossary"], true],
  ] as const)("%s", (_label, kinds, owes) => {
    expect(directoryOwesSerialisations(kinds, registry)).toBe(owes);
  });

  it("the kind's own `serialised` flag wins over `holds`", () => {
    const r = new GraphTypologyRegistry({
      "state-graph": { renderable: false, holds: "state", serialised: true, summary: "A state kind whose files are nodes." },
      "content-code": { renderable: false, holds: "content", serialised: false, summary: "Content that is not nodes." },
    });
    expect(owesSerialisations("state-graph", r)).toBe(true);
    expect(owesSerialisations("content-code", r)).toBe(false);
  });

  it("the base registry marks code, built pages, caches, fixtures and snapshots as not serialised", () => {
    for (const k of ["code", "docs", "cache", "test-data-fixed", "test-data-generated", "auto-docs", "basic-cdn-site", "cdn-site", "substrate-snapshot"]) {
      expect(owesSerialisations(k)).toBe(false);
    }
  });

  function dirOf(kinds: string[], serialisationsProducer = true): ReturnType<typeof auditInstance> {
    const { root, cleanup } = instance(undefined, { graphTypologies: kinds });
    try {
      return auditInstance(root, undefined, { serialisationsProducer });
    } finally {
      cleanup();
    }
  }

  it("the checker: a state directory, a code directory and a docs directory owe nothing", () => {
    for (const kinds of [["attestations"], ["code"], ["docs"], ["todo-items", "beans"]]) {
      const r = dirOf(kinds);
      expect(r.findings.map((f) => f.criterion)).not.toContain("serialisations");
      expect(r.serialisationsNotOwed).toEqual(["thing"]);
      // Not owed is the kind's answer, not a waiver.
      expect(r.exempted.map((e) => e.criterion)).not.toContain("serialisations");
    }
  });

  // An unregistered kind never reaches the checker (the declaration is
  // refused as unreadable), so it is pinned above, against the registry.
  it("the checker: a content kind, or [state, content], still owes, and it is major", () => {
    for (const kinds of [["cat-harness"], ["attestations", "cat-harness"]]) {
      const r = dirOf(kinds);
      const f = r.findings.find((x) => x.criterion === "serialisations");
      expect(f?.severity).toBe("major");
      expect(f?.detail).toContain("every directory of a node-graph kind owes");
      expect(r.serialisationsNotOwed ?? []).toEqual([]);
    }
  });

  // No layer declares a producer: the obligation is listed, not reported as a
  // finding per directory (owner, card "collab gate" B, 2026-11-13).
  it("the checker: with no producer anywhere, an owing directory AWAITS one — listed, not a finding, not waived", () => {
    const r = dirOf(["cat-harness"], false);
    expect(r.findings.map((f) => f.criterion)).not.toContain("serialisations");
    expect(r.serialisationsAwaitingProducer).toEqual(["thing"]);
    expect(r.exempted.map((e) => e.criterion)).not.toContain("serialisations");
    expect(r.serialisationsNotOwed ?? []).toEqual([]);
  });

  it("the checker: a directory not owed is not awaiting a producer either", () => {
    expect(dirOf(["code"], false).serialisationsAwaitingProducer).toEqual([]);
  });

  it("the report: awaiting directories are ONE line with no ✗, so a new directory adds no diagnostic", () => {
    const one = formatReport([dirOf(["cat-harness"], false)]);
    expect(one).toContain("1 director(ies) owe serialisations and declare none, and no layer declares a producer yet");
    expect(one).not.toContain("/ serialisations");
    expect(one.split("\n").filter((l) => l.trim().startsWith("✗") && l.includes("serialisations"))).toEqual([]);
  });

  it("the producer is read from the checkout: any directory declaring coverage.serialisations", () => {
    const none = instance(undefined);
    const some = instance({ serialisations: "scripts/gen.ts" }, { realTargets: ["inst/scripts/gen.ts"] });
    try {
      expect(serialisationsProducerDeclared(dirname(none.root))).toBe(false);
      expect(serialisationsProducerDeclared(dirname(some.root))).toBe(true);
      // Once a producer exists, an undeclared owing directory is a finding again.
      expect(auditInstance(none.root, undefined, { serialisationsProducer: true }).findings.map((f) => f.criterion)).toContain(
        "serialisations",
      );
    } finally {
      none.cleanup();
      some.cleanup();
    }
  });

  it("the report counts the directories not owed", () => {
    expect(formatReport([dirOf(["attestations"])])).toContain("1 director(ies) not owed serialisations (state, code or pages)");
  });
});
