---
name: secrets
description: >
  Adding, rotating and revoking the credentials the harness's automation needs,
  one mechanism at a time, with the exact GitHub UI path for each step. Every
  step that touches a value is a person's; an agent drafts the steps, checks
  names and expiry dates, and records what was done. Leads with the GitHub App
  on a personal account, the recommended mechanism.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Secrets — the person handles the value, the agent handles everything else

The human steps per mechanism. GitHub automation uses **one owner-owned GitHub
App**, and secret names follow the **capability naming rule** below.

## The boundary, first

| an agent **may** | an agent **never** |
|---|---|
| read secret **names** and their `updated_at`, where it has permission | sees, asks for, accepts, echoes, stores or forwards a secret **value** |
| compare declared needs, workflow usage and the names present, and report | runs `gh secret set`, `gh secret delete` or a forge equivalent |
| remind the holder before an expiry (session-start sweep, health issue, a work item) | creates a PAT, an App key, a deploy key or a forge token |
| draft the exact steps below for the person to carry out | rotates or revokes on its own initiative — it reports what would go and waits |
| record what the person did (mechanism, name, expiry) — never the value | writes anything derived from a value: a hash, a prefix, a length |

**If a value is pasted into a chat,** say that it is now exposed — it sits in
a transcript, and possibly in a provider's logs. Recommend rotation with the
steps below, and do not use the value. Pasting it is not permission to use it.

**Who holds each mechanism.** On a personal GitHub account (profile P1) the
account owner holds the App, any PAT, deploy keys, repository secrets and
environments. In an organization (P2) an organization owner holds the App and
organization secrets. On a self-hosted forge (P3) a maintainer of the project
holds the token and the protected variable. A keystore or hardware key (P4)
belongs to the device holder or the institution's custodian.

## Naming: name the capability, not the mechanism

A secret is named for what it lets the workflow do, so the name survives a
change of mechanism: `PUBLISH_SITE_BOOTSTRAP`, not `BOOTSTRAP_PAGES_TOKEN`;
`PUSH_BRANCH_TRIGGERING_CI`, not `MERGE_MAIN_TOKEN`. With the App, the
stored pair is `HARNESS_BOT_ID` (a **variable**) and `HARNESS_BOT_PRIVATE_KEY`
(a **secret**); a workflow mints a short-lived token from them and exposes it
to its job under the capability name.

## 1. GitHub App on a personal account — the recommended mechanism

Why it is first: its working token lasts one hour and is minted per run; it
acts as `<app>[bot]`, not as the owner, so automated pushes stay separate from
the owner's own in the audit trail; one App covers pushing to another
repository, pushes that must start CI, release-please and the smart-*
repositories; and it moves to an organization unchanged. The cost is about ten
minutes of UI, once, and a long-lived private key to store and rotate.

### Add — the person, in the GitHub UI

1. **Register the App.** Avatar → **Settings** → **Developer settings** →
   **GitHub Apps** → **New GitHub App**.
   - *GitHub App name:* something that says whose bot it is, e.g.
     `<account>-harness-bot`.
   - *Homepage URL:* the account or repository URL (required, not used).
   - *Webhook:* **untick Active**. The harness needs no webhook.
   - *Repository permissions:* only what the declared needs require. For the
     two needs measured today: **Contents: Read and write** and
     **Pull requests: Read and write**; **Metadata: Read-only** is added
     automatically. Add **Secrets: Read-only** only if `secrets:check` should
     list secret names. Leave everything else at *No access*.
   - *Where can this GitHub App be installed?* **Only on this account**.
   - **Create GitHub App.**
2. **Note the App ID** shown at the top of the App's settings page. It is not
   secret.
3. **Generate a private key.** Same page → **Private keys** →
   **Generate a private key**. A `.pem` file downloads. This file is the
   secret: do not paste it into a chat, a work item, an issue or a commit.
4. **Install it on selected repositories.** Left menu → **Install App** →
   your account → **Only select repositories** → pick the repositories the
   needs name (e.g. `bootstrap`, `folio-assistant`) → **Install**.
5. **Store the pair in each consuming repository.** In that repository:
   **Settings** → **Secrets and variables** → **Actions**.
   - **Variables** tab → **New repository variable** → name `HARNESS_BOT_ID`,
     value the App ID.
   - **Secrets** tab → **New repository secret** → name
     `HARNESS_BOT_PRIVATE_KEY`, value the whole contents of the `.pem`
     (including the `BEGIN`/`END` lines).
   - Where a secret should only reach one branch or need an approval, use
     **Settings** → **Environments** instead (§5 below) and add it there.
