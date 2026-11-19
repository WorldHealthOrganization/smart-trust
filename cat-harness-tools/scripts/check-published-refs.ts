#!/usr/bin/env bun
/**
 * check-published-refs.ts — a SHA may stage; only a version may publish.
 *
 * A published reference must be a version, never a commit SHA: a downstream
 * consumer may not be able to fetch the commit, and FHIR's `dependsOn`
 * (`packageId` + `version`) has no field a SHA belongs in. Scheme:
 * `cat-harness/docs/proposals/instance-versioning.md`.
 *
 * | | what it is | example | in scope? |
 * |---|---|---|---|
 * | **reference** | a consumer must RESOLVE it to obtain another artefact | a dependency's `ref`, an asset's `source` | **yes** |
 * | **provenance** | a record of where THIS artefact came from | `staging.sha`, `sourceCommitSha` | no |
 *
 * Classification is by KEY, declared in {@link PROVENANCE_KEYS}, never by the
 * look of the value (a 40-hex regex would fail the build stamp). A new
 * provenance key is a deliberate addition to that list.
 *
 * Per-PR previews are branches/: a SHA there is correct, and this gate does not
 * look at `/branches/`.
 *
 * Every reference carrier prints its count, even nought, with a note on why
 * it is empty; zero references is reported, never rendered as a pass.
 *
 * @module scripts/check-published-refs
 * @covers cat-harness
 */

import { relative, resolve } from "node:path";

import { instanceRootFor, layerRootsIn, readDeclaration, repoRootFor } from "../schemas/kg/cat-harness.js";
import { dependsOnFor } from "../schemas/kg/depends-on.js";
import { readEffectiveConfig } from "../schemas/kg/harness-config.js";

/**
 * Keys whose value records where THIS artefact came from.
 *
 * Listed rather than pattern-matched: see the module header. Every entry is a
 * key the exporter actually emits — `scripts/staging-stamp.ts` for the first
 * group, `kg-export.ts`'s identity block for the second.
 */
export const PROVENANCE_KEYS: readonly string[] = [
  "staging",
  "stagingSha",
  "sha",
  "sourceCommit",
  "sourceCommitSha",
  "sourceCommitAt",
  "sourceCommitUnavailable",
  "sourceTreeDirty",
  "sourceTree",
  "identitySource",
];

export type RefKind = "semver" | "sha" | "moving" | "prerelease" | "unpinned";

/**
 * What kind of reference this is.
 *
 * `moving` rather than "branch": a tag is re-pointable too, and the property
 * that matters is whether the same string can resolve to different content
 * later — not what git calls it.
 */
export function classifyRef(ref: string | undefined): RefKind {
  if (ref === undefined || ref.trim() === "") return "unpinned";
  const r = ref.trim();
  // A leading `v` is the tag spelling of the same version; `upstream-pins.json`
  // already matches `^v\d+\.\d+\.\d+$`, so accepting it here keeps one answer.
  if (/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(r)) return "semver";
  if (/^[0-9a-f]{7,40}$/i.test(r)) return "sha";
  // FHIR's pseudo-versions. Named rather than folded into `moving` because
  // they are a DELIBERATE pre-release choice, and the remedy differs: a branch
  // name is usually an accident, `current` usually is not.
  if (r === "current" || r === "dev") return "prerelease";
  return "moving";
}

export interface RefFinding {
  carrier: string;
  where: string;
  ref: string | undefined;
  kind: RefKind;
  severity: "major" | "minor";
  detail: string;
}

export interface CarrierReport {
  carrier: string;
  examined: number;
  findings: RefFinding[];
  /** Why nothing was examined, when nothing was — never left to be inferred. */
  note?: string;
}

const REMEDY: Record<Exclude<RefKind, "semver">, string> = {
  sha: "a SHA is for staging; a published reference resolves only for a consumer holding this repository, and FHIR `dependsOn` has no field for it",
  moving: "resolves to different content later, so two consumers reading the same published document can get different artefacts",
  prerelease: "a pre-release pseudo-version is staging-tier; publishing one asks a downstream to depend on whatever CI last built",
  unpinned: "no ref at all — `current` by omission, which is the same defect arrived at by default rather than chosen",
};

function finding(
  carrier: string,
  where: string,
  ref: string | undefined,
  severity: "major" | "minor",
): RefFinding | undefined {
  const kind = classifyRef(ref);
  if (kind === "semver") return undefined;
  return { carrier, where, ref, kind, severity, detail: REMEDY[kind] };
}

