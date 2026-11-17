---
name: finding-software
description: >
  A script needs a program or module the container does not have (tesseract,
  pdftoppm, PyMuPDF, a CLI from a GitHub release). Get it: `bun run cat
  software:ensure`, which tries apt, pip, then a pinned and checksummed GitHub
  release, from the declared table `scripts/software.json`. Do not route
  around a missing tool with a cache, a weaker backend or a skipped step, and
  do not report "not installed" as if it were a finding about the work.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Finding software — get it, do not route around it

The container is the agent's to provision: installing usually takes one
command, and a workaround produces the wrong output quietly.

## The rule

**A missing program is a step, not a stop.** When a script says it needs
something:

```sh
bun run cat software:ensure --for cat-harness-tools/scripts/pdf-ocr.py  # what that script needs
bun run cat software:ensure tesseract pdftoppm         # by name
bun run cat software:check                             # report only
```

`scripts/ensure-software.ts` walks a ladder per entry and stops at the first
rung that leaves the thing present (checked by presence, never by exit code):

| rung | how | offered when |
|---|---|---|
| present | `command -v`, or `import` for a Python module | always checked first |
| apt | `apt-get install -y --no-install-recommends`, one `apt-get update` and retry on failure | `apt-get` exists and the agent is root or has passwordless `sudo` |
| pip | `python3 -m pip install`, with `--break-system-packages` on an externally managed interpreter | the entry names a pip package |
| GitHub release | the asset for this platform at a **pinned tag**, verified against its **sha256** before unpacking, into `~/.local/bin` | the entry declares one |

Every attempt is printed, including the rungs not offered and why. Exit 0
means everything asked for is present.

## What not to do instead

- **Do not substitute.** A cached OCR text, a weaker backend, a skipped step,
  a "could not determine" you could have determined: each produces output that
  reads as the real thing. If the right tool cannot be installed, say which
  rung failed and how (the tool prints it), and stop.
- **Do not install by hand and move on.** If a script needs something the
  table does not list, add an entry to `scripts/software.json` — how to get
  it, its licence, and `usedBy` — so the next agent's `--for` finds it. The
  tool refuses an undeclared name (exit 2) for exactly this reason.
- **Do not download an unpinned or unverified binary.** A GitHub entry carries
  a tag (never `latest`) and a sha256 per platform, taken from the release's
  own checksums file; the table's test enforces both.
- **A licence is recorded, not a reason to refuse.** PyMuPDF is AGPL: it is
  installed into the environment to RUN tools and is never vendored or shipped
  (see `pdf-structure.py`'s licence note). The entry says so.

## When a rung is blocked by the network

That is [`blocked-build-dependencies`](blocked-build-dependencies.md): read the
refusal (`curl -sS "$HTTPS_PROXY/__agentproxy/status"`) before working around
it. What an agent container typically reaches:

| route | result |
|---|---|
| apt (Ubuntu archive), PyPI, npm | open |
| `github.com/<o>/<r>/releases/download/<tag>/<asset>` | **200** — the GitHub rung works |
| `raw.githubusercontent.com` | 200 |
| `git clone https://github.com/...` | works |
| `codeload.github.com` archives, `github.com/<o>/<r>/raw/...` | 403 |
| `api.github.com` | unreliable — find a tag with `git ls-remote --tags` instead |

## A missing tool for the WHOLE environment

When every new session will need it, the durable fix is the environment's
setup script (the person's cloud environment settings), not each agent
installing it again. Say so to the person once, with the line to add —
`bun run cat software:ensure --for <script>` covers it — and carry on
installing it in this session meanwhile.
