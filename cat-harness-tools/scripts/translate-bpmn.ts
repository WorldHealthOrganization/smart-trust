#!/usr/bin/env bun
/**
 * BPMN diagram translation — extract strings, and inject them back per locale.
 *
 * `pipeline/bpmn-translate.ts` is the round-trip; this is the orchestration
 * around it.
 *
 *   - EXTRACT writes the `.pot` a translator needs before there can be a `.po`.
 *   - INJECT SKIPS a locale that has no `.po` rather than failing: "not
 *     translated yet" is the ordinary state of a diagram, not an error.
 *   - PAGE WIRING is not attempted here. No translated page references a
 *     workflow SVG, so a locale render would produce a file nothing links to
 *     (the mirror of the dangling references gated by `check:workflow-refs`).
 *
 * ## `--check`
 *
 * Like `render:bpmn:check` for `render-bpmn`: a diagram added without
 * re-extracting would otherwise be invisible to translators, since a `.pot`
 * is their INPUT.
 *
 * The comparison excludes the `POT-Creation-Date` header, the only line that
 * differs between two runs over an unchanged diagram.
 *
 * **Three states, not two.** A `.pot` that is absent is STALE; one that
 * differs is STALE; one that cannot be READ is reported as such and fails,
 * never as a pass. A run in which NO locale gates, so that no template was
 * examined at all, exits 2 rather than 0 (exit codes: 0 fresh, 1
 * stale/missing/orphaned, 2 nothing examined or nothing to do, 78 not
 * applicable: the root has no diagram, or translates into no locale).
 *
 * ## What it gates on, and what it only reports
 *
 * A locale that has NEVER carried a workflow template has not opted in. So a
 * locale with a `processes/` tree GATES, and one without is reported as NOT A
 * TARGET with its count — not gated, and not silent either, since a locale
 * scanned and found empty must not read as clean.
 *
 * Usage:
 *   bun run cat translate-bpmn --extract [--locale fr]
 *   bun run cat translate-bpmn --check   [--locale fr]
 *   bun run cat translate-bpmn --inject --locale fr
 *
 * Injection writes `translations/<locale>/processes/<name>.bpmn`. Rendering it
 * is `bun run cat render:bpmn` territory and is deliberately a separate step: the
 * renderer drives headless Chromium, and an extract/inject run should not.
 *
 * @covers processes, translation-sources
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { layerRootsIn, localeDirIn, translationsHomeFor } from "../schemas/kg/cat-harness.js";
import { notJudgedInSwitchedOff, switchedOffGroups } from "../schemas/kg/opt-in-roots.js";
import { gateOwnsFile } from "./lib/gate-own.ts";
import { workflowFiles, corpusScopeFor } from "./known-skills.js";
import { basename, dirname, join, relative, resolve } from "node:path";
import { extractBpmn, injectBpmn } from "../pipeline/bpmn-translate.js";
import { formatPot, potWithoutTimestamp } from "../pipeline/pot-extract.js";
import { parsePo } from "../pipeline/po-inject.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { exitNotApplicable } from "./lib/not-applicable.ts";

/**
 * The layer whose diagrams are extracted — this one, or `--instance <root>`.
 *
 * Bean `j28g`. `bootstrap/` is a NESTED layer, so the root's scan does not
 * reach its three diagrams by design (`7u3g`, enforced by
 * `instance-graph-isolation.test.ts`) — and it must not, because widening the
 * scan re-introduces the leak that test exists to stop. But their `.pot` files
 * sat under `cat-harness/translations/` regardless, where nothing would ever
 * refresh them: measured 2026-09-21, `log-message.pot` did not carry the lane
 * documentation added to that diagram the same day, so a translator opening it
 * would have translated text the diagram no longer contains.
 *
 * The fix is not a wider scan but a SECOND RUN, pointed at the layer that
 * owns those diagrams — the same shape `kg-export.ts --instance ./bootstrap`
 * already uses, and for the same reason.
 */
