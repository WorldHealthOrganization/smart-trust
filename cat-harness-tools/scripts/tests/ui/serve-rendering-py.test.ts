/**
 * The rendering server (Python implementation): declared media types,
 * the directory-index rule, and containment.
 *
 * Real HTTP requests against a real bound socket launched via Python 3
 * standard library server (`scripts/serve-rendering.py`).
 *
 * Bean `folio-assistant-0hi8`. Satisfies `skills/requirements/serving-a-rendering.json`.
 *
 * @module scripts/tests/serve-rendering-py.test
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";

let root: string;
let secret: string;
let proc: Subprocess;
let baseUrl: string;

const url = (p: string): string => `${baseUrl}${p}`;

function runPython(code: string): string {
  const result = Bun.spawnSync(["python3", "-c", code], {
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (!result.success) {
    throw new Error(`Python execution failed: ${new TextDecoder().decode(result.stderr)}`);
  }
  return new TextDecoder().decode(result.stdout).trim();
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "serve-rendering-py-"));
  writeFileSync(join(root, "folio-assistant.jsonld"), '{"@context":{}}');
  writeFileSync(join(root, "folio-assistant.json"), '{"@context":{}}');
  writeFileSync(join(root, "folio-assistant.schema.json"), '{"$schema":"x"}');
  writeFileSync(join(root, "notes.txt"), "plain");
  mkdirSync(join(root, "folio-assistant"));
  writeFileSync(join(root, "folio-assistant", "index.html"), "<!doctype html><title>viewer</title>");

  // Outside the served root, to verify containment
  secret = mkdtempSync(join(tmpdir(), "serve-rendering-outside-py-"));
  writeFileSync(join(secret, "secret.txt"), "should never be served");

  const pyScript = join(import.meta.dir, "../../serve-rendering.py");
  proc = Bun.spawn(["python3", pyScript, "--dir", root, "--port", "0"], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });

  // Read the first line of stdout to extract the bound port and url
  if (!proc.stdout || typeof proc.stdout === "number") {
    throw new Error("proc.stdout is not a readable stream");
  }
  const reader = proc.stdout.getReader();
  let buffer = "";
  const decoder = new TextDecoder();

  while (!buffer.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  const line = buffer.split("\n")[0].trim();
  const match = /http:\/\/[0-9a-zA-Z.]+:[0-9]+/.exec(line);
  if (!match) {
    throw new Error(`Failed to extract server URL from output: ${line}`);
  }
  baseUrl = match[0];
});

afterAll(async () => {
  if (proc) {
    proc.kill();
    await proc.exited;
  }
  rmSync(root, { recursive: true, force: true });
  rmSync(secret, { recursive: true, force: true });
});

describe("the python media-type table", () => {
  test("`.schema.json` beats `.json` — compound extension wins", () => {
    const out = runPython(`
import importlib.util
from pathlib import Path
p = Path("${join(import.meta.dir, "../../serve-rendering.py")}").resolve()
spec = importlib.util.spec_from_file_location("serve_rendering", str(p))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.rendering_media_type("x.schema.json"))
print(mod.rendering_media_type("x.json"))
    `);
    const lines = out.split("\n");
    expect(lines[0]).toBe("application/schema+json");
    expect(lines[1]).toBe("application/json");
  });

  test("the compound extension is listed before its own suffix", () => {
    const out = runPython(`
import importlib.util
from pathlib import Path
p = Path("${join(import.meta.dir, "../../serve-rendering.py")}").resolve()
spec = importlib.util.spec_from_file_location("serve_rendering", str(p))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
exts = [e for e, _ in mod.RENDERING_MEDIA_TYPES]
assert exts.index(".schema.json") < exts.index(".json")
print("OK")
    `);
    expect(out).toBe("OK");
  });

  test("an undeclared extension is None, not a guess", () => {
    const out = runPython(`
import importlib.util
from pathlib import Path
p = Path("${join(import.meta.dir, "../../serve-rendering.py")}").resolve()
spec = importlib.util.spec_from_file_location("serve_rendering", str(p))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.rendering_media_type("notes.txt") is None)
print(mod.rendering_media_type("archive.tar.gz") is None)
    `);
    const lines = out.split("\n");
    expect(lines[0]).toBe("True");
    expect(lines[1]).toBe("True");
  });
});

describe("what a client actually receives from python server", () => {
  test.each([
    ["/folio-assistant.jsonld", "application/ld+json"],
    ["/folio-assistant.json", "application/json"],
    ["/folio-assistant.schema.json", "application/schema+json"],
  ])("%s is served as %s", async (path, expected) => {
    const res = await fetch(url(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(expected);
  });

  test("the bare stub resolves to the viewer, as text/html", async () => {
    const res = await fetch(url("/folio-assistant/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
  });

  test("an undeclared file keeps the server's own inference, not octet-stream", async () => {
    const res = await fetch(url("/notes.txt"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  test("a missing path is 404", async () => {
    expect((await fetch(url("/nope.jsonld"))).status).toBe(404);
  });
});

describe("containment in python server", () => {
  test("traversal over the wire is 404", async () => {
    expect((await fetch(url("/%2e%2e/%2e%2e/etc/passwd"))).status).toBe(404);
  });

  test("plain traversal does not escape the root", async () => {
    expect((await fetch(url("/../../etc/passwd"))).status).toBe(404);
  });

  test("mixed separators traversal does not escape the root", async () => {
    expect((await fetch(url("/..//..//etc/passwd"))).status).toBe(404);
  });

  test("a symlink pointing outside the root is refused", async () => {
    symlinkSync(join(secret, "secret.txt"), join(root, "escape.txt"));
    const res = await fetch(url("/escape.txt"));
    expect(res.status).toBe(404);
  });

  test("a symlink staying inside the root still works", async () => {
    symlinkSync(join(root, "folio-assistant.jsonld"), join(root, "alias.jsonld"));
    const res = await fetch(url("/alias.jsonld"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/ld+json");
  });

  test("a broken symlink is 404 rather than a crash", async () => {
    symlinkSync(join(root, "no-such-target.jsonld"), join(root, "dangling.jsonld"));
    expect((await fetch(url("/dangling.jsonld"))).status).toBe(404);
  });

  test("a directory with no index is 404, not a listing", async () => {
    mkdirSync(join(root, "empty-dir"), { recursive: true });
    expect((await fetch(url("/empty-dir/"))).status).toBe(404);
  });

  test("a malformed percent-escape names no file", async () => {
    expect((await fetch(url("/%zz"))).status).toBe(404);
  });
});
