#!/usr/bin/env bun
/**
 * Every OPEN bean is placed under an epic or a milestone. This is what keeps the roadmap a plan.
 *
 * `beans roadmap` groups by `parent:` and drops everything else into a
 * "Miscellaneous" section. `beans create` does not ask for a parent and a new
 * bean is textually clean, so without this guard that section regrows in
 * silence.
 *
 * ## What it checks
 *
 * 1. Every bean whose `status` is `todo` or `in-progress` carries a `parent`.
 * 2. Every `parent` names a bean that EXISTS. A dangling parent is worse than
 *    none: the roadmap silently omits the child rather than listing it.
 * 3. Every `parent` names a bean whose `type` may parent (`milestone`, `epic`
 *    or `feature`), higher than the child in `milestone -> epic -> feature ->
 *    task` (or bug). Parenting a task to a task nests the roadmap somewhere nobody
 *    looks.
 *
 * ## What it does NOT check
 *
 * **Closed beans.** A `completed` or `scrapped` bean is history; only open
 * work has to be placeable.
 *
 * **A ROOT's own parent.** Milestones and epics are the roadmap's roots, so
 * neither is required to carry one — `ROOT_TYPES` below. An epic's parent is
 * a milestone when it has one.
 *
 * ## Third state
 *
 * A repository with no bean store is **not** a failure — it has no work
 * plan to check, and is reported as `no bean store`. Exit 2 is "could not
 * check" and is never rendered as a pass, the same rule
 * `check-harness-dirs.ts` and `check-ci-health.ts` follow.
 *
 * Usage:
 *   bun run cat check:bean-parents
 *   bun run cat check:bean-parents -- --json
 *
 * Exit: 0 every open bean is placed (or no store), 1 a real orphan, 2 could not check.
 *
 * @module scripts/check-bean-parents
 * @covers bean-defs, beans
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// ONE reader, imported. Until 2026-09-20 this file carried its own
// front-matter parser and its own `beanDefsDir`, and so did every other
// consumer of the store — which is how two of them can disagree about what a
// bean is while both look correct in review. `scripts/beans.ts` is now the
// single answer; this check keeps only the RULE.
import { OPEN_STATUSES, beanDefsDir, readBeans, readStoreBeans, type BeanNode } from "./beans.ts";
import { beanStores } from "./unlinked-beans.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

// Re-exported because it was exported from here before the reader existed, and
// a consumer outside this repository would break on the move.
export { beanDefsDir };

/**
/**
 * The types that are ROOTS of the roadmap, so "open with no parent" is not a
 * defect for them.
 *
 * `beans prime` states this store's hierarchy as `milestone -> epic ->
 * feature -> task/bug`, so a milestone sits ABOVE an epic and has nothing to
 * hang from. Until 2026-09-20 only `epic` was here, because no milestone had
 * ever been created — the type was configured and unused. The first three
 * (the owner's goals, bean `wqht`) failed this check on the day they landed,
 * demanding a parent that by the hierarchy cannot exist.
 *
 * That is the same shape this file's own header warns about one level down:
 * a rule that forces a bean to declare something it never claimed, in order
 * to stay green.
 *
 * TWO SESSIONS FIXED THIS INDEPENDENTLY on 2026-09-20, from opposite ends —
 * one from `beans prime`'s stated hierarchy, one from `wqht`'s own claim that
 * the check "already allows epics under milestones", which it did not. The
 * corroboration is worth keeping: the same defect found twice by different
 * routes is evidence the hierarchy was genuinely unrepresentable here, not
 * that one session misread the check.
 */
const ROOT_TYPES = new Set(["milestone", "epic"]);

/**
 * The types a parent may have.
 *
 * `milestone -> epic -> feature -> task/bug`, which is the hierarchy
 * `beans prime` states. Nothing wider: parenting a task to a task nests the
 * roadmap somewhere nobody looks, which is the original reason this
 * constraint exists.
 *
 * `feature` WAS MISSING and the owner settled it, 2026-09-22 (`itka` finding
 * 2, issue #941): a feature is a real tier that may hold tasks, not a label.
 * Until then this set omitted it while the file's own header quoted the
 * four-tier sentence to justify `ROOT_TYPES` — the check cited the rule and
 * then contradicted it.
 *
 * MEASURED BEFORE THE RULING, so the choice was not made blind: 51 beans are
 * typed `feature`, exactly 2 hang from one and neither is open, and 25 of 25
 * open features hang from an epic. The omission had no live victim; what it
 * decided was what is allowed NEXT.
 */