const instanceFlag = ((): string | undefined => {
  const a = process.argv.slice(2);
  const i = a.indexOf("--instance");
  return i === -1 ? undefined : a[i + 1];
})();
const root = instanceFlag ? resolve(instanceFlag) : resolve(HARNESS_ROOT);
/**
 * This script's OWN layer, which is the host when `--instance` names a
 * different one. Always cat-harness, whatever `--instance` says — that is the
 * point: the tool resolving a dependency's templates is the tool that publishes
 * them.
 */
/**
 * For reporting only. A hosted layer's templates sit outside `--instance`,
 * so a path relative to IT would climb out with `../`, and one relative to the
 * host would read as the host's own file. The repo root is the one base under
 * which every case reads as itself.
 */
const REPO_ROOT = resolve(dirname(HARNESS_ROOT));
const argv = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}
const wantExtract = argv.includes("--extract");
const wantInject = argv.includes("--inject");
const wantCheck = argv.includes("--check");
const locale = flag("locale");

if (!wantExtract && !wantInject && !wantCheck) {
  console.error("Nothing to do. Pass --extract, --check, or --inject --locale <code>.");
  process.exit(2);
}
if (wantInject && !locale) {
  console.error("--inject needs --locale <code>.");
  process.exit(2);
}

// ABSOLUTE paths from every declared knowledge-graph directory. A diagram in
// a topical directory is as translatable as one under `skills/`, and a
// translator who is never shown it has no way to know it was skipped.
//
// SCOPE DIFFERS FROM glossary-export ON PURPOSE (bean `nafz`). `workflowFiles`
// walks the dependency overlay, so a dependent's diagrams are translated here:
// a translator works on what the layer SHOWS, inherited diagrams included.
// `glossary-export` walks this layer's own diagrams only, because a
// glossary is a published artefact OF one layer and each dependent builds
// its own; it names roles drawn in another layer rather than hiding them.
// The skill says so: `swimlane-glossary` §"Run it once per instance — never
// widen the scan" (widening re-opens the `7u3g` leak).
const diagrams = workflowFiles(root, corpusScopeFor(root)).filter((f) => f.endsWith(".bpmn"));
// A root with no diagram has nothing to translate, and no run changes that:
// not applicable (78, `lib/not-applicable.ts`), never "could not determine".
if (diagrams.length === 0) exitNotApplicable("translate-bpmn", `${root} has no .bpmn file in any declared knowledge-graph directory, so there is no workflow template to extract or check`);

/**
 * The declared home of `.pot` / `.po` sources, read rather than written down.
 *
 * `harness.json` declares it as the `translation-sources` graph; this module
 * had the literal `translations` in five places, which `check:declared-paths`
 * caught the moment two more were added. Resolved once here so relocating the
 * tree is a declaration edit, not a sweep — and so this script and
 * `translate-kg-viewer` cannot disagree about where a translator's files are.
 *
 * Falls back to the convention when nothing declares it: a layer with no
 * declaration still has a `translations/`, and refusing to run over one would
 * be worse than assuming the default the schema already supplies.
 */
//
// `HOME` answers all three cases rather than two — see `translationsHomeFor`.
// The third is `bootstrap`, whose templates live in cat-harness's corpus under
// `<locale>/bootstrap/` because a `.pot` is tooling output and bootstrap is a
// floor an agent reads. The host is passed as `HARNESS_ROOT`, this script's own
// layer: the host is a DEPENDENT (cat-harness declares `needs: ['bootstrap']`,
// not the reverse), so it cannot be found by walking `--instance`'s own
// dependencies.
const HOME = translationsHomeFor(root, HARNESS_ROOT);
const TRANSLATIONS = HOME.root;

