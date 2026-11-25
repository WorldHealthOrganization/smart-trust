/**
 * `kg:materialize` (issue #1719, epic bean `fnx4`, slices 5 and 6): one
 * chosen subgraph, or one asset, of a subscribed substrate, copied at the pin
 * through the five gates. Every test runs over fixtures through the injectable
 * fetcher — no network.
 *
 * Here rather than in `cat-harness-tools/scripts/tests/`, because the writer embeds
 * core's `MaterializationSchema`; a cat-harness test importing it would be the
 * wrong-direction edge the writer's placement avoids.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { judgeDeclaration, partRecordsIn, SNAPSHOT_SUFFIX, treeDigest } from "@litlfred/cat-harness-tools/scripts/kg-subscribe.ts";
import { partState, render, subscriptionCards } from "@litlfred/cat-harness-tools/scripts/subscriptions-viz.ts";
import { SUBSTRATE_SNAPSHOT_SCHEMA } from "@litlfred/cat-harness-tools/schemas/kg/substrate-snapshot.ts";
import { KgMaterializationRecordSchema, KgNodesRecordSchema, type KgDecisions } from "../schemas/kg-materialization.ts";
import { MaterializationSchema } from "../schemas/materialization.ts";
import { run as fixityRun } from "./check-materialized-fixity.ts";
import { checkMaterializations, materialize, materializeNodes, sizeGate, type FetchedPart, type PartFetcher } from "./kg-materialize.ts";
import { fetchSubgraphIndex, packSubgraphIndex, type SubgraphIndexFetch } from "@litlfred/cat-harness-tools/scripts/subgraph-index-package.ts";
import { overlayPath } from "@litlfred/cat-harness-tools/scripts/lib/layer-output.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const SHA2 = "89abcdef0123456789abcdef0123456789abcdef";

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}

const SUBSTRATE = {
  name: "ihris-kb",
  title: "iHRIS Knowledge Base",
  directories: [
    { id: "kb", path: "kb/", graphTypologies: ["folio"] },
    { id: "kb-skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "library", path: "library/", graphTypologies: ["library"] },
  ],
};

/** The substrate's whole tree at the pin. */
const UPSTREAM: Record<string, string> = {
  "LICENSE": "MIT License\n\nCopyright (c) iHRIS\n",
  "ihris-kb.json": JSON.stringify(SUBSTRATE),
  "kb/intro.md": "# iHRIS\n\nA knowledge base.\n",
  "kb/nested/deep.md": "deep\n",
  // Upstream's OWN materialization record: describes upstream's checkout, and
  // must never be read by check:materialized-fixity as a claim about ours.
  "kb/catalogue/node.json": JSON.stringify({ id: "n1", materialization: { state: "materialized", localPath: "library/x.pdf", fixity: { algorithm: "sha256", digest: "0".repeat(64) } } }),
  "skills/hello.md": "---\nname: hello\n---\nSay hello.\n",
  "library/report/report.pdf": "%PDF-1.4 fake bytes\n",
  "outside/x.txt": "not part of the graph\n",
};

/** A fetcher over {@link UPSTREAM}, counting calls. */
function fixture(files: Record<string, string> = UPSTREAM, extra: Partial<FetchedPart> = {}): PartFetcher & { calls: number } {
  const serve = (_repo: string, _ref: string, path: string): FetchedPart | undefined => {
    f.calls++;
    const isFile = path in files;
    const under = Object.keys(files).filter((k) => k.startsWith(`${path}/`));
    if (!isFile && under.length === 0) return undefined;
    const root = mkdtempSync(join(tmpdir(), "kg-mat-fx-"));
    const part = join(root, "part");
    mkdirSync(part);
    if (isFile) writeFileSync(join(part, path.split("/").pop()!), files[path]!);
    for (const k of under) {
      const dst = join(part, k.slice(path.length + 1));
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, files[k]!);
    }
    let licence: FetchedPart["licence"];
    if (files["LICENSE"]) {
      writeFileSync(join(root, "LICENSE"), files["LICENSE"]);
      licence = { name: "LICENSE", file: join(root, "LICENSE"), upstreamPath: "LICENSE" };
    }
    return { kind: isFile ? "blob" : "tree", root, part, ...(licence ? { licence } : {}), collectionFiles: Object.keys(files).length, ...extra };
  };
  const f = Object.assign(serve, { calls: 0 });
  return f;
}

interface Sub {
  id?: string;
  ref?: string;
  subgraphs?: string[];
  assets?: { policy: "none" | "on-demand" | "all" };
}