const PARENT_TYPES = new Set(["milestone", "epic", "feature"]);

/**
 * Where each type sits in `beans prime`'s hierarchy, lower being higher up.
 *
 * Used for DIRECTION, which `PARENT_TYPES` cannot express: that set says a
 * type is ALLOWED TO BE SOMEBODY'S parent, not that it is allowed to be THIS
 * bean's parent. While the set held only the two root types those questions
 * coincided. A middle tier separates them.
 *
 * ## Why this is a DELTA over #953 rather than a duplicate of it
 *
 * #953 closed the same hole with `b.type === "epic" && p.type !== "milestone"`
 * — stated positively, which is right, and which is why that rule is kept
 * below unchanged. But it guards **epics only**. Widening `PARENT_TYPES`
 * admits two inversions and #953's form catches one of them:
 *
 * | shape | caught by the epic rule | caught by RANK |
 * |---|---|---|
 * | an `epic` under a `feature`   | yes | yes |
 * | a `feature` under a `feature` | **no** | yes |
 *
 * MEASURED, not argued: against merged `main` at `b7f8945b`, a five-bean
 * fixture (`m1` <- `e1` <- `f1` <- `f2`) reported `problems: []`. A feature
 * nested in a feature passes today.
 *
 * A type absent here is not ranked and is not direction-checked — the rule
 * declines to judge what the hierarchy does not mention, rather than guessing
 * a position for it.
 */
const RANK: Record<string, number> = { milestone: 0, epic: 1, feature: 2, task: 3, bug: 3 };

export interface BeanParentsReport {
  store: string | null;
  open: number;
  /** Defects NOT in the baseline. These fail. */
  problems: string[];
  /** Defects the baseline already records. Listed, never failed. */
  outstanding: string[];
  /** Baseline entries nothing matched — repaired, so the baseline can shrink. */
  stale: string[];
}

/**
 * Defects that predate the rule becoming reachable.
 *
 * `itka` / issue #941: the epic-under-epic rule was structurally unreachable,
 * so the corpus was never judged against it. Making it reachable surfaces
 * what was always there — and re-parenting somebody's epic is a judgement
 * about that epic's content, not a repair the checker's author may make.
 * OUTSTANDING IS THE OWNER'S; the check's job is to stop the count growing.
 *
 * Same shape as `bean-bodies-baseline.json`, deliberately: a recorded defect
 * is listed and never fails, anything outside fails, and an entry nothing
 * matches is reported STALE so the file can only shrink.
 */
export const BASELINE_FILE = "cat-harness-tools/scripts/bean-parents-baseline.json";

/** A defect's identity, stable across a title edit: the bean and the rule. */
const key = (id: string, rule: string): string => `${rule}:${id}`;

function loadBaseline(root: string): Set<string> {
  const f = resolve(root, BASELINE_FILE);
  if (!existsSync(f)) return new Set();
  const raw: unknown = JSON.parse(readFileSync(f, "utf-8"));
  const entries = (raw as { outstanding?: unknown }).outstanding;
  return new Set(Array.isArray(entries) ? entries.filter((e): e is string => typeof e === "string") : []);
}

