---
# folio-assistant-1r0p
$schema: bean/1.0.0
title: 'INGEST: audio — transcription and translation'
status: completed
type: task
priority: normal
created_at: 2026-09-16T06:43:50Z
updated_at: 2026-10-30T23:45:00Z
parent: folio-assistant-slw1
---

## What

Audio content is transcribed, and the transcript translated into the folio's
languages.

## Done when

`library/<slug>/transcript/` holds the source-language transcript and each
translation, both referenced from `manifest.jsonld`, both carrying the
provenance stamp (`folio-assistant-iqim`), and both subject to the round-trip
QA (`folio-assistant-ktt2`).

Diagram: `processes/ingest-derive-content.bpmn`, `Task_Audio`.

_2026-09-19T16:20Z_ — a block was recorded here against
`folio-assistant-68dt` (declare Python dependencies and install them in CI).

_2026-09-22_ — **NOT blocked on `folio-assistant-68dt` any more.** It is
`completed`: `schemas/python-deps.ts` declares the dependencies,
`requirements.txt` is generated from it, and `code-quality-gates.yml:148`
installs the lean set. Verified against those files rather than against the
bean's status word.

The handoff below already said what to do in this case — *"if `68dt` has
landed, this is ordinary work — unblock and proceed"* — so the block is
withdrawn on its own terms. The rest of the entry stands: it records what was
measured absent in 2026-09-19 and why, which is still the reason not to
hand-roll a parser.

- **waits on**: a working backend for audio transcription that CI also has. Measured absent
  2026-09-19; `pip` reaches an index but CI installs only `ruff`, so anything
  built now would ship an untested path — the `5rfy` defect.
- **since**: 2026-09-19.
- **expires**: 2026-10-19. After that, presume this stale and re-measure rather
  than trusting it.
- **handoff**: if `68dt` has landed, this is ordinary work — unblock and
  proceed. If it has not, do NOT hand-roll a parser; say what is missing.
  For `d5f1`, read this bean's measurement first: the image count is not the
  figure count, and 121 of `who-pub-tps-931`'s images are page scans.

_2026-09-20T04:20Z_ — **Still blocked. I unblocked this in error and am
correcting it in the same turn.**

`68dt` declared the Python dependencies the scripts actually IMPORT, and
**there is no audio script**, so nothing declared or installed a transcription
backend. `whisper`, `faster_whisper`, `vosk`, `speech_recognition`, `pydub` and
`soundfile` were all absent when measured 2026-09-19 and all still are —
`68dt` changed nothing for this arm.

What `68dt` did change: the MECHANISM is now in place. Adding a transcription
backend is one entry in `schemas/python-deps.ts` with its tier and cost, and
`check:python-deps` will refuse an audio script that imports something
undeclared. So the block is narrower than it was — it needs a decision about
WHICH backend and what it costs, not a missing convention.

- **waits on**: a transcription backend chosen and declared, plus audio in
  `uploads/` to run it over. Zero audio files present.
- **since**: 2026-09-19. **expires**: 2026-10-19.
- **handoff**: size the backend before proposing it. The `68dt` precedent is
  that a 323 MB dependency for one script is declared `extended` and kept out
  of CI rather than dropped — a local Whisper model is likely that shape or
  larger, so measure before assuming CI can carry it.

*2026-09-20* — Re-measured per this bean's own handoff. **`68dt` HAS landed,
and the blocker MOVED rather than lifted.** Not unblocking.

The handoff says: *"if 68dt has landed, this is ordinary work — unblock and
proceed. If it has not, do NOT hand-roll a parser; say what is missing."*
`68dt` landed — `requirements.txt` is generated from `schemas/python-deps.ts`
and `code-quality-gates.yml:148` runs `pip install -r requirements.txt`. So
the mechanism to declare a Python dependency and have CI install it now
exists, which is exactly what this bean waited on.

It is still not ordinary work, for two reasons neither of which `68dt` touches:

1. **No transcription backend is declared.** The ten packages in
   `requirements.txt` are PDF, XML, YAML and HTTP. No whisper, vosk, speech
   or ffmpeg. Declaring one is a real decision — model size, CI install cost,
   whether weights download at run time — and not a line to add quietly.
2. **There is no audio in the corpus.** Measured across `uploads/` and
   `library/`: zero `.mp3 .wav .m4a .ogg .flac .mp4`. An arm built now would
   run on nothing, which is the same falsifier that stopped `p67i`'s
   narrative half.

