---
$schema: folio-memory/v1
id: link-style-raw-is-not-the-private-repo-answer
label: stable
summary: "link style: `raw` is not the private-repo answer"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
A private folio whose README links to `https://<owner>.github.io/...` is
unreachable for exactly the people who have repository access, and
`raw.githubusercontent.com` does not fix it — it 404s on a private repo
without a token, and a browser session cookie does not authenticate it.

Default is **`blob`** (`github.com/<owner>/<repo>/blob/<ref>/<path>`): follows
the viewer's GitHub session, works public or private, renders PDFs inline.
`pages` and `raw` remain available under `readme.linkStyle` in
`<name>.config.json`, and each prints a note under the table saying who can
follow its links.
