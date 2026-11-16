/**
 * Measure the IG Publisher's BINARY outputs on a published pages branch:
 * which archives and packages are there, how many copies, and how many bytes,
 * split between the published IG and its branch previews.
 *
 * Owner, 2026-10-02 (paraphrased): look at what happens to the binary
 * artefacts of a release on an IG overlay above this layer, and add it to skills and
 * tools. Measured that day on the WHO SMART Base IG fork's
 * `gh-pages` (64ed896d): 5.0 GB in all, 966.5 MB of it Publisher binaries, and
 * 907.1 MB of those under `branches/` — 29 preview copies of the same files.
 * `full-ig.zip` alone was 644.7 MB in 30 copies. Skill:
 * `fhir-harness/skills/fhir-ig-base/ig-binary-artefacts.md`.
 *
 * It reads the git TREE, never a checkout, so a multi-gigabyte pages branch
 * is measured from a depth-1 fetch without writing a byte of it to disk.
 * WHO-free: the names are the Publisher's own outputs, and a pages branch is
 * any IG's.
 *
 * @covers code
 */
import { execFileSync } from "node:child_process";

/** The IG Publisher's binary outputs, by file name. A name not here is not counted. */
export const PUBLISHER_BINARIES = [
  "full-ig.zip",
  "package.tgz",
  "package.r4.tgz",
  "package.r4b.tgz",
  "package-combined.tgz",
  "package.db",
  "ai.zip",
  "validator.pack",
  "definitions.json.zip",
  "definitions.xml.zip",
  "definitions.ttl.zip",
  "examples.json.zip",
  "examples.xml.zip",
  "examples.ttl.zip",
  "expansions.json.zip",
  "expansions.xml.zip",
  "csvs.zip",
  "excels.zip",
  "schematrons.zip",
  "spreadsheets.zip",
] as const;

/** `validator-<package-id>.pack` is the Publisher's per-package validator pack. */
const VALIDATOR_PACK = /^validator-.+\.pack$/;

export function isPublisherBinary(name: string): boolean {
  return (PUBLISHER_BINARIES as readonly string[]).includes(name) || VALIDATOR_PACK.test(name);
}

export interface TreeEntry {
  path: string;
  bytes: number;
}

export interface BinaryRow {
  /** File name, or `validator-*.pack` for the per-package packs. */
  name: string;
  copies: number;
  bytes: number;
}

export interface BinaryAudit {
  $schema: "ig-binary-audit/v1";
  ref: string;
  /** Every blob on the branch. */
  total: { files: number; bytes: number };
  binaries: { files: number; bytes: number };
  /** The part of `binaries` under the preview prefix (default `branches/`). */
  inPreviews: { files: number; bytes: number; previews: number };
  byName: BinaryRow[];
}

/** Parse `git ls-tree -r -l` output. Submodules and symlinks carry no size and are skipped. */
export function parseLsTree(text: string): TreeEntry[] {
  const out: TreeEntry[] = [];
  for (const line of text.split("\n")) {
    const m = /^\d+ blob [0-9a-f]+\s+(\d+)\t(.+)$/.exec(line);
    if (m) out.push({ path: m[2], bytes: Number(m[1]) });
  }
  return out;
}

export function auditTree(ref: string, entries: TreeEntry[], previewPrefix = "branches/"): BinaryAudit {
  const rows = new Map<string, BinaryRow>();
  const previews = new Set<string>();
  const bin = { files: 0, bytes: 0 };
  const prev = { files: 0, bytes: 0 };
  let all = 0;
  for (const e of entries) {
    all += e.bytes;
    const name = e.path.slice(e.path.lastIndexOf("/") + 1);
    if (!isPublisherBinary(name)) continue;
    const key = VALIDATOR_PACK.test(name) ? "validator-*.pack" : name;
    const row = rows.get(key) ?? { name: key, copies: 0, bytes: 0 };
    row.copies++;
    row.bytes += e.bytes;
    rows.set(key, row);
    bin.files++;
    bin.bytes += e.bytes;
    if (e.path.startsWith(previewPrefix)) {
      prev.files++;
      prev.bytes += e.bytes;
      previews.add(e.path.slice(previewPrefix.length).split("/")[0]);
    }
  }
  return {
    $schema: "ig-binary-audit/v1",
    ref,
    total: { files: entries.length, bytes: all },
    binaries: bin,
    inPreviews: { ...prev, previews: previews.size },
    byName: [...rows.values()].sort((a, b) => b.bytes - a.bytes),
  };
}

const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;

export function formatAudit(a: BinaryAudit): string {
  const lines = [
    `${a.ref}: ${mb(a.total.bytes)} in ${a.total.files} files`,
    `  Publisher binaries: ${mb(a.binaries.bytes)} in ${a.binaries.files} files`,
    `  of which in ${a.inPreviews.previews} preview(s): ${mb(a.inPreviews.bytes)} in ${a.inPreviews.files} files`,
    "",
    ...a.byName.map((r) => `  ${mb(r.bytes).padStart(10)}  ${String(r.copies).padStart(3)}×  ${r.name}`),
  ];
  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (f: string) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repo = opt("--repo") ?? ".";
  const ref = opt("--ref") ?? "origin/gh-pages";
  if (args.includes("--help")) {
    console.log(
      "usage: bun run fhir-harness/scripts/ig-binary-audit.ts [--repo <git dir>] [--ref origin/gh-pages] [--previews branches/] [--json]\n" +
        "Fetch the branch first, e.g. git fetch --depth 1 origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages",
    );
    process.exit(0);
  }
  let text: string;
  try {
    text = execFileSync("git", ["-C", repo, "ls-tree", "-r", "-l", ref], { encoding: "utf-8", maxBuffer: 1 << 30 });
  } catch {
    console.error(`could not read ${ref} in ${repo} — fetch it first (see --help)`);
    process.exit(2);
  }
  const audit = auditTree(ref, parseLsTree(text), opt("--previews") ?? "branches/");
  process.stdout.write(args.includes("--json") ? `${JSON.stringify(audit, null, 2)}\n` : formatAudit(audit));
}