So the block stands, with the reason REPLACED rather than repeated:
- **waits on**: a declared transcription backend (a decision), and an audio
  file to transcribe.
- **since**: 2026-09-20, re-measured.
- **expires**: 2026-10-19, unchanged.
- **handoff**: 68dt is no longer the blocker and its name should not be
  repeated. If audio arrives and a backend is chosen, this is ordinary work.

## And the probe guarding this bean was WRONG

`pn6j`'s `expiredExceptions` — added two PRs ago, by me, to fail the gate the
moment an arm lands — probed for `transcript.json`. **This bean's own Done-when
says `library/<slug>/transcript/`, a DIRECTORY.** So when `1r0p` shipped, the
ratchet would never have fired: a gate that cannot fail, which is the precise
class of defect the probe exists to prevent, reproduced two PRs later by the
person who added it.

Corrected to `transcript`, with two tests: one asserting the probe matches
what THIS bean says its arm will write, and one proving a directory probe
actually fires (`existsSync` is not file-only). A probe is a claim about
another arm's output and has to be read from that arm's own statement, not
from the shape a sidecar usually takes.

## 2026-09-23 — the backend is now a choice among declared Tools

`r279` closed on the owner's ruling. The backend options are Tool nodes (`transcribe-whisper-cpp`, `transcribe-faster-whisper`, `transcribe-vosk`), declared but not installed. When the first recording arrives, this bean's first step is to pick one by its `selection` record, install it, declare it in `schemas/python-deps.ts` if it is Python, and re-measure the CI install cost. Until then there is still nothing to transcribe.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

## Owner ruling 2026-10-06: defer until real audio exists

Asked in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze, with three options (recommended first): defer until audio exists; faster-whisper (local); hosted API. **The owner chose "Defer until audio exists".**

The transcription backend is chosen when the first real recording arrives, so it is tested on real speech in a real language. Until then this bean stays parked.


## 2026-10-10: audio exists, the default tool is ruled, and the run is blocked on the network

The owner, 2026-10-10: *"there is audio in smart-ra (video w/ audio to
extract). there are two i think transcripts to compare extract tools. what
options do we have for Tools? we should describe skills and when different
(open-source) Tools are usable when"*. The deferral's condition ("until real
audio exists") is met.

**The recording, measured** (smart-ra `5a2b76d`):
- `uploads/output.mp4`: 17:09, AAC mono 16 kHz, English, two speakers.
- Two transcripts, both Microsoft Teams auto-recognition and so **one
  opinion**: a `.vtt` (275 cues) and a `.docx` export. They agree on 98.0% of
  words and share the same errors.
- An earlier Vosk run (bean `uphx`, skill `crdm-recorded-walkthrough`) agreed
  on 80.2% and corrected those errors. Its output was never committed.

**Owner ruling 2026-10-10: the default independent recogniser is whisper.cpp**
(chosen from whisper.cpp, faster-whisper, WhisperX + pyannote, and Vosk).

**Done:** the skill `skills/library/ingestion/audio-transcription.md` says
which open-source recogniser to use when. It covers:
- audio extraction;
- the one-opinion rule;
- a constraint table: whisper.cpp, faster-whisper, Vosk, WhisperX + pyannote,
  Parakeet/Canary, Distil-Whisper;
- translation as a separate step;
- WER, CER and DER;
- what blocks a run.

**Blocked:** every recogniser's weights are on **huggingface.co** (Vosk's on
alphacephei.com), and this environment's network policy refuses both. Running
whisper.cpp on the smart-ra audio needs huggingface.co added to the
environment's allowed domains. Nothing was substituted for the run.

**Next, once the host is allowed:**
1. Build whisper.cpp and fetch `ggml-base`.
2. Transcribe the extracted WAV.
3. Commit the transcript with its tool, model and SHA-256.
4. Compare it with the Teams `.vtt` (agreement, plus a name and term list).
5. File findings for a reviewer.

## 2026-10-11: stays blocked; the owner cannot allow huggingface.co

The owner, 2026-10-11: *"i cant unblock huggingface.co"*. Probed from this
environment:
- `openaipublic.azureedge.net` (reference Whisper weights): refused.
- `download.pytorch.org`: refused.
- GitHub release downloads: refused.
- PyPI is reachable, but no package checked ships recogniser weights in its
  wheel. `pywhispercpp` downloads from huggingface.co at run time.

