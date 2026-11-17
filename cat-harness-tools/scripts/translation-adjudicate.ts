#!/usr/bin/env bun
/**
 * Turn a translation-review issue into the recorded adjudication.
 *
 * @module scripts/translation-adjudicate
 * @covers translation-sources
 *
 *   bun run cat-harness-tools/scripts/translation-adjudicate.ts \
 *     --root <layer root> --event "$GITHUB_EVENT_PATH" [--summary <file>] [--dry-run]
 *
 * Reads the `issues` event GitHub wrote, never the issue body from a shell
 * variable: the body is untrusted text and is only ever parsed as JSON. The
 * adjudicator is the event's `issue.user.login`, with its
 * `author_association`; nothing in the body can name anyone else.
 *
 * {@link planAdjudication} (`scripts/lib/translation-adjudication.ts`) decides
 * every write; this script resolves the layer's declared directories, checks
 * each attestation against `qa-attestations/v1` before writing it, writes,
 * and leaves a Markdown summary for the issue comment and the PR body.
 *
 * Exit 0 something was recorded · 3 nothing was (every item refused, or none
 * was asked) · 2 could not determine (no event, no declaration).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { readDeclaration, instanceDirectories } from "../schemas/kg/cat-harness.js";
import { criteriaAttestationsHome, TranslationAttestationsSchema } from "../schemas/sdlc/qa-attestations.ts";
import { TranslationNodeSchema } from "../schemas/content/translation.ts";
import { parseIssueBody, planAdjudication, type AdjudicationPayload } from "./lib/translation-adjudication.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface IssueEvent {
  issue?: { body?: string | null; html_url?: string; created_at?: string; author_association?: string; user?: { login?: string } };
}

export function summaryMarkdown(applied: string[], refused: string[], login: string): string {
  const out = [`Translation adjudication by @${login}.`, ""];
  if (applied.length > 0) out.push("**Recorded**", "", ...applied.map((a) => `- ${a}`), "");
  if (refused.length > 0) out.push("**Not recorded**", "", ...refused.map((r) => `- ${r}`), "");
  if (applied.length === 0) out.push("Nothing was recorded, so no pull request is opened.");
  return out.join("\n");
}

function main(): number {
  const root = resolve(arg("--root") ?? ".");
  const eventPath = arg("--event") ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error("translation-adjudicate: no --event and no $GITHUB_EVENT_PATH. This is NOT a pass.");
    return 2;
  }
  const event = JSON.parse(readFileSync(eventPath, "utf-8")) as IssueEvent;
  const issue = event.issue;
  const login = issue?.user?.login;
  if (!issue || !login || !issue.html_url || !issue.created_at) {
    console.error("translation-adjudicate: the event carries no issue with an author. This is NOT a pass.");
    return 2;
  }
  const decl = readDeclaration(root);
  const repository = decl?.repository;
  const tdir = instanceDirectories(root).find((d) => (d.graphTypologies ?? []).includes("translation-sources"));
  if (!decl || !repository || !tdir) {
    console.error(`translation-adjudicate: ${root} declares no repository or no translation-sources directory. This is NOT a pass.`);
    return 2;
  }
  const translations = tdir.path.replace(/\/+$/, "");
  const home = criteriaAttestationsHome(root).root;
  const posix = (p: string) => p.split(sep).join("/");

  const body = issue.body ?? "";
  const payload = parseIssueBody(body);
  const plan =
    payload === undefined
      ? { writes: new Map<string, string>(), applied: [] as string[], refused: ["the issue has no readable `translation-adjudication` JSON block"] }
      : planAdjudication({
          layerRoot: root,
          repository,
          translations,
          payload: payload as AdjudicationPayload,
          author: { login, association: issue.author_association ?? "NONE" },
          issueUrl: issue.html_url,
          at: issue.created_at,
          attestationPath: (cat, locale) => posix(relative(root, join(home, "translation-qa", `${cat}.${locale}.attestations.json`))),
          attestationSubject: (cat) => cat,
        });

    // Every attestation and translation node is checked against its schema
  // before anything is written: a record that would not validate is not written.
  for (const [rel, text] of plan.writes) {
    const schema = rel.endsWith(".attestations.json") ? TranslationAttestationsSchema : rel.endsWith(".json") ? TranslationNodeSchema : undefined;
    if (schema === undefined) continue;
    const r = schema.safeParse(JSON.parse(text));
    if (!r.success) {
      console.error(`translation-adjudicate: ${rel} would not validate: ${r.error.message}`);
      return 2;
    }
  }
  if (!process.argv.includes("--dry-run")) {
    for (const [rel, text] of plan.writes) {
      const abs = join(root, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
      console.log(`  ✓ ${rel}`);
    }
  }
  const summary = summaryMarkdown(plan.applied, plan.refused, login);
  const summaryPath = arg("--summary");
  if (summaryPath) writeFileSync(summaryPath, `${summary}\n`);
  console.log(summary);
  return plan.applied.length > 0 ? 0 : 3;
}

if (import.meta.main) process.exit(main());