/** A checkout holding one subscriber layer, with a cached snapshot at the pin. */
function checkout(sub: Sub = {}, opts: { snapshotRef?: string; substrate?: { file: string; raw: string } } = {}): { repo: string; inst: string; snapDir: string; decl: string } {
  const repo = tmp("kg-mat-repo-");
  const inst = join(repo, "example");
  mkdirSync(inst);
  const entry = { id: "ihris-kb", repository: "litlfred/ihris-kb", ref: SHA, ...sub };
  const decl = join(inst, "example.json");
  writeFileSync(
    decl,
    `${JSON.stringify(
      {
        name: "example",
        livesAt: { repository: "litlfred/example", path: "." },
        directories: [{ id: "subscriptions", path: "subscriptions/", dependents: "skip", graphTypologies: ["substrate-snapshot"] }],
        subscriptions: [entry],
      },
      null,
      2,
    )}\n`,
  );
  const snapDir = join(inst, "subscriptions");
  mkdirSync(snapDir);
  const substrateFile = opts.substrate?.file ?? "ihris-kb.json";
  const raw = opts.substrate?.raw ?? UPSTREAM["ihris-kb.json"]!;
  const v = judgeDeclaration(substrateFile, raw);
  if (v.state !== "substrate") throw new Error("fixture substrate does not judge");
  writeFileSync(
    join(snapDir, `${entry.id}${SNAPSHOT_SUFFIX}`),
    `${JSON.stringify(
      {
        $schema: SUBSTRATE_SNAPSHOT_SCHEMA,
        subscription: entry.id,
        repository: entry.repository,
        ref: opts.snapshotRef ?? entry.ref,
        file: substrateFile,
        raw,
        fixity: { algorithm: "sha256", digest: createHash("sha256").update(raw).digest("hex") },
        summary: v.summary,
      },
      null,
      2,
    )}\n`,
  );
  return { repo, inst, snapDir, decl };
}

const permit = (basis: string) => ({ verdict: "permitted" as const, basis, decidedAt: "2026-10-01" });
const DECISIONS: KgDecisions = {
  purpose: "archival",
  decidedBy: "the subscriber (test)",
  gates: {
    restrictions: permit("public repository, no restriction stated"),
    copyright: permit("MIT, notice copied beside the tree"),
    retention: permit("archival: kept until the pin moves"),
    sourceLoss: permit("this copy of the original bytes is the answer"),
  },
};
const NOW = new Date("2026-10-01T12:00:00Z");

function setSubscription(decl: string, patch: Record<string, unknown>): void {
  const d = JSON.parse(readFileSync(decl, "utf8"));
  d.subscriptions[0] = { ...d.subscriptions[0], ...patch };
  writeFileSync(decl, `${JSON.stringify(d, null, 2)}\n`);
}

describe("refused before any byte moves, with the reason", () => {
  test("refusesUnknownSubscription", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "nope", subgraph: "kb", decisions: DECISIONS, fetch: f });
    expect(r.state).toBe("refused");
    expect(r.state === "refused" && r.reason).toMatch(/no subscription `nope`/);
    expect(f.calls).toBe(0);
  });
  test("refusesUnchosenSubgraph", async () => {
    const { inst, snapDir } = checkout({ subgraphs: ["kb"] });
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb-skills", decisions: DECISIONS, fetch: f });
    expect(r.state).toBe("refused");
    expect(r.state === "refused" && r.reason).toMatch(/not chosen.*add it to `subscriptions\[\]\.subgraphs`/);
    expect(f.calls).toBe(0);
    expect(existsSync(join(snapDir, "ihris-kb"))).toBe(false);
  });
  test("refusesUndeclaredChosenSubgraph", async () => {
    const { inst } = checkout({ subgraphs: ["kb", "ghost"] });
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "ghost", decisions: DECISIONS, fetch: f });
    expect(r.state === "refused" && r.reason).toMatch(/chosen, but the cached snapshot .* does not declare it/);
    expect(f.calls).toBe(0);
  });
  test("refusesSnapshotAtOtherPin", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] }, { snapshotRef: SHA2 });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture() });
    expect(r.state === "refused" && r.reason).toMatch(/re-subscribe/);
  });
  test("refusesAssetUnderPolicyNone", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "ihris-kb", asset: "library/report/report.pdf", decisions: DECISIONS, fetch: f });
    expect(r.state === "refused" && r.reason).toMatch(/asset policy `none`.*`on-demand` or `all`/);
    expect(f.calls).toBe(0);
  });
  test("refusesAssetOutsideDirectories", async () => {
    const { inst } = checkout({ assets: { policy: "on-demand" } });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", asset: "outside/x.txt", decisions: DECISIONS, fetch: fixture() });
    expect(r.state === "refused" && r.reason).toMatch(/outside every directory the snapshot declares/);
  });
  test.each(["../etc/passwd", "/abs/path", "library/../x", "library/.hidden/x"])("refusesAssetPath[%s]", async (p) => {
    const { inst } = checkout({ assets: { policy: "all" } });
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "ihris-kb", asset: p, decisions: DECISIONS, fetch: f });
    expect(r.state).toBe("refused");
    expect(f.calls).toBe(0);
  });
  test("refusesWorkingDischargingSourceLoss", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    const d: KgDecisions = { ...DECISIONS, purpose: "working" };
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: d, fetch: fixture() });
    expect(r.state === "refused" && r.reason).toMatch(/cannot discharge `sourceLoss`/);
  });
});

