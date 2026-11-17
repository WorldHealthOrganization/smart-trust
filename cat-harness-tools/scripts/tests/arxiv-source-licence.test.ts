/**
 * `arxiv-source.py` beyond the fetch: the files it unpacks, and the licence
 * record it writes. Both feed the graph — the files through `source.json`,
 * the licence through `licence.json` — and the licence decides whether a paper
 * may be republished, so the three states are tested, not just the happy one.
 *
 * arXiv is served from fixtures over `file://` (`ARXIV_EPRINT_URL`,
 * `ARXIV_OAI_URL`), so nothing here touches the network.
 *
 * @module scripts/tests/arxiv-source-licence
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { latexSourceNode } from "../../pipeline/gen-library-jsonld.ts";

const SCRIPTS = new URL("..", import.meta.url).pathname;
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

const ID = "0705.1468v1";
const oai = (license?: string): string =>
  `<?xml version="1.0"?><OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/"><GetRecord><record><metadata>` +
  `<arXiv xmlns="http://arxiv.org/OAI/arXiv/"><id>0705.1468</id><title>Knots</title>` +
  (license ? `<license>${license}</license>` : "") +
  `</arXiv></metadata></record></GetRecord></OAI-PMH>`;

/** A library entry, an e-print bundle built from `members`, and an OAI record. */
function fixture(members: Record<string, string> | "pdf", license?: string) {
  const root = mkdtempSync(join(tmpdir(), "axs-"));
  made.push(root);
  const entry = join(root, "library", `arxiv-${ID}`);
  mkdirSync(entry, { recursive: true });
  const serve = join(root, "serve");
  mkdirSync(serve);
  if (members === "pdf") {
    writeFileSync(join(serve, `${ID}`), "%PDF-1.4 not a source");
  } else {
    // Python builds the tar so a hostile member name (`../x`) can be written.
    const py = `
import io, json, sys, tarfile
m = json.loads(sys.argv[2])
with tarfile.open(sys.argv[1], "w:gz") as t:
    for name, body in m.items():
        b = body.encode(); i = tarfile.TarInfo(name); i.size = len(b); t.addfile(i, io.BytesIO(b))`;
    const r = Bun.spawnSync(["python3", "-c", py, join(serve, ID), JSON.stringify(members)]);
    if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  }
  writeFileSync(join(serve, "0705.1468.xml"), oai(license));
  const env = {
    ...process.env,
    ARXIV_EPRINT_URL: `file://${serve}/{id}`,
    ARXIV_OAI_URL: `file://${serve}/{id}.xml`,
  };
  const run = (...args: string[]) => {
    const r = Bun.spawnSync(["python3", join(SCRIPTS, "arxiv-source.py"), entry, "--delay", "0", ...args], { env });
    return { code: r.exitCode, out: new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr) };
  };
  const json = (p: string) => JSON.parse(readFileSync(join(entry, p), "utf-8"));
  return { entry, run, json };
}

const BUNDLE = {
  "main.tex": "\\documentclass{article}\\begin{document}x\\end{document}",
  "sec/intro.tex": "\\section{Intro}",
  "refs.bib": "@article{a,}",
  "LICENSE": "CC BY 4.0",
  "fig.eps": "%!PS",
  "../escape.tex": "outside",
};

describe("arxiv-source: unpacked files", () => {
  test("keeps the TeX, bibliography and licence files, and nothing else", () => {
    const f = fixture(BUNDLE, "http://creativecommons.org/licenses/by/4.0/");
    expect(f.run().code).toBe(0);
    const kept = f.json("source/source.json").files.map((x: { path: string; role: string }) => `${x.path}:${x.role}`);
    expect(kept).toEqual(["files/LICENSE:licence", "files/main.tex:tex", "files/refs.bib:bib", "files/sec/intro.tex:tex"]);
    expect(existsSync(join(f.entry, "source", "files", "fig.eps"))).toBe(false);
    // A member climbing out of the bundle is refused, not written beside it.
    expect(existsSync(join(f.entry, "source", "escape.tex"))).toBe(false);
    expect(existsSync(join(f.entry, "source", "files", "escape.tex"))).toBe(false);
  });
});

describe("arxiv-source: licence", () => {
  test("a licence arXiv states is recorded as stated, with where it was read", () => {
    const f = fixture(BUNDLE, "http://creativecommons.org/licenses/by/4.0/");
    f.run();
    const l = f.json("licence.json");
    expect(l.status).toBe("stated");
    expect(l.id).toBe("http://creativecommons.org/licenses/by/4.0/");
    expect(l.basis).toContain("0705.1468.xml");
    // The bundle's own licence file is pointed at, not silently dropped.
    expect(l.note).toContain("source/files/LICENSE");
  });

  test("no <license> element is unknown, never a default licence", () => {
    const f = fixture({ "main.tex": "x" });
    f.run();
    const l = f.json("licence.json");
    expect(l.status).toBe("unknown");
    expect(l.id).toBeUndefined();
    expect(l.searched[0].result).toContain("no <license>");
  });

  test("a PDF-only paper still gets its licence recorded", () => {
    const f = fixture("pdf", "http://arxiv.org/licenses/nonexclusive-distrib/1.0/");
    const { code, out } = f.run();
    expect(code).toBe(0);
    expect(out).toContain("pdf-only");
    expect(existsSync(join(f.entry, "source", "e-print"))).toBe(false);
    expect(f.json("licence.json").id).toBe("http://arxiv.org/licenses/nonexclusive-distrib/1.0/");
  });

  test("an editor's licence.json is left alone", () => {
    const f = fixture(BUNDLE, "http://creativecommons.org/licenses/by/4.0/");
    const mine = { status: "stated", id: "CC0-1.0", basis: "the author's email of 2026-10-01" };
    writeFileSync(join(f.entry, "licence.json"), JSON.stringify(mine));
    f.run("--refetch");
    expect(f.json("licence.json")).toEqual(mine);
  });
});

describe("gen-library-jsonld: the LaTeX source node", () => {
  test("is a SourceDocument partOf the paper, carrying its files and the paper's licence", () => {
    const lic = { status: "stated", id: "http://creativecommons.org/licenses/by/4.0/", basis: "arXiv" };
    const { path, content } = latexSourceNode(
      "arxiv-0705.1468v1",
      { url: "https://arxiv.org/e-print/0705.1468v1", sha256: "ab", bytes: 9, files: [{ path: "files/main.tex", role: "tex", sha256: "cd", bytes: 3 }] },
      "Knots in the Skyrme-Faddeev model",
      lic,
    );
    expect(path).toBe("source/manifest.jsonld");
    const n = JSON.parse(content);
    expect(n["@id"]).toMatch(/arxiv-0705\.1468v1\/source\/manifest$/);
    expect(n["@type"].join()).toContain("SourceDocument");
    expect(n.partOf).toMatch(/arxiv-0705\.1468v1\/manifest$/);
    expect(n.licenceRecord).toEqual(lic);
    expect(n.meta.files[0].path).toBe("source/files/main.tex");
  });
});