// In a layer's PR checks, only templates the caller commits (owner ruling
// 2026-11-05, "Move the checks"; `lib/gate-own.ts`). bootstrap's `.pot` files
// live in cat-harness's `translations/`, so a layer above is not judged on them.
if (wantCheck && gateOwnsFile(relative(REPO_ROOT, TRANSLATIONS)) === false) {
  console.log(
    `✓ translate-bpmn --check: the templates live in ${relative(REPO_ROOT, TRANSLATIONS)}, which the caller does not commit; ` +
      "the owning layer's CI judges them.",
  );
  process.exit(0);
}

/**
 * The per-locale subdirectory holding a diagram's `.pot`/`.po`/injected `.bpmn`.
 *
 * declared-path-literal: NOT the declared `processes/` graph — this is a
 * sibling INSIDE `translations/<locale>/`, named after the kind whose
 * diagrams it carries so that a translator opening the tree sees the same
 * word the corpus uses. It was `workflows/` until 2026-09-21 and was renamed
 * with the kind; the scanner cannot tell the two apart from the literal
 * alone, which is why the reason is here rather than repeated five times.
 *
 * One constant rather than five joins for the reason `potPathFor`'s own
 * docstring gives about its sibling: two copies of a path is how a check
 * passes over a file the extractor never wrote.
 */
const DIAGRAM_SUBDIR = "processes";

/**
 * Where a diagram's template lives — ONE answer, for the writer and the
 * checker alike.
 *
 * Two copies of this join is how a check passes over a file the extractor
 * never wrote, which is the shape of the defect this whole module exists to
 * close.
 */
function potPathFor(file: string, loc: string): string {
  return join(localeDirIn(homeFor(file), loc), DIAGRAM_SUBDIR, `${basename(file, ".bpmn")}.pot`);
}

/**
 * The layer that OWNS a diagram: the deepest layer root containing it.
 * `--instance`'s corpus reaches other layers' `processes/` graphs (core's,
 * sci's, the FHIR IG harness's, the DAK base layer's), and until 2026-10-04 every one of their
 * templates was written into THIS layer's tree because it had no other
 * home. Owner, that day: *"move things to semantically appropriate place"*
 * (bean riit) — a diagram's templates sit with the layer that draws it.
 */
const INSTANCE_ROOTS = [root, ...layerRootsIn(REPO_ROOT)]
  .map((r) => resolve(r))
  .sort((a, b) => b.length - a.length);
function ownerRootOf(file: string): string {
  const abs = resolve(file);
  return INSTANCE_ROOTS.find((r) => abs.startsWith(`${r}/`)) ?? root;
}

const homes = new Map<string, ReturnType<typeof translationsHomeFor>>();
/** A diagram's translation home: its OWNER's declared `translation-sources`, else hosted, else the convention. */
function homeFor(file: string): ReturnType<typeof translationsHomeFor> {
  const owner = ownerRootOf(file);
  if (owner === resolve(root)) return HOME;
  let h = homes.get(owner);
  if (h === undefined) {
    h = translationsHomeFor(owner, HARNESS_ROOT);
    homes.set(owner, h);
  }
  return h;
}

/** The comparison form of a template, shared with core's `glossary-pot` (see `potWithoutTimestamp`). */
const withoutTimestamp = potWithoutTimestamp;

/** Locales that already have a translations directory. */
function knownLocales(): string[] {
  const out = new Set<string>();
  for (const dir of new Set([TRANSLATIONS, ...diagrams.map((f) => homeFor(f).root)])) {
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) out.add(e.name);
  }
  return [...out].sort();
}

