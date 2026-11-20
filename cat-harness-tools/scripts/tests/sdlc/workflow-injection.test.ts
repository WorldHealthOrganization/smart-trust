/**
 * Workflow expression injection, falsified.
 *
 * Every case here produces a GREEN workflow run. Nothing about an injected
 * `${{ }}` looks wrong from CI's output — the step succeeds, because executing
 * the attacker's command IS success as far as bash is concerned.
 */

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { baselineKey, classify, resolveProvenance, scanWorkflows, staleNotThisRoots, yieldsOnlyLiterals } from "../../check-workflow-injection.ts";

function workflows(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "injection-"));
  writeFileSync(join(dir, "w.yml"), body);
  return dir;
}

describe("classify", () => {
  test("free text is free text — a quote is all it takes", () => {
    for (const e of [
      "github.event.pull_request.title",
      "github.event.pull_request.body",
      "github.event.comment.body",
      "github.event.head_commit.message",
      "github.event.inputs.package",
      "inputs.anything",
    ]) {
      expect({ e, c: classify(e) }).toEqual({ e, c: "free-text" });
    }
  });

  test("attacker-chosen but shape-constrained is reported, not ignored", () => {
    // A git ref cannot contain a space, a quote or a semicolon; a PR number is
    // an integer. Neither carries the payload — but calling them SAFE would
    // assert a property of git this gate does not check.
    for (const e of ["github.head_ref", "github.event.pull_request.number", "github.event.repository.name"]) {
      expect({ e, c: classify(e) }).toEqual({ e, c: "constrained" });
    }
  });

  test("values the attacker does not influence are not reported at all", () => {
    // `steps.*.outputs` is here in the ONE-ARGUMENT form only: with no
    // provenance, the expression text genuinely says nothing about what the
    // step wrote. The scanner always passes provenance — see below.
    for (const e of ["github.workspace", "steps.slug.outputs.branch", "matrix.package", "secrets.GITHUB_TOKEN"]) {
      expect({ e, c: classify(e) }).toEqual({ e, c: null });
    }
  });
});

describe("a comparison yielding literals is not an injection", () => {
  // Caught on this gate's FIRST run, against correct code in
  // `discussions-maintain.yml`. A gate whose first act is a false alarm on a
  // legitimate idiom trains people to route around it.
  test("the shell receives one of two constants, never the input", () => {
    expect(yieldsOnlyLiterals("inputs.force_rerender == true && '--force' || ''")).toBe(true);
    expect(classify("inputs.force_rerender == true && '--force' || ''")).toBeNull();
  });

  test("but a branch that IS an input still reports", () => {
    // The narrowness is the point: one literal branch does not launder the other.
    expect(yieldsOnlyLiterals("inputs.a == 'x' && inputs.b || ''")).toBe(false);
    expect(classify("inputs.a == 'x' && inputs.b || ''")).toBe("free-text");
  });

  test("a bare input with no comparison is not laundered", () => {
    expect(yieldsOnlyLiterals("inputs.package")).toBe(false);
  });
});

describe("scanWorkflows reads `run:` blocks and nothing else", () => {
  test("free text inside a run block is found, with its line", () => {
    const dir = workflows(
      ["jobs:", "  a:", "    steps:", "      - run: |", "          echo '${{ github.event.pull_request.body }}'", ""].join("\n"),
    );
    const f = scanWorkflows(dir);
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("free-text");
    expect(f[0].line).toBe(5);
  });

  test("the SAME expression in `env:` is not reported — env is the remedy", () => {
    // Flagging it would push people back toward interpolation, which is the
    // one thing this gate exists to stop.
    const dir = workflows(
      [
        "jobs:",
        "  a:",
        "    steps:",
        "      - env:",
        "          PR_BODY: ${{ github.event.pull_request.body }}",
        "        run: |",
        '          echo "$PR_BODY"',
        "",
      ].join("\n"),
    );
    expect(scanWorkflows(dir)).toEqual([]);
  });

  test("an expression in `with:` is not a shell injection and is not graded", () => {
    const dir = workflows(
      ["jobs:", "  a:", "    steps:", "      - uses: x@v1", "        with:", "          t: ${{ github.event.issue.title }}", ""].join("\n"),
    );
    expect(scanWorkflows(dir)).toEqual([]);
  });

  test("a one-line `run:` is scanned too, not just a block", () => {
    const dir = workflows(
      ["jobs:", "  a:", "    steps:", "      - run: echo '${{ github.event.comment.body }}'", ""].join("\n"),
    );
    expect(scanWorkflows(dir).map((i) => i.severity)).toEqual(["free-text"]);
  });
});