6. **Delete the downloaded `.pem`** from the computer once it is stored, or
   move it to a password manager if you want a recovery copy.
7. **Narrow the blast radius.** A token with *Contents: write* can write every
   branch. On each repository whose `main` the bot must not push, add a
   ruleset: **Settings** → **Rules** → **Rulesets** → **New branch ruleset**,
   target `main`, and leave the App **off** the bypass list.

### The mint step — what the agent adds to a workflow

The agent writes this; the person only reviews it. Two lines of intent, one
step:

```yaml
- id: bot
  uses: actions/create-github-app-token@v1
  with:
    app-id: ${{ vars.HARNESS_BOT_ID }}
    private-key: ${{ secrets.HARNESS_BOT_PRIVATE_KEY }}
    repositories: bootstrap          # only the repositories this job writes
- env:
    PUBLISH_SITE_BOOTSTRAP: ${{ steps.bot.outputs.token }}
  run: …
```

The token is exposed under the **capability** name, so the rest of the job
does not change when the mechanism does.

### Rotate — no downtime

An App may hold two private keys at once.

1. App settings → **Private keys** → **Generate a private key** (a second one).
2. Update `HARNESS_BOT_PRIVATE_KEY` in each consuming repository with the new
   `.pem`.
3. Run one workflow that mints a token, and see it green.
4. Back in **Private keys**, **Delete** the old key.

The agent records the rotation date; an App key has no expiry, so the registry
carries a `rotateBy` policy date for the checker to warn on.

### Revoke

- One repository: App settings → **Install App** → the installation →
  **Configure** → remove the repository.
- Everything, now: **Suspend** the installation, or **Uninstall** it.
- A leaked key: **Delete** that key under **Private keys**, then rotate as
  above.

## 2. Fine-grained personal access token

Use only where an App cannot: every push made with it is recorded as **the
owner's own** push. Classic PATs are excluded by this design.

- **Add:** avatar → **Settings** → **Developer settings** →
  **Personal access tokens** → **Fine-grained tokens** →
  **Generate new token**. Set an **expiration** (at most one year).
  *Repository access* → **Only select repositories** → the target.
  *Repository permissions* → **Contents: Read and write** (plus only what the
  need names). Copy the value once, then in the **consuming** repository:
  **Settings** → **Secrets and variables** → **Actions** →
  **New repository secret**, named for the capability.
- **Rotate:** open the token → **Regenerate token** → update the secret. Tell
  the agent the new **expiry date** (not the value) so it is recorded.
- **Revoke:** delete the token, then delete the secret.

## 3. Deploy key (SSH)

Git only — no API, so it cannot open a PR or list secret names — and it never
expires.

- **Add:** on your own machine,
  `ssh-keygen -t ed25519 -N "" -C publish-site-bootstrap -f <tmpfile>`. In the
  **target** repository: **Settings** → **Deploy keys** → **Add deploy key**,
  paste the **public** half (`<tmpfile>.pub`), tick **Allow write access**. In
  the **consuming** repository, store the **private** half as a secret. Then
  shred both local files.
- **Rotate:** add the new key, switch the secret, delete the old key.
- **Revoke:** delete the key.

## 4. Trusted publishing — replaces a stored registry token

npmjs.com → the package → **Settings** → **Trusted Publisher** →
**GitHub Actions** → owner, repository, workflow file. Then delete the stored
`NPM_TOKEN` secret: nothing remains to rotate.

## 5. Environment — a secret released only to a branch, or after approval

**Settings** → **Environments** → **New environment** → **Required reviewers**
(if a person must approve each run) → **Deployment branches and tags** →
**Selected branches and tags** → `main`. Add the secret under the
environment, not the repository.

## 6. Self-hosted forge (GitLab)

Project → **Settings** → **Access tokens** → **Add new token** (role,
`write_repository`, an expiry). Then **Settings** → **CI/CD** → **Variables**
→ add it as **Masked** and **Protected**. Whether a push by that token starts
pipelines varies by forge and version: measure it before relying on it.

## 7. Keystore (own machine, air-gapped)

`security add-generic-password …` (macOS) or `secret-tool store …` (Linux),
with the value **typed at the prompt** — never on the command line, where it
would land in the shell history.

## After any change

The agent, not the person:

1. records the mechanism, the secret **name**, and the expiry or `rotateBy`
   date — never the value;
2. runs `secrets:check` where it exists; where it does not, says that no
   checker covers it rather than reporting clean;
3. dispatches one workflow that uses the credential, if a rule grants it
   `dispatch-workflow`, and reports green or red.
