---
# folio-assistant-r279
$schema: bean/1.0.0
title: 'DECIDE: which transcription backend, and what CI pays for it'
status: completed
type: task
priority: normal
created_at: 2026-09-20T13:02:22Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-slw1
---

## Why this is its own bean

`1r0p` (audio transcription) waited on `68dt` — declare Python dependencies and
install them in CI. **`68dt` has landed**: `requirements.txt` is generated from
`schemas/python-deps.ts` and `code-quality-gates.yml` runs
`pip install -r requirements.txt`. The mechanism exists.

What does not exist is a **decision about which backend**, and that is not a
line to add quietly to a dependency list. Measured 2026-09-20: the ten declared
packages are PDF, XML, YAML and HTTP — no whisper, vosk, speech or ffmpeg.

Splitting it out so `1r0p` is not blocked on a bean whose name no longer
describes the blocker. A block that names a cleared dependency sends the next
agent to check something already done — which is what nearly happened here, and
what a previous session got wrong by unblocking `1r0p` in error.

## What a choice has to answer

| | why it is not obvious |
|---|---|
| **install cost in CI** | every gate run pays it. `pip install -r requirements.txt` was measured at 3.9 s / 16 wheels; a torch-backed whisper is a different order |
| **model weights** | downloaded at run time, or vendored? A run-time download makes CI depend on a third-party host, which is the `5rfy` shape |
| **offline** | this repository's gates run without network in places. A backend that must reach a model server cannot be gated |
| **licence** | it ships in a platform other repositories depend on |
| **quality vs size** | `whisper-tiny` and `whisper-large` are the same API and very different artefacts |

## And there is nothing to transcribe

Measured across `uploads/` and `library/`: **zero** `.mp3 .wav .m4a .ogg .flac
.mp4`. Even with a backend chosen, `1r0p` has no input. Both facts are needed —
the backend is a decision, the audio is an absence — and neither is fixed by
the other.

## Done when

- [ ] one backend chosen, with the five rows above answered rather than assumed
- [ ] declared in `schemas/python-deps.ts` with its `# imports:` line, so
      `check:python-deps` can exercise it — a declared-but-unimported package
      is the vacuity `68dt` exists to prevent
- [ ] the CI install cost re-measured after adding it, not predicted
- [ ] `1r0p`'s block updated to name whatever is left

## Not this bean

Building the arm. `1r0p` carries that, and its `transcript/` output is already
probed by `check:l1-complete` — a probe corrected on 2026-09-20 from
`transcript.json`, a filename that could never have matched the directory
`1r0p` says it writes.

## Summary of Changes

Closed 2026-09-23 **by the owner's ruling, which changed the question**. Asked which backend to adopt, the owner said: *"describe options as Tools fulfilling task but dont need to materialize"*. So nothing is chosen and nothing is installed. The candidates are declared as Tool nodes in `cat-harness/tools/index.ts`, each satisfying `library-ingestion`, each naming the other two in `alternativeTo`, and each recording `when`, `limits` and `cost`:

- `transcribe-whisper-cpp`: offline, CPU, no Python. The default candidate.
- `transcribe-faster-whisper`: Python, beside the PDF arms. Weights are fetched on first use.
- `transcribe-vosk`: the lightest offline option, with lower accuracy.

None is in `schemas/python-deps.ts`, `requirements.txt` or CI. The original Done-when items (choose one, declare it in python-deps, re-measure CI cost) are superseded, not skipped: they become `1r0p`'s first step when the first recording arrives. `check:tools` is green over the three nodes.

_2026-10-15T16:49Z_ — Block on `1r0p` lifted: this bean is completed (closed by owner ruling 2026-09-23; residual is 1r0p's first step). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


_2026-10-15T16:49Z_ — Block on `1r0p` lifted: this bean is completed (closed by owner ruling 2026-09-23; residual is 1r0p's first step). The edge was the work plan's "Block never lifted" finding (owner, 2026-10-15). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

_2026-10-16T06:30:00Z_ — The note above is mirrored from the folio-assistant store (commit 0b8d249), where this edge was lifted on 2026-10-15; lifted here too (Owner ruling 2026-10-16, item 9). Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