export function checkBeanParents(root: string): BeanParentsReport {
  const beans = readBeans(root);
  if (beans === null) return { store: null, open: 0, problems: [], outstanding: [], stale: [] };

  // A parent may live in another store: since cat-harness-tools#459 each bean
  // has one home, and a layer's epic is held by that layer. The checked set
  // stays this checkout's own open beans; only the lookup widens.
  const byId = new Map<string, BeanNode>();
  for (const store of beanStores(root)) for (const b of readStoreBeans(store, root) ?? []) byId.set(b.id, b);
  for (const b of beans) byId.set(b.id, b);
  /* EVERY open bean, roots included — `itka`, issue #941.
   *
   * This filtered `ROOT_TYPES` out here, which made the epic-under-epic rule
   * below STRUCTURALLY UNREACHABLE: no `b` in the loop was ever an epic, so
   * the branch could not be taken, and the summary printed it as verified.
   * A rule nothing can reach, asserted as checked, is worse than no rule.
   *
   * The exclusion's intent is right and is documented on `ROOT_TYPES`: a root
   * is not REQUIRED to carry a parent. It was applied one scope too wide —
   * removing roots from every rule rather than from that one. It now lives on
   * the has-a-parent branch alone, so a root that DOES carry a parent is
   * judged on it like anything else.
   */
  const open = beans.filter((b) => OPEN_STATUSES.has(b.status));
  /** The non-roots, which is what "below the roadmap roots" counts. */
  const placed = open.filter((b) => !ROOT_TYPES.has(b.type ?? ""));
  const found: { key: string; message: string }[] = [];

  for (const b of open.sort((a, c) => a.id.localeCompare(c.id))) {
    const where = `${b.id} (${b.title.slice(0, 60)})`;
    if (!b.parent) {
      // A ROOT NEED NOT HAVE ONE. This is the whole of what the exclusion
      // was for, and now the whole of where it applies.
      if (ROOT_TYPES.has(b.type ?? "")) continue;
      found.push({
        key: key(b.id, "no-parent"),
        message: `${where}: open with no \`parent\` — it lands in the roadmap's Miscellaneous section`,
      });
      continue;
    }
    const p = byId.get(b.parent);
    if (!p) {
      found.push({
        key: key(b.id, "parent-missing"),
        message: `${where}: \`parent: ${b.parent}\` names no bean — the roadmap omits this child entirely`,
      });
    } else if (!PARENT_TYPES.has(p.type ?? "")) {
      found.push({
        key: key(b.id, "parent-type"),
        message: `${where}: \`parent: ${b.parent}\` is a ${p.type || "bean with no type"}, not a milestone, epic or feature`,
      });
    } else if (b.type === "epic" && p.type !== "milestone") {
      /* AN EPIC HANGS FROM A GOAL, and from nothing else. `beans prime`'s
       * hierarchy says so: milestone -> epic -> feature -> task/bug.
       *
       * STATED POSITIVELY rather than as "not another epic", which is what it
       * said until `feature` joined `PARENT_TYPES` (owner's ruling, 2026-09-22).
       * The old form tested one wrong parent out of the set; widening
       * `PARENT_TYPES` silently made `epic -> feature` legal, which inverts the
       * hierarchy — a goal's child hanging off one of its own grandchildren.
       * The general form cannot be holed that way by a later addition.
       *
       * Its own case rather than a narrower `PARENT_TYPES`, because the two
       * are not the same rule — a task's parent may be an epic and this one
       * may not — and because the message can then say WHY rather than
       * "wrong type".
       */
      found.push({
        key: key(b.id, "epic-under-epic"),
        message:
          `${where}: an epic's parent is a \`milestone\` (a goal) — ` +
          // Typed rather than prosed: "is a epic" is what an article in a
          // template gets you, and the fix is to stop needing one.
          `\`${b.parent}\` has type \`${p.type || "none"}\``,
      });
    } else if (RANK[b.type ?? ""] !== undefined && RANK[p.type ?? ""] !== undefined && RANK[p.type ?? ""]! >= RANK[b.type ?? ""]!) {
      /* ADDING `feature` TO `PARENT_TYPES` WIDENS MORE THAN IT LOOKS. On its
       * own it also permits an epic hanging from a feature, and a feature
       * nesting inside a feature — an INVERTED hierarchy, silently, because
       * every such parent has an allowed type.
       *
       * So the direction is checked rather than only the type: a parent must
       * sit strictly HIGHER than its child.
       *
       * ## What this adds OVER the epic rule below, which #953 already fixed
       *
       * That rule is the positive form — an epic's parent IS a milestone —
       * and it is right. It guards EPICS. It does not reach a `feature`
       * nested in a `feature`, because its guard is `b.type === "epic"`.
       * Measured against merged `main` at `b7f8945b`: a fixture
       * `m1 <- e1 <- f1 <- f2` reported `problems: []`.
       *
       * ## ORDER IS LOAD-BEARING: this runs AFTER the epic rule, not before
       *
       * Every epic whose parent is not a milestone is already caught above,
       * with the key `epic-under-epic` and #953's wording. So this branch
       * only ever sees NON-epic children, and it needs no escape hatch for
       * epic-under-epic — an earlier draft carried one, written against the
       * old negated rule, and it became dead weight the moment #953's
       * positive form landed.
       *
       * Putting it first instead is what an earlier draft of this merge did,
       * and it is wrong twice: `d308`'s baseline key would change from
       * `epic-under-epic` to `parent-not-higher`, so the recorded entry
       * would be reported STALE by a change that repaired nothing — the
       * baseline may only shrink, and only for the right reason — and #953's
       * own tests, which assert the epic message by name, would go red for a
       * rule that had not actually changed.
       */
      found.push({
        key: key(b.id, "parent-not-higher"),
        message:
          `${where}: a \`${b.type}\` hangs below a \`${p.type}\` in ` +
          "`milestone -> epic -> feature -> task/bug`, so `" +
          `${b.parent}\` cannot be its parent`,
      });
    }
  }
  const baseline = loadBaseline(root);
  const matched = new Set(found.map((f) => f.key).filter((k) => baseline.has(k)));
  return {
    store: beanDefsDir(root),
    open: placed.length,
    problems: found.filter((f) => !baseline.has(f.key)).map((f) => f.message),
    outstanding: found.filter((f) => baseline.has(f.key)).map((f) => f.message),
    stale: [...baseline].filter((k) => !matched.has(k)).sort(),
  };
}