if (wantCheck) {
  const targets = locale ? [locale] : knownLocales();
  if (targets.length === 0) exitNotApplicable("translate-bpmn", "the root translates into no locale (none under its translations root) and none was given with --locale");
  console.log(`Checking ${diagrams.length} diagram(s) against: ${targets.join(", ")}\n`);

  // A locale GATES once it carries at least one workflow template; before
  // that it is reported, not demanded. `--locale` is an explicit request, so
  // naming one opts it in.
  const gating = new Set(
    targets.filter(
      (loc) =>
        locale === loc ||
        existsSync(join(TRANSLATIONS, loc, DIAGRAM_SUBDIR)) ||
        diagrams.some((f) => existsSync(join(localeDirIn(homeFor(f), loc), DIAGRAM_SUBDIR))),
    ),
  );

  // THE THIRD STATE. With no gating locale the loop below examines nothing and
  // would print "Every diagram has a current .pot" over zero comparisons —
  // the `dh4f` shape, a clean run over nothing. That is "could not
  // determine", so it exits 2, neither 0 (a claim of freshness nobody
  // checked) nor 1 (a staleness nobody found). Bean `0hd6`.
  if (gating.size === 0) {
    console.log(
      `  gating on: (none) — ${targets.join(", ")} carry no ${DIAGRAM_SUBDIR}/ tree, so no template was examined.\n` +
        `\nNothing was checked. Opt a locale in with --locale <code>, or extract one with\n` +
        `  bun run cat translate-bpmn --extract --locale <code>`,
    );
    process.exit(2);
  }

  const missing: string[] = [];
  const stale: string[] = [];
  const unreadable: string[] = [];
  const notTarget = new Map<string, number>();

  for (const file of diagrams) {
    const entries = extractBpmn(readFileSync(file, "utf-8"), relative(root, file));
    for (const loc of targets) {
      const out = potPathFor(file, loc);
      const label = relative(root, out);
      if (!gating.has(loc)) {
        notTarget.set(loc, (notTarget.get(loc) ?? 0) + 1);
        continue;
      }
      if (!existsSync(out)) {
        missing.push(label);
        continue;
      }
      let onDisk: string;
      try {
        onDisk = readFileSync(out, "utf-8");
      } catch {
        // NOT a pass. An unreadable template is a template nobody can rely
        // on, and reporting it as up to date is the one answer this check
        // must never give.
        unreadable.push(label);
        continue;
      }
      const fresh = formatPot(entries, { projectName: basename(file, ".bpmn"), locale: loc });
      if (withoutTimestamp(onDisk) !== withoutTimestamp(fresh)) stale.push(label);
    }
  }

  // THE REVERSE QUESTION, and nothing asked it until bean `j28g`.
  //
  // Everything above asks "does every diagram have a template". A template
  // that outlives its diagram is invisible to all of it: `bootstrap.pot` sat
  // in five locales for a day after `7d57e2d279` renamed the diagram away,
  // while this check printed "Every diagram has a current .pot in every
  // locale" — true of the diagrams it looked at, and silent about the file it
  // never did. `fd6i`: declared and never used, so nothing breaks, which is
  // exactly why it survived.
  //
  // Scoped to THIS layer's own templates. A nested layer's diagrams are
  // deliberately unscanned (`7u3g`), so its templates are not orphans here —
  // they are somebody else's to check, with their own `--instance` run.
  // Per HOME (bean riit): a template is owned only in the home its diagram's
  // owner declares, so one left in another layer's tree is an orphan there
  // — which is how a template that did not move with its diagram is caught.
  const ownedIn = new Map<string, Set<string>>();
  const homeList = new Map<string, ReturnType<typeof translationsHomeFor>>();
  /** The layer whose diagrams each home holds templates for. */
  const ownerOf = new Map<string, string>();
  for (const f of diagrams) {
    const h = homeFor(f);
    const key = `${h.root}\u0000${h.scope.join("/")}`;
    homeList.set(key, h);
    if (!ownerOf.has(key)) ownerOf.set(key, ownerRootOf(f));
    const set = ownedIn.get(key) ?? new Set<string>();
    set.add(basename(f, ".bpmn"));
    ownedIn.set(key, set);
  }
  if (!homeList.has(`${HOME.root}\u0000${HOME.scope.join("/")}`)) {
    homeList.set(`${HOME.root}\u0000${HOME.scope.join("/")}`, HOME);
    ownedIn.set(`${HOME.root}\u0000${HOME.scope.join("/")}`, new Set());
  }
  if (!ownerOf.has(`${HOME.root}\u0000${HOME.scope.join("/")}`)) ownerOf.set(`${HOME.root}\u0000${HOME.scope.join("/")}`, resolve(root));
  const orphaned: string[] = [];
  // NOT JUDGED HERE (owner, 2026-11-12, card Q-OPTIN-DIRS A): a template
  // whose diagram is in an opt-in sub-graph the root that MOUNTED the owning
  // layer switched off. The writer files every diagram's template in its
  // layer's one `translations/` home, so a switched-off group's templates
  // stay there while its diagrams are not resolved (or not mounted). They are
  // judged where the group is switched on.
  const notJudged: string[] = [];
  const offGroups = new Map<string, ReturnType<typeof switchedOffGroups>>();
  for (const loc of [...gating].sort()) {
    for (const [key, h] of homeList) {
      // `localeDirIn`, NOT a join on the home's root — a hosted layer's
      // root is its HOST's corpus, and composing `<root>/<locale>/processes`
      // reads every template the host owns and calls each an orphan (355
      // spurious ones, measured 2026-09-27, against bootstrap's three).
      const dir = join(localeDirIn(h, loc), DIAGRAM_SUBDIR);
      let names: string[];
      try {
        names = readdirSync(dir).filter((n) => n.endsWith(".pot"));
      } catch {
        continue;
      }
      const owned = ownedIn.get(key)!;
      const owner = ownerOf.get(key) ?? resolve(root);
      for (const n of names.sort()) {
        if (owned.has(basename(n, ".pot"))) continue;
        let groups = offGroups.get(owner);
        if (groups === undefined) {
          try {
            groups = switchedOffGroups(owner);
          } catch {
            groups = { onDisk: [], leftOut: [] };
          }
          offGroups.set(owner, groups);
        }
        if (notJudgedInSwitchedOff(basename(n, ".pot"), ".bpmn", owner, groups) !== undefined) notJudged.push(`${relative(REPO_ROOT, dir)}/${n}`);
        else orphaned.push(`${relative(REPO_ROOT, dir)}/${n}`);
      }
    }
  }

  const bad = missing.length + stale.length + unreadable.length + orphaned.length;
  console.log(`  gating on: ${[...gating].sort().join(", ") || "(none)"}`);
  console.log(`  ${missing.length ? "✗" : "✓"} ${String(missing.length).padStart(3)}  never extracted`);
  console.log(`  ${stale.length ? "✗" : "✓"} ${String(stale.length).padStart(3)}  out of date`);
  if (unreadable.length) console.log(`  ✗ ${String(unreadable.length).padStart(3)}  could not be read`);
  console.log(`  ${orphaned.length ? "✗" : "✓"} ${String(orphaned.length).padStart(3)}  template with no diagram`);
  if (notJudged.length) console.log(`  · ${String(notJudged.length).padStart(3)}  template of a diagram in an opt-in sub-graph switched off here — not judged`);
  for (const [loc, n] of [...notTarget].sort()) {
    console.log(`  · ${String(n).padStart(3)}  ${loc} — not a workflow-translation target yet, so not demanded`);
  }

  if (missing.length) {
    console.log("\nNEVER EXTRACTED — the diagram is invisible to whoever translates:");
    for (const m of missing) console.log(`  ✗ ${m}`);
  }
  if (stale.length) {
    console.log("\nOUT OF DATE — the diagram changed since the template was written:");
    for (const m of stale) console.log(`  ✗ ${m}`);
  }
  if (unreadable.length) {
    console.log("\nCOULD NOT BE READ — reported, never counted as up to date:");
    for (const m of unreadable) console.log(`  ✗ ${m}`);
  }

  if (orphaned.length) {
    console.log("\nNO DIAGRAM — a template this instance will never refresh again:");
    for (const m of orphaned) console.log(`  ✗ ${m}`);
    console.log(
      "  Either the diagram was renamed or removed and this is a relic, or it belongs to a\n" +
        "  nested instance and should live under ITS translations, extracted with\n" +
        "  `--instance <root>`. Removing a translator's input is a person's call, not this check's.",
    );
  }

  if (bad) {
    // The remedy names THIS run's layer. It said `translate-bpmn --extract`
    // for every run, which for a `--instance ./bootstrap` check is a command
    // that refreshes the OTHER layer's templates and leaves these red.
    const scope = instanceFlag ? ` --instance ${instanceFlag}` : "";
    console.log(`\n${bad} template(s) need attention: bun run cat-harness-tools/scripts/translate-bpmn.ts${scope} --extract`);
    process.exit(1);
  }
  console.log("\nEvery diagram has a current .pot in every locale, and every template has a diagram.");
}

