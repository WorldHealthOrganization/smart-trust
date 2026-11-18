---
# cat-tools-gc21
$schema: bean/1.0.0
title: 'translate-pot: a real OPUS-MT run on a sample locale to verify model outputs'
status: completed
type: task
priority: normal
created_at: 2026-11-12T22:55:00Z
updated_at: 2026-11-14T10:48:00Z
parent: folio-assistant-bzyu
---

`scripts/translate-pot.ts` and `scripts/translation/opus_mt_runner.py` were tested in CI with a stub runner (`test/translate-pot.test.ts`), because the Marian checkpoints (`Helsinki-NLP/opus-mt-en-*`, ~300 MB each) and `transformers`/`torch`/`sentencepiece` are not installed in the fast-gate image.

Before anyone runs `bun run cat translate:pot --engine opus-mt` on a whole catalogue tree and commits the result, run it with real OPUS-MT Marian weights on a sample of `cat-harness`'s `translations/*.pot` into **`fr`, `es`, `ar` and `zh`** (`ar` and `zh` are the two locales that prepend a `>>id<<` target token — see `translate-pot.ts`'s `OPUS_MT_MODELS` table — so they exercise the prefix path that `fr`/`es` do not):

1. Set up a scratch Python environment with `transformers`, `torch` and `sentencepiece` (do not commit the venv).
2. Pick a small `.pot` (or a slice of `cat-harness/translations/`) and run `bun run cat translate:pot --engine opus-mt --locale <loc> --dry-run` first, then without `--dry-run` in a scratch copy, for each of `fr`, `es`, `ar` and `zh`.
3. Inspect the filled `.po` files by eye and check:
   - Placeholder masking (`__PH0__` round-trip): does the Marian model ever corrupt, drop, or reorder the `__PH<n>__` sentinel on real strings with `{count}`, `` `code` ``, `%s`, URLs, or `**bold**`? Which strings does `placeholdersRoundTrip` refuse, and are any bad outputs *not* refused?
   - Target-language token on `ar` (`>>ara<<`) and `zh` (`>>cmn_Hans<<`): does the model ever echo the `>>…<<` token into the translation, and does the output actually come back in Arabic / Simplified Chinese?
   - Plural entries (`msgid_plural` / `msgstr[0..n-1]`): does `nplurals` from the locale's `Plural-Forms` header match what gets written (including `ar`'s 6 forms and `zh`'s 1)?
   - Existing translations: confirm a `.po` with some entries already translated keeps every non-empty `msgstr` byte-for-byte and only fills the empty ones with `#, fuzzy`.
   - The `.json` node sidecar and `bun run cat translation:status`: confirm the machine-filled entries show under `fuzzy`, not `translated`, on the generated status page.

## Done when

- [x] Each of `fr`, `es`, `ar` and `zh` has been run with real OPUS-MT weights: entries filled, entries refused, and the reason for each refusal are recorded in this bean's Notes.
- [x] Every filled entry carries `#, fuzzy`; no non-empty `msgstr` changed (`git diff` shows only empty → filled); the `>>id<<` prefix on `ar`/`zh` never leaks into an output string; `translation:status` counts the machine strings as `fuzzy`, never `translated`.
- [x] Any defect found (a sentinel that does not survive the model, a leaked target token, a wrong plural count) is filed as a bug bean against `scripts/translate-pot.ts` with the failing string.
- Scratch output is discarded before closing — filling the real corpus is the owner's call, not this bean's.

## Notes

### 1. Environment & Models Exercised (2026-11-14)

- **Scratch Python venv:** Python 3.13 (`torch-2.15.0`, `transformers-5.23.0`, `sentencepiece-0.2.3`, `sacremoses-0.2.0`), isolated in scratch and deleted (`0 B`) after verification.
- **Real Marian checkpoints downloaded and run via `scripts/translation/opus_mt_runner.py`:**
  - `fr`: `Helsinki-NLP/opus-mt-en-fr` (no target prefix)
  - `es`: `Helsinki-NLP/opus-mt-en-es` (no target prefix)
  - `ar`: `Helsinki-NLP/opus-mt-en-ar` (target prefix `>>ara<< `)
  - `zh`: `Helsinki-NLP/opus-mt-en-zh` (target prefix `>>cmn_Hans<< `)