/**
 * Exported so the SUMMARY LINE can be tested, which is where this check's
 * worst failure lived: not a wrong verdict, a correct verdict reported as a
 * stronger claim than it was. An exit code cannot carry that, so nothing
 * caught it until somebody read two adjacent lines.
 */
export function formatReport(r: BeanParentsReport): string {
  if (r.store === null) return "Bean parents\n  · no bean store — nothing to check";
  const out = [`Bean parents (${r.open} open, below the roadmap roots)`];
  if (r.problems.length === 0) {
    /* THE CLAIM IS EARNED ONLY WHEN THE BASELINE IS EMPTY.
     *
     * #953 fixed the WORDING — the old line named the wrong shape twice over,
     * since parents may be features and the epic rule requires a milestone
     * rather than merely forbidding another epic — and that wording is kept.
     *
     * It did not fix the QUANTIFIER, and that is this branch's second delta.
     * `d308` is baselined, so on `main` at `b7f8945b` the check prints, in
     * these two adjacent lines:
     *
     *   ✓ every open bean hangs from a milestone, epic or feature, and every
     *     epic from a milestone
     *   · outstanding (baselined): folio-assistant-d308 …: an epic's parent is
     *     a `milestone` (a goal) — `folio-assistant-zzmr` has type `epic`
     *
     * — a universal asserted on one line and refuted on the next. That is the
     * defect this check was repaired FOR, surviving inside the repair, and it
     * is why "NEW" is not pedantry: a reader who stops at the tick is entitled
     * to believe it.
     *
     * The baselined branch says NEW rather than dropping the claim, because
     * the check does still guarantee something — the count cannot grow — and
     * saying nothing would understate it as badly as the universal overstates
     * it.
     */
    out.push(
      r.outstanding.length
        ? "  ✓ every open bean hangs from a milestone, epic or feature, and every NEW epic from a milestone" +
          ` — ${r.outstanding.length} baselined defect(s) below, which this check holds level rather than clears`
        : "  ✓ every open bean hangs from a milestone, epic or feature, and every epic from a milestone",
    );
  } else {
    for (const p of r.problems) out.push(`  ✗ ${p}`);
    out.push("");
    out.push("  Set `parent: <epic-id>` in the bean's front matter, or open an epic for it.");
    out.push("  An epic's parent, if it has one, is the `milestone` bean for the goal it serves");
    out.push("  — work-plan/skills/work-plan/todo-manager.md §\"A GOAL is a `milestone` bean\".");
    out.push("  `beans roadmap` shows the current structure.");
  }
  /* LISTED, NEVER FAILED, and never silent either. A defect the baseline
   * records is still shown: hiding it would make "nobody has fixed this" and
   * "there is nothing here" the same output, which is the disease this whole
   * check exists to treat. */
  for (const o of r.outstanding) out.push(`  · outstanding (baselined): ${o}`);
  /* A BASELINE ENTRY NOTHING MATCHED means somebody repaired it, so the file
   * must shrink. Left in place it would licence the defect's return. */
  for (const k of r.stale) out.push(`  ✗ baseline entry \`${k}\` matches nothing — remove it from ${BASELINE_FILE}`);
  return out.join("\n");
}

if (import.meta.main) {
  let report: BeanParentsReport;
  try {
    report = checkBeanParents(resolve("."));
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-parents", e);
    console.error(`Could not check bean parents: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.problems.length || report.stale.length ? 1 : 0);
}
