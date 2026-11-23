#!/usr/bin/env bun
/**
 * readme-links.ts — verify the links a README already carries.
 *
 * ## Why an audit and not a sixth generated section
 *
 * `readme-sections.ts` made the *generated* parts of a folio README verify
 * their own targets. Everything else in the file is authored Markdown, and
 * nothing checked it at all — which is how qou's Published Artefacts table
 * came to list `blueprint/` and `docs/`, neither of which has ever existed on
 * `gh-pages` (the Lean documentation is published at `lean/docs/`). Both rows
 * were dead in both columns, in a table nobody could regenerate.
 *
 * Generating that table instead would mean inventing its labels — "Folio
 * landing page", "Blueprint (interactive graph)", the Project Structure
 * descriptions — which are prose worth keeping. The defect was never the
 * layout going stale; it was targets that do not resolve. So this verifies
 * what the author wrote and never rewrites a byte of it.
 *
 * ## What is left here, and what moved (bean `cp3l`)
 *
 * The **auditor** — parse, classify, resolve against the working tree or a
 * ref, report a third state for what it could not check — is
 * `src/core/markdown-links.ts`, because none of it was ever about a README.
 * It lived here because the first caller did, and the cost was one layer out:
 * a harness-level check over `AGENTS.md` had to reach into core to audit a
 * link, so every future harness link check inherited a wrong-direction edge.
 *
 * What stays is the README-shaped front end and nothing else: which file to
 * audit when nobody names one (**asked** of the declaration, not composed),
 * the config that supplies the publish targets, and the CLI.
 *
 * @module pipeline/readme-links
 * @covers docs
 */


import { join } from "path";

import { loadReadmeConfig } from "./readme-toc";
import { findContentRepoRoot } from "./repo-root";
import { auditMarkdownFile } from "../src/core/markdown-links";
import { INSTANCE_README_ROLE, declaredAssetPath } from "../schemas/kg/cat-harness.ts";
import { movesResolver } from "../scripts/check-agent-entry-links.ts";

// Re-exported for callers that audit a README and nothing else, so a folio
// tool does not have to know where the generic auditor lives. New harness
// callers import from `src/core/markdown-links` directly.
export {
  auditLinks,
  auditMarkdownFile,
  classify,
  parseLinks,
  type AuditResult,
  type DeadLink,
  type LinkRef,
} from "../src/core/markdown-links";

/** Shared by the CLI and the `readme_audit` MCP tool. */
export function runReadmeAudit(opts: {
  root?: string;
  file?: string;
  fetch?: boolean;
}): { text: string; exitCode: number } {
  const root = opts.root ?? findContentRepoRoot();
  const cfg = loadReadmeConfig(root);
  // ASKED, not composed — see the same line in `readme-sections.ts`. The
  // README is declared `scope: "repository"` here, one directory above the
  // layer `root` every link is resolved against.
  const file =
    opts.file ?? declaredAssetPath(root, INSTANCE_README_ROLE) ?? join(root, "README.md");

  return auditMarkdownFile({
    root,
    file,
    repoUrl: cfg.repoUrl,
    pagesBaseUrl: cfg.pagesBaseUrl,
    publishRef: cfg.publishRef,
    fetch: opts.fetch,
    // A link into a path a layer moved resolves there in the move's window.
    resolveMoved: movesResolver(root),
  });
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  try {
    const result = runReadmeAudit({ file: flag("file"), fetch: argv.includes("--fetch") });
    (result.exitCode === 0 ? console.log : console.error)(result.text);
    process.exit(result.exitCode);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}
