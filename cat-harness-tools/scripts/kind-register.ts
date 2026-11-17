#!/usr/bin/env bun
/**
 * Every artefact a NEW GRAPH TYPOLOGY owes, performed and then verified — the
 * `skill:register` of kinds.
 *
 * @module scripts/kind-register
 * @covers cat-harness, typologies — it loads every declared kind node (which parses each against folio-graph-typology/v1) and checks each owes nothing
 *
 * ## What a new kind owes
 *
 * | obligation | kind |
 * |---|---|
 * | `readme:subgraphs` — READMEs whose regions count files | generated |
 * | `handler:index` — `published-graphs.md` | generated |
 * | `docs:harness` — `docs/_data/harness.json`, read by the navbar | generated |
 * | `navbar:include` — the generated nav partial | generated |
 * | `avatars:css` — the stylesheet, both schemes | generated |
 * | the **avatar** — glyph, hue, a sentence | **authored** |
 * | the **row** in `directory-conventions.md` | **authored** |
 *
 * It is a command rather than a list because each stale artefact's failure
 * names a generated file, never the kind you added, so the cause is
 * invisible from the symptom.
 *
 * ## Each check is run on its own, never through `gates`
 *
 * `bun test` runs some of these writers, so a `bun run cat gates` run can
 * repair an artefact and then report it current. As `skill:register` does,
 * this invokes each `--check` separately against the identical tree.
 *
 * ## The two AUTHORED artefacts are reported, never written
 *
 * An avatar's hue is a design decision and a table row is prose.
 *
 * ## Hue is reported, never graded
 *
 * A shared hue deliberately marks a FAMILY of kinds (e.g. the work-plan kinds
 * `beans`, `bean-defs`, `attestations`, `issue-marks`), so an exact collision
 * is not a defect, and two similar glyphs at similar hues are not something
 * one number can express. The clearance table is input to the person choosing
 * a tone — which is where {@link authoredGaps} sends them.
 *
 * Exit codes: 0 clean · 1 any stale artefact or any authored gap.
 */
import { spawnSync } from "node:child_process";

import { defaultGraphTypologies } from "../schemas/kg/cat-harness.js";
import { allAvatars, hasAvatar } from "../schemas/content/avatars.js";
import { documentedKinds, KIND_TABLE_DOC } from "./kind-table.ts";
// `folio` is registered by CORE as a load-time side effect, so the harness alone
// does not know it exists. Same import, same reason, as `check-declared-dirs`.
import "../schemas/kg/folio-graph-typology.js";

export interface Step {
  /** What to run, as `bun run` arguments. */
  readonly write: readonly string[];
  /** The same question asked rather than written. */
  readonly verify: readonly string[];
  /** Why this is in the chain, so a reader can re-derive rather than trust. */
  readonly because: string;
}

/**
 * The six GENERATED obligations, in order.
 *
 * Hand-declared, because no file states which artefacts a kind feeds — but each
 * was measured stale-then-current on #2022 by adding one kind, and {@link main}
 * re-proves every one at runtime rather than asserting it here.
 */
export const STEPS: readonly Step[] = [
  {
    write: ["kind:table"],
    verify: ["kind:table:check"],
    because:
      "the graph-typology TABLE in skills/kg/kg-core/directory-conventions.md, generated from each kind's " +
      "`description` since the owner moved the prose onto the kinds (bean dmx1). Edit the kind, not the row",
  },
  {
    write: ["avatars:css"],
    verify: ["avatars:css:check"],
    because:
      "the avatar stylesheet, in BOTH colour schemes. Found by `bun test` and not by `gates` on #2022, " +
      "which is bean `ymsu` from the other side",
  },
  {
    write: ["docs:harness"],
    verify: ["docs:harness:check"],
    because: "`docs/_data/harness.json`, which the site navbar reads — so a missing kind is a missing tile",
  },
  {
    write: ["navbar:include"],
    verify: ["navbar:include:check"],
    because: "the generated navigation partial the theme includes",
  },
  {
    write: ["handler:index"],
    verify: ["handler:index:check"],
    because: "`docs/cat-harness/published-graphs.md`, the index of what this instance publishes",
  },
  {
    write: ["readme:subgraphs"],
    verify: ["readme:sync:check"],
    because:
      "the directory READMEs whose generated regions COUNT files. `readme:sync:check` rather than a " +
      "`readme:subgraphs:check`, because the regions are written by the sync and checked by it",
  },
] as const;

/** An artefact a person must write, and which kind owes it. */
export interface AuthoredGap {
  kind: string;
  owes: "avatar" | "kind-table-row";
  detail: string;
}

/**
 * The authored obligations, per registered kind.
 *
 * Reported against the KIND, which is the point: `avatars:css:check` fails
 * naming a stylesheet, and `graph-typology-docs.test.ts` fails naming a table, and
 * neither says which kind you added.
 */
export function authoredGaps(root?: string): AuthoredGap[] {
  const out: AuthoredGap[] = [];
  const documented = new Set(documentedKinds(root));
  for (const kind of defaultGraphTypologies.names()) {
    if (!hasAvatar(kind)) {
      out.push({
        kind,
        owes: "avatar",
        detail:
          `no avatar: an \`avatar\` on its \`typologies/\` node for a declared kind, else an entry in \`schemas/content/avatars.ts\`. It needs a glyph (24x24 path data), a \`tone\` ` +
          `(hue, 0-359) and a \`reads\` sentence saying why that mark. Check the clearance report ` +
          `below before choosing the tone.`,
      });
    }
    if (!documented.has(kind)) {
      out.push({
        kind,
        owes: "kind-table-row",
        detail: `no row in \`${KIND_TABLE_DOC}\`: the table is GENERATED from each kind's \`description\` (bean dmx1), so run \`bun run cat kind:table\`, and give the kind a \`description\` if it has none.`,
      });
    }
  }
  return out;
}

