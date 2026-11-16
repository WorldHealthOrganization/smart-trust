#!/usr/bin/env node
/**
 * Write public/i18n/<locale>.json from smart-trust's translations/<locale>/apps/onboarding-game.po, for
 * `npm run dev` and a local `npm run build`. At publish the harness's `web-apps:build` does the same
 * before it builds (cat-harness skill `web-apps`), with the same rule, so the two give the same files:
 *
 *   a translation is used only when its msgctxt (the catalog key) and msgid (the English) match the
 *   current catalog, src/i18n/en.json, and it keeps the same {placeholders}. Anything else falls back
 *   to English and is reported.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYER = resolve(APP, '..');
const manifest = JSON.parse(readFileSync(join(APP, 'web-app.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(APP, manifest.i18n.catalog), 'utf8'));

/** (msgctxt \u0004 msgid) -> msgstr, translated entries only. */
export function parsePo(text) {
  const out = new Map();
  let e = {}, field;
  const flush = () => { if (e.msgid && e.msgstr) out.set(`${e.msgctxt ?? ''}\u0004${e.msgid}`, e.msgstr); e = {}; field = undefined; };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) { if (line === '' && e.msgstr !== undefined) flush(); continue; }
    const m = /^(msgctxt|msgid|msgstr)\s+(".*")$/.exec(line);
    if (m) {
      if ((m[1] === 'msgctxt' || (m[1] === 'msgid' && e.msgctxt === undefined)) && e.msgstr !== undefined) flush();
      field = m[1];
      e[field] = JSON.parse(m[2]);
    } else if (line.startsWith('"') && field) e[field] += JSON.parse(line);
  }
  flush();
  return out;
}

const holes = (s) => [...s.matchAll(/\{[A-Za-z0-9_]+\}/g)].map((m) => m[0]).sort().join();

for (const locale of manifest.locales.slice(1)) {
  const file = join(LAYER, 'translations', locale, 'apps', `${manifest.id}.po`);
  const po = existsSync(file) ? parsePo(readFileSync(file, 'utf8')) : new Map();
  const strings = {};
  const bad = [];
  for (const [key, en] of Object.entries(catalog)) {
    const t = po.get(`${key}\u0004${en}`);
    if (t === undefined) continue;
    if (holes(t) !== holes(en)) { bad.push(key); continue; }
    strings[key] = t;
  }
  const out = join(APP, manifest.i18n.out, `${locale}.json`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(strings, null, 2)}\n`);
  const n = Object.keys(catalog).length;
  console.log(`✓ ${locale}: ${Object.keys(strings).length}/${n} translated${bad.length ? `; placeholder mismatch, English used: ${bad.join(', ')}` : ''}`);
}
