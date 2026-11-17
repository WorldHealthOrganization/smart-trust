#!/usr/bin/env node
/**
 * The sample country and how the game names it (owner, 2026-11-17).
 *
 *   node scripts/test-country.mjs     (the build runs it)
 *
 * 1. The sample is Onesa (XXU), the SMART Trust demonstrator's home country. A name the demonstrator's
 *    journeys viewer keeps for Onesa in this origin's localStorage (`jv:<workshop>:country:onesa`,
 *    cat-harness-tools scripts/journeys/present.ts countryKey) becomes the sample; the player's own
 *    setting wins over both; older saves of "Country XC" mean the sample; the game never writes `jv:` keys.
 * 2. Every country mention substitutes cleanly in every locale: the English catalog names no sample
 *    country, and in ru, ar and fr `{country}` always follows a head noun that takes the grammar
 *    (страна/страны/…, دولة, le pays/du pays/au pays), so the name itself is never inflected. The one
 *    exception is the letterhead "Ministry of Health, {country}".
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYER = resolve(APP, '..');
let failed = 0;
const ok = (cond, what) => { if (cond) console.log(`✓ ${what}`); else { failed++; console.error(`✗ ${what}`); } };

// ---------- 1. settings ----------
const tmp = mkdtempSync(join(tmpdir(), 'gdhcn-country-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export * from ${JSON.stringify(join(APP, 'src/game/settings.ts'))};`);
const out = join(tmp, 'settings.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', absWorkingDir: APP, define: { 'import.meta.env': '{}' } });

class Store {
  constructor(o = {}) { this.m = new Map(Object.entries(o)); this.writes = []; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.writes.push(k); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
let n = 0;
async function load(items) {
  globalThis.localStorage = new Store(items);
  const mod = await import(`${pathToFileURL(out).href}?${n++}`); // a fresh module: DEFAULTS is read at load
  return { mod, store: globalThis.localStorage };
}

try {
  {
    const { mod } = await load();
    ok(mod.DEFAULTS.country === 'Onesa' && mod.DEFAULTS.code === 'XXU', 'no saved setting, no demo name: Onesa, XXU');
    const tk = mod.tokens(mod.loadSettings());
    ok(tk.country === 'Onesa' && tk.code === 'XXU' && tk.code3Lower === 'xxu' && tk.domain === 'health.gov', 'tokens: {country} Onesa, {code} XXU, {domain} health.gov');
  }
  {
    const { mod, store } = await load({ 'jv:dpi-h-policy-track:country:onesa': ' Kenya ', 'jv:dpi-h-policy-track:country:taifafeki': 'Ghana' });
    const s = mod.loadSettings();
    ok(s.country === 'Kenya' && s.code === 'KEN', "the demo viewer's name for Onesa is the sample: Kenya, KEN");
    mod.saveSettings(s);
    ok(!store.writes.some(k => k.startsWith('jv:')), 'the game never writes the viewer\'s keys');
    ok(!('country' in JSON.parse(store.getItem('gdhcn-game-settings'))), 'the sample is not saved as the player\'s choice');
  }
  {
    const { mod } = await load({ 'jv:technical-track:country:onesa': 'Catopia', 'jv:dpi-h-policy-track:country:onesa': 'Kenya' });
    ok(mod.DEFAULTS.country === 'Kenya', 'two workshops with a name: the policy track wins');
  }
  {
    const { mod } = await load({ 'jv:technical-track:country:onesa': 'Catopia' });
    ok(mod.DEFAULTS.country === 'Catopia' && mod.DEFAULTS.code === 'CAT', 'a fictional name from the viewer gets a non-ISO code: Catopia, CAT');
  }
  {
    const { mod } = await load({ 'jv:dpi-h-policy-track:country:onesa': 'Kenya', 'gdhcn-game-settings': JSON.stringify({ country: 'Ghana', code: 'GHA', names: {} }) });
    const s = mod.loadSettings();
    ok(s.country === 'Ghana' && s.code === 'GHA', "the player's own country wins over the viewer's name");
  }
  {
    const { mod } = await load({ 'gdhcn-game-settings': JSON.stringify({ country: 'Country XC', code: 'XXC', names: { legal: 'Ana Ruiz' } }) });
    const s = mod.loadSettings();
    ok(s.country === 'Onesa' && s.code === 'XXU' && s.names.legal === 'Ana Ruiz', 'an older save of Country XC is the sample now; the team names are kept');
  }
  {
    const { mod } = await load({ 'gdhcn-game-settings': JSON.stringify({ country: 'Pays XC', code: 'XXC', names: {} }), 'jv:dpi-h-policy-track:country:onesa': 'Kenya' });
    ok(mod.loadSettings().country === 'Kenya', 'an older French save of the sample follows the viewer\'s name too');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- 2. strings ----------
const catalog = JSON.parse(readFileSync(join(APP, 'src/i18n/en.json'), 'utf8'));
const xc = Object.entries(catalog).filter(([, v]) => /\bX{1,2}C\b/.test(v)).map(([k]) => k);
ok(xc.length === 0, `the catalog names no old sample country${xc.length ? `: ${xc.join(', ')}` : ''}`);

/** msgctxt -> msgstr, live entries only. */
function po(locale) {
  const text = readFileSync(join(LAYER, 'translations', locale, 'apps', 'onboarding-game.po'), 'utf8');
  const out = new Map();
  for (const m of text.matchAll(/^msgctxt (".*")\nmsgid ".*"\nmsgstr (".*")$/gm)) out.set(JSON.parse(m[1]), JSON.parse(m[2]));
  return out;
}
const LETTERHEAD = 'scenario:soi.docs.0.lines.0';
const HEAD = {
  ru: /(?:^|[\s«(>])(?:[Сс]тран[аыеу]|[Сс]тран(?:ой|ою)|[Сс]транах?)\s$|примеру:\s$/,
  ar: /(?:دولة|لدولة|بدولة)\s$|النموذجي:\s$/,
  fr: /(?:[Ll]e|[Dd]u|[Aa]u)\spays\s$|exemple\s:\s$/,
};
for (const [locale, head] of Object.entries(HEAD)) {
  const bad = [];
  for (const [key, s] of po(locale)) {
    if (key === LETTERHEAD) continue;
    for (const m of s.matchAll(/\{country\}/g)) if (!head.test(s.slice(0, m.index))) bad.push(key);
  }
  ok(bad.length === 0, `${locale}: every {country} follows its head noun${bad.length ? `; not in ${[...new Set(bad)].join(', ')}` : ''}`);
}

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
