/**
 * The ✍ suggest editor's profiles: found through the declaration, bundled
 * under the runtime's roles, and refused when a code ref leaves its layer
 * (bean folio-assistant-4dx7).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { writeDeclaration } from "../test/support/instance-fixture";
import { bundleEditorProfiles, editorProfiles, profileEntrySource, profileTokens, resolveCodeRef } from "./editor-profiles";

let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "editor-profiles-"));
  const sci = join(repo, "sci");
  mkdirSync(join(sci, "editor-checkers"), { recursive: true });
  mkdirSync(join(sci, "suggest"), { recursive: true });
  writeDeclaration(sci, { name: "sci", directories: [{ id: "sci-editor-checkers", path: "editor-checkers/", graphTypologies: ["editor-checkers"] }] });
  writeFileSync(
    join(sci, "suggest", "check.ts"),
    [
      "const arity = (tex: string) => Math.max(0, ...Array.from(tex.matchAll(/#([1-9])/g), (m) => Number(m[1])));",
      "export function checkIt(before: string, after: string) { return after.includes('{') && !after.includes('}') ? [{ severity: 'error', message: 'unbalanced' }] : []; }",
      "export function tableOf(k: Record<string, string>) { return Object.fromEntries(Object.entries(k).map(([n, t]) => [n.slice(1), arity(t)])); }",
      "export function inline(katex: unknown, macros: unknown) { return { katex, macros }; }",
      "export function openIt(host: unknown, ctx: { text: string }) { return { get: async () => ctx.text + '!', dispose() {} }; }",
      "export function issueOf(before: string, after: string) { return { title: 'T', body: after }; }",
      "export function features(f: Record<string, string>, k: Record<string, string>) { return { [f.Math]: { k } }; }",
      "",
    ].join("\n"),
  );
  // A content type's own syntax, as token rules: `@name{key}` references.
  writeFileSync(
    join(sci, "suggest", "tokens.ts"),
    String.raw`export function atRefs() { return [{ id: "at-ref", shield: /@[a-z]+\{[^}\n]*\}/, find: /@[a-z]+\S*/g, valid: /^@[a-z]+\{[^{}\n]+\}$/, trim: /[.,;:)]+$/ }]; }
