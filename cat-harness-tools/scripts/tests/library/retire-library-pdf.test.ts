/**
 * `retire-library-pdf.py`: a processed PDF leaves the repository, and the
 * entry keeps everything derived from it plus a record of where the bytes are.
 *
 * Every refusal is tested, not just the happy path: the script deletes files,
 * so the cases where it must NOT are the ones worth pinning.
 *
 * @module scripts/tests/retire-library-pdf
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocumentNodes } from "../../../pipeline/gen-library-jsonld.ts";

const SCRIPT = join(new URL("../..", import.meta.url).pathname, "retire-library-pdf.py");
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const PDF = "%PDF-1.4 a processed paper\n";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface Opts {
  arxiv?: boolean;
  doi?: string;
  sections?: boolean;
  recordedSha?: string;
  git?: boolean;
  /** What the fsh-guts branch keeps for the PDF: the same bytes (default), other bytes, or nothing. */
  copy?: "same" | "other" | "none";
}

/** A library entry as the PDF rung leaves it; optionally inside a git repo with the PDF committed. */
function entry(o: Opts = {}): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), "retire-"));
  made.push(root);
  const dir = join(root, "library", "arxiv-0705.1468v1");
  mkdirSync(join(dir, "sections"), { recursive: true });
  writeFileSync(join(dir, "0705.1468v1.pdf"), PDF);
  if (o.sections !== false) writeFileSync(join(dir, "sections", "sec-000.md"), "text\n");
  const metadata: Record<string, unknown> = { doi: o.doi ?? null };
  if (o.arxiv !== false) metadata.arxiv = { id: "0705.1468", version: "1" };
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({ _schema: "pdf-structure/v1", source: { file: "0705.1468v1.pdf", sha256: o.recordedSha ?? sha(PDF) }, metadata, sections: [] }),
  );
  if (o.git) {
    const sh = (cmd: string) => {
      const r = Bun.spawnSync(["sh", "-c", cmd], { cwd: root });
      if (r.exitCode !== 0) throw new Error(`${cmd}: ${r.stderr}`);
    };
    sh("git init -q && git config user.email t@t && git config user.name t && git add -A && git commit -qm init");
    sh("git remote add origin https://github.com/litlfred/qou.git");
    const copy = o.copy ?? "same";
    if (copy !== "none") {
      // The deprecation branch keeps the file under fsh-guts/retired-pdfs/<path on main>.
      const kept = "fsh-guts/retired-pdfs/library/arxiv-0705.1468v1";
      sh("git switch -q -c cat/cat-harness/fsh-guts && git rm -rq library");
      mkdirSync(join(root, kept), { recursive: true });
      writeFileSync(join(root, kept, "0705.1468v1.pdf"), copy === "same" ? PDF : PDF + "changed");
      sh("git add -A && git commit -qm copy && git switch -q -");
    }
  }
  return { root, dir };
}

function run(dir: string, ...args: string[]): { code: number; out: { counts: Record<string, number>; entries: Record<string, unknown>[] } } {
  const r = Bun.spawnSync(["python3", SCRIPT, dir, "--json", ...args]);
  return { code: r.exitCode, out: JSON.parse(new TextDecoder().decode(r.stdout)) };
}

const record = (dir: string) => JSON.parse(readFileSync(join(dir, "source.materialization.json"), "utf-8"));