- **Slices tested in a scratch copy of `cat-harness/translations/`:**
  1. **Run A (`--no-create`, `--dry-run` then real fill):** All 15–16 existing `.po` catalogues per locale in `cat-harness/translations/{fr,es,ar,zh}`:
     - `translations/{fr,es,ar,zh}/kg-viewer.po` (45 empty entries per locale: 29 plain-text strings + 16 `{...}` placeholder strings).
     - `translations/fr/guides/agent-onboarding.po` (24 active empty entries + 94 already-translated entries; 1 of the 24 contains backtick code `` `skill_list` `` / `` `skill_fetch` ``).
     - All other 13–14 existing `.po` files per locale (~716–718 already-translated entries per locale) to verify that non-empty `msgstr` entries remain untouched byte-for-byte.
  2. **Run B (`.pot` → `.po` + `.json` creation without `--no-create`, `--dry-run` then real fill):** Uncreated template `translations/{fr,es,ar,zh}/bootstrap/processes/log-message.pot` (17 translatable entries per locale), exercising `poFromPot()` and `.json` translation-node sidecar generation.

### 2. Per-Locale Summary (Filled vs. Refused)

| Locale | Model (`targetToken`) | Catalogue | Total Empty (in `.pot`) | Filled (`#, fuzzy`) | Refused | Plain-text Refused | `{...}` Placeholder Refused |
|---|---|---|---:|---:|---:|---:|---:|
| `fr` | `Helsinki-NLP/opus-mt-en-fr` (—) | `guides/agent-onboarding.po` | 24 | **24** | **0** | 0/23 | 0/1 (backticks) |
| `fr` | `Helsinki-NLP/opus-mt-en-fr` (—) | `kg-viewer.po` | 45 | **38** | **7** | 0/29 | **7/16** |
| `fr` | `Helsinki-NLP/opus-mt-en-fr` (—) | `bootstrap/processes/log-message.po` *(created)* | 17 | **17** | **0** | 0/17 | 0/0 |
| `es` | `Helsinki-NLP/opus-mt-en-es` (—) | `kg-viewer.po` | 45 | **44** | **1** | 0/29 | **1/16** *(+1 silent `_` leak)* |
| `es` | `Helsinki-NLP/opus-mt-en-es` (—) | `bootstrap/processes/log-message.po` *(created)* | 17 | **17** | **0** | 0/17 | 0/0 |
| `ar` | `Helsinki-NLP/opus-mt-en-ar` (`>>ara<<`) | `kg-viewer.po` | 45 | **29** | **16** | 0/29 | **16/16** |
| `ar` | `Helsinki-NLP/opus-mt-en-ar` (`>>ara<<`) | `bootstrap/processes/log-message.po` *(created)* | 17 | **17** | **0** | 0/17 | 0/0 |
| `zh` | `Helsinki-NLP/opus-mt-en-zh` (`>>cmn_Hans<<`) | `kg-viewer.po` | 45 | **33** | **12** | 0/29 | **12/16** *(+1 silent `_` leak)* |
| `zh` | `Helsinki-NLP/opus-mt-en-zh` (`>>cmn_Hans<<`) | `bootstrap/processes/log-message.po` *(created)* | 17 | **17** | **0** | 0/17 | 0/0 |
| **Total** | | | **272** | **236** | **36** | **0/207** | **36/65** |

### 3. Complete Refusal Log & Reasons (36 Refusals Across `fr`, `es`, `ar`, `zh`)