describe("a step output CARRIES whatever the step put in it (bean `6bhf`)", () => {
  // Live in this repository, not hypothetical: `release-folio-assistant.yml`
  // bound `github.event.inputs.version` to env correctly, wrote it to
  // `$GITHUB_OUTPUT`, and a later step interpolated the output into
  // `mv *.tgz "folio-assistant-….tgz"`. The gate saw `steps.*.outputs` and said
  // nothing. A dispatch of `1.0";id;"` ran `id`.
  const launderer = [
    "jobs:",
    "  release:",
    "    steps:",
    "      - name: Determine version",
    "        id: version",
    "        env:",
    "          INPUT_VERSION: ${{ github.event.inputs.version }}",
    "        run: |",
    '          echo "version=$INPUT_VERSION" >> "$GITHUB_OUTPUT"',
    "      - name: Pack",
    "        run: |",
    '          mv *.tgz "folio-assistant-${{ steps.version.outputs.version }}.tgz"',
    "",
  ].join("\n");

  test("the producing step is recorded as carrying free text, keyed job.stepId", () => {
    const prov = resolveProvenance(launderer.split("\n"));
    expect(prov.get("release.version")).toBe("free-text");
  });

  test("the consumption is FREE TEXT, and the finding names the step that leaked", () => {
    const f = scanWorkflows(workflows(launderer));
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("free-text");
    // Without `via` the reader looks at a line whose expression is harmless.
    expect(f[0].via).toBe("release.version");
  });

  test("a step that writes an output but binds nothing is NOT a producer", () => {
    // Over-tainting costs an `env:` line, so the rule is deliberately coarse —
    // but it must still be a rule about the value, not about writing outputs.
    const prov = resolveProvenance(
      [
        "jobs:",
        "  a:",
        "    steps:",
        "      - id: plain",
        "        run: |",
        '          echo "n=3" >> "$GITHUB_OUTPUT"',
        "",
      ].join("\n").split("\n"),
    );
    expect([...prov]).toEqual([]);
  });

  test("a step that binds free text but writes NO output is not a producer either", () => {
    const prov = resolveProvenance(
      [
        "jobs:",
        "  a:",
        "    steps:",
        "      - id: quiet",
        "        env:",
        "          B: ${{ github.event.pull_request.body }}",
        "        run: |",
        '          echo "$B" > /tmp/x',
        "",
      ].join("\n").split("\n"),
    );
    expect([...prov]).toEqual([]);
  });

  test("the taint is JOB-scoped — step outputs are, so two jobs may reuse an id", () => {
    const f = scanWorkflows(
      workflows(
        [
          "jobs:",
          "  dirty:",
          "    steps:",
          "      - id: v",
          "        env:",
          "          T: ${{ github.event.inputs.tag }}",
          "        run: |",
          '          echo "x=$T" >> "$GITHUB_OUTPUT"',
          "  clean:",
          "    steps:",
          "      - id: v",
          "        run: |",
          '          echo "x=3" >> "$GITHUB_OUTPUT"',
          "      - run: |",
          '          echo "${{ steps.v.outputs.x }}"',
          "",
        ].join("\n"),
      ),
    );
    // `clean.v` wrote a literal. Keying on the bare id would have borrowed
    // `dirty.v`'s taint and reported a step that is fine.
    expect(f).toEqual([]);
  });

  test("a job output is followed one more hop, so `needs.*.outputs.*` inherits", () => {
    const f = scanWorkflows(
      workflows(
        [
          "jobs:",
          "  setup:",
          "    outputs:",
          "      sel: ${{ steps.pick.outputs.sel }}",
          "    steps:",
          "      - id: pick",
          "        env:",
          "          P: ${{ inputs.package }}",
          "        run: |",
          '          echo "sel=$P" >> "$GITHUB_OUTPUT"',
          "  use:",
          "    steps:",
          "      - run: |",
          '          echo "${{ needs.setup.outputs.sel }}"',
          "",
        ].join("\n"),
      ),
    );
    expect(f.map((i) => [i.severity, i.via])).toEqual([["free-text", "setup.sel"]]);
  });

  test("the SAME laundered output in `env:` is still not reported — env is the remedy", () => {
    // The fix for all four real sites was exactly this. If the gate flagged it
    // there would be nowhere left to go.
    const f = scanWorkflows(
      workflows(
        [
          "jobs:",
          "  release:",
          "    steps:",
          "      - id: version",
          "        env:",
          "          I: ${{ github.event.inputs.version }}",
          "        run: |",
          '          echo "version=$I" >> "$GITHUB_OUTPUT"',
          "      - env:",
          "          VERSION: ${{ steps.version.outputs.version }}",
          "        run: |",
          '          mv *.tgz "folio-assistant-$VERSION.tgz"',
          "",
        ].join("\n"),
      ),
    );
    expect(f).toEqual([]);
  });

  test("the real corpus is parsed, not skipped — an empty map would make this gate vacuous", () => {
    // `could not determine` is never rendered as clean. If the step walker
    // breaks, every `steps.*.outputs` silently returns to the safe band and
    // this gate goes green having asked nothing. Should this repository ever
    // genuinely have no such producer, say so deliberately rather than by
    // deleting the guard.
    const dir = join(import.meta.dir, "..", "..", "..", "..", ".github", "workflows");
    const found = readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => resolveProvenance(readFileSync(join(dir, f), "utf-8").split("\n")));
    const producers = found.reduce((n, m) => n + m.size, 0);
    expect(producers).toBeGreaterThan(0);
  });
});

