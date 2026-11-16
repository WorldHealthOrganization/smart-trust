/**
 * MCP tool arguments that name a path stay inside the repository.
 *
 * Security review 2026-10-31: `translation_*` joined `source`, `po_file`,
 * `pot_file`, `path` and `locale` straight into paths, so a locale like
 * `../../x` wrote outside the repo and `source` read any file. The workflow
 * `instance`, `folio_init`'s `dir` and `nquads_query`'s `dataset` had the same
 * shape. Each is now refused, never repaired.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registerTranslationTools } from "../src/tools/translation.ts";
import { registerNQuadsQueryTools } from "../src/tools/nquads-query.ts";
import { registerFolioInitTools } from "../src/tools/folio-init.ts";
import { loadInstance, saveInstance } from "../src/workflow/store.ts";

type Result = { content: Array<{ text: string }>; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

function handlers(register: (server: never) => void): Map<string, Handler> {
  const captured = new Map<string, Handler>();
  register({ tool: (n: string, _d: string, _s: unknown, fn: Handler) => captured.set(n, fn) } as never);
  return captured;
}

let base: string;
let repo: string;
let outside: string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "mcp-paths-"));
  repo = join(base, "repo");
  outside = join(base, "outside");
  mkdirSync(join(repo, "docs"), { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(repo, "docs", "a.md"), "# Title\n\nHello world.\n");
  writeFileSync(join(repo, "docs", "a.po"), 'msgid "Hello world."\nmsgstr "Bonjour le monde."\n');
  writeFileSync(join(outside, "secret.md"), "# Secret\n\nDo not read.\n");
  symlinkSync(join(outside, "secret.md"), join(repo, "docs", "link.md"));
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("translation tools", () => {
  const tools = () => handlers((s) => registerTranslationTools(s, repo));

  it("still injects for an ordinary source, po file and locale", async () => {
    const r = await tools().get("translation_inject")!({ source: "docs/a.md", po_file: "docs/a.po", locale: "fr" });
    expect(r.isError).toBeUndefined();
    expect(existsSync(join(repo, "translations", "fr", "a.md"))).toBe(true);
  });

  it("refuses a locale that is not a BCP 47 tag, and writes nothing outside", async () => {
    for (const locale of ["../../../outside/x", "..", "fr/../../x", "fr\0"]) {
      const r = await tools().get("translation_inject")!({ source: "docs/a.md", po_file: "docs/a.po", locale });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("BCP 47");
    }
    expect(existsSync(join(outside, "x"))).toBe(false);
    expect(existsSync(join(base, "x"))).toBe(false);
  });

  it("refuses to write through a locale directory that links out of the translations root", async () => {
    mkdirSync(join(repo, "translations"), { recursive: true });
    mkdirSync(join(outside, "de"), { recursive: true });
    symlinkSync(join(outside, "de"), join(repo, "translations", "de"));
    const r = await tools().get("translation_inject")!({ source: "docs/a.md", po_file: "docs/a.po", locale: "de" });
    expect(r.isError).toBe(true);
    expect(existsSync(join(outside, "de", "a.md"))).toBe(false);
  });

  it("refuses a source or po_file outside the repository, including through a link", async () => {
    const inject = tools().get("translation_inject")!;
    for (const source of ["../outside/secret.md", join(outside, "secret.md"), "docs/link.md"]) {
      const r = await inject({ source, po_file: "docs/a.po", locale: "fr" });
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain("not an existing path inside the repository");
    }
    const r = await inject({ source: "docs/a.md", po_file: "../outside/secret.md", locale: "fr" });
    expect(r.isError).toBe(true);
  });

  it("extract, status, signoff and validate refuse the same values", async () => {
    const t = tools();
    expect((await t.get("translation_extract")!({ path: "../outside", locale: "en" })).isError).toBe(true);
    expect((await t.get("translation_extract")!({ path: "docs/a.md", locale: "../../x" })).isError).toBe(true);
    expect((await t.get("translation_status")!({ locale: "../../outside" })).isError).toBe(true);
    expect((await t.get("translation_signoff")!({ locale: "../../x", source: "docs/a.md", signed_off_by: "a", level: "chapter" })).isError).toBe(true);
    expect((await t.get("translation_signoff")!({ locale: "fr", source: "../outside/secret.md", signed_off_by: "a", level: "chapter" })).isError).toBe(true);
    expect((await t.get("translation_validate")!({ pot_file: "../outside/secret.md", po_file: "docs/a.po" })).isError).toBe(true);
    expect(existsSync(join(base, "x"))).toBe(false);
  });
});

describe("workflow instance store", () => {
  it("does not read or write an instance id that is not one segment", () => {
    writeFileSync(join(outside, "planted.json"), JSON.stringify({ id: "planted" }));
    expect(loadInstance(repo, "../../outside/planted")).toBeUndefined();
    expect(() => saveInstance(repo, { id: "../../outside/evil" } as never)).toThrow("not one path segment");
    expect(existsSync(join(outside, "evil.json"))).toBe(false);
  });
});

describe("nquads_query and folio_init", () => {
  it("nquads_query refuses a dataset outside the working tree", async () => {
    const r = await handlers((s) => registerNQuadsQueryTools(s)).get("nquads_query")!({
      dataset: outside, query_name: "q", bindings: {}, format: "table",
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("Refused");
  });

  it("folio_init refuses a dir outside the working tree and an assistant_path with shell or code characters", async () => {
    const init = handlers((s) => registerFolioInitTools(s)).get("folio_init")!;
    const common = { title: "T", authors: ["A"], content_type: "document", link: "submodule", force: false, dry_run: true };
    const r1 = await init({ ...common, dir: outside });
    expect(r1.isError).toBe(true);
    expect(r1.content[0].text).toContain("not inside the repository");
    const r2 = await init({ ...common, dir: ".", assistant_path: 'x"; $(touch /tmp/x)' });
    expect(r2.isError).toBe(true);
  });
});
