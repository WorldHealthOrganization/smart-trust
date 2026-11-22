#!/usr/bin/env bun
/**
 * A voice skill's instruction body must not RESTATE its own rules.
 *
 * @module scripts/check-voice-skills
 * @covers voices, skills
 * @graphNode none — a checker over the voices graph
 *
 * Enforces the rule in `schemas/content/voice-skill.ts`: a rule lives in
 * `voice.json` with its cited page, quote and checker patterns; copied into
 * `SKILL.md` as prose it loses its citation and is free to drift.
 *
 * | signal | what it catches |
 * |---|---|
 * | the rule's **id** | a body that indexes or lists the rules |
 * | the rule's **title** | the commonest copy — a heading per rule |
 * | the citation's **quote** | the source passage moved into the prose |
 * | a **terminology pair**, both sides | "write X, never Y" lifted out of the data |
 *
 * This works mechanically because rule titles are specific editorial claims
 * (*"-ize, not -ise"*) while instructions describe what an actor does.
 *
 * Structural half: a voice declaring `$schema: "folio-voice-skill/v1"`
 * promises an `instructions.file`, and that file must RESOLVE. A bare
 * `folio-voice/v1` profile may carry no instruction body (`voiceFilesIn`
 * reads that layout) and is not missing anything.
 *
 * Usage:
 *   bun run cat check:voice-skills
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readVoicesGraph } from "./voices-graph.ts";
import { loadVoices } from "../schemas/content/voices.ts";
import {
  directoriesForGraph,
  layerRootsIn,
  repoRootFor,
} from "../schemas/kg/cat-harness.ts";

const ROOT = HARNESS_ROOT;

export interface VoiceSkillFinding {
  voice: string;
  instance: string;
  /** Repo-relative path of the file the finding is about. */
  file: string;
  severity: "critical" | "major";
  detail: string;
}

/**
 * The shortest title worth matching on.
 *
 * A two-word title could collide with ordinary prose, and a false positive on
 * a gate is how a gate gets switched off. The shortest title across the four
 * voices here is 16 characters, so this excludes nothing real today and gives
 * a future short title room to be generic.
 */
const MIN_TITLE_LEN = 12;

/** The leading slice of a quote matched against the body. */
const QUOTE_PREFIX = 40;

/** As much of a rule as this check reads. */
export interface VoiceSkillRuleShape {
  id: string;
  title: string;
  /** The citation. `quote` sits here, beside the page it is on. */
  source?: { quote?: string };
  terminology?: { correct: string; incorrect: string | string[] }[];
}

/** Front matter, if the file has any. */
function frontMatter(text: string): string | undefined {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return m?.[1];
}

/**
 * Does the body restate this voice's rules, and how?
 *
 * Every signal is matched case-insensitively on the body with its FRONT MATTER
 * REMOVED. The front matter's `description` is the skill's one-line summary and
 * legitimately paraphrases what the voice is for; treating it as body would
 * make the check fire on the one place a summary belongs.
 */
export function restatements(body: string, rules: readonly VoiceSkillRuleShape[]): string[] {
  const fm = frontMatter(body);
  const prose = (fm === undefined ? body : body.slice(body.indexOf(`\n---\n`, 4) + 5)).toLowerCase();
  const out: string[] = [];

  for (const r of rules) {
    if (prose.includes(r.id.toLowerCase())) {
      out.push(
        `names the rule id \`${r.id}\` — an instruction body that indexes the rules is ` +
          `a second index, and \`voice.json\` is the first`,
      );
    }
    if (r.title.length >= MIN_TITLE_LEN && prose.includes(r.title.toLowerCase())) {
      out.push(
        `restates the rule "${r.title}" (\`${r.id}\`) — the rule is in \`voice.json\` ` +
          `WITH its citation; this copy carries none`,
      );
    }
    // The quote lives on the rule's SOURCE, beside the page it is on — which
    // is the point: a quote that has been separated from its citation is the
    // thing this check is looking for.
    const quote = r.source?.quote ?? "";
    if (quote.length > QUOTE_PREFIX) {
      const head = quote.slice(0, QUOTE_PREFIX).toLowerCase();
      if (prose.includes(head)) {
        out.push(
          `quotes \`${r.id}\`'s source passage — the quote belongs beside the citation ` +
            `that says which page it is on, not in prose that does not`,
        );
      }
    }
    for (const t of r.terminology ?? []) {
      const wrong = Array.isArray(t.incorrect) ? t.incorrect : [t.incorrect];
      const both = wrong.filter(
        (w) => prose.includes(t.correct.toLowerCase()) && prose.includes(w.toLowerCase()),
      );
      if (both.length > 0) {
        out.push(
          `gives \`${r.id}\`'s terminology pair in prose ("${t.correct}" against ` +
            `"${both[0]}") — a pair stated here has no pattern behind it`,
        );
      }
    }
  }
  return out;
}

