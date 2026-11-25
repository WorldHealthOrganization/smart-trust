/**
 * Folio Assistant — Entry point.
 *
 * Wires up the server with the appropriate content adapter based on
 * configuration. Currently supports the "paper" adapter.
 *
 * Usage:
 *   bun run cat-harness-tools/src/index.ts [--stdio|--http] [--repo <path>] [--check-deps]
 *
 * @module folio-assistant/index
 */

import { resolve } from "path";
import { FolioServer } from "./server.js";
import { createContentAdapter, readFolioContentConfig } from "./content-adapter.js";
import { GitHelper } from "./core/git.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";

// ── Parse CLI args ───────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.includes("--http") ? "http" : "stdio";

// --repo <path> or default to parent directory (assuming folio-assistant/ is inside the repo)
let repoRoot: string;
const repoIdx = args.indexOf("--repo");
if (repoIdx >= 0 && args[repoIdx + 1]) {
  repoRoot = resolve(args[repoIdx + 1]);
} else {
  // Default: assume folio-assistant/ is a subdirectory of the content repo
  repoRoot = resolve(import.meta.dir, "../..");
}

// ── Dependency check mode ────────────────────────────────────────

if (args.includes("--check-deps")) {
  const { execSync } = await import("child_process");

  interface DepInfo { name: string; required: boolean; cmd: string; hint: string }
  const deps: DepInfo[] = [
    { name: "bun", required: true, cmd: "bun --version", hint: "curl -fsSL https://bun.sh/install | bash" },
    { name: "latexmk", required: false, cmd: "latexmk --version", hint: "sudo apt install latexmk" },
    { name: "pdflatex", required: false, cmd: "pdflatex --version", hint: "sudo apt install texlive-latex-base" },
    { name: "pandoc", required: false, cmd: "pandoc --version", hint: "sudo apt install pandoc" },
    { name: "lean", required: false, cmd: "lean --version", hint: "Install via elan" },
    { name: "rg", required: false, cmd: "rg --version", hint: "sudo apt install ripgrep" },
  ];

  console.log("\nFolio Assistant — Dependency check:\n");
  let missingReq = 0;
  for (const d of deps) {
    let ok = false;
    try { execSync(d.cmd, { stdio: "pipe" }); ok = true; } catch {}
    const icon = ok ? "✓" : (d.required ? "✗" : "○");
    const tag = d.required ? "(required)" : "(optional)";
    console.log(`  ${icon} ${d.name.padEnd(12)} ${tag}`);
    if (!ok) {
      console.log(`    Install: ${d.hint}`);
      if (d.required) missingReq++;
    }
  }
  // Declared capability probes. These are a separate mechanism from the list
  // above — `cat-harness/scenarios/capabilities/*.json` is what skills declare
  // `requiredCapabilities` against — and until now nothing executed them, so a
  // skill's prerequisite could be missing with no way to find out. The two
  // hardcoded lists remain (here and in the `check_dependencies` Tool, which
  // bean `bbza` moved up to the content layer that owns the paper adapter);
  // unifying them is a separate change.
  const { loadCapabilities, probeAll, formatCapabilityReport } = await import("./tools/capabilities.js");
  const instance = resolve(import.meta.dir, "..");
  const caps = loadCapabilities(repoRootFor(instance));
  if (caps.length) {
    console.log("\nDeclared capabilities (cat-harness/scenarios/capabilities/):\n");
    const statuses = probeAll(caps);
    console.log(formatCapabilityReport(statuses));

    // What each skill DOES about a missing capability. The probes above say
    // what is absent; this says what follows — the half that was missing
    // while 24 `degradation` declarations were read by nothing (owner "b1",
    // bean `folio-assistant-ahvw`).
    const { loadSkillNeeds, allSkillAvailability, formatSkillAvailability } = await import(
      "./tools/degradation.js"
    );
    const { kgRoots } = await import("../scripts/known-skills.js");
    const { fallbackRolesBySkill } = await import("../scripts/check-fallback-roles.js");
    const { skills, unreadable } = await loadSkillNeeds(kgRoots(instance));

    // ONE pass, not one per skill. The comment this replaces already noticed
    // that "the derivation reads every BPMN in the corpus" and hoisted the call
    // out of a synchronous predicate — but still ran it per skill. Measured on
    // 74 diagrams and 23 skills: 1745.8 ms for one pass against 26016.8 ms for
    // the loop (bean `sff8`).
    const human = await fallbackRolesBySkill(instance);

    console.log("\nSkills, by what they declared about a missing capability:\n");
    console.log(
      formatSkillAvailability(
        allSkillAvailability(skills, statuses, caps, { humanFallback: (id) => human.get(id) ?? [] }),
      ),
    );
    for (const u of unreadable) {
      // Reported, never skipped: a skill module that will not import is a
      // defect whose remedy is to fix it, and dropping it would make it read
      // as a skill with nothing to require.
      console.log(`  ⚠ ${u.file} declares requiredCapabilities but will not import: ${u.error}`);
    }
  }

  console.log(missingReq > 0
    ? `\n⚠  ${missingReq} required dep(s) missing!\n`
    : `\n✓  All required deps present.\n`);
  process.exit(missingReq > 0 ? 1 : 0);
}

// ── Load folio config and create adapter ────────────────────────
//
// In `content-adapter.ts`, so the viewer server in `adapters/mcp-server/`
// serves the same content tools rather than a fork of them (bean riit, 3c).

const folioConfig = readFolioContentConfig(repoRoot);
const { feedbackDir, viewerPort } = folioConfig;
const gitHelper = new GitHelper(repoRoot);
// The UI stayed in the harness when the server moved up (70lx).
const assistantDir = resolve(import.meta.dir, "..", "..", "cat-harness", "ui");
const adapter = await createContentAdapter(repoRoot, gitHelper, folioConfig);

// ── Start server ─────────────────────────────────────────────────

const server = new FolioServer({
  repoRoot,
  feedbackDir,
  assistantDir,
  adapter,
  serverName: "folio-assistant",
  viewerPort,
});

if (mode === "stdio") {
  await server.startStdio();
} else {
  await server.startHttp();
}