describe("a value bound ABOVE the step still reaches its output", () => {
  // No workflow- or job-level `env:` in this corpus carries free text, measured
  // 2026-09-26. Closed rather than recorded, because recording a "true today"
  // instead of closing it is the exact mistake this whole change came out of.
  test("a WORKFLOW-level env taints a producer that binds nothing itself", () => {
    const prov = resolveProvenance(
      [
        "env:",
        "  T: ${{ github.event.inputs.tag }}",
        "jobs:",
        "  a:",
        "    steps:",
        "      - id: v",
        "        run: |",
        '          echo "x=$T" >> "$GITHUB_OUTPUT"',
        "",
      ].join("\n").split("\n"),
    );
    expect(prov.get("a.v")).toBe("free-text");
  });

  test("a JOB-level env taints that job's producer and NOT another job's", () => {
    const prov = resolveProvenance(
      [
        "jobs:",
        "  dirty:",
        "    env:",
        "      T: ${{ github.event.inputs.tag }}",
        "    steps:",
        "      - id: v",
        "        run: |",
        '          echo "x=$T" >> "$GITHUB_OUTPUT"',
        "  clean:",
        "    steps:",
        "      - id: w",
        "        run: |",
        '          echo "x=3" >> "$GITHUB_OUTPUT"',
        "",
      ].join("\n").split("\n"),
    );
    expect(prov.get("dirty.v")).toBe("free-text");
    expect(prov.has("clean.w")).toBe(false);
  });

  test("an env block BELOW the steps it reaches still taints them", () => {
    // YAML has no required order, and a one-pass resolver would read this file
    // clean while reading the same job written the other way round as a finding.
    const prov = resolveProvenance(
      [
        "jobs:",
        "  a:",
        "    steps:",
        "      - id: v",
        "        run: |",
        '          echo "x=$T" >> "$GITHUB_OUTPUT"',
        "    env:",
        "      T: ${{ inputs.tag }}",
        "",
      ].join("\n").split("\n"),
    );
    expect(prov.get("a.v")).toBe("free-text");
  });

  test("a step-level env is not mistaken for a job-level one", () => {
    // `env:` at indent 8 belongs to the step; only 0 and 4 are the wider scopes.
    const prov = resolveProvenance(
      [
        "jobs:",
        "  a:",
        "    steps:",
        "      - id: v",
        "        env:",
        "          T: ${{ inputs.tag }}",
        "        run: |",
        '          echo "x=$T" >> "$GITHUB_OUTPUT"',
        "      - id: w",
        "        run: |",
        '          echo "x=3" >> "$GITHUB_OUTPUT"',
        "",
      ].join("\n").split("\n"),
    );
    expect(prov.get("a.v")).toBe("free-text");
    // `w` binds nothing and sits under no wider env — it must stay clean.
    expect(prov.has("a.w")).toBe(false);
  });
});