/** Every finding over every voice the repository ships. */
export function checkVoiceSkills(repoRoot: string): VoiceSkillFinding[] {
  const g = readVoicesGraph([repoRoot], repoRoot);
  if (g === null) return [];
  const findings: VoiceSkillFinding[] = [];

  // The raw voice objects, by id — the graph view drops `instructions` and
  // `terminology`, and both are checked here. Read through the declaration, as
  // everything over this graph does.
  const raw = new Map<string, Record<string, unknown>>();
  for (const root of layerRootsIn(repoRoot)) {
    if (directoriesForGraph(root, "voices").length === 0) continue;
    for (const v of loadVoices(root)) raw.set(v.id, v as unknown as Record<string, unknown>);
  }

  for (const v of g.voices) {
    const dir = join(repoRoot, v.path);
    const file = `${v.path}/SKILL.md`;
    const rv = raw.get(v.id) ?? {};
    const declaresSkill = rv["$schema"] === "folio-voice-skill/v1";
    const instructions = rv["instructions"] as { file?: string } | undefined;

    // ── structural ────────────────────────────────────────────────────
    if (declaresSkill && instructions?.file === undefined) {
      findings.push({
        voice: v.id,
        instance: v.instance,
        file: `${v.path}/voice.json`,
        severity: "critical",
        detail:
          "declares `folio-voice-skill/v1` and names no `instructions.file` — " +
          "a voice skill with no instruction body is a profile wearing a skill's schema",
      });
      continue;
    }
    // A voice that PROMISES no body is not missing one.
    //
    // `voiceFilesIn` reads two layouts on purpose — a voice SKILL at
    // `<id>/voice.json` beside its `SKILL.md`, and a bare `folio-voice/v1`
    // profile — so that "a downstream folio is not broken by an upgrade it did
    // not ask for". Demanding a `SKILL.md` from the second shape breaks
    // exactly that, and it was not hypothetical: `technical-writer` is a bare
    // profile whose instruction body is the separate `technical-documentation`
    // skill it cites, and this check called it CRITICAL for not having a file
    // it never claimed. Found by relocating it, not by a test — which is why
    // the test now covers the shape.
    //
    // So the body is required when it is PROMISED (an `instructions.file`, or
    // the skill schema, which the branch above already refuses without one)
    // and never otherwise. Everything below this point needs a body to read.
    if (instructions?.file === undefined && !declaresSkill) continue;
    const bodyPath = instructions?.file === undefined ? join(dir, "SKILL.md") : join(dir, instructions.file);
    if (!existsSync(bodyPath)) {
      findings.push({
        voice: v.id,
        instance: v.instance,
        file,
        severity: "critical",
        detail:
          `declares \`instructions.file\` as \`${instructions?.file ?? "SKILL.md"}\` and ` +
          "the file is not there — Zod cannot check that a path resolves, which is " +
          "the whole reason this check exists beside the schema",
      });
      continue;
    }

    const text = readFileSync(bodyPath, "utf-8");
    const fm = frontMatter(text);
    if (fm === undefined) {
      findings.push({
        voice: v.id,
        instance: v.instance,
        file,
        severity: "major",
        detail: "has no front matter — a skill is indexed by its `name` and `description`",
      });
    } else {
      for (const key of ["name", "description"]) {
        if (!new RegExp(`^${key}:`, "m").test(fm)) {
          findings.push({
            voice: v.id,
            instance: v.instance,
            file,
            severity: "major",
            detail: `front matter has no \`${key}\` — a skill is indexed by it`,
          });
        }
      }
    }

    // ── restatement ───────────────────────────────────────────────────
    const rules = (rv["rules"] ?? []) as VoiceSkillRuleShape[];
    for (const detail of restatements(text, rules)) {
      findings.push({ voice: v.id, instance: v.instance, file, severity: "major", detail });
    }
  }
  return findings;
}



if (import.meta.main) {
  const repoRoot = repoRootFor(ROOT);
  const g = readVoicesGraph([repoRoot], repoRoot);
  if (g === null) {
    // NOT a pass. A layer declaring no voices has none to check, and
    // saying so is different from saying they are all fine.
    console.log("Voice skills — no voices directory is declared, so nothing was checked");
    process.exit(0);
  }
  const findings = checkVoiceSkills(repoRoot);
  const rules = g.voices.reduce((n, v) => n + v.rules.length, 0);
  console.log(
    `Voice skills (${g.voices.length} voice(s), ${rules} rule(s) across ` +
      `${new Set(g.voices.map((v) => v.instance)).size} instance(s))`,
  );
  if (findings.length === 0) {
    console.log(
      "  ✓ every voice skill carries an instruction body, and none of them restates " +
        "the rules beside it",
    );
    process.exit(0);
  }
  const critical = findings.filter((f) => f.severity === "critical").length;
  for (const f of findings) {
    console.error(`  ✗ ${f.file}\n      ${f.detail}`);
  }
  console.error(
    `\n${findings.length} finding(s) — ${critical} critical, ${findings.length - critical} major.`,
  );
  console.error(
    "A rule belongs in `voice.json`, where it carries the page it was read from and " +
      "the patterns a checker runs. `SKILL.md` says what to DO with the rules.",
  );
  process.exit(1);
}