describe("retire-library-pdf", () => {
  test("dry run by default: nothing is written or removed", () => {
    const { dir } = entry();
    expect(run(dir).out.entries[0]?.result).toBe("retire");
    expect(existsSync(join(dir, "0705.1468v1.pdf"))).toBe(true);
    expect(existsSync(join(dir, "source.materialization.json"))).toBe(false);
  });

  test("--apply removes the PDF, keeps the derived files, and records where the bytes are", () => {
    const { dir } = entry({ git: true });
    const { code, out } = run(dir, "--apply");
    expect(code).toBe(0);
    expect(out.entries[0]?.result).toBe("retired");
    expect(existsSync(join(dir, "0705.1468v1.pdf"))).toBe(false);
    expect(existsSync(join(dir, "structure.json"))).toBe(true);
    expect(existsSync(join(dir, "sections", "sec-000.md"))).toBe(true);
    const r = record(dir);
    expect(r).toMatchObject({ $schema: "folio-materialization/v1", state: "referenced", file: "0705.1468v1.pdf", bytes: PDF.length });
    expect(r.fixity).toMatchObject({ algorithm: "sha256", digest: sha(PDF) });
    expect(r.provenance.upstream).toBe("https://arxiv.org/pdf/0705.1468v1");
    // arXiv may rebuild the PDF: the record must not imply the bytes match.
    expect(r.provenance.upstreamFixity).toContain("not promised to match");
    // The fsh-guts copy of the exact bytes, pinned to that branch's commit, not a commit of main.
    expect(r.provenance.retiredCopy.url).toMatch(
      /^https:\/\/github\.com\/litlfred\/qou\/blob\/[0-9a-f]{40}\/fsh-guts\/retired-pdfs\/library\/arxiv-0705\.1468v1\/0705\.1468v1\.pdf$/,
    );
    expect(r.provenance.retiredCopy.ref).toBe("cat/cat-harness/fsh-guts");
  });

  test("a second run reports already-retired and touches nothing", () => {
    const { dir } = entry({ git: true });
    run(dir, "--apply");
    const before = readFileSync(join(dir, "source.materialization.json"), "utf-8");
    expect(run(dir, "--apply").out.entries[0]?.result).toBe("already-retired");
    expect(readFileSync(join(dir, "source.materialization.json"), "utf-8")).toBe(before);
  });

  test("a sha256 mismatch is REFUSED and exits non-zero: the record would name the wrong bytes", () => {
    const { dir } = entry({ recordedSha: "0".repeat(64) });
    const { code, out } = run(dir, "--apply");
    expect(code).toBe(1);
    expect(out.entries[0]?.result).toBe("refused");
    expect(existsSync(join(dir, "0705.1468v1.pdf"))).toBe(true);
  });

  test("an unprocessed entry is skipped: its PDF has not been read yet", () => {
    const { dir } = entry({ sections: false });
    expect(run(dir, "--apply").out.entries[0]).toMatchObject({ result: "skipped", reason: expect.stringContaining("not processed") });
    expect(existsSync(join(dir, "0705.1468v1.pdf"))).toBe(true);
  });

  test("no arXiv id: skipped unless a DOI or history-only is allowed", () => {
    const doi = entry({ arxiv: false, doi: "10.1000/x" });
    expect(run(doi.dir).out.entries[0]?.result).toBe("skipped");
    expect(run(doi.dir, "--allow-doi").out.entries[0]).toMatchObject({ result: "retire", upstream: "https://doi.org/10.1000/x" });

    const none = entry({ arxiv: false, git: true });
    expect(run(none.dir, "--allow-doi").out.entries[0]?.result).toBe("skipped");
    run(none.dir, "--allow-history", "--apply");
    const r = record(none.dir);
    expect(r.provenance.upstream).toBeUndefined();
    expect(r.provenance.retiredCopy.path).toBe("fsh-guts/retired-pdfs/library/arxiv-0705.1468v1/0705.1468v1.pdf");
  });

  test("history-only needs an fsh-guts copy of the same bytes", () => {
    // Not in git: there is no retired copy, so nothing to point at.
    for (const o of [{ arxiv: false }, { arxiv: false, git: true, copy: "none" as const }, { arxiv: false, git: true, copy: "other" as const }]) {
      const { dir } = entry(o);
      expect(run(dir, "--allow-history", "--apply").out.entries[0]?.result).toBe("skipped");
      expect(existsSync(join(dir, "0705.1468v1.pdf"))).toBe(true);
    }
  });

  test("a copy holding other bytes is never named, even when arXiv is the upstream", () => {
    const { dir } = entry({ git: true, copy: "other" });
    run(dir, "--apply");
    expect(record(dir).provenance).not.toHaveProperty("retiredCopy");
  });
});

describe("the manifest carries the record", () => {
  test("source_materialization appears in meta when given, and is absent otherwise", () => {
    const structure = { doc_id: "d", sections: [], source: { file: "d.pdf", sha256: sha(PDF) } };
    const m = { $schema: "folio-materialization/v1", state: "referenced", provenance: { upstream: "https://arxiv.org/pdf/x" } };
    const meta = (files: Array<{ path: string; content: string }>) =>
      JSON.parse(files.find((f) => f.path === "manifest.jsonld")!.content).meta;
    expect(meta(buildDocumentNodes("d", structure, undefined, () => false, undefined, undefined, undefined, undefined, undefined, m)).source_materialization).toEqual(m);
    expect(meta(buildDocumentNodes("d", structure, undefined, () => false))).not.toHaveProperty("source_materialization");
  });
});
