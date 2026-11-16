#!/usr/bin/env node
/**
 * Read the game's content from smart-trust itself, at build time, so the game cannot drift from it
 * (owner, 2026-11-11: "pull directly from smart-trust content where available").
 *
 * Reads, relative to the smart-trust layer root (the parent of onboarding-game/):
 *   input/business-processes/*.bpmn                 the onboarding processes and their tasks
 *   translations/<locale>/processes/<stem>.po        their names in each locale
 *   input/fsh/instances/TrustDomain-*.fsh            the trust domains a country can join
 *   glossary/gdhcn.glossary.json                     the GDHCN Framework's defined terms
 *   translations/<locale>/glossary/smart-trust--gdhcn.po   their labels and definitions in each locale
 *   smart-trust.json                                 the IG's published base URL
 * and writes src/generated/smart-trust.json.
 *
 * Fails (exit 1) when a moment in src/game/process-refs.json names a process or task that is not in
 * the BPMN. `--check` compares instead of writing.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LAYER = resolve(APP, '..');
const OUT = join(APP, 'src/generated/smart-trust.json');
const LOCALES = JSON.parse(readFileSync(join(APP, 'web-app.json'), 'utf8')).locales;
const check = process.argv.includes('--check');

const read = (p) => readFileSync(join(LAYER, p), 'utf8');
const unxml = (s) => s.replace(/&#10;|&#xA;/g, '\n').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const oneLine = (s) => unxml(s).replace(/\s*\n\s*/g, ' ').trim();

/** msgid -> msgstr for a .po, translated entries only (an empty msgstr is untranslated, not blank). */
export function parsePo(text) {
  const out = new Map();
  let id, str, field;
  const flush = () => { if (id && str) out.set(id, str); id = str = field = undefined; };
  const unq = (s) => JSON.parse(s);
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) { if (line === '' && str !== undefined) flush(); continue; }
    const m = /^(msgctxt|msgid|msgstr)\s+(".*")$/.exec(line);
    if (m) {
      if ((m[1] === 'msgid' || m[1] === 'msgctxt') && str !== undefined) flush();
      field = m[1];
      if (field === 'msgid') id = unq(m[2]); else if (field === 'msgstr') str = unq(m[2]);
    } else if (line.startsWith('"')) {
      if (field === 'msgid') id = (id ?? '') + unq(line); else if (field === 'msgstr') str = (str ?? '') + unq(line);
    }
  }
  flush();
  return out;
}
const po = (p) => (existsSync(join(LAYER, p)) ? parsePo(read(p)) : new Map());

/** One label in every locale: the source, then each translation that exists. */
const localised = (en, locPo) => {
  const o = { en };
  for (const l of LOCALES) if (l !== 'en') { const t = locPo[l]?.get(en); if (t) o[l] = t; }
  return o;
};

// ── Processes ───────────────────────────────────────────────────────────────
const BP = 'input/business-processes';
const processes = {};
for (const f of readdirSync(join(LAYER, BP)).filter((f) => f.endsWith('.bpmn')).sort()) {
  const stem = f.slice(0, -5);
  const xml = read(`${BP}/${f}`);
  const locPo = Object.fromEntries(LOCALES.map((l) => [l, po(`translations/${l}/processes/${stem}.po`)]));
  const participant = /<bpmn:participant\b[^>]*\bname="([^"]*)"/.exec(xml);
  const proc = /<bpmn:process\b[^>]*\bname="([^"]*)"/.exec(xml);
  const tasks = {};
  for (const m of xml.matchAll(/<bpmn:(task|userTask|serviceTask|sendTask|receiveTask|manualTask|scriptTask|businessRuleTask|callActivity|subProcess)\b([^>]*)>/g)) {
    const id = /\bid="([^"]*)"/.exec(m[2])?.[1];
    const name = /\bname="([^"]*)"/.exec(m[2])?.[1];
    if (id && name) tasks[id] = localised(oneLine(name), locPo);
  }
  const title = oneLine((proc ?? participant)?.[1] ?? stem);
  processes[stem] = { title: localised(title, locPo), anchor: stem.toLowerCase().replace(/\./g, '-'), tasks };
}

// The IG section titles for each process are on the process page; the game links there by anchor.
const decl = JSON.parse(read('smart-trust.json'));
const igBase = decl.iriBase;
const processPage = 'concepts_onboarding_process_full.html';

// ── Moment refs, checked ───────────────────────────────────────────────────
const refsFile = join(APP, 'src/game/process-refs.json');
const refs = JSON.parse(readFileSync(refsFile, 'utf8'));
const problems = [];
for (const [moment, list] of Object.entries(refs)) {
  if (moment.startsWith('$')) continue;
  for (const r of list) {
    if (r.startsWith('page:')) {
      if (!existsSync(join(LAYER, 'input/pagecontent', `${r.slice(5)}.md`))) problems.push(`${moment}: no IG page input/pagecontent/${r.slice(5)}.md`);
      continue;
    }
    const [stem, task] = r.split('#');
    if (!processes[stem]) problems.push(`${moment}: no business process ${stem} in ${BP}/`);
    else if (!processes[stem].tasks[task]) problems.push(`${moment}: no task ${task} in ${stem}.bpmn`);
  }
}

// ── Trust domains ───────────────────────────────────────────────────────────
const FSH = 'input/fsh/instances';
const trustDomains = [];
for (const f of readdirSync(join(LAYER, FSH)).filter((f) => /^TrustDomain-.*\.fsh$/.test(f)).sort()) {
  const t = read(`${FSH}/${f}`);
  const field = (k) => new RegExp(`^\\* ${k} = "((?:[^"\\\\]|\\\\.)*)"`, 'm').exec(t)?.[1];
  const code = /^\* code = #(\S+)/m.exec(t)?.[1];
  const instance = /^Instance:\s*(\S+)/m.exec(t)?.[1];
  if (!code || !instance) { problems.push(`${f}: no code or Instance line`); continue; }
  trustDomains.push({ code, name: field('name') ?? code, description: field('description') ?? '', page: `Binary-${instance}.html` });
}

// ── Glossary ────────────────────────────────────────────────────────────────
const g = JSON.parse(read('glossary/gdhcn.glossary.json'));
const gPo = Object.fromEntries(LOCALES.map((l) => [l, po(`translations/${l}/glossary/smart-trust--gdhcn.po`)]));
const glossary = Object.fromEntries(g.terms.map((t) => [t.id, { term: localised(t.prefLabel, gPo), def: localised(t.definition, gPo) }]));

if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}

const out = `${JSON.stringify({ $comment: 'GENERATED by scripts/smart-trust-content.mjs from smart-trust. Do not edit.', igBase, processPage, processes, trustDomains, glossary }, null, 1)}\n`;
if (check) {
  const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (cur !== out) { console.error(`✗ ${OUT} is stale: run node scripts/smart-trust-content.mjs`); process.exit(1); }
  console.log('✓ smart-trust content current');
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out);
  const nTasks = Object.values(processes).reduce((n, p) => n + Object.keys(p.tasks).length, 0);
  console.log(`✓ ${Object.keys(processes).length} processes (${nTasks} tasks), ${trustDomains.length} trust domains, ${Object.keys(glossary).length} glossary terms`);
}