/** Two kinds sharing a hue exactly, plus how close the nearest neighbour is. */
export interface HueReport {
  collisions: Array<{ tone: number; kinds: string[] }>;
  /** Every kind's nearest neighbour by hue, closest first. */
  nearest: Array<{ kind: string; neighbour: string; degrees: number }>;
}

/**
 * Hue clearance across the avatars.
 *
 * **Nothing here is a finding.** Measured over the real corpus: 11 exact
 * collisions across 58 kinds, every one deliberate, because a shared hue marks a
 * family — and two kinds say *"in WHO blue"* in their own `reads` string, so the
 * convention is in the data rather than inferred from it. A near-miss is no more
 * gradeable: hue is one of three signals and the glyph and the `reads` sentence
 * are the others.
 *
 * It is reported so the person choosing a tone can see the field they are
 * choosing in. Reading a number off this table is their judgement; a cutoff
 * would make it a gate's.
 */
export function hueReport(): HueReport {
  const byTone = new Map<number, string[]>();
  for (const [kind, a] of allAvatars()) {
    byTone.set(a.tone, [...(byTone.get(a.tone) ?? []), kind]);
  }
  const collisions = [...byTone.entries()]
    .filter(([, ks]) => ks.length > 1)
    .map(([tone, kinds]) => ({ tone, kinds: [...kinds].sort() }))
    .sort((a, b) => a.tone - b.tone);

  // Circular distance: 350 and 10 are 20 apart, not 340.
  const gap = (a: number, b: number): number => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  };
  const entries = allAvatars();
  const nearest = entries
    .map(([kind, a]) => {
      let neighbour = "";
      let degrees = 360;
      for (const [other, b] of entries) {
        if (other === kind) continue;
        const d = gap(a.tone, b.tone);
        if (d < degrees) {
          degrees = d;
          neighbour = other;
        }
      }
      return { kind, neighbour, degrees };
    })
    .sort((a, b) => a.degrees - b.degrees);
  return { collisions, nearest };
}

function run(args: readonly string[]): number {
  const r = spawnSync("bun", ["run", "cat", ...args], { stdio: "inherit", cwd: process.cwd() });
  return r.status ?? (r.error ? 128 : 0);
}

function verifyQuietly(args: readonly string[]): { code: number; output: string } {
  const r = spawnSync("bun", ["run", "cat", ...args], { encoding: "utf-8", cwd: process.cwd() });
  return { code: r.status ?? (r.error ? 128 : 0), output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function main(argv: readonly string[]): number {
  const check = argv.includes("--check");
  const kinds = defaultGraphTypologies.names();

  if (!check) {
    console.log(`Writing — ${STEPS.length} generated artefact(s) a graph typology owes:\n`);
    for (const s of STEPS) {
      const rc = run(s.write);
      if (rc !== 0) {
        console.error(`\n✗ \`bun run cat ${s.write.join(" ")}\` exited ${rc} — ${s.because}`);
        return 1;
      }
    }
  }

  // Each on its own, never through `gates` (bean `ymsu`).
  console.log(`\nVerifying — each check run on its own, never through \`gates\`:\n`);
  const red: string[] = [];
  for (const s of STEPS) {
    const { code, output } = verifyQuietly(s.verify);
    const name = s.verify.join(" ");
    if (code === 0) {
      console.log(`  ✓ ${name}`);
    } else {
      red.push(name);
      console.log(`  ✗ ${name} — ${s.because}`);
      for (const line of output.trim().split("\n").slice(-4)) console.log(`      ${line}`);
    }
  }

  const gaps = authoredGaps();
  const hues = hueReport();

  if (gaps.length > 0) {
    console.log(`\n${gaps.length} AUTHORED artefact(s) — a person writes these, this command does not:\n`);
    for (const g of gaps) console.log(`  · ${g.kind} owes its ${g.owes}: ${g.detail}`);
  }

  if (hues.collisions.length > 0) {
    // Reported, never graded: a shared tone marks a FAMILY. See `hueReport`.
    console.log(`\n${hues.collisions.length} shared tone(s) — a family colour, not a collision:\n`);
    for (const c of hues.collisions) console.log(`  · tone ${c.tone}: ${c.kinds.join(", ")}`);
  }

  // Reported and NOT graded, on purpose — see `hueReport`.
  const tight = hues.nearest.slice(0, 3);
  if (tight.length > 0) {
    console.log(`\nTightest hue clearances (reported, not graded — the threshold is nobody's to invent):`);
    for (const n of tight) console.log(`  ${n.degrees}° between ${n.kind} and ${n.neighbour}`);
  }

  // Hue is NOT a term here — see `hueReport` for the measurement that removed it.
  const failed = red.length + gaps.length;
  if (failed > 0) {
    console.error(
      `\n✗ ${red.length} stale artefact(s) and ${gaps.length} authored gap(s) across ` +
        `${kinds.length} registered kind(s).` +
        (check ? `\n  Run \`bun run cat kind:register\` to perform the generated ones.` : ``),
    );
    return 1;
  }
  console.log(
    `\n✓ ${STEPS.length} generated artefact(s) current and ${kinds.length} registered kind(s) ` +
      `carry an avatar and a table row. Commit them with the kind.`,
  );
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