describe("`script:` blocks are JavaScript, and the same values land in them (bean `j0zs`)", () => {
  // Live here, not hypothetical: `feature-staging.yml` interpolated the RAW fork
  // branch name into a JS TEMPLATE LITERAL, where `${…}` is evaluated — and
  // `git check-ref-format --branch 'a${process.exit(1)}b'` is LEGAL. Meanwhile
  // `folio-staging.yml`, doing the same job, had used `process.env` all along.
  test("free text in a `script:` block is reported, and the surface says so", () => {
    const f = scanWorkflows(
      workflows(
        [
          "jobs:",
          "  a:",
          "    steps:",
          "      - uses: actions/github-script@v9",
          "        with:",
          "          script: |",
          "            const t = '${{ github.event.pull_request.title }}';",
          "",
        ].join("\n"),
      ),
    );
    expect(f.map((i) => [i.severity, i.surface])).toEqual([["free-text", "script"]]);
  });

  test("a `run:` finding still says `run:` — the surface is read, not assumed", () => {
    const f = scanWorkflows(
      workflows(
        ["jobs:", "  a:", "    steps:", "      - run: echo '${{ github.event.comment.body }}'", ""].join("\n"),
      ),
    );
    expect(f.map((i) => i.surface)).toEqual(["run"]);
  });

  test("an ordinary `with:` input is still NOT graded — only `script:` is code", () => {
    // The scope line and the remedy line collided at exactly one key, and this
    // pins that only that one key moved. Widening to all of `with:` would flag
    // the remedy itself.
    const f = scanWorkflows(
      workflows(
        [
          "jobs:",
          "  a:",
          "    steps:",
          "      - uses: x@v1",
          "        with:",
          "          title: ${{ github.event.issue.title }}",
          "",
        ].join("\n"),
      ),
    );
    expect(f).toEqual([]);
  });

  test("the baseline key carries the surface, so one decision cannot baseline the other", () => {
    const base = { workflow: "w.yml", line: 1, expression: "github.head_ref", severity: "constrained" } as const;
    expect(baselineKey({ ...base, surface: "run" })).toBe("w.yml (run): github.head_ref");
    expect(baselineKey({ ...base, surface: "script" })).toBe("w.yml (script): github.head_ref");
    expect(baselineKey({ ...base, surface: "run" })).not.toBe(baselineKey({ ...base, surface: "script" }));
  });

  test("a `script:` block ends at its indentation, like a `run:` block", () => {
    // Otherwise the walker keeps scanning into the next step and attributes its
    // expressions to the wrong surface — which is a wrong remedy, not just a
    // wrong label.
    const f = scanWorkflows(
      workflows(
        [
          "jobs:",
          "  a:",
          "    steps:",
          "      - uses: actions/github-script@v9",
          "        with:",
          "          script: |",
          "            const ok = 1;",
          "      - run: echo '${{ github.event.comment.body }}'",
          "",
        ].join("\n"),
      ),
    );
    expect(f.map((i) => i.surface)).toEqual(["run"]);
  });

  test("the real corpus HAS `script:` blocks that are scanned — else this is inert", () => {
    // The guard that matters. If the `script:` detection breaks, every finding
    // in that surface silently disappears and the gate goes green having looked
    // at one of two surfaces. `could not determine` is never rendered as clean,
    // and neither is `did not look`.
    //
    // This asked for a live `script:` FINDING until folio-assistant#3066
    // (2026-11-10) dropped `publish.yml`, which held the only one. A clean
    // corpus is the outcome the gate wants, so the guard cannot depend on a
    // finding staying unfixed. It holds instead on the corpus's own `script:`
    // blocks: each is copied with one free-text expression planted on its first
    // line, and the scanner must report it there, as `script`. A walker that
    // stops seeing `script:` in a real workflow's shape fails here.
    const dir = join(import.meta.dir, "..", "..", "..", "..", ".github", "workflows");
    const planted = mkdtempSync(join(tmpdir(), "injection-corpus-"));
    let blocks = 0;
    for (const f of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
      const lines = readFileSync(join(dir, f), "utf-8").split("\n");
      lines.forEach((line, i) => {
        const stripped = line.trimStart();
        if (!/^-?\s*script:\s*[|>][-+]?\s*$/.test(stripped)) return;
        const indent = " ".repeat(line.length - stripped.length + 2);
        const copy = [...lines];
        copy.splice(i + 1, 0, `${indent}const planted = "\${{ github.event.comment.body }}";`);
        const name = `${blocks++}-${f}`;
        writeFileSync(join(planted, name), copy.join("\n"));
      });
    }
    expect(blocks).toBeGreaterThan(0);
    const found = scanWorkflows(planted).filter((i) => i.expression === "github.event.comment.body");
    expect(found.map((i) => i.surface)).toEqual(Array(blocks).fill("script"));
  });
});

// cat-harness-tools#1701: in a content instance's root the platform index's
// baseline lines name workflows that root does not have. Excused only there.
describe("staleNotThisRoots — a baseline line for another root's workflow", () => {
  const stale = ["feature-staging.yml (run): github.event.repository.name", "pr.yml (run): github.head_ref"];
  function root(name: string | undefined, workflows: string[]): string {
    const r = mkdtempSync(join(tmpdir(), "wfinj-root-"));
    if (name !== undefined) writeFileSync(join(r, `${name}.json`), JSON.stringify({ name }));
    mkdirSync(join(r, ".github", "workflows"), { recursive: true });
    for (const w of workflows) writeFileSync(join(r, ".github", "workflows", w), "on: push\n");
    return r;
  }

  test("an instance root without the named workflow excuses the line", () => {
    const got = staleNotThisRoots(stale, root("smart-ips-pilgrimage", ["pr.yml"]));
    expect([...got.keys()]).toEqual([stale[0]]);
  });

  test("a root that HAS the workflow still fails the stale line", () => {
    expect(staleNotThisRoots(stale, root("smart-ips-pilgrimage", ["feature-staging.yml", "pr.yml"])).size).toBe(0);
  });

  test("the index root, which declares no instance, is judged exactly as before", () => {
    expect(staleNotThisRoots(stale, root(undefined, [])).size).toBe(0);
  });
});
