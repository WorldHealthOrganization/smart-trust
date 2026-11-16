#!/usr/bin/env bun
/**
 * The URL a person can drop a file at, composed from the declaration.
 *
 * @module scripts/upload-url
 *
 * ## Why the obvious composition is wrong
 *
 * `harness.json` declares `{ id: "uploads", path: "uploads/" }` with no
 * `scope`, and absent scope means **layer**. So the declared path resolves
 * against the LAYER root (e.g. `cat-harness/`), while a GitHub upload URL
 * needs the path relative to the **repository** root. Pasting the declared
 * `path` straight into `/upload/<branch>/` drops the layer segment and
 * mints a 404. `rootForScope` resolves it, and this module is one more caller.
 *
 * **So the path is never written down**: a literal would be wrong at the next
 * relocation.
 *
 * ## Every failure is NAMED, never a broken link
 *
 * A person sent to a wrong link cannot tell it from an empty directory, so
 * each of the four resolution steps reports what it could not determine
 * instead of guessing.
 */
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
  readDeclaration,
  repoRootFor,
  rootForScope,
  type ContentDirectory,
} from "../schemas/kg/cat-harness.js";
import { detectRepoUrl } from "../pipeline/readme-toc.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The graph typology an acquisition queue declares. */
export const UPLOADS_GRAPH_TYPOLOGY = "uploads";

/** Resolved, or the reason it could not be — never a guessed URL. */
export type UploadTarget =
  | { ok: true; url: string; repoRelative: string; branch: string }
  | { ok: false; reason: string; remedy: string };

/**
 * Where a layer's acquisition queue is, relative to the REPOSITORY root.
 *
 * The one piece of arithmetic this module exists for. Exported so a test can
 * assert it against the real declaration rather than against a literal.
 */
export function queueRepoRelative(root: string): string | undefined {
  const decl = readDeclaration(root);
  const entry = (decl?.directories ?? []).find((d: ContentDirectory) =>
    d.graphTypologies.includes(UPLOADS_GRAPH_TYPOLOGY),
  );
  if (!entry) return undefined;
  const abs = resolve(rootForScope(root, entry.scope), entry.path);
  // POSIX separators: this becomes a URL, and a Windows checkout would
  // otherwise emit backslashes into it.
  return relative(repoRootFor(root), abs).split("\\").join("/");
}

/**
 * The upload URL for this layer's queue, or a named failure.
 *
 * `branch` defaults to `main` because that is what a forge's web upload form
 * targets when nobody says otherwise; pass the working branch to send somebody
 * at a PR's head instead.
 */
export function uploadUrl(root: string, branch = "main"): UploadTarget {
  const decl = readDeclaration(root);
  if (!decl) {
    return {
      ok: false,
      reason: `no harness declaration at ${root}`,
      remedy: "run this from inside an initialized instance",
    };
  }
  const rel = queueRepoRelative(root);
  if (rel === undefined) {
    return {
      ok: false,
      reason: `${decl.name} declares no \`${UPLOADS_GRAPH_TYPOLOGY}\` graph`,
      remedy:
        "declare one in the instance's <name>.json, or acquire the resource through another channel — see the content-acquisition skill",
    };
  }
  if (!existsSync(resolve(repoRootFor(root), rel))) {
    // A declared-but-absent directory is the `dh4f` defect, and a forge will
    // 404 on it exactly as it did for the owner.
    return {
      ok: false,
      reason: `the declared queue \`${rel}\` does not exist on disk`,
      remedy: "create it (a directory needs a keep-marker file to survive a clone)",
    };
  }
  const repoUrl = detectRepoUrl(root);
  if (!repoUrl) {
    return {
      ok: false,
      reason: "could not read a git remote named `origin`",
      remedy: "paste the resource into the conversation instead — chat is the other acquisition channel",
    };
  }
  if (!/^https:\/\/github\.com\//.test(repoUrl)) {
    // The `/upload/<branch>/<path>` form is GitHub's. Emitting it for another
    // forge would be a guess wearing a URL's clothes.
    return {
      ok: false,
      reason: `\`${repoUrl}\` is not a github.com remote, and the web upload path is GitHub's`,
      remedy: `have them commit the file to \`${rel}\` on \`${branch}\`, or paste it into the conversation`,
    };
  }
  return {
    ok: true,
    url: `${repoUrl.replace(/\.git$/, "").replace(/\/$/, "")}/upload/${branch}/${rel}`,
    repoRelative: rel,
    branch,
  };
}

if (import.meta.main) {
  const branch = process.argv[2] ?? "main";
  const target = uploadUrl(HARNESS_ROOT, branch);
  if (target.ok) {
    console.log(target.url);
    process.exit(0);
  }
  console.error(`cannot compose an upload URL: ${target.reason}`);
  console.error(`  ${target.remedy}`);
  process.exit(1);
}
