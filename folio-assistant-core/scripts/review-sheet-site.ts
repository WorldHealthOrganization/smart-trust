/**
 * Publish a folio's review-sheet script and settings with its site.
 *
 *   bun run folio-assistant-core/scripts/review-sheet-site.ts [--repo <folio root>] [--out _site]
 *
 * For every `review/<mode>/sheet-sync.json` in the folio, writes under
 * `<out>/review-sheet/`:
 *
 * - `Code.gs`: the one generic script every review sheet runs (owner,
 *   2026-10-31, option C), the only file a person pastes;
 * - `<mode>.config-rows.json`: that document's Config tab rows;
 * - `review-sheet.jsonld`: the graph of what is published here: the script
 *   (with its SHA-256 and the commit it was built from) and each document's
 *   settings, linked to the sheet and to the Tool that built them;
 * - `index.html`: a page that says what each file is and how to set a sheet
 *   up, with the SHA-256 to check a pasted copy against.
 *
 * Skill: `review-sheet-script`. Tool: `review-sheet-sync`.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig, buildScript, configRows } from "../tools/review-sheet-sync/build-review-sheet-script.ts";

const SKILL = "https://github.com/litlfred/folio-assistant-core/blob/main/skills/content/folio-document-adapter/review-sheet-script.md";
const TOOL = "https://github.com/litlfred/folio-assistant-core/tree/main/tools/review-sheet-sync";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Every `review/<mode>/sheet-sync.json` of the folio, repository-relative. */
export function sheetConfigs(repo: string): string[] {
  const review = join(repo, "review");
  if (!existsSync(review)) return [];
  return readdirSync(review, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(review, d.name, "sheet-sync.json")))
    .map((d) => `review/${d.name}/sheet-sync.json`)
    .sort();
}

export function buildReviewSheetSite(repo: string, out: string): { configs: number; dir: string } {
  const configs = sheetConfigs(repo);
  const dir = join(out, "review-sheet");
  if (!configs.length) return { configs: 0, dir };
  mkdirSync(dir, { recursive: true });

  const script = buildScript();
  const scriptSha = sha256(script);
  const commit = (script.match(/tools\/review-sheet-sync at ([0-9a-f]{7,40}|[^.\s]+)/) ?? [])[1] ?? "unknown";
  writeFileSync(join(dir, "Code.gs"), script);
  const here = dirname(fileURLToPath(import.meta.url));
  const scopes: string[] = JSON.parse(readFileSync(join(here, "../tools/review-sheet-sync/appsscript.json"), "utf8")).oauthScopes;

  const docs = configs.map((path) => {
    const c = buildConfig(repo, path);
    const mode = c.CFG.MODE;
    const file = `${mode}.config-rows.json`;
    writeFileSync(join(dir, file), `${JSON.stringify(configRows(c), null, 1)}\n`);
    return { path, mode, file, sheet: c.CFG.SHEET };
  });

  const graph = {
    "@context": { schema: "https://schema.org/", dcterms: "http://purl.org/dc/terms/", prov: "http://www.w3.org/ns/prov#", spdx: "http://spdx.org/rdf/terms#" },
    "@graph": [
      {
        "@id": "Code.gs",
        "@type": "schema:SoftwareSourceCode",
        "schema:name": "Review sheet Apps Script (generic)",
        "schema:programmingLanguage": "Google Apps Script",
        "schema:codeRepository": TOOL,
        "schema:version": commit,
        "spdx:checksum": { "spdx:algorithm": "SHA-256", "spdx:checksumValue": scriptSha },
        "schema:permissions": scopes,
        "prov:wasGeneratedBy": { "@id": `${TOOL}#review-sheet-sync` },
      },
      ...docs.map((d) => ({
        "@id": d.file,
        "@type": "schema:Dataset",
        "schema:name": `Review sheet settings (${d.mode})`,
        "dcterms:source": d.path,
        "schema:isPartOf": d.sheet ? { "@id": `https://docs.google.com/spreadsheets/d/${d.sheet}/edit` } : undefined,
        "dcterms:conformsTo": { "@id": "Code.gs" },
        "prov:wasGeneratedBy": { "@id": `${TOOL}#review-sheet-sync` },
      })),
    ],
  };
  const jsonld = JSON.stringify(graph, null, 2);
  writeFileSync(join(dir, "review-sheet.jsonld"), `${jsonld}\n`);

  const rows = docs.map((d) => `<tr><td>${esc(d.mode)}</td><td><code>${esc(d.path)}</code></td><td><a href="${esc(d.file)}">${esc(d.file)}</a></td><td>${d.sheet ? `<a href="https://docs.google.com/spreadsheets/d/${esc(d.sheet)}/edit">the sheet</a>` : "not named in the config"}</td></tr>`).join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review sheet script</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:52rem;margin:2rem auto;padding:0 1rem}code{font-size:.9em}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.3rem .5rem;text-align:left}</style>
<script type="application/ld+json">${jsonld.replace(/</g, "\\u003c")}</script>
</head><body>
<h1>Review sheet script</h1>
<p>One Google Apps Script runs every review sheet of this document. What is particular to the document is in the sheet's <b>Config</b> tab, which the agent writes and only the sheet's owner can edit.</p>
<h2>Files</h2>
<ul>
<li><a href="Code.gs">Code.gs</a>: the script. SHA-256 <code>${scriptSha}</code>, built from folio-assistant-core at <code>${esc(commit)}</code>. It reads and writes only the sheet it is installed in.</li>
<li><a href="review-sheet.jsonld">review-sheet.jsonld</a>: these files as linked data.</li>
</ul>
<h2>Settings for this document</h2>
<table><tr><th>mode</th><th>from</th><th>Config rows</th><th>sheet</th></tr>
${rows}
</table>
<h2>Set up a sheet</h2>
<ol>
<li>Copy the template for the mode, name it, and share it with the contributors as Editor.</li>
<li>Give the agent the copy's URL; it writes the Config tab.</li>
<li>Data &gt; Protect sheets and ranges &gt; "Ready columns: editors" &gt; Change permissions &gt; Custom: add each editor.</li>
<li>Extensions &gt; Apps Script: paste <a href="Code.gs">Code.gs</a> (the only file to paste); save; run <b>installTriggers</b>. Google asks for three permissions: this spreadsheet, the script's own triggers, and its menu.</li>
<li>Drafting only: on the Sections column, tick "Allow multiple selections" in its data validation.</li>
</ol>
<p>To check a pasted copy: compute the SHA-256 of its text and compare it with the one above. The full steps are in the <a href="${SKILL}">review-sheet-script skill</a>.</p>
</body></html>
`;
  writeFileSync(join(dir, "index.html"), html);
  return { configs: docs.length, dir };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repo = resolve(opt("repo") ?? process.cwd());
  const r = buildReviewSheetSite(repo, resolve(repo, opt("out") ?? "_site"));
  console.error(r.configs ? `✓ review sheet: ${r.configs} config(s) → ${r.dir}/index.html` : "review sheet: no review/*/sheet-sync.json, nothing to publish");
}