export function noFind() { return [{ id: "half", find: /@x/g }]; }
export function globalValid() { return [{ id: "g", find: /@x/g, valid: /@x/g }]; }
export const notAFunction = [];
`,
  );
  const node = (id: string, contentType: string, extra: object = {}) =>
    JSON.stringify({ $schema: "folio-editor-checker/v1", id, contentType, check: "suggest/check.ts#checkIt", ...extra });
  writeFileSync(
    join(sci, "editor-checkers", "paper-math.json"),
    node("paper-math", "paper", { macros: "suggest/check.ts#tableOf", crepe: { featureConfigs: "suggest/check.ts#features", nodeViews: { math_inline: "suggest/check.ts#inline" } }, rawFirstFor: ["proof"], tokens: "suggest/tokens.ts#atRefs" }),
  );
  writeFileSync(join(sci, "editor-checkers", "doc.json"), node("doc", "document"));
  // A mode: its own editor, for a file type that is not Markdown, and no checker.
  writeFileSync(join(sci, "editor-checkers", "form.json"), JSON.stringify({ $schema: "folio-editor-checker/v1", id: "form", contentType: "fhir", extensions: [".json"], open: "suggest/check.ts#openIt", issue: "suggest/check.ts#issueOf" }));
  // Neither a checker nor an editor: nothing to load.
  writeFileSync(join(sci, "editor-checkers", "empty.json"), JSON.stringify({ $schema: "folio-editor-checker/v1", id: "empty", contentType: "fhir" }));
  writeFileSync(join(sci, "editor-checkers", "other.json"), JSON.stringify({ $schema: "something-else/v1", id: "x", contentType: "paper" }));
});
afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("editor profiles", () => {
  test("found through the declaration, by content type", () => {
    expect(editorProfiles(repo, "paper").map((p) => p.node.id)).toEqual(["paper-math"]);
    expect(editorProfiles(repo, "document").map((p) => p.node.id)).toEqual(["doc"]);
    expect(editorProfiles(repo, "fhir").map((p) => p.node.id)).toEqual(["form"]);
    expect(editorProfiles(repo, "lean")).toEqual([]);
  });

  test("the bundle re-exports each code ref under its role", () => {
    const src = profileEntrySource(editorProfiles(repo, "paper")[0]!);
    expect(src).toContain("checkIt as check");
    expect(src).toContain("tableOf as macros");
    expect(src).toContain("features as featureConfigs");
    expect(src).toContain('export const nodeViews = { "math_inline": nodeView0 }');
  });

  test("a code ref outside its instance, or to no file, is refused", () => {
    expect(() => resolveCodeRef(join(repo, "sci"), "../x.ts#y")).toThrow("outside its instance");
    expect(() => resolveCodeRef(join(repo, "sci"), "suggest/none.ts#y")).toThrow("does not exist");
    expect(() => resolveCodeRef(join(repo, "sci"), "suggest/check.ts")).toThrow("not a code ref");
  });

  test("bundled into one browser module that runs on its own", async () => {
    const out = join(repo, "site", "assets", "suggest");
    const profiles = await bundleEditorProfiles(repo, "paper", out, "../../assets/suggest/");
    expect(profiles).toEqual([{ id: "paper-math", module: "../../assets/suggest/paper-math.js", rawFirstFor: ["proof"], tokens: [{ id: "at-ref", shield: String.raw`/@[a-z]+\{[^}\n]*\}/`, find: String.raw`/@[a-z]+\S*/g`, valid: String.raw`/^@[a-z]+\{[^{}\n]+\}$/`, trim: String.raw`/[.,;:)]+$/` }] }]);
    const js = readFileSync(join(out, "paper-math.js"), "utf-8");
    expect(js).not.toMatch(/\bimport\b[^(]/);
    const mod = await import(join(out, "paper-math.js"));
    expect(mod.check("a", "a {")).toEqual([{ severity: "error", message: "unbalanced" }]);
    expect(mod.macros({ "\\pair": "#1,#2" })).toEqual({ pair: 2 });
    expect(Object.keys(mod.nodeViews)).toEqual(["math_inline"]);
    expect(mod.featureConfigs({ Math: "math" }, { a: "b" })).toEqual({ math: { k: { a: "b" } } });
    expect(await bundleEditorProfiles(repo, "lean", join(repo, "none"), "")).toEqual([]);
  });

  test("a mode bundles its open and issue, and names the file types it serves", async () => {
    const out = join(repo, "site", "assets", "suggest");
    expect(await bundleEditorProfiles(repo, "fhir", out, "")).toEqual([{ id: "form", module: "form.js", extensions: [".json"] }]);
    const mod = await import(join(out, "form.js"));
    const h = mod.open(null, { text: "{}" });
    expect(await h.get()).toBe("{}!");
    expect(mod.issue("a", "b")).toEqual({ title: "T", body: "b" });
    expect(mod.check).toBeUndefined();
  });

  test("token rules are called at build time, serialised, and refused when they would do nothing", async () => {
    const found = editorProfiles(repo, "paper")[0]!;
    const at = (tokens: string) => profileTokens({ ...found, node: { ...found.node, tokens } });
    expect(await profileTokens({ ...found, node: { ...found.node, tokens: undefined } })).toBeUndefined();
    await expect(at("suggest/tokens.ts#noFind")).rejects.toThrow("a find needs a valid");
    await expect(at("suggest/tokens.ts#globalValid")).rejects.toThrow("must not be global");
    await expect(at("suggest/tokens.ts#notAFunction")).rejects.toThrow("is not a function");
  });
});