if (wantExtract) {
  const targets = locale ? [locale] : knownLocales();
  if (targets.length === 0) exitNotApplicable("translate-bpmn", "the root translates into no locale (none under its translations root) and none was given with --locale");
  console.log(`Extracting ${diagrams.length} diagram(s) for: ${targets.join(", ")}\n`);
  let total = 0;
  for (const file of diagrams) {
    const xml = readFileSync(file, "utf-8");
    const rel = relative(root, file);
    const entries = extractBpmn(xml, rel);
    total += entries.length;
    for (const loc of targets) {
      const out = potPathFor(file, loc);
      mkdirSync(dirname(out), { recursive: true });
      const fresh = formatPot(entries, { projectName: basename(file, ".bpmn"), locale: loc });
      // Written only when the CONTENT changed. `POT-Creation-Date` differs on
      // every run, so an unconditional write reports all 32 files as modified
      // after an extract that changed nothing — and a diff where everything
      // moved is a diff nobody reads. Skipping the no-op write is what makes
      // `git status` after an extract say what actually changed, which is how
      // the `.beans/` → `beans/` drift in 18 of these was spotted at all.
      const prior = existsSync(out) ? readFileSync(out, "utf-8") : undefined;
      if (prior !== undefined && withoutTimestamp(prior) === withoutTimestamp(fresh)) continue;
      writeFileSync(out, fresh);
    }
    console.log(`  ${relative(root, file).padEnd(48)} ${String(entries.length).padStart(3)} msgid(s)`);
  }
  console.log(`\n${total} translatable string(s) across ${diagrams.length} diagram(s).`);
  console.log("A .pot is a translator's input; nothing is translated until a .po sits beside it.");
}