Every refusal occurred on a `{...}` placeholder entry in `kg-viewer.po` because the `__PH<n>__` sentinel was either corrupted by Marian (`_PH0__`, `__PH0_`, `--PH0--`, `_BAR_`, or dropped) or triggered runaway underscore repetition (`____...`) that collided with `PROTECTED_RE`'s `__` Markdown bold token:

#### `fr` (7 refused in `translations/fr/kg-viewer.po`)
1. `refused "… and {n} more; narrow the search.": placeholders or markup did not round-trip: ["{n}"] → ["__", ...(251×)..., "{n}"]` (raw: `"... et __PH0____________________________________________..."`, len 517)
2. `refused "{n} nodes match": placeholders or markup did not round-trip: ["{n}"] → ["__", ...(140×)..., "{n}"]` (raw: `"__PH0____________________________________________..."`, len 287)
3. `refused "A translation of this interface into {languages} is planned. Until it is ready, the page is shown in English.": placeholders or markup did not round-trip: ["{languages}"] → ["__", ...(249×)..., "{languages}"]` (raw: `"Une traduction de cette interface en __PH0____________________________________________..."`, len 543)
4. `refused "commit {sha}": a placeholder sentinel survived unmasking` (raw: `"_PH0____________________________________________..."`, len 192)
5. `refused "Interface language: {language}": a placeholder sentinel survived unmasking` (raw: `"Langue de l'interface : _PH0__"`)
6. `refused "Links to {name} via {via}": a placeholder sentinel survived unmasking` (raw: `"Liens vers _PH0__ via _PH1____________________________________________..."`, len 526)
7. `refused "Referenced by {name} via {via}": placeholders or markup did not round-trip: ["{name}","{via}"] → ["__", ...(127×)..., "{name}","{via}"]` (raw: `"Référencé par __PH0__ via __PH1____________________________________________..."`, len 294)

#### `es` (1 refused in `translations/es/kg-viewer.po`)
1. `refused "commit {sha}": a placeholder sentinel survived unmasking` (raw: `"commit __PH0_"`)

#### `ar` (16 refused in `translations/ar/kg-viewer.po` — all 16 `{...}` entries in `kg-viewer.po`)
1. `refused "… and {n} more; narrow the search.": placeholders or markup did not round-trip: ["{n}"] → []` (raw: `"و ------------------------------------------------..."`, len 1022)
2. `refused "{n} nodes": placeholders or markup did not round-trip: ["{n}"] → []` (raw: `"------------------------------------------------..."`, len 1021)
3. `refused "{n} nodes match": placeholders or markup did not round-trip: ["{n}"] → []` (raw: `"_BAR_ العقد متطابقة"`)
4. `refused "{n} of this node's properties are not in the @context": placeholders or markup did not round-trip: ["{n}"] → []` (raw: `"من خصائص هذه العقدة ليست في الـ @ connex"`)
5. `refused "{stub} — knowledge graph": placeholders or markup did not round-trip: ["{stub}"] → ["__", ...]` (raw: `"________________________________________________..."`, len 217)
6. `refused "A translation of this interface into {languages} is planned. Until it is ready, the page is shown in English.": placeholders or markup did not round-trip: ["{languages}"] → ["__", ...]` (raw: `"ومن المقرر ترجمة هذه الوصلة إلى ________________________________________________..."`, len 231)
7. `refused "commit {sha}": a placeholder sentinel survived unmasking` (raw: `"إلتزم بـ --PH0------------------------------------------------..."`, len 1020)
8. `refused "could not load {doc} — {error}": placeholders or markup did not round-trip: ["{doc}","{error}"] → ["__", ...]` (raw: `"لم أستطع تحميل ________________________________________________..."`, len 274)
9. `refused "Download this graph as JSON-LD ({doc})": a placeholder sentinel survived unmasking` (raw: `"نزّل هذا الرسم البياني كما JSON-LD (-PH0--)"`)
10. `refused "Interface language: {language}": placeholders or markup did not round-trip: ["{language}"] → ["__", ...]` (raw: `"لغة الواجهة: ________________________________________________..."`, len 224)
11. `refused "Links to {name} via {via}": placeholders or markup did not round-trip: ["{name}","{via}"] → ["__", ...]` (raw: `"الوصلات إلى ______________________ عبر ________________________________________________..."`, len 524)
12. `refused "loading {doc}…": placeholders or markup did not round-trip: ["{doc}"] → ["__", ...]` (raw: `"تحميل ________________________________________________..."`, len 211)
13. `refused "One-hop neighbourhood, {n} linked nodes": placeholders or markup did not round-trip: ["{n}"] → []` (raw: `"حي واحد هوب، ------------------------------------------------..."`, len 1025)
14. `refused "Referenced by {name} via {via}": a placeholder sentinel survived unmasking` (raw: `"تشير إليها --PH0-- عن طريق --PH1------------------------------------------------..."`, len 1028)
15. `refused "so a JSON-LD processor drops them. They are shown below, marked. Across the graph: {n} such property names.": a placeholder sentinel survived unmasking` (raw: `"... عبر الرسم البياني: _PH0_________________________________________..."`, len 561)
16. `refused "The interface is shown in {language}. The graph itself — node names, descriptions and property names — comes from this repository and is shown as written, in English.": placeholders or markup did not round-trip: ["{language}"] → ["__", ...]` (raw: `"وترد الواجهة في ________________________________________________..."`, len 522)