So no recogniser can run in a cloud session with this network policy. No
transcript was substituted.

**What unblocks it (option 1, recommended to the owner):** on any machine
with ordinary internet, run:

```sh
ffmpeg -i smart-ra/uploads/output.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp && cmake -B build && cmake --build build -j
sh ./models/download-ggml-model.sh base
./build/bin/whisper-cli -m models/ggml-base.bin -f ../output.wav -oj -of output.whisper-base
```

Then commit `output.whisper-base.json` to smart-ra `uploads/`, noting the tool,
model and the WAV's SHA-256. The comparison with the Teams `.vtt` (agreement,
plus a name and term list) needs no network, and any session can do it from
there.



## 2026-10-10: audio exists, the default tool is ruled, and the run is blocked on the network

The owner, 2026-10-10: *"there is audio in smart-ra (video w/ audio to
extract). there are two i think transcripts to compare extract tools. what
options do we have for Tools? we should describe skills and when different
(open-source) Tools are usable when"*. The deferral's condition ("until real
audio exists") is met.

**The recording, measured** (smart-ra `5a2b76d`):
- `uploads/output.mp4`: 17:09, AAC mono 16 kHz, English, two speakers.
- Two transcripts, both Microsoft Teams auto-recognition and so **one
  opinion**: a `.vtt` (275 cues) and a `.docx` export. They agree on 98.0% of
  words and share the same errors.
- An earlier Vosk run (bean `uphx`, skill `crdm-recorded-walkthrough`) agreed
  on 80.2% and corrected those errors. Its output was never committed.

**Owner ruling 2026-10-10: the default independent recogniser is whisper.cpp**
(chosen from whisper.cpp, faster-whisper, WhisperX + pyannote, and Vosk).

**Done:** the skill `skills/library/ingestion/audio-transcription.md` says
which open-source recogniser to use when. It covers:
- audio extraction;
- the one-opinion rule;
- a constraint table: whisper.cpp, faster-whisper, Vosk, WhisperX + pyannote,
  Parakeet/Canary, Distil-Whisper;
- translation as a separate step;
- WER, CER and DER;
- what blocks a run.

**Blocked:** every recogniser's weights are on **huggingface.co** (Vosk's on
alphacephei.com), and this environment's network policy refuses both. Running
whisper.cpp on the smart-ra audio needs huggingface.co added to the
environment's allowed domains. Nothing was substituted for the run.

## 2026-10-11: stays blocked; the owner cannot allow huggingface.co

The owner, 2026-10-11: *"i cant unblock huggingface.co"*. Probed from this
environment:
- `openaipublic.azureedge.net` (reference Whisper weights): refused.
- `download.pytorch.org`: refused.
- GitHub release downloads: refused.
- PyPI is reachable, but no package checked ships recogniser weights in its
  wheel. `pywhispercpp` downloads from huggingface.co at run time.

So no recogniser can run in a cloud session with this network policy. No
transcript was substituted.

**What unblocks it (option 1, recommended to the owner):** on any machine
with ordinary internet, run:

```sh
ffmpeg -i smart-ra/uploads/output.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp && cmake -B build && cmake --build build -j
sh ./models/download-ggml-model.sh base
./build/bin/whisper-cli -m models/ggml-base.bin -f ../output.wav -oj -of output.whisper-base
```

Then commit `output.whisper-base.json` to smart-ra `uploads/`, noting the tool,
model and the WAV's SHA-256. The comparison with the Teams `.vtt` (agreement,
plus a name and term list) needs no network, and any session can do it from
there.

## 2026-10-24: `whisper.cpp` (`ggml-base.bin`) run on `smart-ra/uploads/output.mp4` + comparison (`litlfred/smart-ra#91`)

