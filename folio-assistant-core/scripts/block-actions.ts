/**
 * block-actions — [edit] and [feedback] on every block. The recipe moved to
 * `cat-harness-tools/src/core/edit-links.ts` (one recipe for every page the
 * platform publishes, owner 2026-10-06); this module re-exports it and keeps
 * the `block-actions` Tool's command.
 */
export * from "@litlfred/cat-harness-tools/src/core/edit-links.js";
import { editUrl, feedbackUrl } from "@litlfred/cat-harness-tools/src/core/edit-links.js";

/**
 * `bun run folio-assistant-core/scripts/block-actions.ts --repo <folio root> [--block <label>]`
 * prints each block's links as JSON: `{ label, source, section, edit, feedback }`.
 * The `block-actions` Tool invokes this, so an agent can hand a reader the
 * right edit or feedback link for the block under discussion.
 */
if (import.meta.main) {
  const { resolve } = await import("node:path");
  const { defaultBlockActions, documentBlocks, documentManifests } = await import("./build-document-site.js");
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes("--help")) {
    console.log(
      "usage: bun run folio-assistant-core/scripts/block-actions.ts [--repo <folio root>] [--block <label>]\n" +
        "         [--github <owner/repo>] [--edit-branch main] [--issue-template block-feedback.yml] [--site-url <url>]",
    );
    process.exit(0);
  }
  const root = resolve(opt("repo") ?? process.cwd());
  const cfg = defaultBlockActions(root, {
    ...(opt("github") ? { repo: opt("github") } : {}),
    ...(opt("edit-branch") ? { branch: opt("edit-branch") } : {}),
    ...(opt("issue-template") ? { template: opt("issue-template") } : {}),
    ...(opt("site-url") ? { siteUrl: opt("site-url") } : {}),
  });
  if (!cfg.repo) {
    console.error("✗ no GitHub repository: pass --github <owner/repo>, set GITHUB_REPOSITORY, or run in a checkout whose origin is on GitHub");
    process.exit(2);
  }
  const want = opt("block");
  const out = [];
  for (const d of documentManifests(root)) {
    for (const b of await documentBlocks(d.path, root, d.slug)) {
      if (want && b.label !== want) continue;
      out.push({ label: b.label, source: b.source, section: b.section, edit: editUrl(cfg, b.source), feedback: feedbackUrl({ content: d.slug, ...cfg }, b) });
    }
  }
  if (want && out.length === 0) {
    console.error(`✗ no block labelled ${want}`);
    process.exit(1);
  }
  console.log(JSON.stringify(out, null, 1));
  console.error(`✓ ${out.length} block(s), ${cfg.template ? `issue form ${cfg.template}` : "no issue form: plain issues"}`);
}