#### `zh` (12 refused in `translations/zh/kg-viewer.po`)
1. `refused "… and {n} more; narrow the search.": a placeholder sentinel survived unmasking` (raw: `"... 和... PH0 更多; 缩小搜索范围 。"`)
2. `refused "{n} nodes": a placeholder sentinel survived unmasking` (raw: `"_PH0__节点"`)
3. `refused "{n} nodes match": a placeholder sentinel survived unmasking` (raw: `"_PH0__ 结点匹配"`)
4. `refused "{n} of this node's properties are not in the @context": a placeholder sentinel survived unmasking` (raw: `"_PH0__ 此节点的属性不在@ context 中 。"`)
5. `refused "A translation of this interface into {languages} is planned. Until it is ready, the page is shown in English.": a placeholder sentinel survived unmasking` (raw: `"计划将该接口翻译为_PH0__。在完成之前,该页面以英文显示。"`)
6. `refused "commit {sha}": a placeholder sentinel survived unmasking` (raw: `"承诺 _PH0__"`)
7. `refused "could not load {doc} — {error}": a placeholder sentinel survived unmasking` (raw: `"无法装入 _PH0__ —__PH1__"`)
8. `refused "Download this graph as JSON-LD ({doc})": a placeholder sentinel survived unmasking` (raw: `"以 JSON- LD (_PH0___) 下载此图"`)
9. `refused "Interface language: {language}": a placeholder sentinel survived unmasking` (raw: `"界面语言: _PH0__"`)
10. `refused "loading {doc}…": a placeholder sentinel survived unmasking` (raw: `"正在装入_PH0___..."`)
11. `refused "Referenced by {name} via {via}": placeholders or markup did not round-trip: ["{name}","{via}"] → ["__", ...]` (raw: `"________________________________________________..."`, len 365)
12. `refused "so a JSON-LD processor drops them. They are shown below, marked. Across the graph: {n} such property names.": a placeholder sentinel survived unmasking` (raw: `"... 在图中显示 :_PH0__ 这样的属性名称 。"`)

### 4. Sample Filled Translations Across `fr`, `es`, `ar`, and `zh`

- **`fr` (`Helsinki-NLP/opus-mt-en-fr`):**
  - `kg-viewer.po`: `msgid "{stub} — knowledge graph"` → `msgstr "{stub} — graphique des connaissances"` (`#, fuzzy`)
  - `kg-viewer.po`: `msgid "could not load {doc} — {error}"` → `msgstr "ne pouvait pas charger {doc} — {error}"` (`#, fuzzy`)
  - `guides/agent-onboarding.po`: `msgid "generated input/output contract per skill"` → `msgstr "contrat d'entrée/sortie généré par compétence"` (`#, fuzzy`)
  - `bootstrap/processes/log-message.po`: `msgid "Record it where a person can read it"` → `msgstr "Enregistrez-le où une personne peut le lire"` (`#, fuzzy`)
