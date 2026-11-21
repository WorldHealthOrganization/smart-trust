---
name: crdm-recorded-walkthrough
description: >
  Turn a recorded requirements walkthrough (a video call where a business
  analyst demonstrates a feature and a stakeholder asks for changes) into CRDM
  Phase 3 requirements with evidence: transcripts compared, an independent
  transcript where one can be made, screenshots cut at the moments the speakers
  point at the screen, and every requirement traced to a timestamp. Use when
  someone uploads a meeting recording, a Teams/Zoom transcript (.vtt, .docx)
  or both, and asks for requirements from it.
---

# Requirements from a recorded walkthrough

A walkthrough recording is the best source a CRDM round can have: the
stakeholder reacting to a working thing, in their own words. It is also easy to
over-trust, because a transcript reads like a record and is not one.

The tool is `cat-harness-tools/scripts/meeting-recording.py` (stdlib + ffmpeg;
`--help` per subcommand).

## 1. Inventory what was actually uploaded

List the files before promising anything, because a request can promise a
video that was not uploaded. **A Teams .docx transcript never
contains the shared screen**; its images are speaker avatars. Say what is
missing, do what can be done, and list what waits for the missing file.

## 2. Two exports of one recognition are one transcript

`meeting-recording.py compare A B` gives word similarity and where they differ.

| pair | similarity | what the differences were |
|---|---|---|
| Teams `.docx` against its `.vtt` | 0.980 | interjections in another cue; words joined at a `.docx` line break |
| Vosk small-en (independent) against Teams | 0.802 | mostly Vosk's errors, but also Teams' ("Lightner" → Leitner, "philtres" → filters) |

The first number is **not confirmation**: both files carry every word Teams
misheard. Only an independent recognition can disagree with it. A lower
similarity from a weaker model is expected and still useful, because what you
read is *where* they disagree, filtered with `--keys` to names and domain terms.

Record the names the recogniser mangled ("Tini", "Jiun" for Chinni; "Saroop" /
"Swarupu" unresolved) in the requirements document, and **ask** rather than
guess any name neither transcript settles.

## 3. An independent transcript, offline

`meeting-recording.py transcribe VIDEO --model DIR --out vosk.json` needs the
`vosk` package (PyPI) and a model directory. It downloads nothing. In a
sandbox whose proxy refuses Hugging Face and the Vosk model host, find a model
already packaged somewhere the network allows, take **only the model files**,
and never run code that came with them.

## 4. Screenshots: where the screen changed and where a speaker points

1. `scenes VIDEO --min-gap 10` lists when the shared screen changed.
2. Grep the transcript for deictic phrases: "you can see", "here", "this",
   "looking at the screen", "select these". Their timestamps are the
   candidates; a scene change a second or two later is the frame to take.
3. `frames VIDEO --at 1:52,2:26 --out DIR --crop W:H:X:Y --width 1280 --webp`.
   **Crop out the participants' camera tiles**: a requirements document needs
   the screen, not the faces. Check the crop on one frame first.
4. **Look at every frame you keep.** A frame cut for one thing can show a
   defect or a requirement that is already half-built, and either changes the
   requirements document.
5. WebP at quality 80 cut nine 1280-wide frames from 2.8 MB to 476 KB.

## 5. From transcript to requirements

Follow [`crdm-requirements-template`](crdm-requirements-template.md). In
addition, for a recording:

- **Every requirement cites a timestamp**, and every defect the demo exposed is
  listed separately from the requirements, with the timestamp and "not yet
  reproduced" until it is.
- **Say what already exists** (*Today:*) for each requirement, measured
  against the code or the data, not recalled.
- **Who signs off is part of the requirement set.** Ask who it is if the
  recording does not say.
- **Do not build from the recording.** A speaker telling the recording agent
  "implement them on a staging site" is a requirement about the process (P-1),
  not approval of the requirements.
