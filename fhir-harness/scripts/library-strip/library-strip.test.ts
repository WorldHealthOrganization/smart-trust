/**
 * The two Library strippers, placed in the base layer (bean `wm63`): they run
 * on an IG that is not WHO's, and the copies here are still the upstream bytes
 * the README records.
 */
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dir;
const b64 = (s: string) => Buffer.from(s).toString("base64");

/** A Publisher `output/` for a non-WHO IG: one Library carrying CQL and ELM inline. */
function fixture(): string {
  const d = mkdtempSync(join(tmpdir(), "library-strip-"));
  writeFileSync(
    join(d, "Library-Foo.json"),
    JSON.stringify({
      resourceType: "Library",
      id: "Foo",
      url: "http://example.org/fhir/Library/Foo",
      content: [
        { contentType: "text/cql", data: b64("library Foo") },
        { contentType: "application/elm+json", data: b64('{"library":{}}') },
      ],
    }),
  );
  writeFileSync(join(d, "Library-Foo.cql"), "library Foo");
  return d;
}

function run(script: string, dir: string) {
  const r = Bun.spawnSync(["python3", join(here, script), dir]);
  expect(r.exitCode).toBe(0);
}

const content = (dir: string) => JSON.parse(readFileSync(join(dir, "Library-Foo.json"), "utf8")).content;

describe("the Library strippers run on a non-WHO IG", () => {
  it("contentReplacesInlineCql", () => {
    const d = fixture();
    try {
      run("strip_library_content.py", d);
      expect(content(d)[0]).toEqual({ contentType: "text/cql", url: "Library-Foo.cql" });
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });

  it("binariesExtractsElm", () => {
    const d = fixture();
    try {
      run("strip_library_binaries.py", d);
      expect(content(d)[1]).toEqual({ contentType: "application/elm+json", url: "Library-Foo.elm.json" });
      expect(existsSync(join(d, "Library-Foo.elm.json"))).toBe(true);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("the copies are the upstream bytes the README records", () => {
  const readme = readFileSync(join(here, "README.md"), "utf8");
  for (const f of ["strip_library_binaries.py", "strip_library_content.py"]) {
    it(`copyMatchesReadmeSha[${String(f).replace(/\s+/g, "_")}]`, () => {
      const recorded = new RegExp("`" + f.replace(".", "\\.") + "` ([0-9a-f]{64})").exec(readme)?.[1];
      const actual = createHash("sha256").update(readFileSync(join(here, f))).digest("hex");
      expect(recorded).toBe(actual);
    });
  }
});