if (wantInject) {
  const loc = locale!;
  const dirFor = (file: string) => join(localeDirIn(homeFor(file), loc), DIAGRAM_SUBDIR);
  let injected = 0;
  const skipped: string[] = [];

  console.log(`Injecting ${loc}\n`);
  for (const file of diagrams) {
    const stem = basename(file, ".bpmn");
    const po = join(dirFor(file), `${stem}.po`);
    if (!existsSync(po)) {
      // The ordinary state, not a failure. Say so per diagram rather than
      // reporting a clean run that produced nothing.
      skipped.push(stem);
      continue;
    }
    const translations = parsePo(readFileSync(po, "utf-8"));
    const xml = readFileSync(file, "utf-8");
    mkdirSync(dirFor(file), { recursive: true });
    writeFileSync(join(dirFor(file), basename(file)), injectBpmn(xml, translations));
    injected++;
    console.log(`  ✓ ${stem.padEnd(38)} ${translations.size} translation(s)`);
  }

  if (skipped.length) {
    console.log(`\n${skipped.length} diagram(s) have no ${loc} .po yet — nothing injected for them:`);
    console.log(`  ${skipped.join(", ")}`);
  }
  console.log(
    `\n${injected} diagram(s) written to translations/${loc}/${DIAGRAM_SUBDIR}/.` +
      (injected ? "\nRender them with `bun run cat render:bpmn` once the output path is wired." : ""),
  );
}
