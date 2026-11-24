#!/usr/bin/env bun
/**
 * Headless rendering QC — checks HTML rendering of diagrams, SVGs,
 * LaTeX math, and markdown using Playwright.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/headless-render-qc.ts
 *   bun run cat-harness-tools/scripts/headless-render-qc.ts --screenshot  # save screenshots
 *
 * Requires: playwright (npx playwright install chromium)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { findContentRepoRoot } from "../pipeline/repo-root";

// `VIEWER_DIR` below is `<root>/folio-assistant/ui` — a FOLIO-relative path,
// since inside a folio the platform IS the `folio-assistant/` directory. So
// this root must be the folio's, not `import.meta.dir`'s, which pointed at
// `<platform>/folio-assistant/ui` and does not exist in any checkout.
const REPO_ROOT = findContentRepoRoot();
const VIEWER_DIR = join(REPO_ROOT, "folio-assistant", "ui");
const BUILD_DIR = join(REPO_ROOT, "build", "viewer");
const PAPER_JSON = join(BUILD_DIR, "paper.json");
const OUT_DIR = join(REPO_ROOT, "build", "render-qc");
const SAVE_SCREENSHOTS = process.argv.includes("--screenshot");

if (!existsSync(PAPER_JSON)) {
  console.error(`No paper.json found at ${PAPER_JSON}. Export it first with the science layer's pipeline/export-json.ts.`);
  process.exit(2);
}

const paper = JSON.parse(readFileSync(PAPER_JSON, "utf-8"));

// Collect test blocks: ones with rendered assets, display math, tables, bold/italic
interface TestBlock {
  rootName: string;
  kind: string;
  label?: string;
  title?: string;
  md: string;
  rendered?: Array<{ mime: string; url: string; blockIndex: number }>;
  chapter: string;
  reason: string;
}

const testBlocks: TestBlock[] = [];

for (const ch of paper.chapters) {
  for (const sec of ch.sections) {
    for (const blk of sec.blocks) {
      const md = blk.md || "";
      const reasons: string[] = [];

      if (blk.rendered?.length) reasons.push("has-svg");
      if (/\$\$[\s\S]*?\$\$/.test(md)) reasons.push("display-math");
      if (/\$[^\n$]+?\$/.test(md)) reasons.push("inline-math");
      if (/\*\*[\s\S]+?\*\*/.test(md)) reasons.push("bold");
      if (/\*[^*]+\*/.test(md)) reasons.push("italic");
      if (/^\|.+\|$/m.test(md)) reasons.push("table");
      if (/```tex/.test(md)) reasons.push("tex-block");
      if (/\\cite\{/.test(md)) reasons.push("citation");
      if (/\[.+\]\(#.+\)/.test(md)) reasons.push("cross-ref");

      if (reasons.length > 0 && testBlocks.length < 30) {
        testBlocks.push({
          rootName: blk.rootName,
          kind: blk.kind,
          label: blk.label,
          title: blk.title,
          md,
          rendered: blk.rendered,
          chapter: ch.title,
          reason: reasons.join(", "),
        });
      }
    }
  }
}

console.log(`Selected ${testBlocks.length} test blocks`);

// Build a standalone HTML page that renders these blocks
const stylesCss = readFileSync(join(VIEWER_DIR, "styles.css"), "utf-8");

// Extract just mdToHtml + helpers from app.js
const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<style>${stylesCss}</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<style>
  body { font-family: Georgia, "Times New Roman", Times, serif; font-size: 16px; line-height: 1.6;
         max-width: 800px; margin: 2rem auto; padding: 0 1rem;
         background: #fafafa; color: #2c2c34; }
  [data-font="paper"] { --f-body: Georgia, "Times New Roman", Times, serif; --f-head: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
    --f-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace; --f-sz: 16px; --f-lh: 1.6; }
  .test-block { margin: 2rem 0; border: 1px solid #ddd; border-radius: 6px;
    padding: 1rem; background: #fff; }
  .test-meta { font-size: .7rem; color: #888; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace;
    margin-bottom: .5rem; border-bottom: 1px solid #eee; padding-bottom: .4rem; }
  .test-meta .reason { color: #2a6bc4; }
  .issue { background: #fee; border-color: #c44; }
  .issue-msg { color: #c44; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace; font-size: .7rem; margin-top: .5rem; }
  #summary { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace; font-size: .8rem; padding: 1rem;
    background: #f0f0f4; border-radius: 4px; margin-bottom: 2rem; }
</style>
</head>
<body data-font="paper">
<h1>Render QC</h1>
<div id="summary"></div>
<div id="blocks"></div>
<script>
// Minimal helpers from app.js
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escAttr(s) { return esc(s).replace(/'/g,"&#39;"); }

function mdToHtml(md, rendered) {
  let out = md;
  out = out.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, (_, tex) =>
    \`<span class="katex-display-raw" data-tex="\${escAttr(tex.trim())}"></span>\`);
  out = out.replace(/\\$([^\\n$]+?)\\$/g, (_, tex) =>
    \`<span class="katex-inline-raw" data-tex="\${escAttr(tex.trim())}"></span>\`);
  let texBlockIdx = 0;
  out = out.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, (_, lang, code) => {
    if (lang === "tex" || lang === "latex") {
      const idx = texBlockIdx++;
      const asset = rendered && rendered.find(r => r.blockIndex === idx);
      if (asset) {
        return \`<div class="txb"><img src="\${escAttr(asset.url)}" alt="diagram" class="txb-svg"></div>\`;
      }
      return \`<div class="txb ph">\${esc(code.trim())}</div>\`;
    }
    return \`<pre style="background:#f0f0f4;padding:.6rem;border-radius:4px;overflow-x:auto;font-size:.8rem"><code>\${esc(code)}</code></pre>\`;
  });
  out = out.replace(/((?:^\\|.+\\|$\\n?)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split("\\n").filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    const isSep = /^\\|[\\s:]*-+[\\s:]*/.test(rows[1]);
    let html = '<table class="md-table">';
    const dataRows = isSep ? [rows[0], ...rows.slice(2)] : rows;
    for (let i = 0; i < dataRows.length; i++) {
      const cells = dataRows[i].split("|").slice(1, -1);
      const tag = (i === 0 && isSep) ? "th" : "td";
      html += "<tr>" + cells.map(c => \`<\${tag}>\${c.trim()}</\${tag}>\`).join("") + "</tr>";
    }
    return html + "</table>";
  });
  out = out.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
  out = out.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  out = out.replace(/\\*\\*([\\s\\S]+?)\\*\\*/g, "<strong>$1</strong>");
  out = out.replace(/\\*([^\\n*][^*]*?)\\*/g, "<em>$1</em>");
  out = out.replace(/\\\`([^\\\`]+)\\\`/g, '<code style="background:#f0f0f4;padding:.1rem .3rem;border-radius:3px;font-size:.85em">$1</code>');
  out = out.replace(/\\\\cite\\{([^}]+)\\}/g, '<span class="cite" title="$1">[$1]</span>');
  out = out.replace(/---/g, "\\u2014");
  out = out.replace(/--/g, "\\u2013");
  out = out.replace(/\\[([^\\]]+)\\]\\(#([^)]+)\\)/g, '<a class="uref" href="#$2">$1</a>');
  out = out.replace(/(\\d+)\\.\\s+(.+)/gm, '<li class="md-li" value="$1">$2</li>');
  out = out.replace(/^[-*]\\s+(.+)$/gm, '<li class="md-li">$1</li>');
  out = out.replace(/\\n{2,}/g, "</p><p>");
  out = "<p>" + out + "</p>";
  out = out.replace(/<p>(<table|<h[34])/g, "$1");
  out = out.replace(/(<\\/table>|<\\/h[34]>)<\\/p>/g, "$1");
  return out;
}

const blocks = ${JSON.stringify(testBlocks)};
const container = document.getElementById("blocks");
const issues = [];

for (const blk of blocks) {
  const div = document.createElement("div");
  div.className = "test-block";
  div.dataset.root = blk.rootName;
  div.innerHTML = \`<div class="test-meta">
    <strong>\${esc(blk.kind)}</strong> \${esc(blk.title || blk.rootName)}
    &mdash; <span class="reason">\${esc(blk.reason)}</span>
    &mdash; \${esc(blk.chapter)}
  </div>
  <div class="bb">\${mdToHtml(blk.md, blk.rendered)}</div>\`;
  container.appendChild(div);
}

// Render KaTeX
document.querySelectorAll(".katex-display-raw").forEach(el => {
  try {
    katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: true });
  } catch (e) {
    el.textContent = el.dataset.tex;
    el.style.color = "red";
    el.closest(".test-block")?.classList.add("issue");
    const msg = document.createElement("div");
    msg.className = "issue-msg";
    msg.textContent = "KaTeX error: " + e.message;
    el.closest(".test-block")?.appendChild(msg);
    issues.push({ block: el.closest(".test-block")?.dataset.root, type: "katex-display", error: e.message });
  }
});
document.querySelectorAll(".katex-inline-raw").forEach(el => {
  try {
    katex.render(el.dataset.tex, el, { displayMode: false, throwOnError: true });
  } catch (e) {
    el.textContent = el.dataset.tex;
    el.style.color = "red";
    el.closest(".test-block")?.classList.add("issue");
    const msg = document.createElement("div");
    msg.className = "issue-msg";
    msg.textContent = "KaTeX error: " + e.message;
    el.closest(".test-block")?.appendChild(msg);
    issues.push({ block: el.closest(".test-block")?.dataset.root, type: "katex-inline", error: e.message });
  }
});

// Check for broken images
document.querySelectorAll("img.txb-svg").forEach(img => {
  img.onerror = () => {
    img.closest(".test-block")?.classList.add("issue");
    const msg = document.createElement("div");
    msg.className = "issue-msg";
    msg.textContent = "SVG failed to load: " + img.src;
    img.closest(".test-block")?.appendChild(msg);
    issues.push({ block: img.closest(".test-block")?.dataset.root, type: "svg-broken", error: img.src });
  };
});

// Check for unrendered tex placeholders
document.querySelectorAll(".txb.ph").forEach(el => {
  el.closest(".test-block")?.classList.add("issue");
  const msg = document.createElement("div");
  msg.className = "issue-msg";
  msg.textContent = "Unrendered TeX block (no SVG available)";
  el.closest(".test-block")?.appendChild(msg);
  issues.push({ block: el.closest(".test-block")?.dataset.root, type: "tex-unrendered" });
});

// Check for literal ** (unrendered bold)
document.querySelectorAll(".bb").forEach(el => {
  if (/\\*\\*[^<]/.test(el.textContent || "")) {
    el.closest(".test-block")?.classList.add("issue");
    const msg = document.createElement("div");
    msg.className = "issue-msg";
    msg.textContent = "Literal ** found (bold not rendered)";
    el.closest(".test-block")?.appendChild(msg);
    issues.push({ block: el.closest(".test-block")?.dataset.root, type: "bold-unrendered" });
  }
});

// Summary
setTimeout(() => {
  const summary = document.getElementById("summary");
  const issueBlocks = document.querySelectorAll(".issue").length;
  summary.innerHTML = \`<strong>\${blocks.length}</strong> blocks tested,
    <strong style="color:\${issueBlocks ? '#c44' : '#1a8a44'}">\${issueBlocks}</strong> with issues\`;
  // Expose for Playwright
  window.__renderQC = { total: blocks.length, issues, issueCount: issueBlocks };
}, 500);
</script>
</body>
</html>`;

mkdirSync(OUT_DIR, { recursive: true });
const htmlPath = join(OUT_DIR, "render-qc.html");
writeFileSync(htmlPath, html);
console.log(`Test page written: ${htmlPath}`);

// Run Playwright
// Spawn node subprocess to run Playwright (bun's playwright-core version doesn't match)
const { execSync } = await import("child_process");
const screenshotPath = join(OUT_DIR, "render-qc.png");
const runnerPath = join(OUT_DIR, "_pw-runner.cjs");
writeFileSync(runnerPath, `
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('file://${htmlPath}', { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  ${SAVE_SCREENSHOTS ? `await page.screenshot({ path: '${screenshotPath}', fullPage: true });` : ""}
  const result = await page.evaluate(() => window.__renderQC);
  console.log(JSON.stringify(result));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
`);
const nodeResult = execSync(`node ${runnerPath}`, {
  encoding: "utf-8",
  timeout: 60000,
}).trim();
const result = JSON.parse(nodeResult);
if (SAVE_SCREENSHOTS) {
  console.log(`Screenshot saved: ${join(OUT_DIR, "render-qc.png")}`);
}

// Report
console.log(`\n=== Render QC Results ===`);
console.log(`Blocks tested: ${result.total}`);
console.log(`Issues found: ${result.issueCount}`);

if (result.issues.length > 0) {
  console.log(`\nIssues:`);
  for (const issue of result.issues) {
    console.log(`  [${issue.type}] ${issue.block}: ${issue.error || ""}`);
  }
  process.exit(1);
} else {
  console.log(`\nAll blocks rendered successfully.`);
}
