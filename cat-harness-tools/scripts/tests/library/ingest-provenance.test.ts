/**
 * Ingest provenance — bean `turh`, the two gaps the who-iris re-ingest
 * (litlfred/who-iris#44) exposed:
 *
 * 1. a KNOWN title (the catalogue's `dc.title`, or `--title`) reaches the PDF
 *    rungs through `bun run cat ingest`, instead of a hand rebuild with
 *    `pdf-pages.py --from-ocr --title …`;
 * 2. the OCR engine and version are recorded at ingest time, as the existing
 *    `folio-run-context/v1` (cat-harness `schemas/sdlc/run-context.ts`) beside
 *    `ocr/`, and cited from `structure.json` `source.runContext` by digest.
 *
 * The run-context checks hold the Python writer to the TypeScript schema and
 * to `runContextRef`'s digest, so the two languages cannot disagree about
 * which context a structure cites.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RunContextSchema, runContextRef } from "../../../schemas/sdlc/run-context.ts";
import { PdfStructureSchema } from "../../../schemas/ui/pdf-structure.ts";

import { knownLanguages, knownTitle, withKnownTitle, withLanguageHint, type Plan } from "../../ingest-document.ts";

const SCRIPTS = join(import.meta.dir, "..", "..");
const py = (code: string, cwd: string) =>
  Bun.spawnSync(["python3", "-c", code], { cwd, env: { ...process.env, PYTHONPATH: SCRIPTS } });
const has = (bin: string) => Bun.spawnSync(["sh", "-c", `command -v ${bin}`]).exitCode === 0;
const hasPymupdf = Bun.spawnSync(["python3", "-c", "import pymupdf"]).exitCode === 0;

function gitRepo(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const g = (...a: string[]) => Bun.spawnSync(["git", "-C", root, ...a]);
  g("init", "-q");
  writeFileSync(join(root, "README"), "x\n");
  g("add", "README");
  g("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "x");
  return root;
}

describe("title pass-through (turh, gap 1)", () => {
  const plan: Plan = {
    rung: "pdf-ocr+pdf-pages",
    why: "scan",
    steps: [
      ["python3", "/s/pdf-ocr.py", "-o", "lib", "x.pdf"],
      ["python3", "/s/pdf-pages.py", "-o", "lib", "--from-ocr", "x.pdf"],
    ],
  };

  test("the title reaches the rungs that write structure.json and doc_title, and not the OCR", () => {
    const p = withKnownTitle(plan, "WHO Editorial Style Manual");
    expect(p.steps[0]).toEqual(plan.steps[0]!);
    expect(p.steps[1]).toEqual([...plan.steps[1]!, "--title", "WHO Editorial Style Manual"]);
    expect(withKnownTitle({ ...plan, steps: [["python3", "/s/pdf-structure.py", "-o", "lib", "x.pdf"]] }, "T").steps[0]).toContain("--title");
  });

  test("no title, no change; and never a second --title", () => {
    expect(withKnownTitle(plan, undefined)).toBe(plan);
    const once = withKnownTitle(plan, "A");
    expect(withKnownTitle(once, "B").steps[1]!.filter((a) => a === "--title")).toHaveLength(1);
  });

  test("--title wins; otherwise the catalogue's dc.title; otherwise nothing is guessed", () => {
    const root = mkdtempSync(join(tmpdir(), "turh-title-"));
    try {
      writeFileSync(
        join(root, "fixture.json"),
        JSON.stringify({
          name: "fixture",
          directories: [
            { id: "library", path: "library/", graphTypologies: ["library"] },
            { id: "catalogue", path: "catalogue/", graphTypologies: ["catalogue"] },
          ],
        }),
      );
      mkdirSync(join(root, "catalogue", "nodes"), { recursive: true });
      mkdirSync(join(root, "catalogue", "records"), { recursive: true });
      writeFileSync(
        join(root, "catalogue", "nodes", "item-x.json"),
        JSON.stringify({ id: "item/x", libraryId: "who-pub-tps-931", metadataRef: "catalogue/records/x.dc.json" }),
      );
      writeFileSync(
        join(root, "catalogue", "records", "x.dc.json"),
        JSON.stringify({ fields: [{ element: "title", values: [{ value: "WHO editorial style manual" }] }] }),
      );
      expect(knownTitle([], root, "who-pub-tps-931")).toEqual({
        title: "WHO editorial style manual",
        from: "catalogue/records/x.dc.json dc.title",
      });
      expect(knownTitle(["x.pdf", "--title", "Given"], root, "who-pub-tps-931")).toEqual({ title: "Given", from: "--title" });
      expect(knownTitle([], root, "no-such-entry")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("OCR language hint (owner, 2026-11-10)", () => {
  const plan: Plan = {
    rung: "pdf-ocr+pdf-pages",
    why: "scan",
    steps: [
      ["python3", "/s/pdf-ocr.py", "-o", "lib", "x.pdf"],
      ["python3", "/s/pdf-pages.py", "-o", "lib", "--from-ocr", "x.pdf"],
    ],
  };

  test("the languages reach the OCR rung only, once, and never over an explicit --lang", () => {
    const p = withLanguageHint(plan, ["fr", "en"]);
    expect(p.steps[0]).toEqual([...plan.steps[0]!, "--lang-hint", "fr,en"]);
    expect(p.steps[1]).toEqual(plan.steps[1]!);
    expect(withLanguageHint(p, ["ar"]).steps[0]!.filter((a) => a === "--lang-hint")).toHaveLength(1);
    const forced: Plan = { ...plan, steps: [["python3", "/s/pdf-ocr.py", "--lang", "jpn", "x.pdf"]] };
    expect(withLanguageHint(forced, ["fr"]).steps[0]).toEqual(forced.steps[0]!);
    expect(withLanguageHint(plan, [])).toBe(plan);
    expect(withLanguageHint(plan, undefined)).toBe(plan);
  });

  test("--lang-hint wins; otherwise the catalogue's dc.language.iso; otherwise nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "ocr-lang-"));
    try {
      writeFileSync(
        join(root, "fixture.json"),
        JSON.stringify({
          name: "fixture",
          directories: [
            { id: "library", path: "library/", graphTypologies: ["library"] },
            { id: "catalogue", path: "catalogue/", graphTypologies: ["catalogue"] },
          ],
        }),
      );
      mkdirSync(join(root, "catalogue", "nodes"), { recursive: true });
      mkdirSync(join(root, "catalogue", "records"), { recursive: true });
      writeFileSync(
        join(root, "catalogue", "nodes", "item-y.json"),
        JSON.stringify({ id: "item/y", libraryId: "10665-174143", metadataRef: "catalogue/records/y.dc.json" }),
      );
      writeFileSync(
        join(root, "catalogue", "records", "y.dc.json"),
        JSON.stringify({
          fields: [
            { element: "language", values: [{ value: "Русский" }] },
            { element: "language", qualifier: "iso", values: [{ value: "ru" }, { value: "en" }, { value: "ru" }] },
          ],
        }),
      );
      expect(knownLanguages([], root, "10665-174143")).toEqual({ langs: ["ru", "en"], from: "catalogue/records/y.dc.json dc.language.iso" });
      expect(knownLanguages(["x.pdf", "--lang-hint", "ar, fa"], root, "10665-174143")).toEqual({ langs: ["ar", "fa"], from: "--lang-hint" });
      expect(knownLanguages([], root, "no-such-entry")).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("pdf-ocr's language choice holds (scripts/tests/pdf-ocr-language.test.py)", () => {
    const r = Bun.spawnSync(["python3", join(SCRIPTS, "tests", "pdf-ocr-language.test.py")]);
    expect(r.stdout.toString()).toContain("all checks passed");
    expect(r.exitCode).toBe(0);
  });

  test("pdf-ocr's optional vision digit fallback holds (scripts/tests/pdf-ocr-vision-digits.test.py)", () => {
    const r = Bun.spawnSync(["python3", join(SCRIPTS, "tests", "pdf-ocr-vision-digits.test.py")]);
    expect(r.stdout.toString()).toContain("all checks passed");
    expect(r.exitCode).toBe(0);
  });
});

describe("which software ran, as a folio-run-context/v1 (turh, gap 2)", () => {
  test("the Python writer produces a context the schema accepts, with runContextRef's digest", () => {
    const root = gitRepo("turh-ctx-");
    try {
      writeFileSync(join(root, "in.pdf"), "%PDF-1.4 not really\n");
      writeFileSync(
        join(root, "index.lock.json"),
        JSON.stringify({ instances: [{ instance: "cat-harness", repository: "litlfred/cat-harness", sha: "a".repeat(40) }] }),
      );
      const r = py(
        `import json, _run_context as rc
ctx = rc.build(invoker_script="${join(SCRIPTS, "pdf-ocr.py")}",
               releases=[rc.provisioned("tesseract", "5.3.4", "${join(root, "README")}"),
                         rc.could_not_provision("tessdata-jpn", "unknown", "no jpn.traineddata")],
               inputs=["${join(root, "in.pdf")}"], where=["${root}"])
print(json.dumps({"ctx": ctx, "ref": rc.write(ctx, "${join(root, "ocr")}")}, ensure_ascii=False))`,
        root,
      );
      expect(r.exitCode).toBe(0);
      const out = JSON.parse(r.stdout.toString()) as { ctx: unknown; ref: { sha256: string } };
      const parsed = RunContextSchema.parse(out.ctx);
      expect(out.ref).toEqual(runContextRef(parsed));
      // And the file on disk is the same context.
      expect(runContextRef(RunContextSchema.parse(JSON.parse(readFileSync(join(root, "ocr", "run-context.json"), "utf8"))))).toEqual(out.ref);
      expect(parsed.invoker).toMatchObject({ kind: "system", id: "scripts/pdf-ocr.py" });
      expect(parsed.mounts.state).toBe("locked");
      expect(parsed.releases.map((x) => x.state)).toEqual(["provisioned", "could-not-provision"]);
      expect(parsed.inputs[0]!.inputs).toEqual(["in.pdf"]);
      expect(parsed.inputs[0]!.hash).toMatch(/^[0-9a-f]{12}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no checkout to name means no context, rather than an invalid one", () => {
    const dir = mkdtempSync(join(tmpdir(), "turh-nogit-"));
    try {
      const r = py(
        `import _run_context as rc
print(rc.build(invoker_script="/nonexistent/x.py", releases=[], inputs=[], where=["${dir}"]))`,
        dir,
      );
      // The script's own checkout is the fallback, so this is None only when
      // neither is a checkout; here the script path is not one.
      expect(r.stdout.toString().trim()).toBe("None");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(!(has("tesseract") && has("pdftoppm") && hasPymupdf))(
    "end to end: pdf-ocr records the engine, pdf-pages cites it and carries the known title",
    () => {
      const root = gitRepo("turh-e2e-");
      try {
        const pdf = join(root, "scan.pdf");
        const mk = py(
          `import pymupdf
d = pymupdf.open(); p = d.new_page()
p.insert_text((72, 120), "WHO Editorial Style Manual", fontsize=28)
d.save("${pdf}")`,
          root,
        );
        expect(mk.exitCode).toBe(0);
        const lib = join(root, "library");
        const ocr = Bun.spawnSync(["python3", join(SCRIPTS, "pdf-ocr.py"), "-o", lib, "--lang", "eng", pdf], { cwd: root });
        expect(ocr.exitCode).toBe(0);
        const entry = join(lib, readdirSync(lib)[0]!);
        const ctxFile = join(entry, "ocr", "run-context.json");
        expect(existsSync(ctxFile)).toBe(true);
        const ctx = RunContextSchema.parse(JSON.parse(readFileSync(ctxFile, "utf8")));
        const tess = ctx.releases.find((x) => x.release.startsWith("tesseract@"));
        expect(tess?.state).toBe("provisioned");
        expect(ctx.releases.some((x) => x.release.startsWith("tessdata-eng@"))).toBe(true);

        const pages = Bun.spawnSync(
          ["python3", join(SCRIPTS, "pdf-pages.py"), "-o", lib, "--from-ocr", "--title", "WHO Editorial Style Manual", pdf],
          { cwd: root },
        );
        expect(pages.exitCode).toBe(0);
        const st = PdfStructureSchema.parse(JSON.parse(readFileSync(join(entry, "structure.json"), "utf8")));
        expect(st.source.text_source).toBe("ocr");
        expect(st.source.runContext).toEqual(runContextRef(ctx));
        const sec = readdirSync(join(entry, "sections"))[0]!;
        expect(readFileSync(join(entry, "sections", sec), "utf8")).toContain('doc_title: "WHO Editorial Style Manual"');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