- **`es` (`Helsinki-NLP/opus-mt-en-es`):**
  - `kg-viewer.po`: `msgid "… and {n} more; narrow the search."` → `msgstr "... y {n} más; estrechar la búsqueda."` (`#, fuzzy`)
  - `kg-viewer.po`: `msgid "Links to {name} via {via}"` → `msgstr "Enlaces a {name} a través de {via}"` (`#, fuzzy`)
  - `bootstrap/processes/log-message.po`: `msgid "Compose the message"` → `msgstr "Componer el mensaje"` (`#, fuzzy`)
- **`ar` (`Helsinki-NLP/opus-mt-en-ar` with `>>ara<<`):**
  - `kg-viewer.po`: `msgid "1 node matches"` → `msgstr "تطابق عقدة واحدة"` (`#, fuzzy`)
  - `kg-viewer.po`: `msgid "in another graph"` → `msgstr "في رسم بياني آخر"` (`#, fuzzy`)
  - `bootstrap/processes/log-message.po`: `msgid "Record it where a person can read it"` → `msgstr "سجلها حيث يستطيع الشخص قراءتها"` (`#, fuzzy`)
- **`zh` (`Helsinki-NLP/opus-mt-en-zh` with `>>cmn_Hans<<`):**
  - `kg-viewer.po`: `msgid "{stub} — knowledge graph"` → `msgstr "{stub}——知识图"` (`#, fuzzy`)
  - `kg-viewer.po`: `msgid "Links to {name} via {via}"` → `msgstr "通过{via}连接到{name}"` (`#, fuzzy`)
  - `bootstrap/processes/log-message.po`: `msgid "Record it where a person can read it"` → `msgstr "记录在别人看得懂的地方"` (`#, fuzzy`)

### 5. Verification of All Checklist Invariants

