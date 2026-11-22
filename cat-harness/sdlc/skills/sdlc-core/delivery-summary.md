---
name: delivery-summary
description: Post-delivery summary with server restart command and viewer links
user_invocable: true
---

# Delivery Summary

After completing a feature or edit (i.e., after pushing changes), provide:

## 1. Server restart command

A single copy-paste block to fetch, switch to the branch, pull, and restart:

```bash
git fetch origin <BRANCH> && git switch <BRANCH> && git pull origin <BRANCH> && ./cat-harness-tools/scripts/start-folio-assistant.sh --http
```

Replace `<BRANCH>` with the actual branch name you pushed to.

## 2. GitHub and deployed links

Always provide:

- **File blob links**: for **every** created or modified file, include a direct
  GitHub blob URL on the pushed branch:
  ```
  https://github.com/<owner>/<repo>/blob/<branch>/<relative-path>
  ```
  Never report "created/edited `foo.md`" without also giving its clickable
  GitHub blob link. If the branch is not yet pushed, say so explicitly — do not
  fabricate a URL that will 404.
- **Commit links**: `https://github.com/<owner>/<repo>/commit/<hash>` for each commit
- **Branch diff**: `https://github.com/<owner>/<repo>/compare/main...<branch>`
- **Local viewer**: `http://localhost:<viewer_port>/` (from the layer's
  viewer configuration)
- **Remote/deployed links** (when applicable):
  - **GitHub Pages**: `https://<owner>.github.io/<repo>/`
  - **Staging preview** (feature branches): `https://<owner>.github.io/<repo>/branches/<branch-slug>/`
    ([`feature-staging`](../../../skills/ui/ui-core/feature-staging.md))

When delivering in a content layer that refines this skill with a content-block
change summary, include that layer's per-block change table alongside the
links above.

## Example output

After pushing changes to `claude/feature-xyz`:

> **Restart & preview:**
> ```bash
> git fetch origin claude/feature-xyz && git switch claude/feature-xyz && git pull origin claude/feature-xyz && ./cat-harness-tools/scripts/start-folio-assistant.sh --http
> ```
>
> **Changed files:**
> - [`scripts/example.ts`](https://github.com/<owner>/<repo>/blob/claude/feature-xyz/scripts/example.ts) — Updated CLI flag handling
> - [`docs/example.md`](https://github.com/<owner>/<repo>/blob/claude/feature-xyz/docs/example.md) — Documented the new flag
>
> **Commits:**
> - [Update CLI flag handling](https://github.com/<owner>/<repo>/commit/abc123)
> - [Document new flag](https://github.com/<owner>/<repo>/commit/def456)
>
> **Full diff:** [main...claude/feature-xyz](https://github.com/<owner>/<repo>/compare/main...claude/feature-xyz)

## Staging links

When a staging preview exists, every request this skill makes for feedback,
review or sign-off carries it: one deep link per changed page, to the anchor
where the change sits, with the same page on main as *before*. Where the skill
declares an output contract, they go in its `stagingLinks` field. The rule, and
where the page list comes from:
[`feedback-deep-links`](../../../skills/authoring/content-lifecycle/feedback-deep-links.md).
