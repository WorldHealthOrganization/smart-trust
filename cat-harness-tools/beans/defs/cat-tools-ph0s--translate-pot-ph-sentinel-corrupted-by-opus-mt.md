---
# cat-tools-ph0s
$schema: bean/1.0.0
title: 'translate-pot.ts: __PH<n>__ placeholder sentinel triggers OPUS-MT underscore/hyphen hallucinations, 36/64 placeholder refusals, and silent single-underscore leaks'
status: completed
type: bug
priority: high
created_at: 2026-11-14T10:46:00Z
updated_at: 2026-11-14T20:30:00Z
parent: folio-assistant-bzyu
---

Discovered during the real OPUS-MT Marian validation run required by `cat-tools-gc21` (`scripts/translate-pot.ts` with `Helsinki-NLP/opus-mt-en-{fr,es,ar,zh}` on `cat-harness/translations/{fr,es,ar,zh}/kg-viewer.po`).

While 100% of plain-text entries (`29/29` per locale in `kg-viewer.po`, `24/24` in `fr/guides/agent-onboarding.po`, and `17/17` per locale in `bootstrap/processes/log-message.pot`) translated cleanly across `fr`, `es`, `ar`, and `zh` with 0 refusals, **`scripts/translate-pot.ts`'s `__PH<n>__` placeholder sentinel (`mask()` / `unmask()`) fails on 36 of the 64 (`16 × 4`) `{...}` placeholder-bearing strings in `kg-viewer.po`** (`7/16` refused in `fr`, `1/16` in `es`, `16/16` in `ar`, `12/16` in `zh`), and **silently leaks a stray single underscore `_` into 2 accepted translations** (`es` and `zh`).

## Root causes (three distinct failure modes of `__PH<n>__`)

In `scripts/translate-pot.ts`:

```ts
const PROTECTED_RE =
  /`[^`\n]+`|\{[a-zA-Z_][a-zA-Z0-9_]*\}|%[0-9]*\$?[sd]|https?://\S+|\*\*|__|~~/g;

export function mask(s: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = s.replace(PROTECTED_RE, (t) => `__PH${tokens.push(t) - 1}__`);
  return { masked, tokens };
}

export function unmask(s: string, tokens: string[]): string | null {
  const out = s.replace(/_\s?_\s?PH\s?(\d+)\s?_\s?_/gi, (m, idx) => {
    const i = Number(idx);
    return i >= 0 && i < tokens.length ? tokens[i]! : m;
  });
  if (/PH\s?\d+/i.test(out)) return null;
  return out;
}
```

When SentencePiece tokenizes `__PH0__`, the double underscores `__` and uppercase `PH0` split into subword pieces that destabilize Marian beam decoding across `en-fr`, `en-es`, `en-ar`, and `en-zh`:

### 1. Runaway underscore/hyphen repetition + `PROTECTED_RE` `__` collision (4 refusals in `fr`, 7 in `ar`, 1 in `zh`)
The Marian decoder gets stuck repeating `_` or `-` up to `max_new_tokens=512` after `__PH0__`, or replaces `__PH0__` with a bar of underscores. Because `PROTECTED_RE` also matches `__` (Markdown bold emphasis), `placeholdersRoundTrip` extracts hundreds of `"__"` tokens from the unmasked output (`["{n}"] → ["__", "__", ..., "{n}"]`) and refuses the entry:
- `fr` (`Helsinki-NLP/opus-mt-en-fr`):
  - `"… and {n} more; narrow the search."` (`… and __PH0__ more; narrow the search.`) → `"... et __PH0________________________________________________________..."` (len 517)
  - `"{n} nodes match"` (`__PH0__ nodes match`) → `"__PH0________________________________________________________..."` (len 287)
  - `"A translation of this interface into {languages} is planned. Until it is ready, the page is shown in English."` → `"Une traduction de cette interface en __PH0________________________________________________________..."` (len 543)
  - `"Referenced by {name} via {via}"` (`Referenced by __PH0__ via __PH1__`) → `"Référencé par __PH0__ via __PH1________________________________________________________..."` (len 294)
- `ar` (`Helsinki-NLP/opus-mt-en-ar` with `>>ara<< `):
  - `"{stub} — knowledge graph"` → `"________________________________________________________..."` (len 217)
  - `"A translation of this interface into {languages} is planned..."` → `"ومن المقرر ترجمة هذه الوصلة إلى ________________________________________________________..."` (len 231)
  - `"could not load {doc} — {error}"` → `"لم أستطع تحميل ________________________________________________________..."` (len 274)
  - `"Interface language: {language}"` → `"لغة الواجهة: ________________________________________________________..."` (len 224)
  - `"Links to {name} via {via}"` → `"الوصلات إلى ______________________ عبر ________________________________________________________..."` (len 524)
  - `"loading {doc}…"` → `"تحميل ________________________________________________________..."` (len 211)
  - `"The interface is shown in {language}..."` → `"وترد الواجهة في ________________________________________________________..."` (len 522)
- `zh` (`Helsinki-NLP/opus-mt-en-zh` with `>>cmn_Hans<< `):
  - `"Referenced by {name} via {via}"` → `"________________________________________________________..."` (len 365)

### 2. Stripped/mutated underscores or dropped sentinel (`_PH0__`, `--PH0--`, `_BAR_`, `PH0`) causing `unmask` or `placeholdersRoundTrip` failure (3 refusals in `fr`, 1 in `es`, 9 in `ar`, 11 in `zh`)
The Marian model drops one of the leading/trailing underscores (producing `_PH0__` or `__PH0_`), converts underscores to hyphens (`--PH0--` or `-PH0--`), or drops the sentinel entirely (`_BAR_` or `---...`). Because `unmask` requires two underscores on both sides (`/_\s?_\s?PH\s?(\d+)\s?_\s?_/gi`), `_PH0__` and `__PH0_` are not substituted and trip `if (/PH\s?\d+/i.test(out)) return null` (`"a placeholder sentinel survived unmasking"`):
- `fr`:
  - `"commit {sha}"` → `"_PH0________________________________________________________..."`
  - `"Interface language: {language}"` → `"Langue de l'interface : _PH0__"`
  - `"Links to {name} via {via}"` → `"Liens vers _PH0__ via _PH1________________________________________________________..."`
- `es`:
  - `"commit {sha}"` → `"commit __PH0_"`
- `ar`:
  - `"… and {n} more; narrow the search."` → `"و --------------------------------------------------------..."` (sentinel dropped → `["{n}"] → []`)
  - `"{n} nodes"` → `"--------------------------------------------------------..."` (sentinel dropped → `["{n}"] → []`)
  - `"{n} nodes match"` → `"_BAR_ العقد متطابقة"` (sentinel replaced by `_BAR_` → `["{n}"] → []`)
  - `"{n} of this node's properties are not in the @context"` → `"من خصائص هذه العقدة ليست في الـ @ connex"` (sentinel dropped → `["{n}"] → []`)
  - `"commit {sha}"` → `"إلتزم بـ --PH0--------------------------------------------------------..."` (`a placeholder sentinel survived unmasking`)
  - `"Download this graph as JSON-LD ({doc})"` → `"نزّل هذا الرسم البياني كما JSON-LD (-PH0--)"` (`a placeholder sentinel survived unmasking`)
  - `"One-hop neighbourhood, {n} linked nodes"` → `"حي واحد هوب، --------------------------------------------------------..."` (`["{n}"] → []`)
  - `"Referenced by {name} via {via}"` → `"تشير إليها --PH0-- عن طريق --PH1--------------------------------------------------------..."` (`a placeholder sentinel survived unmasking`)
  - `"so a JSON-LD processor drops them. They are shown below, marked. Across the graph: {n} such property names."` → `"... عبر الرسم البياني: _PH0_________________________________________..."` (`a placeholder sentinel survived unmasking`)
- `zh`:
  - `"… and {n} more; narrow the search."` → `"... 和... PH0 更多; 缩小搜索范围 。"`
  - `"{n} nodes"` → `"_PH0__节点"`
  - `"{n} nodes match"` → `"_PH0__ 结点匹配"`
  - `"{n} of this node's properties are not in the @context"` → `"_PH0__ 此节点的属性不在@ context 中 。"`
  - `"A translation of this interface into {languages} is planned..."` → `"计划将该接口翻译为_PH0__。在完成之前,该页面以英文显示。"`
  - `"commit {sha}"` → `"承诺 _PH0__"`
  - `"could not load {doc} — {error}"` → `"无法装入 _PH0__ —__PH1__"`
  - `"Download this graph as JSON-LD ({doc})"` → `"以 JSON- LD (_PH0___) 下载此图"`
  - `"Interface language: {language}"` → `"界面语言: _PH0__"`
  - `"loading {doc}…"` → `"正在装入_PH0___..."`
  - `"so a JSON-LD processor drops them... Across the graph: {n} such property names."` → `"... 在图中显示 :_PH0__ 这样的属性名称 。"`

### 3. Silent single-underscore `_` leak when Marian outputs 3 underscores (`__PH0___`) (1 leaked in `es`, 1 leaked in `zh`)
When the model outputs `__PH0___` (two leading underscores, three trailing underscores), `unmask`'s `/_\s?_\s?PH\s?(\d+)\s?_\s?_/gi` consumes `__PH0__` and leaves the third `_` attached to the restored placeholder (`{doc}_` or `{language}_`). Because `PROTECTED_RE` only checks for double underscore `__` and not single `_`, `placeholdersRoundTrip` passes and writes a corrupted translation:
- `es`: `"Download this graph as JSON-LD ({doc})"` → raw `"Descargar este gráfico como JSON-LD (__PH0___)"` → unmasked `"Descargar este gráfico como JSON-LD ({doc}_)"` (accepted!).
- `zh`: `"The interface is shown in {language}. The graph itself — node names, descriptions and property names — comes from this repository and is shown as written, in English."` → raw `"接口在 __PH0___中显示。..."` → unmasked `"接口在 {language}_中显示。..."` (accepted!).

## Measured comparison with `[0]` bracket sentinels (2026-11-14)

Running the exact same 16 placeholder-bearing `msgid`s from `kg-viewer.po` through `scripts/translation/opus_mt_runner.py` across all 4 Marian checkpoints with `[0]`, `[1]` bracket sentinels (as adopted in `scripts/lib/machine-translation.ts` on PR `#2144`):

- `fr` (`Helsinki-NLP/opus-mt-en-fr`): **16/16 succeeded** (vs. `9/16` with `__PH0__`)
- `es` (`Helsinki-NLP/opus-mt-en-es`): **16/16 succeeded** (vs. `15/16` with `__PH0__`, 1 of which had a leaked `_`)
- `ar` (`Helsinki-NLP/opus-mt-en-ar`, `>>ara<< `): **16/16 succeeded** (vs. `0/16` with `__PH0__`)
- `zh` (`Helsinki-NLP/opus-mt-en-zh`, `>>cmn_Hans<< `): **16/16 succeeded** (vs. `4/16` with `__PH0__`, 1 of which had a leaked `_`)

## Done when

- [x] `mask()` / `unmask()` in `scripts/translate-pot.ts` (or unified via `scripts/lib/machine-translation.ts` in `#2144`) replaces `__PH<n>__` with `[0]`, `[1]` bracket sentinels, which achieve `64/64` (`16/16` per locale) round-trip survival across `fr`, `es`, `ar`, and `zh`.
- [x] Unit tests cover the failing `__PH<n>__` outputs recorded above (`_PH0__`, `__PH0_`, `__PH0___`, `--PH0--`) and verify `[0]` round-trip behaviour.

## Resolution (2026-11-14)

`translate-pot` is now the older name of `translation-candidates` (owner, 2026-11-14: one machine-translation command, through the one candidates writer). Its own `mask()` / `unmask()` and `__PH<n>__` sentinel are gone; every string is masked by `scripts/lib/machine-translation.ts` `maskPlaceholders` with `[0]`, `[1]`, … stand-ins, line by line. `scripts/tests/translation-candidates.test.ts` "a mangled stand-in is refused, never leaked into the text" covers the failure shapes: a broken stand-in loses its placeholder and is refused by the guard, and a spaced `[ 0 ]` still restores. The `_` an engine adds beside an intact stand-in is not a placeholder, so it is not caught by the guard; it reaches a reviewer as a fuzzy candidate.

