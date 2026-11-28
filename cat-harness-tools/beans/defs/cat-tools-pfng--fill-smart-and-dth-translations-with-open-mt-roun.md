---
# cat-tools-pfng
$schema: bean/1.0.0
title: 'Fill the smart-* and dth-* translations with open MT candidates, blind round-trip and glossary review'
status: todo
type: epic
priority: normal
created_at: 2026-11-15T09:00:00Z
updated_at: 2026-11-15T09:00:00Z
parent: folio-assistant-bzyu
---

The owner, 2026-11-15: fill in the translations of every `smart-*` and `dth-*` repository, with **blind round-trip verification** and **glossary review** as part of the work. Hand-off: agy may take any repository below. Do not claim the whole bean (`beans:claim` locks it for everyone); claim ONE repository with a note, from a cat-harness-tools checkout on its own branch, and merge that note PR before starting:

```
bun run cat beans:note cat-tools-pfng --title "claim smart-trust" --body "Taken by <worker/session>. Branch: translations/opus-mt-candidates in litlfred/smart-trust."
```

Report progress the same way, one note per event: `--title "done smart-trust"` with the PR link and the counts (candidates, filled, refused, glossary findings, round-trip verdicts), or `--title "blocked smart-trust"` with what blocks it. Never edit this bean's text to tick a box; the owner ticks boxes from the notes.

Every repository should already have `.pot` templates (owner, 2026-11-15). If one does not, generate them first (`bun run cat translation:pot`), and record which repository needed it.

## Locales

The six UN locales: `ar`, `es`, `fr`, `ru`, `zh` (and `en`, the source), unless the repository's `harness.config.json` `translation.supportedLocales` says otherwise. Region-tagged locales (`pt-BR`, `zh-Hans`) are supported since cat-harness-tools#2158.

## Per repository (one PR each, never to `main` directly)

1. **Set up the engine, once per machine.** A Python venv OUTSIDE the repository with `transformers`, `torch` and `sentencepiece` (`schemas/sdlc/python-deps.ts`, extended tier). The models come from `huggingface.co` (with `cdn-lfs.hf.co`, `cdn-lfs-us-1.hf.co`, `cas-bridge.xethub.hf.co`, `cas-server.xethub.hf.co`); allow those hosts. Never commit the venv or model weights.
2. **Collect candidates.** From the repository root:
   ```
   bun run cat translation:candidates -- --instance . --engine opus-mt --init --python <venv>/bin/python
   ```
   (`translate-pot` is the same command under its older flags.) It writes, per catalogue: `<catalogue>.candidates.json` (`translation-candidates/v1`), the `.po` with each EMPTY `msgstr` filled by the first good candidate as `#, fuzzy` (plural entries too, by the catalogue's plural count), and the translation node with `generatedBy: "machine"`. It never sets `official`, never overwrites a non-empty `msgstr`, and leaves a catalogue marked `DO NOT MACHINE-FILL` or signed off as official (node, or `X-Folio-Official: yes`) unchanged apart from its candidates. Read its "Not recorded" list: a string whose placeholders did not round-trip is reported, not filled.
3. **Glossary review.** `bun run cat translation:glossary` against the layer's term base (the glossaries of the layers it mounts, deepest first; `pipeline/translation-glossary.ts`). For every finding, fix the fuzzy `msgstr` to the fixed term, or record why the term does not apply here (`--pending --json` lists the sense questions; `--record <file>` stores the answers). Health content must not take the platform's own sense of a term (FHIR `Reference(...)`, IHE "actor", health "policy" = 政策). Then `bun run cat translation:glossary:check`.
4. **Blind round-trip verification**, on at least a sample of each catalogue per locale (every string of a short catalogue; for a long one, at least 20 strings chosen to include placeholders, plurals and domain terms). Two separate agents, as `pipeline/translation-roundtrip.ts` requires:
   - the **back-translator** sees ONLY the target-language text, with no tools and no repository access, and writes it back into English;
   - the **adjudicator** sees the English original and the back-translation, never the target text, and rules pass / warn / fail with each drift named.
   One agent doing both halves is not this check. Record each verdict with `bun run cat translation:roundtrip -- --payload <file>` where the catalogue belongs to a content block; for a catalogue with no block (a FHIR IG's own `.po`), put the verdicts in this bean's notes with the catalogue, locale, msgids and both agents' identities, and say so. A `fail` leaves that string empty (remove the fuzzy fill), never a guessed fix.
5. **Checks before the PR:** `bun run cat translation:status`, `translation:catalogue:check`, and the repository's own tests. Every machine string stays `#, fuzzy`: only a person's adjudication (`translation:adjudicate`, from a review issue) makes a translation reviewed, and nothing here marks one official.
6. **PR** titled `translations: machine candidates for <locales> (cat-tools-pfng)`, listing per locale: candidates recorded, strings filled, strings refused and why, glossary findings and how each was resolved, and the round-trip verdicts.

## Repositories

Tick each when its PR merges. Old FHIR IG forks with no `.pot` and no harness layer: note "no catalogues" and move on rather than invent them.

- [ ] smart-trust-demo (already declares `translation-sources`; 170+ catalogues)
- [ ] smart-trust
- [ ] smart-trust-phw
- [ ] smart-trust-tools
- [ ] smart-base
- [ ] smart-base-clinical
- [ ] smart-ra
- [ ] smart-immunizations
- [ ] smart-immunizations-uganda
- [ ] smart-hiv
- [ ] smart-tuberculosis
- [ ] smart-anc
- [ ] smart-fp
- [ ] smart-ccc
- [ ] smart-pcmt
- [ ] smart-ips-pilgrimage
- [ ] smart-dak-srv, smart-dak-chud, smart-dak-pnc, smart-dak-tb, smart-dak-ccc, smart-dak-smbp, smart-dak-immz, smart-dak-bds
- [ ] smart-html, smart-html-jtd, smart-kg, smart-core, smart-ig-template
- [ ] dth-hrh
- [ ] dth-phc
- [ ] dth-sc
- [ ] dth-pc
- [ ] dth-sfp

## Done when

- [ ] Every repository above is ticked, or noted as having no catalogues.
- [ ] Every machine string in them is `#, fuzzy`, with its candidates in a `.candidates.json` beside the catalogue.
- [ ] `translation:glossary:check` passes in each, with every term finding fixed or answered.
- [ ] Each catalogue has blind round-trip verdicts from two separate agents, recorded as above.
- [ ] No catalogue was marked official by this work.

## Background

- cat-harness-tools#2144 and #2149: the one candidates writer, open MT sources and platform imports.
- cat-harness-tools#2158: region-tagged locales.
- cat-harness-tools#2208: `translate-pot` folded into `translation-candidates`; plurals machine-filled, fuzzy; the `[n]` masking that fixed bean `cat-tools-ph0s`.