1. **Every filled entry carries `#, fuzzy`:** Verified across `git diff` (`168` added non-empty `msgstr` lines and `168` added `#, fuzzy` lines in Run A; `68/68` `#, fuzzy` entries in Run B's newly created `log-message.po` files).
2. **Zero pre-existing non-empty `msgstr` values changed:** Programmatic inspection of `git diff -- translations/**/*.po` across all 15–16 catalogues per locale confirmed `0` non-empty `-msgstr` lines removed (`Removed lines in .po diff that are not '-msgstr ""': []`).
3. **`>>id<<` target-language prefix never leaks into `ar` or `zh` output:** Checked all `236` filled `msgstr` values for `>>`, `<<`, `ara`, and `cmn_Hans`; `0` occurrences leaked, and all `ar` / `zh` outputs came back in Arabic and Simplified Chinese respectively.
4. **Plural entries (`msgid_plural` / `msgstr[0..n-1]`):** Current `cat-harness/translations/*.pot` templates contain singular `msgid` entries only (no `msgid_plural` templates in `cat-harness` yet); `poFromPot` header handling and plural slot sizing remain covered by unit tests.
5. **`translation:status` (`scripts/gen-translation-status.ts --instance`) counts machine strings strictly as `fuzzy`, never `translated`:**
   - **Before fill (baseline):**
     ```
     cat-harness: translations/
       ar       15 catalogue(s) of  100 template(s)     716/765    translated (93.6%)  0 fuzzy, 49 empty  not signed off (machine or agent translation)
       es       15 catalogue(s) of  101 template(s)     717/766    translated (93.6%)  0 fuzzy, 49 empty  not signed off (machine or agent translation)
       fr       16 catalogue(s) of  103 template(s)     693/766    translated (90.5%)  0 fuzzy, 73 empty  not signed off (machine or agent translation)
       ru       15 catalogue(s) of  100 template(s)     716/765    translated (93.6%)  0 fuzzy, 49 empty  not signed off (machine or agent translation)
       zh       15 catalogue(s) of  101 template(s)     718/767    translated (93.6%)  0 fuzzy, 49 empty  not signed off (machine or agent translation)
     ```
   - **After Run A (`--no-create` fill of existing `.po` files):**
     ```
     cat-harness: translations/
       ar       15 catalogue(s) of  100 template(s)     716/765    translated (93.6%)  29 fuzzy, 20 empty  not signed off (machine or agent translation)
       es       15 catalogue(s) of  101 template(s)     717/766    translated (93.6%)  44 fuzzy, 5 empty  not signed off (machine or agent translation)
       fr       16 catalogue(s) of  103 template(s)     693/766    translated (90.5%)  62 fuzzy, 11 empty  not signed off (machine or agent translation)
       ru       15 catalogue(s) of  100 template(s)     716/765    translated (93.6%)  0 fuzzy, 49 empty  not signed off (machine or agent translation)
       zh       15 catalogue(s) of  101 template(s)     718/767    translated (93.6%)  33 fuzzy, 16 empty  not signed off (machine or agent translation)
     ```
   - **After Run B (+ `bootstrap/processes/log-message.pot` → `.po` creation):**
     ```
     cat-harness: translations/
       ar       16 catalogue(s) of  100 template(s)     716/782    translated (91.6%)  46 fuzzy, 20 empty  not signed off (machine or agent translation)
       es       16 catalogue(s) of  101 template(s)     717/783    translated (91.6%)  61 fuzzy, 5 empty  not signed off (machine or agent translation)
       fr       17 catalogue(s) of  103 template(s)     693/783    translated (88.5%)  79 fuzzy, 11 empty  not signed off (machine or agent translation)
       ru       15 catalogue(s) of  100 template(s)     716/765    translated (93.6%)  0 fuzzy, 49 empty  not signed off (machine or agent translation)
       zh       16 catalogue(s) of  101 template(s)     718/784    translated (91.6%)  50 fuzzy, 16 empty  not signed off (machine or agent translation)
     ```

### 6. Defect Filed: `cat-tools-ph0s`

- Filed bug bean **`cat-tools-ph0s`** (`beans/defs/cat-tools-ph0s--translate-pot-ph-sentinel-corrupted-by-opus-mt.md`) against `scripts/translate-pot.ts` documenting:
  1. Runaway underscore/hyphen repetition (`____...` / `----...`) triggered by `__PH<n>__` in Marian beam search, which collides with `PROTECTED_RE`'s `__` Markdown bold token (`4` refusals in `fr`, `7` in `ar`, `1` in `zh`).
  2. Stripped/mutated underscores (`_PH0__`, `__PH0_`, `--PH0--`, `_BAR_`) or dropped sentinels (`3` refusals in `fr`, `1` in `es`, `9` in `ar`, `11` in `zh`).
  3. Silent single-underscore `_` leak when Marian outputs 3 trailing underscores (`__PH0___`), where `unmask()` replaces `__PH0__` and leaves a stray `_` that `placeholdersRoundTrip()` does not catch:
     - `es`: `"Download this graph as JSON-LD ({doc})"` → `"Descargar este gráfico como JSON-LD ({doc}_)"`
     - `zh`: `"The interface is shown in {language}..."` → `"接口在 {language}_中显示。..."`
  4. **Measured verification of `[0]` bracket sentinels (PR `#2144`):** Re-running the same 16 placeholder-bearing `msgid`s from `kg-viewer.po` through `opus_mt_runner.py` with `[0]`, `[1]` bracket sentinels instead of `__PH<n>__` achieved **64/64 (`16/16` in `fr`, `16/16` in `es`, `16/16` in `ar`, `16/16` in `zh`)** round-trip survival with `0` refusals and `0` leaked characters.