describe("the gates: an unanswered gate counts as a refusal", () => {
  test("noDecisionsStaysReferenced", async () => {
    const { inst, snapDir } = checkout({ subgraphs: ["kb"] });
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", fetch: f, now: NOW });
    expect(r.state).toBe("stayed-referenced");
    expect(f.calls).toBe(0);
    if (r.state !== "stayed-referenced") return;
    expect(KgMaterializationRecordSchema.safeParse(JSON.parse(readFileSync(r.recordFile, "utf8"))).success).toBe(true);
    expect(r.record.materialization.state).toBe("referenced");
    expect(r.record.refusal?.unanswered.sort()).toEqual(["copyright", "restrictions", "retention", "size", "sourceLoss"]);
    expect(r.record.refusal?.purposeMissing).toBe(true);
    expect(existsSync(join(snapDir, "ihris-kb", "subgraphs", "kb", "tree"))).toBe(false);
    const [view] = partRecordsIn(snapDir, "ihris-kb").parts;
    expect(partState(view!, SHA)).toMatch(/^\? gates unanswered: .*no purpose stated/);
  });
  test("refusedGateNamed", async () => {
    const { inst, snapDir } = checkout({ subgraphs: ["kb"] });
    const d: KgDecisions = { ...DECISIONS, gates: { ...DECISIONS.gates, copyright: { verdict: "refused", basis: "no licence grants redistribution" } } };
    const f = fixture();
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: d, fetch: f, now: NOW });
    expect(r.state).toBe("stayed-referenced");
    expect(f.calls).toBe(0);
    if (r.state !== "stayed-referenced") return;
    expect(r.record.refusal?.refused).toEqual(["copyright"]);
    const [view] = partRecordsIn(snapDir, "ihris-kb").parts;
    expect(partState(view!, SHA)).toMatch(/^✗ gate refused: `copyright`/);
  });
  test("sizeMeasuredOverBudget", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: { ...DECISIONS, maxBytes: 10 }, fetch: fixture(), now: NOW });
    expect(r.state).toBe("stayed-referenced");
    if (r.state !== "stayed-referenced") return;
    expect(r.record.refusal?.refused).toEqual(["size"]);
    expect(r.record.refusal?.gates.size.basis).toMatch(/measured .* in 3 of the 8 files .* over it/);
  });
  test("sizeGateNoInventedDenominator", () => {
    expect(sizeGate(100, 2, 1000).basis).toMatch(/the repository's whole was not enumerated/);
    expect(sizeGate(100, 2, 1000).verdict).toBe("permitted");
  });
});

describe("could-not-determine is never clean, and writes nothing", () => {
  test("throwingFetchCouldNotDetermine", async () => {
    const { inst, snapDir } = checkout({ subgraphs: ["kb"] });
    const failing: PartFetcher = () => {
      throw new Error("fatal: unable to access 'https://github.com/litlfred/ihris-kb.git/': 403");
    };
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: failing });
    expect(r.state).toBe("could-not-determine");
    expect(r.state === "could-not-determine" && r.reason).toMatch(/was not read: .*403/);
    expect(existsSync(join(snapDir, "ihris-kb"))).toBe(false);
  });
  test("emptyDeclaredPathRefused", async () => {
    const { inst } = checkout({ subgraphs: ["kb-skills"] });
    const { "skills/hello.md": _gone, ...without } = UPSTREAM;
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb-skills", decisions: DECISIONS, fetch: fixture(without) });
    expect(r.state === "refused" && r.reason).toMatch(/holds nothing at `skills`/);
  });
  test("subgraphPathIsFileRefused", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture({ ...UPSTREAM, kb: "a file" }, { kind: "blob" }) });
    expect(r.state === "refused" && r.reason).toMatch(/is a file at the pin/);
  });
  test("symlinkRefused", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    const base = fixture();
    const linking: PartFetcher = (a, b, c) => {
      const got = base(a, b, c) as FetchedPart;
      symlinkSync("/etc/hostname", join(got.part, "escape.md"));
      return got;
    };
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: linking });
    expect(r.state === "refused" && r.reason).toMatch(/symbolic link.*escape\.md/);
  });
});

