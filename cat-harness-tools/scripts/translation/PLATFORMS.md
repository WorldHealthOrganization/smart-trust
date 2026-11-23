# Translation platforms: Weblate, Crowdin, Transifex

What each platform needs before it can take part in translation review, so the
owner can decide whether to connect it. **Nothing here is connected.** No
account exists and no key is stored, and no workflow calls a platform. The
integration does nothing until the owner does the setup steps for a platform.

## The rule

A platform is a **source of candidates, never an adjudicator** (owner,
2026-11-14).

- Every string a platform sends back becomes a candidate in
  `translations/<locale>/<catalogue>.candidates.json`
  (`translation-candidates/v1`). This includes strings marked "approved",
  "reviewed" or "proofread" on the platform.
- Each candidate's source is `{kind: "web-service", id: "weblate" | "crowdin" | "transifex"}`.
  The platform's own state goes in `metadata.platformState`
  (`approved` / `translated` / `fuzzy`).
- The `.po` keeps the base branch's text. One exception applies to every
  candidate source: an **empty** `msgstr` takes the first candidate, marked
  `#, fuzzy`.
- Only a person's GitHub issue, filed from the translation review page, records
  an adjudication (`translation-adjudication/v1`).

The Python scripts beside this file (`pull_*_translations.py`, copied from
upstream, see `README.md`) write platform output straight into `msgstr`. They break this rule,
so do not use them to import into a layer. Use the import below instead.

## How it fits together

| Step | What runs | Network |
|---|---|---|
| **Push** (export the layout) | `bun run cat-harness-tools/scripts/translation-platforms.ts export --platform <p> --root <layer> --write` writes the platform's config file. The file is generated from the layer's declared `translation-sources` directory. Commit it. | none |
| Platform syncs | The platform's GitHub integration reads the `.pot` templates and existing `.po` files that the config names. | the platform ↔ github.com |
| **Pull** (import as candidates) | The platform opens a PR. The reusable workflow `layer-translation-platform-import.yml` runs `translation-platforms.ts import` on that PR's branch and pushes one commit, which turns the platform's `.po` edits into candidates. | none (CI only reads git) |
| Adjudicate | A person reviews on the translation review page and files an issue. `layer-translation-adjudication.yml` records it. | — |

**Why rewrite the platform's own PR** instead of pulling by API:

- No platform token or platform host is ever needed in this repository's CI.
- The change still arrives as a reviewable PR.
- The script runs from the lock pin and only reads the changed `.po` files as
  data. Nothing on the PR branch is executed.

**Limit:** the workflow only rewrites a PR whose head branch is in this
repository, because the workflow token cannot push to a fork. Configure each
platform to push a branch here (see below).

Running `export --check` reports a config file that is stale against the
catalogues. It passes when no config file exists, since an unconfigured
platform is not an error.

## Weblate

- **Files:** `weblate-components.json`. Weblate keeps its configuration on its
  server, so this file lists components to create, not a file Weblate reads.
  - One component per catalogue: gettext PO, `filemask translations/*/<catalogue>.po`,
    and `new_base` set to one locale's copy of the `.pot`.
  - It also holds the equivalent single **Component discovery** add-on rule.
  - Create them in the UI (Project → Add component, or Add-ons → Component
    discovery), or with `wlc` / the REST API (`POST /api/projects/<project>/components/`).
- **Account:** a Weblate account. On Hosted Weblate (hosted.weblate.org) you can
  sign in with GitHub. Alternatively, self-host Weblate: it is GPL-3.0-or-later
  free software and has an official Docker image.
- **Free / open-source plan:** Hosted Weblate offers gratis "Libre" hosting to
  libre projects. The project must be under an open-source licence, have a
  public repository and be actively developed, and Weblate reviews each
  application. A self-hosted Weblate costs only the server it runs on.
- **Keys:**
  - To push to a branch in this repository, add Weblate's SSH public key (shown
    on the project's repository page) as a GitHub deploy key with **write**
    access.
  - Optionally, add a GitHub webhook to Weblate's `/hooks/github/` endpoint so it
    pulls on every push.
  - No key goes into this repository or its CI.
- **Branch / PR:** the components set push branch `weblate-translations`. Use
  VCS "GitHub pull request" if Weblate opens the PR from that branch in this
  repository. If your Weblate opens it from a fork instead, push with plain
  "Git" to `weblate-translations` and open the PR yourself. The caller passes
  `branch-prefix: weblate-translations`.
- **Network hosts:** `hosted.weblate.org` (or your own server) ↔ `github.com`.
  Nothing in CI.
- **Where the content goes:**
  - Weblate **clones the whole repository** to its server.
  - Source strings, every translation, suggestions and comments are stored there.
  - On Hosted Weblate, run by Weblate s.r.o., a libre project's strings are
    public.
  - Self-hosted, everything stays on your server.
