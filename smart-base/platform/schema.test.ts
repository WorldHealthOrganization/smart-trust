/**
 * The files the platform loads by glob stay off the full barrel, and the
 * light seam they use stays light.
 *
 * The platform imports `themes/themes.ts`, `schemas/**` and
 * `pipeline/qa-checkers-*.ts` from every layer, so whatever those files
 * load sits in the closure of every check that loads a theme, a kind or the
 * QA checkers. Through `index.ts` that was fhir-harness's IG-site and AST
 * readers, which left `skill:register:check` and `kg:audit:check`
 * undetermined for the CI input-hash (beans folio-assistant-x35i, vgfp,
 * k3vv). `schema.ts` is their seam; this holds it.
 *
 * The walk follows relative specifiers, type-only ones included, as the
 * input-hash closure (`cat-harness-tools/scripts/input-sites.ts`) does.
 *
 * @module smart-base/platform/schema.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const INSTANCE = resolve(import.meta.dir, "..");
const CHECKOUT = resolve(INSTANCE, "..");
const IMPORT_RE =
  /(?:^|[^\w$.])(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|(?:^|[^\w$.])import\s*["']([^"']+)["']|(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g;

function specifiers(file: string): string[] {
  const out: string[] = [];
  for (const m of readFileSync(file, "utf-8").matchAll(IMPORT_RE)) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}

function resolveModule(from: string, spec: string): string | undefined {
  const base = resolve(dirname(from), spec);
  for (const c of [base, base.replace(/\.js$/, ".ts"), `${base}.ts`, `${base}.tsx`, `${base}.js`, join(base, "index.ts")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return undefined;
}

/** Every file a relative import reaches from `entry`, checkout-relative. */
function closureOf(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of specifiers(f)) {
      if (!spec.startsWith(".")) continue;
      const t = resolveModule(f, spec);
      if (t !== undefined) stack.push(t);
    }
  }
  return [...seen].map((f) => relative(CHECKOUT, f)).sort();
}

/** The layer's files the platform loads by glob (tests are never loaded). */
function globbedByPlatform(): string[] {
  const out: string[] = [join(INSTANCE, "themes", "themes.ts")];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
    }
  };
  walk(join(INSTANCE, "schemas"));
  for (const f of readdirSync(join(INSTANCE, "pipeline"))) {
    if (/^qa-checkers-.*\.ts$/.test(f) && !f.endsWith(".test.ts")) out.push(join(INSTANCE, "pipeline", f));
  }
  return out.filter(existsSync);
}

const mounted = existsSync(join(CHECKOUT, "cat-harness-tools", "schemas"));

describe.skipIf(!mounted)("platform/schema.ts: the seam of the files the platform loads", () => {
  test("globbedFilesReachPlatformViaSchemaOnly", () => {
    const wrong: string[] = [];
    for (const f of globbedByPlatform()) {
      for (const spec of specifiers(f)) {
        const t = spec.startsWith(".") ? resolveModule(f, spec) : undefined;
        if (t === undefined) continue;
        const rel = relative(INSTANCE, t);
        if (rel.startsWith("platform/") && rel !== "platform/schema.ts") wrong.push(`${relative(CHECKOUT, f)} → ${spec}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("schemaReachesNoFhirHarnessOrScript", () => {
    const files = closureOf(join(INSTANCE, "platform", "schema.ts"));
    expect(files.filter((f) => f.startsWith("fhir-harness/") || /^[^/]+\/scripts\//.test(f))).toEqual([]);
  });

  test("globbedClosureStaysOffFhirHarness", () => {
    const heavy = new Set<string>();
    for (const f of globbedByPlatform()) {
      for (const c of closureOf(f)) if (c.startsWith("fhir-harness/") || /^[^/]+\/scripts\//.test(c)) heavy.add(`${relative(CHECKOUT, f)} ⇒ ${c}`);
    }
    expect([...heavy]).toEqual([]);
  });
});