Executed the commands above on the connected machine and opened [`litlfred/smart-ra#91`](https://github.com/litlfred/smart-ra/pull/91) (`052cb21fc04b0f057047c5405e3aebef9da7f44d`) committing `uploads/output.whisper-base.json` and `uploads/README.md`:

### Provenance & SHA-256 Digests
| Artefact | SHA-256 | Details |
|---|---|---|
| `uploads/output.mp4` | `5cdd6c09ef690a0f516f4277fefdb000fee849292ff04ca6ef7d8c85116cabb3` | 24,776,789 bytes (17:09, AAC mono 16 kHz) |
| `output.wav` | `e63fba5ee95c5c2e973ed8cc1739bb409978713c6f883c2cc374132fe49fef01` | 32,927,822 bytes (`ffmpeg -i uploads/output.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav`, FFmpeg 9.0.2 / `Lavf63.1.102`, 1,028.992 s) |
| `ggml-org/whisper.cpp` (`./build/bin/whisper-cli`) | commit `231638a0717b7822784297e5980965ffcec05810` | Tool node `transcribe-whisper-cpp` |
| `models/ggml-base.bin` | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` | 147,951,465 bytes (`base`, multilingual) |
| `uploads/output.whisper-base.json` | `d72b592bd85f9e1b4e5ffb674b692f2517c47e989154dffe05a52cdd26e6bd2c` | 35,950 bytes (139 timed segments, 2,395 words) |

### Word-Level Agreement (`difflib.SequenceMatcher` + word edit distance)
| Pair | Words (A vs B) | Matched words | Word similarity (`SequenceMatcher`) | Word edits (S / D / I) | Edit rate vs A (WER-style) |
|---|---:|---:|---:|---:|---:|
| Teams `.vtt` vs `output.whisper-base.json` | 2,474 vs 2,395 | 2,269 | **0.932** (`0.9320`, 93.2%) | 66 / 139 / 60 | **10.71%** (89.29% exact word match) |
| Teams `.docx` vs `output.whisper-base.json` | 2,469 vs 2,395 | 2,250 | **0.925** (`0.9252`, 92.5%) | 76 / 143 / 69 | **11.66%** (88.34% exact word match) |
| Teams `.vtt` vs Teams `.docx` (same recogniser) | 2,474 vs 2,469 | 2,421 | **0.980** (`0.9796`, 98.0%) | 5 / 48 / 43 | **3.88%** |
| Teams `.vtt` vs Vosk `small-en` (`uphx`) | 2,474 vs 2,610 | — | **0.802** (80.2%) | — | — |

### Key Domain Terms, Names & Recovered Utterance
- **Recovered 12-second utterance (`9:56–10:08`):** Teams omitted 12 seconds of speech in both `.vtt` and `.docx` right before `10:11`; `whisper.cpp` captured: *"So, for example, we have the GDHP comments. Actually, to share the couple of ones that went into the reference architecture, I think it went to the reference architecture. Sorry, it went to the smart email mailbox."*
- **Agreed terms:** `CRDM` (`0:12`), `change sets` (`2:21`, `2:26`), `CS-001` / `CS-164` (`2:28`, `3:34`), `Saroop` (`3:45`), `Copilot` (`4:18`), `reviewed by the editorial team in terms of WHO` (`7:53`), `WHO` / `WHO IRIS` (`15:43`, `16:28`).
- **Corrections by `whisper.cpp`:** `"filters"` (`14:14`, where Teams wrote `"philtres"`), plus final 5.3 seconds (`17:03–17:09`).
- **Names needing glossary/prompting:** `Carl Leitner` (both `"Carl Lightner"` at `0:05`), `Chinni Eyetan` (`"Chinni Eyetan"` / `"Tini"` / `"Jiun"` in Teams vs `"Ginny Aie turn"` / `"Ginny"` in `whisper.cpp`), `DPI-F` (`"DPIF"` vs `"DPI F"` at `2:45`), `Swarupu` / `Saroop` (`14:49`).

_2026-10-26T10:23:00Z_ — [`litlfred/smart-ra#91`](https://github.com/litlfred/smart-ra/pull/91) (`052cb21f`, `uploads/output.whisper-base.json` + `uploads/README.md`) merged on `smart-ra` `main`.

## 2026-10-29: the arm exists; the English entry is up; translations remain

Owner chose option A on 2026-10-29: build the arm and file the English transcript now, and leave the translations for agy to draft.

- Merged: litlfred/cat-harness#685 adds `folio-recording/v1` and `folio-transcript/v1` in `schemas/library/recording.ts`, and classifies the `transcript` block kind as authored.
- Merged: litlfred/cat-harness-tools#834 (issue #829) adds `scripts/recording-transcript.py`, audio and video sniffing, and a `recording` rung in `gen-library-jsonld`. `check:l1-complete` now checks `audio-transcripts`, and `NOT_DERIVABLE` is empty.
- Merged: litlfred/folio-assistant-core#222 adds §7 "File it in the library" to the `audio-transcription` skill.
- Merged: litlfred/smart-ra#96 (re-pin all remote layers to main tips, `2026-10-29T10:57:20Z`) and litlfred/smart-ra#94 (`2026-10-29T10:57:41Z`) add `library/crdm-walkthrough-2026-10-06/` with `transcript/en.json` (139 segments, draft) on `smart-ra` `main`.

**Left for Done-when:**
1. ~~Translations into ar, zh, fr, ru and es (agy). Each goes in `transcript/<lang>.json` with `translated_from: {lang: en, segments_sha256}` and the source's segment times. `recording-transcript.py segments-sha256` prints the digest.~~ Done in [`litlfred/smart-ra#99`](https://github.com/litlfred/smart-ra/pull/99) (`0f7714aac`).
2. ~~Round-trip QA (`ktt2`) for each translation.~~ Done (`pass` across all 5 languages; see below).
3. A human confirms `en` (and merges [`litlfred/smart-ra#99`](https://github.com/litlfred/smart-ra/pull/99)).

## 2026-10-30: `ar`, `es`, `fr`, `ru`, `zh` translations + untainted round-trip QA (`litlfred/smart-ra#99`)

Opened [`litlfred/smart-ra#99`](https://github.com/litlfred/smart-ra/pull/99) (`0f7714aac` on branch `fix/1r0p-transcript-translations`):

- **Source `segments_sha256` (`transcript/en.json`, 139 segments):** `ed224c2bc8748e3a8164fa2cf46f450f22d430c2ed42a7435d7a83812a846f90` (via `recording-transcript.py segments-sha256`).
- **Translations authored (`library/crdm-walkthrough-2026-10-06/transcript/{ar,es,fr,ru,zh}.json`):**
  - 139 timed segments each, 1-for-1 `start_ms` / `end_ms` alignment with `en.json`.
  - `translated_from: { "lang": "en", "segments_sha256": "ed224c2bc8748e3a8164fa2cf46f450f22d430c2ed42a7435d7a83812a846f90" }`.
  - `state: "draft"`, `drafted_by: { kind: "agent", id: "claude-code", model: "not-disclosed", session: "conversation://4e43c8a3-23a2-4f5e-8fc4-cad1bee809b0" }`, `drafted_at: "2026-10-30"`.
- **Library JSON-LD:** `blocks/transcript-{ar,es,fr,ru,zh}.jsonld` and updated `manifest.jsonld` (`6 entries`) generated via `gen-library-jsonld.ts --entry library/crdm-walkthrough-2026-10-06`.
- **Untainted Round-Trip QA (`folio-assistant-ktt2`, `untainted-verification`):**
  - Back-translator (`fr`, `es`, `zh`): `conversation://40eea24b-58e9-4224-b3a6-f92e12b385c7` (`TOOLS_USED: none`) — caught a French word (`nouvelle`) and quantifier phrasing (`dos o tres comentarios más`) in `es.json`, fixed prior to adjudication.
  - Back-translator (`ru`, `ar`): `conversation://c7855c93-469e-4653-a650-2f2f18e85123` (`TOOLS_USED: none`).
  - Adjudicator (`fr`, `es`, `zh`, `ru`, `ar`): `conversation://6788c201-7800-4606-ae76-d8302cbbd034` (`TOOLS_USED: none`) — **`VERDICT: pass`** for all 5 languages (`fr`, `es`, `zh`, `ru`, `ar`) with 0 semantic drift findings.
- **Verification:** `gen-library-jsonld --check --doc crdm-walkthrough-2026-10-06` (`7 node(s) up to date`) and `bun run cat check:l1-complete library/crdm-walkthrough-2026-10-06` (all 9 requirements `met`, 0 defects).

_2026-10-30T12:10:00Z_ — Translations merged: [`litlfred/smart-ra#99`](https://github.com/litlfred/smart-ra/pull/99) (`4bdc30f`) adds `transcript/{ar,es,fr,ru,zh}.json`, 139 segments each, aligned to `en.json`, with `translated_from.segments_sha256` and `state: draft`, plus their `blocks/transcript-*.jsonld` and the manifest references. The PR body reports a round-trip QA by untainted back-translators and an adjudicator (`ktt2`) with verdict `pass`. That QA is recorded in the PR body only, not as a file in the library. Checked before merging with cat-harness-tools main `audioTranscripts()`, which reported `met`: 139 segments, en source plus five translations, all draft. Spot-checked fr and zh against en. Merged under the owner's merge-and-repin window, session https://claude.ai/code/session_013ZJ1uYnvBifNcPaVPVJbUS.

**Left:** item 3, a person confirms `en`, and the translations, in `bun run cat narratives`. No agent can do that, so the bean stays `in-progress`, waiting on a person.



## 2026-10-10: audio exists, the default tool is ruled, and the run is blocked on the network

The owner, 2026-10-10: *"there is audio in smart-ra (video w/ audio to
extract). there are two i think transcripts to compare extract tools. what
options do we have for Tools? we should describe skills and when different
(open-source) Tools are usable when"*. The deferral's condition ("until real
audio exists") is met.

**The recording, measured** (smart-ra `5a2b76d`):
- `uploads/output.mp4`: 17:09, AAC mono 16 kHz, English, two speakers.
- Two transcripts, both Microsoft Teams auto-recognition and so **one
  opinion**: a `.vtt` (275 cues) and a `.docx` export. They agree on 98.0% of
  words and share the same errors.
- An earlier Vosk run (bean `uphx`, skill `crdm-recorded-walkthrough`) agreed
  on 80.2% and corrected those errors. Its output was never committed.

**Owner ruling 2026-10-10: the default independent recogniser is whisper.cpp**
(chosen from whisper.cpp, faster-whisper, WhisperX + pyannote, and Vosk).

**Done:** the skill `skills/library/ingestion/audio-transcription.md` says
which open-source recogniser to use when. It covers:
- audio extraction;
- the one-opinion rule;
- a constraint table: whisper.cpp, faster-whisper, Vosk, WhisperX + pyannote,
  Parakeet/Canary, Distil-Whisper;
- translation as a separate step;
- WER, CER and DER;
- what blocks a run.

**Blocked:** every recogniser's weights are on **huggingface.co** (Vosk's on
alphacephei.com), and this environment's network policy refuses both. Running
whisper.cpp on the smart-ra audio needs huggingface.co added to the
environment's allowed domains. Nothing was substituted for the run.

## 2026-10-11: stays blocked; the owner cannot allow huggingface.co

The owner, 2026-10-11: *"i cant unblock huggingface.co"*. Probed from this
environment:
- `openaipublic.azureedge.net` (reference Whisper weights): refused.
- `download.pytorch.org`: refused.
- GitHub release downloads: refused.
- PyPI is reachable, but no package checked ships recogniser weights in its
  wheel. `pywhispercpp` downloads from huggingface.co at run time.

So no recogniser can run in a cloud session with this network policy. No
transcript was substituted.

**What unblocks it (option 1, recommended to the owner):** on any machine
with ordinary internet, run:

```sh
ffmpeg -i smart-ra/uploads/output.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp && cmake -B build && cmake --build build -j
sh ./models/download-ggml-model.sh base
./build/bin/whisper-cli -m models/ggml-base.bin -f ../output.wav -oj -of output.whisper-base
```

Then commit `output.whisper-base.json` to smart-ra `uploads/`, noting the tool,
model and the WAV's SHA-256. The comparison with the Teams `.vtt` (agreement,
plus a name and term list) needs no network, and any session can do it from
there.

## 2026-10-24: `whisper.cpp` (`ggml-base.bin`) run on `smart-ra/uploads/output.mp4` + comparison (`litlfred/smart-ra#91`)

Executed the commands above on the connected machine and opened [`litlfred/smart-ra#91`](https://github.com/litlfred/smart-ra/pull/91) (`052cb21fc04b0f057047c5405e3aebef9da7f44d`) committing `uploads/output.whisper-base.json` and `uploads/README.md`:

### Provenance & SHA-256 Digests
| Artefact | SHA-256 | Details |
|---|---|---|
| `uploads/output.mp4` | `5cdd6c09ef690a0f516f4277fefdb000fee849292ff04ca6ef7d8c85116cabb3` | 24,776,789 bytes (17:09, AAC mono 16 kHz) |
| `output.wav` | `e63fba5ee95c5c2e973ed8cc1739bb409978713c6f883c2cc374132fe49fef01` | 32,927,822 bytes (`ffmpeg -i uploads/output.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output.wav`, FFmpeg 9.0.2 / `Lavf63.1.102`, 1,028.992 s) |
| `ggml-org/whisper.cpp` (`./build/bin/whisper-cli`) | commit `231638a0717b7822784297e5980965ffcec05810` | Tool node `transcribe-whisper-cpp` |
| `models/ggml-base.bin` | `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe` | 147,951,465 bytes (`base`, multilingual) |
| `uploads/output.whisper-base.json` | `d72b592bd85f9e1b4e5ffb674b692f2517c47e989154dffe05a52cdd26e6bd2c` | 35,950 bytes (139 timed segments, 2,395 words) |

### Word-Level Agreement (`difflib.SequenceMatcher` + word edit distance)
| Pair | Words (A vs B) | Matched words | Word similarity (`SequenceMatcher`) | Word edits (S / D / I) | Edit rate vs A (WER-style) |
|---|---:|---:|---:|---:|---:|
| Teams `.vtt` vs `output.whisper-base.json` | 2,474 vs 2,395 | 2,269 | **0.932** (`0.9320`, 93.2%) | 66 / 139 / 60 | **10.71%** (89.29% exact word match) |
| Teams `.docx` vs `output.whisper-base.json` | 2,469 vs 2,395 | 2,250 | **0.925** (`0.9252`, 92.5%) | 76 / 143 / 69 | **11.66%** (88.34% exact word match) |
| Teams `.vtt` vs Teams `.docx` (same recogniser) | 2,474 vs 2,469 | 2,421 | **0.980** (`0.9796`, 98.0%) | 5 / 48 / 43 | **3.88%** |
| Teams `.vtt` vs Vosk `small-en` (`uphx`) | 2,474 vs 2,610 | — | **0.802** (80.2%) | — | — |

### Key Domain Terms, Names & Recovered Utterance
- **Recovered 12-second utterance (`9:56–10:08`):** Teams omitted 12 seconds of speech in both `.vtt` and `.docx` right before `10:11`; `whisper.cpp` captured: *"So, for example, we have the GDHP comments. Actually, to share the couple of ones that went into the reference architecture, I think it went to the reference architecture. Sorry, it went to the smart email mailbox."*
- **Agreed terms:** `CRDM` (`0:12`), `change sets` (`2:21`, `2:26`), `CS-001` / `CS-164` (`2:28`, `3:34`), `Saroop` (`3:45`), `Copilot` (`4:18`), `reviewed by the editorial team in terms of WHO` (`7:53`), `WHO` / `WHO IRIS` (`15:43`, `16:28`).
- **Corrections by `whisper.cpp`:** `"filters"` (`14:14`, where Teams wrote `"philtres"`), plus final 5.3 seconds (`17:03–17:09`).
- **Names needing glossary/prompting:** `Carl Leitner` (both `"Carl Lightner"` at `0:05`), `Chinni Eyetan` (`"Chinni Eyetan"` / `"Tini"` / `"Jiun"` in Teams vs `"Ginny Aie turn"` / `"Ginny"` in `whisper.cpp`), `DPI-F` (`"DPIF"` vs `"DPI F"` at `2:45`), `Swarupu` / `Saroop` (`14:49`).

## 2026-10-30: English confirmed by the owner; bean complete

The owner chose, on a decision card at 2026-10-30T19:39:44Z, to fix the misheard names and confirm `en`. [`litlfred/smart-ra#115`](https://github.com/litlfred/smart-ra/pull/115) (merged as `7aad6bb`, issue smart-ra#114) changes:
- "Carl Lightner" to Carl Leitner, and "DPI F" to DPI-F.
- "Ginny Aie turn" and "Ginny" to "[the chief editor]" and "[Chief editor]", so no spelling is guessed. `recording.json` names the speaker "EYETAN, Chinemerem Chika".
- `en` is now `confirmed` (`confirmed_by: human litlfred`).
- The five translations get the same fixes. Their `translated_from.segments_sha256` now points at the corrected source (`72fccad3…`), and they stay `draft`, because no reviewer here reads all five languages.

`check:l1-complete` meets every requirement. Done-when holds, so the bean is complete. Session https://claude.ai/code/session_01Qmmkt7H9zdiexgtnNwV1d8.
