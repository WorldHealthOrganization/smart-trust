/**
 * Check a folio's blocks against the content profile it declares.
 *
 * ## What this catches that schema validation cannot
 *
 * `content_validate` checks each block against its own Zod schema and the
 * constraint table. Both are profile-blind by construction: a `theorem` is a
 * valid `theorem` whatever kind of folio it sits in, and `constraints.ts`
 * has no way to know that this repo's `harness.config.json` says `document`.
 *
 * So a document folio can accumulate math blocks — most easily by an agent
 * reaching for `theorem` out of habit, or by a paper folio being re-declared
 * as a document — and nothing says a word until publication, when the render
 * needs a `.lean` file and a TeX installation the folio was set up without.
 * This is the check that turns that into an error at authoring time.
 *
 * Two rules, both from `schemas/content/block-kinds.ts`:
 *
 * 1. every block's kind is in the declared profile
 *    ({@link kindsOutsideProfile}); and
 * 2. in the `document` profile, no block carries a `lean` field at all
 *    ({@link DOCUMENT_FORBIDS_LEAN}) — several document kinds *declare* one
 *    as optional, so rule 1 alone would let a `remark` smuggle in a
 *    formalization the folio has no toolchain to check.
 *
 * @module pipeline/profile-check
 */

import { folioDir, unparseableConfigsIn } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync } from "fs";
import { basename } from "path";

import {
  DOCUMENT_FORBIDS_LEAN,
  profileAcceptsKind,
  profileForContentType,
  type ContentProfile,
} from "../schemas/content/block-kinds.ts";
import { walkBlocks } from "./qa-utils";
import { expectedInstanceConfigPath, readEffectiveConfig } from "../schemas/kg/harness-config.ts";

export interface ProfileViolation {
  label: string;
  kind: string;
  /** Absolute path to the offending `.ts` manifest. */
  ts: string;
  reason: "kind-outside-profile" | "lean-in-document";
  detail: string;
}

export interface ProfileCheckResult {
  /** The profile the folio declares. */
  profile: ContentProfile;
  /** Where that came from, for a report that can be acted on. */
  declaredBy: string;
  blocksChecked: number;
  violations: ProfileViolation[];
}

/**
 * Read the profile a folio DECLARES, keeping "could not determine" distinct
 * from "declared `paper`".
 *
 * `profile` is `undefined` when the folio does not say: no
 * `harness.config.json`, no `contentType` in it, or a file that will not parse.
 * Those three are genuinely different from a folio that declares
 * `contentType: "paper"`, and the difference matters to any consumer whose
 * response to "the folio says document" is to *stop doing something* —
 * {@link profileForContentType} resolves the unknown case to `paper` because
 * the wider vocabulary is the safe answer for a *validator*, but a consumer
 * that skips work on the strength of a profile must not skip it on the
 * strength of a guess.
 *
 * `declaredBy` says which of the four cases it was in words, so a report
 * never leaves the reader wondering whether the profile was chosen or
 * inherited.
 */
export function readDeclaredFolioProfile(repoRoot: string): {
  profile?: ContentProfile;
  declaredBy: string;
} {
  // A layer an `index.config.json` lists is configured by its ENTRY; it
  // has no `<name>.config.json` of its own, and reading only the file
  // reported every indexed layer as unconfigured (2026-10-09).
  const eff = readEffectiveConfig(repoRoot);
  if (eff.via === "index") {
    if (eff.state === "unreadable") return { declaredBy: `undetermined (${eff.from} unreadable: ${eff.why})` };
    const ct = eff.state === "ok" ? eff.config.contentType : undefined;
    if (typeof ct !== "string" || ct === "") return { declaredBy: `undetermined (${eff.from} declares no contentType)` };
    return { profile: profileForContentType(ct), declaredBy: `${eff.from} contentType: "${ct}"` };
  }
  const configPath = expectedInstanceConfigPath(repoRoot);
  // A FOURTH way of not knowing, and it is not the same as the three below:
  // nothing here declares a layer, so there is no name to compose a
  // config filename from and no file to be absent. Reported as its own
  // sentence rather than folded into "no config", because the remedy differs
  // — one wants a config written, the other wants a declaration.
  if (configPath === undefined) {
    // UNREADABLE IS NOT UNDECLARED, and telling them apart moved here when
    // `harness.json` was excised (2026-09-21). The declaration and the config
    // are one file now, so a malformed one makes `instanceConfigFor` return
    // the third state — which arrives at this branch looking exactly like
    // "nothing declares this directory". It is the opposite: somebody
    // declared, and it will not parse. The remedies are different sentences,
    // which is this branch's whole reason for existing.
    const broken = unparseableConfigsIn(repoRoot);
    if (broken.length > 0) {
      return {
        declaredBy: `undetermined (unreadable: ${broken.join(", ")} will not parse)`,
      };
    }
    return { declaredBy: "undetermined (no instance declares this directory)" };
  }
  // The file's name is the layer's, so the messages below say which file
  // they mean rather than naming a global that no longer exists.
  const shown = basename(configPath);
  if (!existsSync(configPath)) {
    return { declaredBy: `undetermined (no ${shown})` };
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as { contentType?: string };
    if (!config.contentType) {
      return { declaredBy: `undetermined (${shown} declares no contentType)` };
    }
    return {
      profile: profileForContentType(config.contentType),
      declaredBy: `${shown} contentType: "${config.contentType}"`,
    };
  } catch (e) {
    // A config that will not parse is reported, not silently defaulted: the
    // folio's whole configuration is unread in that state and every other
    // tool reading it is equally in the dark.
    return {
      declaredBy: `undetermined (${shown} unreadable: ${e instanceof Error ? e.message : String(e)})`,
    };
  }
}

