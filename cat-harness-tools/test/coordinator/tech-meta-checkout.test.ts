/**
 * `tech-meta` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/tech-meta.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads a who-iris library entry, which
 * only the checkout holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { libraryEntry } from "../../scripts/tests/library-dirs.ts";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** The module under test, in this layer's `scripts/`. */
const TECH_META_PY = join(import.meta.dir, "..", "..", "scripts", "_tech_meta.py");

function techMeta(file: string): Record<string, unknown> {
  const py =
    "import sys, json, importlib.util as u\n" +
    // Absolute, from this file's location. It was `'scripts/_tech_meta.py'`,
    // relative to the CWD — a path inside a python string inside a test, which
    // no scan here reaches. Fifth instance of this exact shape on this branch.
    // The module moved with the rest of cat-harness's code into this layer
    // (bean `70lx`): `cat-harness/scripts/` no longer exists, so it is read
    // from `cat-harness-tools/scripts/`, this file's own layer.
    `spec = u.spec_from_file_location('t', ${JSON.stringify(TECH_META_PY)})\n` +
    "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
    "print(json.dumps(m.tech_meta(sys.argv[1])))\n";
  const r = Bun.spawnSync(["python3", "-c", py, file], { cwd: ROOT });
  // A failed run says why, rather than surfacing as a JSON parse error of empty stdout.
  if (r.exitCode !== 0) throw new Error(`_tech_meta.py exited ${r.exitCode}: ${new TextDecoder().decode(r.stderr)}`);
  return JSON.parse(new TextDecoder().decode(r.stdout)) as Record<string, unknown>;
}

describe("the mechanical facts", () => {

  test("the real corpus agrees with what pdf-structure recorded independently", () => {
    // pdf-structure.py computed these digests with its own implementation
    // before this module existed. Agreement is the cross-check.
    // READ from the declaration: the corpus moved to `who-iris/` in bean
    // `frs5`, and `cat` on a missing file returns empty stdout, so composing
    // the path here would have turned a moved document into a JSON parse
    // error rather than a clear "not found".
    const entry = libraryEntry("who-pub-tps-931");
    expect(entry, "who-pub-tps-931 is not in any declared library").toBeDefined();
    const s = JSON.parse(readFileSync(join(entry!, "structure.json"), "utf-8")) as {
      source: { sha256: string; file: string };
    };
    // The SOURCE path is derived too, and it has to be: bean `yl5w` moved
    // this PDF out of `cat-harness/uploads/` and into the folio beside its own
    // intake, and the line here was `join(ROOT, "uploads/WHO_PUB_TPS_93.1.pdf")`
    // — a literal, in the one test whose own comment says asserting a spelling
    // of a location is what re-pins the next relocation. `structure.json`
    // records the source FILENAME, and the library entry says which layer and slug,
    // so the upload sits at `<instance>/uploads/<slug>/<basename>` with nothing
    // spelled out here.
    const slug = basename(entry!);
    const instance = resolve(entry!, "..", "..");
    const pdf = join(instance, "uploads", slug, s.source.file);
    expect(existsSync(pdf), `the ingested source for ${slug} is not at ${pdf}`).toBe(true);
    expect(techMeta(pdf).sha256).toBe(s.source.sha256);
  });
});
