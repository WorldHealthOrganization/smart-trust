/**
 * The ✍ suggest editor, installed into a built site: Milkdown Crepe and KaTeX
 * bundled into ONE module and ONE stylesheet at `assets/vendor/crepe/`, where
 * the edit-links runtime looks for them.
 *
 *   bun run cat-harness-tools/scripts/suggest-editor.ts --site _site
 *
 * ## Why bundled here and not loaded from a CDN
 *
 * jsDelivr's `+esm` serves each package as its own module and resolves each
 * one's dependencies on its own, so two copies of `prosemirror-state` meet in
 * one editor (*"Adding different instances of a keyed plugin"*). Its theme
 * CSS also `@import`s bare package paths a CDN cannot resolve. One bundle,
 * built from this package's pinned dependencies, has one copy of each and its
 * CSS inlined, and it is the bytes the tests run.
 *
 * ## Why installed at BUILD time and never committed
 *
 * As `pdf-viewer.ts` says of pdf.js: it costs the site and nothing else, and
 * the pin is this package's own `@milkdown/crepe` and `katex` versions.
 *
 * @covers none — a build step that installs third-party bytes, not an audit of a declared graph
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

/** Where the editor lands, relative to the SITE ROOT. The runtime derives the same path. */
export const SUGGEST_EDITOR_DIR = "assets/vendor/crepe";
/** The bundle's build record, beside it: the versions it was built from. */
export const BUILD_FILE = ".build.json";

// From the module URL, not `import.meta.dir`: the e2e spec imports this file under Node.
const ENTRY = join(dirname(fileURLToPath(import.meta.url)), "suggest-editor");

/** A package's directory, as module resolution from `from` (default: the bundle entry) finds it. */
export function packageDir(name: string, from: string = ENTRY): string {
  const main = Bun.resolveSync(name, from);
  const at = main.lastIndexOf(`/${name}/`);
  if (at < 0) throw new Error(`cannot place ${name} from ${main}`);
  return main.slice(0, at + name.length + 1);
}

/** The KaTeX Crepe depends on, found from Crepe's own directory. */
export function katexDir(): string {
  return packageDir("katex", packageDir("@milkdown/crepe"));
}

/** Bundle `crepe.js` (exports `Crepe`, and KaTeX as the default) and `crepe.css` (with KaTeX's fonts) into `<siteDir>/assets/vendor/crepe/`. */
export async function installSuggestEditor(siteDir: string): Promise<{ dir: string; files: string[] }> {
  const dir = join(resolve(siteDir), ...SUGGEST_EDITOR_DIR.split("/"));
  const work = mkdtempSync(join(tmpdir(), "suggest-editor-"));
  try {
    // KaTeX is Crepe's own dependency, resolved from Crepe's directory, so the
    // node views render with the KaTeX the editor ships and this package
    // declares no second copy beside the root's.
    const katex = katexDir();
    const jsEntry = join(work, "entry.ts");
    writeFileSync(jsEntry, `export * from ${JSON.stringify(join(ENTRY, "entry.ts"))};\nexport { default } from ${JSON.stringify(Bun.resolveSync("katex", katex))};\n`);
    const jsOut = join(work, "js");
    const js = await Bun.build({ entrypoints: [jsEntry], outdir: jsOut, target: "browser", format: "esm", minify: true, splitting: true, naming: { entry: "crepe.js", chunk: "chunks/[name]-[hash].js" } });
    if (!js.success) throw new Error(`the editor did not bundle: ${js.logs.map(String).join("; ")}`);
    // The stylesheet entry names each package's CSS by the path module
    // resolution finds, not by a relative node_modules path: standing alone, a
    // layer's own node_modules is not there and the root's is (seed-ready.ts).
    const cssEntry = join(work, "entry.css");
    writeFileSync(cssEntry, [
      `${packageDir("@milkdown/crepe")}/lib/theme/common/style.css`,
      `${packageDir("@milkdown/crepe")}/lib/theme/frame/style.css`,
    ].map((f) => `@import ${JSON.stringify(f)};`).join("\n") + "\n");
    const out = join(work, "out");
    const css = await Bun.build({ entrypoints: [cssEntry], outdir: out, minify: true, naming: { entry: "crepe.css" } });
    if (!css.success) throw new Error(`the editor's stylesheet did not bundle: ${css.logs.map(String).join("; ")}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    cpSync(jsOut, dir, { recursive: true });
    cpSync(out, dir, { recursive: true });
    // KaTeX's fonts as files beside the stylesheet, not inlined: Bun's CSS
    // bundler writes all sixty into crepe.css as base64, about a megabyte
    // compressed that every reader downloaded before the editor opened
    // (smart-ra, 2026-10-26). KaTeX's own @font-face rules name them by
    // relative url(fonts/…), and a browser fetches a font only when a formula
    // uses it.
    const FONT_FACE = /@font-face\s*\{[^}]*\}/g;
    const bundled = readFileSync(join(dir, "crepe.css"), "utf-8").replace(FONT_FACE, (r) => (r.includes("url(data:") ? "" : r));
    const katexFaces = readFileSync(join(katexDir(), "dist", "katex.min.css"), "utf-8").match(FONT_FACE) ?? [];
    if (!katexFaces.length) throw new Error("KaTeX's stylesheet declares no fonts");
    writeFileSync(join(dir, "crepe.css"), bundled + "\n" + katexFaces.join("") + "\n");
    cpSync(join(katexDir(), "dist", "fonts"), join(dir, "fonts"), { recursive: true });
    if (!existsSync(join(dir, "crepe.css"))) throw new Error("the editor's stylesheet was not written");
    // What the bundle was built from. Bun names chunks by a hash that depends on
    // the temporary build path, so two builds of the same versions differ in
    // bytes; a host that shares the bundle between sites keys it by this file
    // instead (scripts/lib/shared-assets.ts).
    const version = (d: string): string => String((JSON.parse(readFileSync(join(d, "package.json"), "utf-8")) as { version?: unknown }).version ?? "");
    writeFileSync(join(dir, BUILD_FILE), `${JSON.stringify({ "@milkdown/crepe": version(packageDir("@milkdown/crepe")), katex: version(katexDir()), bun: Bun.version }, null, 2)}\n`);
    const files = readdirSync(dir, { recursive: true }).map(String).sort();
    return { dir, files };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const site = argv[argv.indexOf("--site") + 1];
  if (!argv.includes("--site") || !site) {
    console.error("usage: suggest-editor.ts --site <built site dir>");
    process.exit(2);
  }
  installSuggestEditor(site)
    .then((r) => console.log(`suggest-editor: Crepe + KaTeX → ${r.dir} (${r.files.length} files)`))
    .catch((e) => {
      console.error(`✗ suggest-editor: ${(e as Error).message}`);
      process.exit(1);
    });
}