/**
 * Carrier 1 — layer dependencies in a layer's `<name>.config.json`.
 *
 * `major`: this is the reference a consumer resolves to obtain another whole
 * layer. It is the one the FHIR alignment is actually about.
 *
 * **The path is RESOLVED, not composed, and that is not a style preference.**
 * This read `join(root, "harness.config.json")` until 2026-09-21. The config
 * was renamed to `<name>.config.json` on the 21st, so `existsSync` went false
 * for every layer, every iteration `continue`d, and the carrier reported
 * *"no instance carries a harness.config.json — there are no declared
 * instance dependencies in this repository to check"* with `examined: 0`.
 *
 * That sentence was true about a filename and false about the repository:
 * `folio-assistant.config.json` declares `dependencies.folioAssistant`, with
 * no `ref` and no `version` — precisely the `major` unpinned finding this
 * carrier exists to raise. **A check that scans nothing and reports a clean
 * run is the `dh4f` shape**, and here it was hiding the only dependency edge
 * in the repository.
 *
 * `readEffectiveConfig()` reads the layer's `index.config.json` entry first
 * and its `<name>.config.json` only as a legacy fallback (bean `ymvt`).
 */
export function dependencyRefs(repoRoot: string): CarrierReport {
  const findings: RefFinding[] = [];
  let examined = 0;
  const seen: string[] = [];

  for (const root of layerRootsIn(repoRoot)) {
    // INDEX FIRST (bean `ymvt`): a layer an `index.config.json` lists is
    // configured by its entry; a `<name>.config.json` alone is the legacy
    // fallback, named as such in `seen`. `absent` with no `from` is "nothing
    // here declares an instance", which is not the same as "an instance with
    // no config" — neither is a finding, but only the second was examined.
    const eff = readEffectiveConfig(root);
    if (eff.state === "absent") continue;
    const where = eff.via === "index" ? `${relative(repoRoot, root) || "."}: ${eff.from}` : `${relative(repoRoot, root) || "."}/${eff.from} (legacy)`;
    seen.push(where);
    if (eff.state === "unreadable") {
      findings.push({
        carrier: "dependencies",
        where,
        ref: undefined,
        kind: "unpinned",
        severity: "major",
        detail: `${where} is unreadable — not a clean run, and not an empty dependency set (${eff.why})`,
      });
      continue;
    }
    const parsed = eff.config as { dependencies?: { folioAssistant?: Array<{ name?: string; ref?: string; version?: string }> } };
    for (const dep of parsed.dependencies?.folioAssistant ?? []) {
      examined += 1;
      // `version` is the scheme's field and does not exist yet; when it does it
      // wins, because `ref` is demoted to "how to fetch while staging".
      const f = finding("dependencies", `${relative(repoRoot, root) || "."} → ${dep.name ?? "(unnamed)"}`, dep.version ?? dep.ref, "major");
      if (f) findings.push(f);
    }
  }

  return {
    carrier: "dependencies",
    examined,
    findings,
    note:
      examined === 0
        ? seen.length === 0
          ? "no instance carries a config — there are no declared instance dependencies in this repository to check"
          : `${seen.length} instance config(s) found, none declaring dependencies.folioAssistant`
        : undefined,
  };
}

/**
 * Carrier 2 — the `source` on a declared asset.
 *
 * A reference rather than provenance, and the line is fine enough to be worth
 * stating: `source` exists so "is this still what it was copied from" can be
 * ASKED, which means resolving it and comparing. A build stamp asks nothing.
 *
 * `minor` rather than `major`: resolving it obtains one file for a comparison,
 * not a layer a build depends on. It is the carrier that has entries
 * today, so it is what keeps this gate from being a check over nothing.
 */
export function assetSourceRefs(repoRoot: string): CarrierReport {
  const findings: RefFinding[] = [];
  let examined = 0;

  for (const root of layerRootsIn(repoRoot)) {
    let decl;
    try {
      decl = readDeclaration(root);
    } catch {
      continue;
    }
    for (const asset of decl?.assets ?? []) {
      if (asset.source === undefined) continue; // authored here — a third state, not a gap
      examined += 1;
      const f = finding(
        "asset-source",
        `${relative(repoRoot, root) || "."} → ${asset.id} (${asset.source.instance}/${asset.source.path})`,
        asset.source.ref,
        "minor",
      );
      if (f) findings.push(f);
    }
  }

  return {
    carrier: "asset-source",
    examined,
    findings,
    note: examined === 0 ? "no declared asset names a `source` — every one is authored in place" : undefined,
  };
}

