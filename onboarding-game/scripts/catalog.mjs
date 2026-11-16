#!/usr/bin/env node
/**
 * Write the game's string catalog, src/i18n/en.json: every English string the player can see, one flat
 * `{ key: text }` object, which is what the harness's translation process reads (web-app.json `i18n.catalog`).
 *
 *   node scripts/catalog.mjs           write src/i18n/en.json
 *   node scripts/catalog.mjs --check   fail when it is stale (the build runs this)
 *
 * The English is written in code, where it is used: src/i18n/en.ts (UI), src/game/scenario.ts (the
 * moments, phases and roles) and src/game/glossary.ts (the hover terms). This script gathers it under
 * three key shapes:
 *   `<file>:<id>`              a UI string, as in en.ts             `ui.ts:title.lede`
 *   `scenario:<path>`          a scenario string, by its path       `scenario:soi.choices.email.text`
 *   `glossary:<term>.<field>`  a hover term                         `glossary:gateway.def`
 * Scenario paths address arrays by `id` (choices), `flag` (checks) or index (src/i18n/path.ts).
 * Left out: `steps` (references into smart-trust's BPMN, translated there) and terminal lines (code).
 *
 * Translations live in smart-trust, translations/<locale>/apps/onboarding-game.po, and reach the app as
 * public/i18n/<locale>.json (scripts/strings.mjs locally; the harness's `web-apps:build` at publish).
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/i18n/en.json');
const check = process.argv.includes('--check');

async function load() {
  const tmp = mkdtempSync(join(tmpdir(), 'gdhcn-catalog-'));
  const src = (p) => JSON.stringify(join(ROOT, p));
  const entry = join(tmp, 'entry.ts');
  writeFileSync(entry, `
    export { en } from ${src('src/i18n/en.ts')};
    export { MOMENTS, PHASES, ROLES } from ${src('src/game/scenario.ts')};
    export { GLOSSARY_EN } from ${src('src/game/glossary.ts')};
  `);
  const out = join(tmp, 'bundle.mjs');
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', absWorkingDir: ROOT, define: { 'import.meta.env': '{}' } });
  try { return await import(pathToFileURL(out).href); } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const TEXT_LEAF = new Set(['title', 'brief', 'prompt', 'learn', 'text', 'by', 'what', 'why', 'label', 'note', 'button', 'fix', 'lines']);

/** Scenario path -> English, for every translatable string in the moments, phases and roles. */
export function scenarioStrings({ MOMENTS, PHASES, ROLES }) {
  const out = {};
  for (const [p, v] of Object.entries(PHASES)) out[`phases.${p}`] = v;
  for (const [r, o] of Object.entries(ROLES)) for (const f of ['name', 'title', 'initials', 'job']) if (typeof o[f] === 'string' && o[f]) out[`roles.${r}.${f}`] = o[f];
  const walk = (v, segs, leaf) => {
    if (typeof v === 'string') { if (TEXT_LEAF.has(leaf) && v.trim()) out[segs.join('.')] = v; return; }
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (typeof x === 'string') return walk(x, [...segs, String(i)], leaf);
        const id = leaf === 'choices' ? x.id : leaf === 'checks' ? x.flag : String(i);
        walk(x, [...segs, id], leaf);
      });
      return;
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'steps') continue; // BPMN refs
        if (k === 'lines' && v.kind === 'terminal') continue; // code
        walk(x, [...segs, k], k);
      }
    }
  };
  for (const m of MOMENTS) walk(m, [m.id], '');
  return out;
}

const cur = await load();
const catalog = { ...cur.en };
for (const [k, v] of Object.entries(scenarioStrings(cur))) catalog[`scenario:${k}`] = v;
for (const [k, g] of Object.entries(cur.GLOSSARY_EN)) { catalog[`glossary:${k}.term`] = g.term; catalog[`glossary:${k}.def`] = g.def; }
const empty = Object.entries(catalog).filter(([, v]) => typeof v !== 'string' || v === '').map(([k]) => k);
if (empty.length) { console.error(`✗ empty strings: ${empty.join(', ')}`); process.exit(1); }

const sorted = Object.fromEntries(Object.keys(catalog).sort().map((k) => [k, catalog[k]]));
const text = `${JSON.stringify(sorted, null, 1)}\n`;
if (check) {
  if ((existsSync(OUT) ? readFileSync(OUT, 'utf8') : '') !== text) { console.error('✗ src/i18n/en.json is stale: run node scripts/catalog.mjs'); process.exit(1); }
  console.log(`✓ catalog current (${Object.keys(sorted).length} strings)`);
} else {
  writeFileSync(OUT, text);
  console.log(`✓ src/i18n/en.json: ${Object.keys(sorted).length} strings`);
}