/**
 * Read the profile a folio declares, resolved for a VALIDATOR.
 *
 * A folio that does not say reads as `paper` — see
 * {@link profileForContentType} for why the wider profile is the safe default
 * when the question is "may this folio contain this block?". Consumers that
 * need to tell "undetermined" from "declared paper" call
 * {@link readDeclaredFolioProfile} instead.
 */
export function readFolioProfile(repoRoot: string): { profile: ContentProfile; declaredBy: string } {
  const declared = readDeclaredFolioProfile(repoRoot);
  if (declared.profile) return { profile: declared.profile, declaredBy: declared.declaredBy };
  return { profile: "paper", declaredBy: declared.declaredBy.replace(/^undetermined/, "default") };
}

/**
 * Does this block manifest populate a `lean` field?
 *
 * Read textually rather than by importing the module, matching how
 * `walkBlocks` identifies blocks in the first place: importing runs the file,
 * and the whole point of this check is that it is cheap enough to run on
 * every block on every validate.
 *
 * A sibling `.lean` file counts too. A block can carry formalization by
 * convention (`<root>.lean` beside `<root>.ts`) without naming it in the
 * manifest, and a document folio should not hold one of those either.
 */
function declaresLean(tsPath: string, root: string): string | undefined {
  if (existsSync(`${root}.lean`)) return `sibling ${root.split("/").pop()}.lean exists`;
  const src = readFileSync(tsPath, "utf-8");
  // `lean:` as an object key — the manifests are object literals, so a
  // property assignment is the only way the field gets populated.
  return /^\s*lean\s*:/m.test(src) ? "manifest declares a `lean` field" : undefined;
}

/**
 * Check every block under `contentRoot` against `repoRoot`'s declared profile.
 *
 * @param repoRoot - Folio repo root, holding `harness.config.json`.
 * @param contentRoot - Directory to walk. Defaults to `<repoRoot>/content`.
 */
export function checkFolioProfile(repoRoot: string, contentRoot?: string): ProfileCheckResult {
  const { profile, declaredBy } = readFolioProfile(repoRoot);
  const root = contentRoot ?? folioDir(repoRoot);
  const violations: ProfileViolation[] = [];
  let blocksChecked = 0;

  if (!existsSync(root)) {
    return { profile, declaredBy, blocksChecked: 0, violations: [] };
  }

  for (const block of walkBlocks(root, { includeUnlabelled: true })) {
    blocksChecked++;

    if (!profileAcceptsKind(profile, block.kind)) {
      violations.push({
        label: block.label,
        kind: block.kind,
        ts: block.ts,
        reason: "kind-outside-profile",
        detail:
          `kind \`${block.kind}\` is not in the \`${profile}\` profile. ` +
          (profile === "document"
            ? "A document folio holds no blocks whose assertion is a formal mathematical claim — " +
              "declare `contentType: \"paper\"` if this folio needs them."
            : `No profile admits \`${block.kind}\`; it may belong to another adapter.`),
      });
      continue;
    }

    if (profile === "document" && DOCUMENT_FORBIDS_LEAN) {
      const how = declaresLean(block.ts, block.root);
      if (how) {
        violations.push({
          label: block.label,
          kind: block.kind,
          ts: block.ts,
          reason: "lean-in-document",
          detail:
            `${how}, but a document folio has no Lean toolchain to check it. ` +
            "Either drop the formalization or declare `contentType: \"paper\"`.",
        });
      }
    }
  }

  return { profile, declaredBy, blocksChecked, violations };
}

/** Render a result as the report a human or an agent reads. */
export function formatProfileCheck(result: ProfileCheckResult): string {
  const head =
    `Profile: ${result.profile} (${result.declaredBy})\n` +
    `Blocks checked: ${result.blocksChecked}`;
  if (result.violations.length === 0) {
    return `${head}\n✓ Every block is within the declared profile.`;
  }
  const lines = [head, `✗ ${result.violations.length} block(s) outside the profile:`, ""];
  for (const v of result.violations) {
    lines.push(`  ${v.label} (${v.kind})`);
    lines.push(`    ${v.detail}`);
    lines.push(`    ${v.ts}`);
  }
  return lines.join("\n");
}
