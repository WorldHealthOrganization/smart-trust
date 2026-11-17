/**
 * A tiny built site for the page scan, shared by `ig-page-render-qa.test.ts`
 * (no browser) and `ig-page-render-qa.e2e.ts` (a real browser): a page drawn by
 * a script in the browser, a static page, a JSON view, a mappings view and a
 * redirect stub.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function pageScanSite(): string {
  const d = mkdtempSync(join(tmpdir(), "page-scan-"));
  mkdirSync(join(d, "artifact"), { recursive: true });
  const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body><main>${body}</main></body></html>`;
  // Drawn in the browser, as the artefact pages are: raw markdown in one block, a link and code in another.
  writeFileSync(join(d, "artifact", "ActorDefinition-a.html"), page(`<div class="iga-body"><p class="iga-state">Loading…</p></div><script>
    setTimeout(function () { var b = document.querySelector(".iga-body"); b.innerHTML = "<p>**Persona**: a phone</p><ul><li><a href='x.html'>X</a>: fine</li></ul><p><code>**meant**</code> and !<a href='y.html'>Bo</a></p>"; }, 50);
  </script>`));
  writeFileSync(join(d, "index.html"), page("<h2>1. Plan</h2><p>Plain text, a <a href='artifact/ActorDefinition-a.html'>link</a> (and <a href='z.html'>another</a>).</p>"));
  writeFileSync(join(d, "artifact", "ActorDefinition-a.json.html"), page("<p>**json**</p>"));
  writeFileSync(join(d, "artifact", "StructureDefinition-s-mappings.html"), page("<td>* .role [classCode = x]</td>"));
  writeFileSync(join(d, "old.html"), `<meta http-equiv="refresh" content="0; url=index.html">`);
  return d;
}