/**
 * Carrier 3 — `dependsOn` records, §3.4's published dependency set.
 *
 * `major`: this is the reference an EXTERNAL consumer resolves, read straight
 * out of the published document. It is the carrier the FHIR alignment is
 * ultimately for.
 *
 * ## It is computed from the declarations, not read back from `_kg/`
 *
 * `_kg/` is a build output — gitignored, absent in a fresh checkout, and
 * possibly stale in a dirty one. A gate that read it would pass on an old
 * export and report `examined: 0` where the file simply had not been built,
 * which is the `dh4f` shape wearing a plausible number. `dependsOnFor` walks
 * the same declarations the exporter walks, so this checks what the next
 * export WILL publish rather than what the last one did.
 *
 * **Nought today is a determined nought, and the note says which.** Every
 * layer is undecided (§6 Q1), so no layer emits the block at all — a
 * different fact from "the block is emitted and holds no references", and the
 * report distinguishes them.
 */
export function publishedGraphRefs(repoRoot: string): CarrierReport {
  const findings: RefFinding[] = [];
  let examined = 0;
  let emitting = 0;

  for (const root of layerRootsIn(repoRoot)) {
    const where = relative(repoRoot, root) || ".";
    let deps;
    try {
      deps = dependsOnFor(root);
    } catch {
      continue; // reported by `check:publishable`, whose job the census is
    }
    if (deps.unavailable !== undefined && deps.records.length === 0) continue;
    emitting += 1;
    for (const record of deps.records) {
      examined += 1;
      const f = finding("published-graph", `${where} → ${record.packageId}`, record.version, "major");
      if (f) findings.push(f);
    }
  }

  return {
    carrier: "published-graph",
    examined,
    findings,
    note:
      emitting === 0
        ? "no instance emits a `dependsOn` block — every one is UNDECIDED (§3.1, §6 Q1), which is not the same as emitting an empty one. " +
          "The graph's one 40-hex string is the build stamp, which is PROVENANCE and deliberately out of scope"
        : examined === 0
          ? `${emitting} instance(s) emit a \`dependsOn\` block, all of them empty — a determined empty, not an unchecked one`
          : undefined,
  };
}

export function auditPublishedRefs(repoRoot: string): CarrierReport[] {
  return [dependencyRefs(repoRoot), assetSourceRefs(repoRoot), publishedGraphRefs(repoRoot)];
}

export function formatReport(reports: readonly CarrierReport[]): string {
  const out: string[] = ["Published references — a SHA may stage; only a version may publish", ""];
  for (const r of reports) {
    out.push(`  · ${r.carrier.padEnd(16)} ${String(r.examined).padStart(3)} reference(s) examined, ${r.findings.length} finding(s)`);
    if (r.note !== undefined) out.push(`      – ${r.note}`);
    for (const f of r.findings) {
      out.push(`      ✗ ${f.where}`);
      out.push(`        ${f.kind}${f.ref === undefined ? "" : ` \`${f.ref}\``} — ${f.detail}`);
    }
  }

  const examined = reports.reduce((n, r) => n + r.examined, 0);
  const findings = reports.flatMap((r) => r.findings);
  const major = findings.filter((f) => f.severity === "major").length;
  out.push("");
  out.push(`${examined} reference(s) examined across ${reports.length} carrier(s) — ${findings.length} finding(s), ${major} major.`);
  if (examined === 0) {
    // The loudest line in the report, because it is the state most easily
    // mistaken for success.
    out.push("NOTHING WAS EXAMINED. That is not a pass — see each carrier's note above for why it was empty.");
  }
  out.push("Previews are STAGING (owner, 2026-09-20), so `/STAGING/` is out of scope by design, not by omission.");
  return out.join("\n");
}

if (import.meta.main) {
  const repoRoot = repoRootFor(instanceRootFor(import.meta.dir));
  const reports = auditPublishedRefs(resolve(repoRoot));
  console.log(process.argv.includes("--json") ? JSON.stringify(reports, null, 2) : formatReport(reports));

  // ADVISORY by default, `--strict` to fail, matching `check:subgraph-coverage`
  // — and for the same reason: the scheme this enforces is a proposal, so the
  // findings are a worklist before they are a contract. `--strict` is what CI
  // pins once the worklist is empty.
  const findings = reports.flatMap((r) => r.findings);
  if (process.argv.includes("--strict") && findings.length > 0) process.exit(1);
  process.exit(0);
}