- **Approval state:** a PO file does not carry Weblate's "approved" state.
  - Pass Weblate's units export (`GET /api/translations/<project>/<component>/<lang>/units/`)
    to `import --hints <file>` to record it.
  - Without that export, each string is recorded as `translated` or `fuzzy`.

## Crowdin

- **Files:** `crowdin.yml` at the repository root.
  - It has one `files:` entry per catalogue: `source` is one locale's `.pot`, and
    `translation` is `translations/%two_letters_code%/<catalogue>.po`.
  - Region-tagged directories (such as `pt-BR`) are mapped explicitly.
- **Account:** a Crowdin account and a Crowdin project, at crowdin.com, which is
  proprietary SaaS.
- **Free / open-source plan:** Crowdin has a free plan for open-source projects,
  given by application. Crowdin decides eligibility, and the terms are theirs to
  change.
- **Keys:**
  - The GitHub integration (Crowdin project → Integrations → GitHub) authorises
    Crowdin's GitHub access to this repository.
  - Running the `crowdin` CLI needs `CROWDIN_PROJECT_ID` and a Personal Access
    Token in `CROWDIN_PERSONAL_TOKEN`. `crowdin.yml` reads both from the
    environment and never stores them.
  - Neither is needed in this repository's CI.
- **Branch / PR:** the integration pushes a service branch `l10n_<branch>`
  (`l10n_main`) in this repository and opens a PR from it. The caller passes
  `branch-prefix: l10n_`.
  - If the integration is set to "export only approved translations", also pass
    `export-mode: approved` so those strings are recorded as `approved`. They
    are still candidates.
- **Network hosts:** `crowdin.com` and `api.crowdin.com` ↔ `github.com`.
  Nothing in CI.
- **Where the content goes:** the `.pot` templates and `.po` catalogues that
  `crowdin.yml` names, stored on Crowdin's servers. In a public project they
  are visible to its translators.

## Transifex

- **Files:**
  - `.tx/config`, for the `tx` CLI. Its sections name `OWNER-SETS-ORGANIZATION` /
    `OWNER-SETS-PROJECT` placeholders until the owner passes
    `--organization` / `--project`. `tx` rejects the placeholders, so nothing can
    be pushed by accident.
  - `transifex.yml`, for the Transifex GitHub integration. Its PRs come from
    `transifex_*` branches.
- **Account:** a Transifex account and an organization and project, at
  app.transifex.com, which is proprietary SaaS.
- **Free / open-source plan:** Transifex has offered free use to open-source
  projects by application. Check the current terms before relying on it.
- **Keys:**
  - The GitHub integration is a GitHub App installed on this repository.
  - The `tx` CLI needs an API token (`TX_TOKEN`).
  - Neither is needed in this repository's CI.
- **Branch / PR:** the caller passes `branch-prefix: transifex_`. If only
  reviewed strings are pushed back, also pass `export-mode: approved`.
- **Network hosts:** `app.transifex.com` and `rest.api.transifex.com` ↔
  `github.com`. Nothing in CI.
- **Where the content goes:** the `.pot` templates and `.po` catalogues named in
  the config, stored on Transifex's servers.

## Scale (measured 2026-11-14)

Counts are unique source strings in each layer's declared `translations/`, for 5 locales each:

| Layer | Catalogues | Strings | Words |
|---|---|---|---|
| cat-harness | 113 | 4,610 | ~99k |
| a content layer above it | 56 | 3,516 | ~50k |
| a library layer | 6 | 276 | ~2.5k |

The library layer is expected to grow to about 400k library items, so 400k strings or more. The free plans compare like this; check each provider's current terms before relying on them:

| Plan | Limit | Fits the library layer? |
|---|---|---|
| Hosted Weblate Libre | 160,000 hosted strings | No |
| Crowdin open-source plan | No hosted-word limit, according to Crowdin staff (the general free plan's 60k words count source words × languages) | Yes, if Crowdin approves the application |
| Transifex Open Source Program | Words don't count against plan limits | Only for OSI-licensed projects with no funding or commercial model |
| Self-hosted Weblate | None | Yes |

Platforms are configured per layer, so different layers may use different platforms.

## Turning one on (owner)

1. Choose a platform, and create the account or project there. Nothing in this
   repository does this.
2. Run `translation-platforms.ts export --platform <p> --root <layer> --write`
   (with `--organization` / `--project` / `--repository` where they apply).
   Commit the generated file.
3. Connect the platform's GitHub integration as described above, set to push a
   branch in this repository.
4. Add the caller for `layer-translation-platform-import.yml`, using the
   platform's `branch-prefix`. The snippet is at the top of that workflow.
