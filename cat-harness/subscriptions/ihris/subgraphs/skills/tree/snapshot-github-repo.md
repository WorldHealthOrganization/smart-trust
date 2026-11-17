---
name: snapshot-github-repo
description: >
  Describe a GitHub repository pinned at a commit (path-level inventory of FSH
  definitions, Markdown pages, packages) without copying its content. Use for
  iHRIS 5 and any other git-hosted iHRIS asset.
input: src/schemas/skills/snapshot-github-repo/input.schema.json
output: src/schemas/skills/snapshot-github-repo/output.schema.json
---

# Snapshot a GitHub repository

1. `git clone --depth 1 https://github.com/<owner>/<repo>` (public repos clone
   anonymously through the session's git proxy).
2. `python3 src/tools/snapshot_github.py <clone> <owner>/<repo> "<title>"`
   writes `uploads/github/<repo>.json`.
3. `python3 src/tools/build_kg.py && python3 src/tools/validate.py`.

**Licence decides what may be reproduced.** A repository with no licence file
(for example `iHRIS/ihris-documentation`) is listed by path and heading only,
and its text is never copied. A licensed one may be ingested into `library/` as
a separate step, citing the pinned commit.
