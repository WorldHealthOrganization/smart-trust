#!/usr/bin/env bun
/**
 * Does a bean's body name a parent its front matter does not carry?
 *
 * @module scripts/check-bean-parent-prose
 * @covers bean-defs
 *
 * Every consumer that walks `parent` — a goal's open count, `beans roadmap`,
 * a review's queue — omits a bean whose prose names a parent its front
 * matter lacks, and that bean's whole subtree. `check:bean-parents` validates
 * the DECLARED graph; this asks whether the declaration agrees with the
 * bean's own prose.
 *
 * ## The phrase set is narrow ON PURPOSE
 *
 * Beans cross-reference each other constantly, so any nearby id is not a
 * parent claim. Only phrases that ASSERT PLACEMENT count — "belongs to",
 * "parent is", "should hang from", "parented to", "sits under" — each
 * requiring the id within about sixty characters. The scope is stated rather
 * than widened: other phrasings are not judged.
 *
 * Blockquote lines and fenced code are skipped, so a quoted sentence is not
 * read as a claim.
 *
 * ## Could-not-determine is never green
 *
 * No bean store, or a body that cannot be read, exits 2.
 *
 * Exit codes: 0 report only, or `--check` with no finding · 1 `--check` with
 * one · 2 could not determine.
 */
/**
 * `readBeans` is the ONE reader of the store, and this uses it rather than
 * walking `beans/defs/` itself.
 *
 * `check-bean-parents.ts` records why in its own import comment: every other
 * script had grown its own front-matter parser and its own `beanDefsDir`, so a
 * bean's `parent` had as many readings as there were callers. `BeanNode` already
 * carries `id`, `parent` AND `body`, which is everything this check needs — and
 * `beansIn` is deliberately non-recursive, so `beans/defs/archive/` (631
 * terminal beans with its own declaration and its own reader) does not fold
 * into this count. Re-globbing the directory here would have picked it up.
 */
import { readBeans } from "./beans.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

const BEAN_ID = "folio-assistant-[a-z0-9]{4}";

/**
 * Phrases that assert PLACEMENT, each capturing the id it places the bean under.
 *
 * Each allows up to ~60 characters between the phrase and the id, so
 * *"belongs to the rendered-surface stream, `folio-assistant-10uc`"* matches
 * while a sentence that merely mentions a bean two clauses later does not.
 */
const CLAIMS: readonly { readonly re: RegExp; readonly label: string }[] = [
  { re: new RegExp(`belongs\\s+(?:to|under|with)\\s+(?:the\\s+)?[\\w\\-\\s,']{0,60}?\`?(${BEAN_ID})`, "gi"), label: "belongs to/under" },
  { re: new RegExp(`(?:its|the)\\s+parent\\s+(?:is|should be)\\s+\`?(${BEAN_ID})`, "gi"), label: "parent is" },
  { re: new RegExp(`(?:should|must)\\s+(?:hang|sit)\\s+(?:from|under)\\s+\`?(${BEAN_ID})`, "gi"), label: "should hang from" },
  { re: new RegExp(`parented\\s+(?:to|under)\\s+\`?(${BEAN_ID})`, "gi"), label: "parented to" },
  { re: new RegExp(`(?:sits|lives)\\s+under\\s+\`?(${BEAN_ID})`, "gi"), label: "sits under" },
];

/**
 * A body with blockquotes and fenced code removed.
 *
 * Both carry somebody ELSE's words. `tlj9` quotes the very sentence this check
 * exists to find, so reading a blockquote as a claim makes the report its own
 * subject.
 */
function assertedProse(body: string): string {
  const out: string[] = [];
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n");
}

interface Finding {
  readonly bean: string;
  readonly label: string;
  readonly claimed: string;
  readonly declared: string;
}

function main(): number {
  const repoRoot = process.cwd();
  const check = process.argv.includes("--check");

  let store: ReturnType<typeof readBeans>;
  try {
    store = readBeans(repoRoot);
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-parent-prose", e);
    console.error("✗ cannot read the bean store:");
    console.error(`  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    return 2;
  }
  if (store === null) {
    // `readBeans` returns null for "the graph declares no bean-defs node", which
    // is a determined absence rather than a clean store. Refusing, not passing.
    console.error("✗ no bean-defs node declared in the bean graph — refusing");
    console.error("  rather than reporting no drift over a store I did not open.");
    return 2;
  }

  let beans = 0;
  let withIds = 0;
  let mentions = 0;
  let sites = 0;
  const findings: Finding[] = [];

  for (const bean of store) {
    beans++;
    const declared = bean.parent.trim();

    const inBody = bean.body.match(new RegExp(BEAN_ID, "g"))?.length ?? 0;
    if (inBody > 0) {
      withIds++;
      mentions += inBody;
    }

    const prose = assertedProse(bean.body);
    for (const { re, label } of CLAIMS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(prose)) !== null) {
        const claimed = m[1]!;
        // A bean naming ITSELF is not a parent claim.
        if (claimed === bean.id) continue;
        sites++;
        if (claimed !== declared) {
          findings.push({
            bean: bean.id,
            label,
            claimed,
            declared: declared === "" ? "(none)" : declared,
          });
        }
      }
    }
  }

  if (beans === 0) {
    console.error("✗ the bean-defs directory holds no bean — refusing.");
    return 2;
  }

  console.log("Bean parent prose — does the body agree with the front matter?\n");
  console.log(`  beans read                  ${beans}`);
  console.log(`  ...naming any bean id       ${withIds} of ${beans}`);
  console.log(`  id mentions in bodies       ${mentions}`);
  console.log(`  ...in a PLACEMENT phrase    ${sites} of ${mentions}\n`);

  // The last ratio is the check's own justification and is printed every run:
  // a placement-phrase count approaching the mention count would mean the
  // phrase set had stopped discriminating, and the right response then is to
  // narrow it rather than to accept the findings.

  for (const f of findings) {
    console.log(`  ✗ ${f.bean}: body says it ${f.label} ${f.claimed}`);
    console.log(`      front matter declares ${f.declared}`);
  }
  if (findings.length > 0) console.log();

  if (findings.length > 0) {
    console.log(`✗ ${findings.length} bean(s) whose body and front matter disagree.`);
  } else if (sites === 0) {
    // A DETERMINED EMPTY, not a clean sweep — the same distinction
    // `check:instance-themes` draws, and for the same reason: "0 claims, 0
    // disagreements" over an empty domain reads exactly like "0 disagreements
    // across the store", and only one of those two is evidence. It is still
    // exit 0: no bean asserting a placement is a fine state for the store to be
    // in, and the day one does the phrase set will see it.
    console.log("· no placement claim in any body, so nothing was compared.");
    console.log(`  ${withIds} of ${beans} bodies name a bean id (${mentions} mentions),`);
    console.log("  and none of them asserts where its bean belongs. That is a");
    console.log("  determined empty rather than a clean sweep.");
  } else {
    console.log(
      `✓ no drift — all ${sites} placement claim(s) match their front matter.`,
    );
  }

  return check && findings.length > 0 ? 1 : 0;
}

// GUARDED so the module can be imported. Without this, a test importing an
// exported helper runs the CLI and exits the test runner — which is exactly
// what happened to `upload-names.test.ts`: the report printed and the run
// died with no tally. `if (import.meta.main)` is the idiom every other
// importable script here uses.
if (import.meta.main) process.exit(main());