describe("slice 5: a chosen subgraph, materialised", () => {
  test("materialisedWithRecordAndGates", async () => {
    const { inst, snapDir } = checkout({ subgraphs: ["kb"] });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(r.state).toBe("materialized");
    if (r.state !== "materialized") return;
    const dir = join(snapDir, "ihris-kb", "subgraphs", "kb");
    expect(readFileSync(join(dir, "tree", "intro.md"), "utf8")).toBe(UPSTREAM["kb/intro.md"]!);
    expect(readFileSync(join(dir, "tree", "nested", "deep.md"), "utf8")).toBe("deep\n");
    expect(readFileSync(join(dir, "LICENSE"), "utf8")).toBe(UPSTREAM["LICENSE"]!);
    const onDisk = JSON.parse(readFileSync(join(dir, "materialization.json"), "utf8"));
    expect(KgMaterializationRecordSchema.safeParse(onDisk).success).toBe(true);
    const m = r.record.materialization;
    expect(MaterializationSchema.safeParse(m).success).toBe(true);
    expect(m.state).toBe("materialized");
    expect(m.purpose).toBe("archival");
    expect(m.upstreamVersion).toBe(SHA);
    expect(m.localPath).toBe("subscriptions/ihris-kb/subgraphs/kb/tree");
    expect(m.provenance.upstream).toBe(`https://github.com/litlfred/ihris-kb/tree/${SHA}/kb`);
    expect(m.fixity?.digest).toBe(treeDigest(join(dir, "tree")));
    expect(m.gates?.size.verdict).toBe("permitted");
    expect(m.gates?.copyright.decidedBy).toBe("the subscriber (test)");
    expect(r.record.files?.map((f) => f.name)).toEqual(["catalogue/node.json", "intro.md", "nested/deep.md"]);
    for (const f of r.record.files ?? []) expect(MaterializationSchema.safeParse(f.materialization).success).toBe(true);
    expect(r.record.files?.[1]?.materialization.provenance.upstream).toBe(`https://github.com/litlfred/ihris-kb/blob/${SHA}/kb/intro.md`);
  });

  test("fixityCoversCopiesNotUpstream", async () => {
    const { repo, inst } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    const verdicts = fixityRun(repo);
    const kinds = verdicts.map((v) => v.kind).sort();
    // 3 files + the licence verified; the directory record covered by its parts.
    expect(kinds).toEqual(["covered-by-parts", "verified", "verified", "verified", "verified"]);
    expect(verdicts.some((v) => v.record.localPath === "library/x.pdf")).toBe(false);
  });

  test("editInPlaceFailsBoth", async () => {
    const { repo, inst, snapDir } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    appendFileSync(join(snapDir, "ihris-kb", "subgraphs", "kb", "tree", "intro.md"), "an edit\n");
    expect(fixityRun(repo).some((v) => v.kind === "mismatch")).toBe(true);
    const rep = checkMaterializations(inst);
    expect(rep.findings.join("\n")).toMatch(/do not hash to the recorded digest/);
    expect(rep.findings.join("\n")).toMatch(/`intro\.md` does not match its digest/);
  });

  test("addedFileCaughtByTreeDigest", async () => {
    const { repo, inst, snapDir } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    writeFileSync(join(snapDir, "ihris-kb", "subgraphs", "kb", "tree", "added.md"), "mine\n");
    expect(fixityRun(repo).some((v) => v.kind === "mismatch" || v.kind === "absent")).toBe(false);
    expect(checkMaterializations(inst).findings.join("\n")).toMatch(/`added\.md` is under the tree and in no file record/);
  });

  test("checkCleanCountsChosenNotHeld", async () => {
    const { inst } = checkout({ subgraphs: ["kb", "kb-skills"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(checkMaterializations(inst)).toEqual({ findings: [], held: 1, stayedReferenced: 0, chosenNotHeld: 1, nodesHeld: 0 });
  });

  test("rerunWritesNothing", async () => {
    const { inst, snapDir } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    const file = join(snapDir, "ihris-kb", "subgraphs", "kb", "materialization.json");
    const before = readFileSync(file, "utf8");
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: new Date("2027-01-01T00:00:00Z") });
    expect(r.state === "materialized" && r.changed).toBe(false);
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  test("refusalReplacedWhenGatesPass", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", fetch: fixture(), now: NOW });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(r.state).toBe("materialized");
    expect(checkMaterializations(inst).findings).toEqual([]);
  });

  test("movedPinStaleAndRefused", async () => {
    const { inst, decl } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    setSubscription(decl, { ref: SHA2 });
    expect(checkMaterializations(inst).findings.join("\n")).toMatch(/held at 0123456789ab, and the subscription pins 89abcdef0123 — refresh/);
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    // The snapshot is still at the old pin, so that refusal comes first; either way nothing is overwritten.
    expect(r.state).toBe("refused");
  });

  test("unchosenAndUnrecordedFindings", async () => {
    const { inst, decl, snapDir } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    setSubscription(decl, { subgraphs: [] });
    mkdirSync(join(snapDir, "ihris-kb", "subgraphs", "stray"), { recursive: true });
    mkdirSync(join(snapDir, "gone-sub"));
    const text = checkMaterializations(inst).findings.join("\n");
    expect(text).toMatch(/subgraph `kb` is held but no longer chosen/);
    expect(text).toMatch(/`ihris-kb\/subgraphs\/stray` is in the subscription's directory with no record/);
    expect(text).toMatch(/gone-sub\/: materialised parts for no subscription/);
  });
});

describe("slice 6: one asset on demand", () => {
  test.each(["on-demand", "all"] as const)("assetOneFile[%s]", async (policy) => {
    const { repo, inst, snapDir } = checkout({ assets: { policy } });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", asset: "library/report/report.pdf", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(r.state).toBe("materialized");
    if (r.state !== "materialized") return;
    const dir = join(snapDir, "ihris-kb", "assets", "library", "report", "report.pdf");
    expect(readFileSync(join(dir, "tree", "report.pdf"), "utf8")).toBe(UPSTREAM["library/report/report.pdf"]!);
    expect(r.record.part).toEqual({ kind: "asset", path: "library/report/report.pdf" });
    expect(r.record.files).toBeUndefined();
    expect(r.record.materialization.localPath).toBe("subscriptions/ihris-kb/assets/library/report/report.pdf/tree/report.pdf");
    expect(r.record.materialization.provenance.upstream).toBe(`https://github.com/litlfred/ihris-kb/blob/${SHA}/library/report/report.pdf`);
    expect(Object.keys(r.record.materialization.gates ?? {}).sort()).toEqual(["copyright", "restrictions", "retention", "size", "sourceLoss"]);
    expect(fixityRun(repo).filter((v) => v.kind !== "verified")).toEqual([]);
    expect(checkMaterializations(inst).findings).toEqual([]);
  });
  test("directoryNotAsset", async () => {
    const { inst } = checkout({ assets: { policy: "on-demand" } });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", asset: "library/report", decisions: DECISIONS, fetch: fixture() });
    expect(r.state === "refused" && r.reason).toMatch(/is a directory at the pin; an asset is one file/);
  });
  test("heldAssetPolicyOffFinding", async () => {
    const { inst, decl } = checkout({ assets: { policy: "on-demand" } });
    await materialize({ instance: inst, subscription: "ihris-kb", asset: "library/report/report.pdf", decisions: DECISIONS, fetch: fixture(), now: NOW });
    setSubscription(decl, { assets: { policy: "none" } });
    expect(checkMaterializations(inst).findings.join("\n")).toMatch(/an asset is held under asset policy `none`/);
  });
});

describe("the subscriptions page draws a part from its record", () => {
  test("cardsDrawEachState", async () => {
    const { repo, inst } = checkout({ subgraphs: ["kb", "kb-skills", "library"], assets: { policy: "on-demand" } });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    await materialize({
      instance: inst,
      subscription: "ihris-kb",
      subgraph: "kb-skills",
      decisions: { ...DECISIONS, gates: { ...DECISIONS.gates, restrictions: { verdict: "refused", basis: "embargoed" } } },
      fetch: fixture(),
      now: NOW,
    });
    await materialize({ instance: inst, subscription: "ihris-kb", asset: "library/report/report.pdf", decisions: DECISIONS, fetch: fixture(), now: NOW });
    const cards = subscriptionCards(repo);
    expect(cards).toHaveLength(1);
    const page = render([], cards);
    expect(page).toMatch(/\| subgraph `kb` \| ✓ \| ⬇ materialised — 3 file\(s\), .*archival \|/);
    expect(page).toMatch(/\| subgraph `kb-skills` \| ✓ \| ✗ gate refused: `restrictions`/);
    expect(page).toMatch(/\| subgraph `library` \| ✓ \| 🔗 chosen, not yet held \|/);
    expect(page).toMatch(/\| asset `library\/report\/report\.pdf` \| on demand \| ⬇ materialised — 1 file\(s\)/);
  });
  test("mismatchDrawsWarning", async () => {
    const { repo, inst, snapDir } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    appendFileSync(join(snapDir, "ihris-kb", "subgraphs", "kb", "tree", "intro.md"), "x");
    expect(render([], subscriptionCards(repo))).toMatch(/\| subgraph `kb` \| ✓ \| ⚠ the bytes do not match the record \(mismatch\) \|/);
  });
  test("unreadableRecordDrawsUnknown", async () => {
    const { repo, snapDir } = checkout({ subgraphs: ["kb"] });
    mkdirSync(join(snapDir, "ihris-kb", "subgraphs", "kb"), { recursive: true });
    writeFileSync(join(snapDir, "ihris-kb", "subgraphs", "kb", "materialization.json"), "{not json");
    expect(render([], subscriptionCards(repo))).toMatch(/\| subgraph `kb` \| ✓ \| \? record unreadable: not readable as JSON/);
  });
});

// ── Metadata mode: `--nodes` (bean `c1m4`) ──────────────────────────────────

/**
 * A substrate that publishes subgraph files. Named `cat-harness` so the hit
 * can be served THIS repository's own generated `sdlc/skills` hydrated file —
 * the consumer is tested against what the producer actually writes, not
 * against a hand-made imitation of it.
 */
const NODES_SUBSTRATE = {
  name: "cat-harness",
  title: "C@T Harness",
  directories: [
    { id: "skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "sdlc", path: "sdlc/", graphTypologies: ["skills"] },
    { id: "docs", path: "docs/", graphTypologies: ["docs"] },
  ],
};
const SDLC_HYDRATED_PATH = "docs/subgraph/cat-harness/sdlc/skills/index.hydrated.jsonld";
// Written at publish into the layer output overlay (bean sm8r), not the mount.
const SDLC_HYDRATED = readFileSync(overlayPath(join(import.meta.dir, "..", "..", "cat-harness", SDLC_HYDRATED_PATH)), "utf8");
const NODES_UPSTREAM: Record<string, string> = {
  "cat-harness.json": JSON.stringify(NODES_SUBSTRATE),
  [SDLC_HYDRATED_PATH]: SDLC_HYDRATED,
  "docs/subgraph/cat-harness/index.jsonld": JSON.stringify({ "@context": "https://example.org/ns/subgraph/v1.jsonld", "@id": "https://example.org/subgraph/cat-harness/" }),
  "sdlc/skills/sdlc-core/todo-manager.md": "# the bytes metadata mode never fetches\n",
};
const nodesCheckout = (opts: { snapshotRef?: string } = {}) =>
  checkout({ id: "cat", subgraphs: [] }, { ...opts, substrate: { file: "cat-harness.json", raw: NODES_UPSTREAM["cat-harness.json"]! } });
/** No package is published for the pin — the 404 answer, so a test never reaches the network. */
const noPackage = (): SubgraphIndexFetch => ({ state: "absent", pkg: { name: "", version: "", tag: "", tarball: "", record: "", tarballUrl: "", recordUrl: "" }, detail: "nothing published (test)" });
/** A fetcher that records which paths it was asked for. */
function nodesFixture(files: Record<string, string> = NODES_UPSTREAM): PartFetcher & { calls: number; paths: string[] } {
  const inner = fixture(files);
  const paths: string[] = [];
  const f = Object.assign(
    (repo: string, ref: string, path: string) => {
      paths.push(path);
      f.calls++;
      return inner(repo, ref, path);
    },
    { calls: 0, paths },
  );
  return f;
}

describe("kg:materialize --nodes — one subgraph's index.hydrated.jsonld, metadata only", () => {
  test("nodesHitLandsWithRecord", async () => {
    const { inst, snapDir } = nodesCheckout();
    const f = nodesFixture();
    const r = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: f, now: NOW });
    expect(r.state).toBe("materialized");
    if (r.state !== "materialized") return;
    // One file asked for, at the declared docs path: never the subgraph's own bytes.
    expect(f.paths).toEqual([SDLC_HYDRATED_PATH]);
    const dir = join(snapDir, "cat", "nodes", "sdlc", "skills");
    expect(readFileSync(join(dir, "index.hydrated.jsonld"), "utf8")).toBe(SDLC_HYDRATED);
    const rec = KgNodesRecordSchema.parse(JSON.parse(readFileSync(join(dir, "nodes.json"), "utf8")));
    expect(rec.ref).toBe(SHA);
    expect(rec.subgraph.iri).toMatch(/\/subgraph\/cat-harness\/sdlc\/skills\/$/);
    expect(rec.file!.fixity.digest).toBe(createHash("sha256").update(SDLC_HYDRATED).digest("hex"));
    expect(rec.file!.upstream).toBe(`https://github.com/litlfred/ihris-kb/blob/${SHA}/${SDLC_HYDRATED_PATH}`);
    expect(rec.size.verdict).toBe("permitted");
    expect(rec.members).toBeGreaterThan(0);
    // No byte-copy artefacts: no tree/, no materialization.json, no licence.
    expect(existsSync(join(dir, "tree"))).toBe(false);
    expect(existsSync(join(dir, "materialization.json"))).toBe(false);
    const report = checkMaterializations(inst);
    expect(report.findings).toEqual([]);
    expect(report.nodesHeld).toBe(1);
    expect(partRecordsIn(snapDir, "cat").strays).toEqual([]);
    // Idempotent at the same pin.
    const again = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills/", fetch: nodesFixture(), now: NOW });
    expect(again.state === "materialized" && again.changed).toBe(false);
  });

  test("nodesRootRefused", async () => {
    const { inst, snapDir } = nodesCheckout();
    for (const path of ["", ".", "/"]) {
      const f = nodesFixture();
      const r = await materializeNodes({ instance: inst, subscription: "cat", path, fetch: f });
      expect(r.state).toBe("refused");
      expect(r.state === "refused" && r.reason).toMatch(/root of `cat-harness` publishes `docs\/subgraph\/cat-harness\/index\.jsonld` only, by design/);
      expect(f.calls).toBe(0);
    }
    expect(existsSync(join(snapDir, "cat"))).toBe(false);
  });

  test("nodesMissingRefused", async () => {
    const { inst, snapDir } = nodesCheckout();
    const r = await materializeNodes({ instance: inst, subscription: "cat", path: "skills/nope", fetch: nodesFixture(), indexPackage: noPackage });
    expect(r.state).toBe("refused");
    expect(r.state === "refused" && r.reason).toMatch(/publishes no `docs\/subgraph\/cat-harness\/skills\/nope\/index\.hydrated\.jsonld`/);
    expect(r.state === "refused" && r.reason).toContain("the pin's subgraph index package absent");
    expect(existsSync(join(snapDir, "cat"))).toBe(false);
  });

  // ── Not in the tree: the pin's subgraph index PACKAGE (bean `mo75` G2b/G3) ──
  //
  // Every litlfred harness builds `<docs>/subgraph/` at publish, so no pin's
  // tree carries the file; a hydrated mount reads it from the pin's package,
  // and `--nodes` now does too, through the same fetch and verification.

  /** Pack `files` (under docs/subgraph/cat-harness/) as the pin's package; a fetch served from it over file://. */
  function servedPackage(files: Record<string, string>): (a: { repository: string; ref: string; harness: string }) => SubgraphIndexFetch {
    const root = tmp("kg-mat-pkg-src-");
    writeFileSync(join(root, "cat-harness.json"), NODES_UPSTREAM["cat-harness.json"]!);
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), body);
    }
    const out = tmp("kg-mat-pkg-out-");
    packSubgraphIndex({ root, repository: "litlfred/ihris-kb", ref: SHA, outDir: out });
    return (a) => fetchSubgraphIndex({ ...a, urlFor: (url) => `file://${join(out, url.split("/").pop()!)}` });
  }

  test("nodesFromPinPackage", async () => {
    const { inst, snapDir } = nodesCheckout();
    const { [SDLC_HYDRATED_PATH]: _inTree, ...withoutFile } = NODES_UPSTREAM;
    const r = await materializeNodes({
      instance: inst,
      subscription: "cat",
      path: "sdlc/skills",
      fetch: nodesFixture(withoutFile),
      indexPackage: servedPackage({ [SDLC_HYDRATED_PATH]: SDLC_HYDRATED }),
      now: NOW,
    });
    expect(r.state).toBe("materialized");
    const dir = join(snapDir, "cat", "nodes", "sdlc", "skills");
    expect(readFileSync(join(dir, "index.hydrated.jsonld"), "utf8")).toBe(SDLC_HYDRATED);
    const rec = KgNodesRecordSchema.parse(JSON.parse(readFileSync(join(dir, "nodes.json"), "utf8")));
    expect(rec.file!.upstream).toMatch(new RegExp(`/cat-harness-subgraph-index-.*\\.tgz#${SDLC_HYDRATED_PATH.replace(/\./g, "\\.")}$`));
    expect(checkMaterializations(inst).findings).toEqual([]);
  });

  test("nodesPackageOtherSubgraphRefused", async () => {
    const { inst, snapDir } = nodesCheckout();
    const { [SDLC_HYDRATED_PATH]: _inTree, ...withoutFile } = NODES_UPSTREAM;
    const r = await materializeNodes({
      instance: inst,
      subscription: "cat",
      path: "sdlc/skills",
      fetch: nodesFixture(withoutFile),
      indexPackage: servedPackage({ "docs/subgraph/cat-harness/skills/other/index.hydrated.jsonld": SDLC_HYDRATED }),
    });
    expect(r.state).toBe("refused");
    expect(r.state === "refused" && r.reason).toContain("the pin's subgraph index package holds no file for it");
    expect(existsSync(join(snapDir, "cat"))).toBe(false);
  });

  test("nodesPackageUnfetchedCouldNotDetermine", async () => {
    const { inst, snapDir } = nodesCheckout();
    const { [SDLC_HYDRATED_PATH]: _inTree, ...withoutFile } = NODES_UPSTREAM;
    const r = await materializeNodes({
      instance: inst,
      subscription: "cat",
      path: "sdlc/skills",
      fetch: nodesFixture(withoutFile),
      indexPackage: (a) => ({ state: "could-not-determine", pkg: { name: "", version: "", tag: "", tarball: "", record: "", tarballUrl: "", recordUrl: "" }, detail: `offline (${a.harness})` }),
    });
    expect(r.state).toBe("could-not-determine");
    expect(r.state === "could-not-determine" && r.reason).toContain("offline (cat-harness)");
    expect(existsSync(join(snapDir, "cat"))).toBe(false);
  });

  test("nodesPathOutsideRefused", async () => {
    const { inst } = nodesCheckout();
    const f = nodesFixture();
    const r = await materializeNodes({ instance: inst, subscription: "cat", path: "elsewhere/x", fetch: f });
    expect(r.state === "refused" && r.reason).toMatch(/outside every directory the snapshot declares/);
    expect(f.calls).toBe(0);
  });

  test("nodesInvalidFileRefused", async () => {
    const { inst, snapDir } = nodesCheckout();
    const bad = JSON.parse(SDLC_HYDRATED) as Record<string, unknown>;
    bad["@context"] = { inlined: "https://example.org/" }; // the contract: the context is never inlined
    const r = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: nodesFixture({ ...NODES_UPSTREAM, [SDLC_HYDRATED_PATH]: JSON.stringify(bad) }) });
    expect(r.state).toBe("refused");
    expect(r.state === "refused" && r.reason).toMatch(/not a valid hydrated subgraph file: @context/);
    const notJson = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: nodesFixture({ ...NODES_UPSTREAM, [SDLC_HYDRATED_PATH]: "{oops" }) });
    expect(notJson.state === "refused" && notJson.reason).toMatch(/is not JSON/);
    // Valid, but published under the wrong path: it names another subgraph.
    const elsewhere = { ...JSON.parse(SDLC_HYDRATED), "@id": "https://example.org/subgraph/cat-harness/skills/other/" };
    const wrong = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: nodesFixture({ ...NODES_UPSTREAM, [SDLC_HYDRATED_PATH]: JSON.stringify(elsewhere) }) });
    expect(wrong.state === "refused" && wrong.reason).toMatch(/not the subgraph `…\/subgraph\/cat-harness\/sdlc\/skills\/`/);
    expect(existsSync(join(snapDir, "cat"))).toBe(false);
  });

  test("nodesPinChecked", async () => {
    const stale = nodesCheckout({ snapshotRef: SHA2 });
    const f = nodesFixture();
    const r1 = await materializeNodes({ instance: stale.inst, subscription: "cat", path: "sdlc/skills", fetch: f });
    expect(r1.state === "refused" && r1.reason).toMatch(/re-subscribe/);
    expect(f.calls).toBe(0);

    const { inst, decl, snapDir } = nodesCheckout();
    await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: nodesFixture(), now: NOW });
    // Move the pin under the held copy (and the snapshot with it): moving is refresh-materialized.
    setSubscription(decl, { ref: SHA2 });
    const snapFile = join(snapDir, `cat${SNAPSHOT_SUFFIX}`);
    writeFileSync(snapFile, readFileSync(snapFile, "utf8").replace(SHA, SHA2));
    const r2 = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: nodesFixture() });
    expect(r2.state === "refused" && r2.reason).toMatch(/held at 0123456789ab .* `refresh-materialized`/);
    expect(checkMaterializations(inst).findings.some((x) => /held at 0123456789ab, and the subscription pins 89abcdef0123/.test(x))).toBe(true);

    // The real fetcher throws when FETCH_HEAD is not the pin: could-not-determine, nothing written.
    const fresh = nodesCheckout();
    const r3 = await materializeNodes({
      instance: fresh.inst,
      subscription: "cat",
      path: "sdlc/skills",
      fetch: () => {
        throw new Error(`the remote served ${SHA2} for ${SHA}`);
      },
    });
    expect(r3.state).toBe("could-not-determine");
    expect(existsSync(join(fresh.snapDir, "cat"))).toBe(false);
  });

  test("nodesSizeCapReferenced", async () => {
    const { inst, snapDir } = nodesCheckout();
    const r = await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", maxBytes: 1024, fetch: nodesFixture(), now: NOW });
    expect(r.state).toBe("stayed-referenced");
    const dir = join(snapDir, "cat", "nodes", "sdlc", "skills");
    expect(existsSync(join(dir, "index.hydrated.jsonld"))).toBe(false);
    const rec = KgNodesRecordSchema.parse(JSON.parse(readFileSync(join(dir, "nodes.json"), "utf8")));
    expect(rec.state).toBe("referenced");
    expect(rec.size.verdict).toBe("refused");
    expect(checkMaterializations(inst).findings).toEqual([]);
  });

  test("nodesCheckFindsEditAndExtra", async () => {
    const { inst, snapDir } = nodesCheckout();
    await materializeNodes({ instance: inst, subscription: "cat", path: "sdlc/skills", fetch: nodesFixture(), now: NOW });
    const dir = join(snapDir, "cat", "nodes", "sdlc", "skills");
    appendFileSync(join(dir, "index.hydrated.jsonld"), " ");
    writeFileSync(join(dir, "extra.txt"), "x");
    const findings = checkMaterializations(inst).findings;
    expect(findings.some((x) => /does not hash to its record/.test(x))).toBe(true);
    expect(findings.some((x) => /nodes\/sdlc\/skills\/extra\.txt` is in the subscription's directory with no record/.test(x))).toBe(true);
  });
});

describe("a nested subgraph: chosen by its parent, materialised by its path (owner, 2026-10-24, ruling 4)", () => {
  test("nestedHeldApart", async () => {
    const { repo, inst, snapDir } = checkout({ subgraphs: ["kb"] });
    const r = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb/nested", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(r.state).toBe("materialized");
    if (r.state !== "materialized") return;
    expect(r.record.part as unknown).toEqual({ kind: "subgraph", id: "kb", path: "kb/nested", nested: true });
    const dir = join(snapDir, "ihris-kb", "nested", "kb", "nested");
    expect(readFileSync(join(dir, "tree", "deep.md"), "utf8")).toBe("deep\n");
    expect(r.record.materialization.provenance.upstream).toBe(`https://github.com/litlfred/ihris-kb/tree/${SHA}/kb/nested`);
    expect(r.record.files?.map((f) => f.id)).toEqual(["ihris-kb/nested/kb/nested/deep.md"]);
    // The parent's own copy afterwards neither moves nor removes the child's.
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(existsSync(join(dir, "tree", "deep.md"))).toBe(true);
    const report = checkMaterializations(inst);
    expect(report.findings).toEqual([]);
    expect(report.held).toBe(2);
    expect(report.chosenNotHeld).toBe(0);
    expect(partRecordsIn(snapDir, "ihris-kb").parts.map((p) => p.slot) as unknown[]).toEqual([
      { kind: "nested", path: "kb/nested" },
      { kind: "subgraph", id: "kb" },
    ]);
    expect(fixityRun(repo).every((v) => v.kind === "verified" || v.kind === "covered-by-parts")).toBe(true);
  });

  test("nestedAloneNotParent", async () => {
    const { inst } = checkout({ subgraphs: ["kb"] });
    await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb/nested", decisions: DECISIONS, fetch: fixture(), now: NOW });
    expect(checkMaterializations(inst).chosenNotHeld).toBe(1);
  });

  test("nestedRefusedUnchosenOrOutside", async () => {
    const { inst } = checkout({ subgraphs: ["kb-skills"] });
    const f = fixture();
    const unchosen = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "kb/nested", decisions: DECISIONS, fetch: f });
    expect(unchosen.state).toBe("refused");
    if (unchosen.state === "refused") expect(unchosen.reason).toContain("A nested part is chosen by its parent: add `kb`");
    const outside = await materialize({ instance: inst, subscription: "ihris-kb", subgraph: "outside/x", decisions: DECISIONS, fetch: f });
    expect(outside.state).toBe("refused");
    if (outside.state === "refused") expect(outside.reason).toContain("lies under no directory the cached snapshot");
    expect(f.calls).toBe(0);
  });
});
