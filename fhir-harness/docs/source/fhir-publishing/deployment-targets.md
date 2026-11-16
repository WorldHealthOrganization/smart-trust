**GitHub Pages is the only target that is built and running.** The
publisher writes the site to `gh-pages`, and GitHub serves it.

The harness declares the targets it allows, so a new one is a declared option
rather than a hidden switch:

- `PUBLICATION_HOSTS` (in cat-harness-tools `schemas/kg/cat-harness.ts`):
  `github-pages`, `local-server`, `jurisdiction-endpoint` or `none`. A missing
  value does **not** default to `github-pages`.
- `ARTIFACT_STORE_KINDS` (in `schemas/sdlc/artifact-store.ts`):
  `github-release`, `object-store` (R2, S3 and similar) or `site-tree`, each
  with `publicBaseUrl`, `immutableUrls` and `cacheTtlSeconds`. A store that is
  not declared is refused; it never falls back to GitHub.
- The `render-kg-to-cdn` skill treats each CDN as its own Tool with its own
  process. Only the GitHub Pages Tool exists today.

| Option | Status for IG sites | How it would work |
|---|---|---|
| **GitHub Pages** | **in use** | `gh-pages` branch → `https://<owner>.github.io/<repo>/`. Limits: 1 GB per site, 100 MB per file |
| **GitHub Pages + custom domain** | available, not set up | a `CNAME` file on `gh-pages` and a DNS record. Nothing in the pipeline changes |
| **Cloudflare Pages** | not set up | connect Cloudflare Pages to the IG repository's `gh-pages` branch with no build command, so it serves the same files from Cloudflare's edge. Nothing in the pipeline changes |
| **Cloudflare R2 + CDN** | not set up for IG sites | upload the built site, or only the release binaries, to an R2 bucket as an `object-store` artifact store. This would be a new deploy Tool, run with `wrangler` |

One layer in this checkout already deploys to Cloudflare: the WHO IRIS
mirror's `iris-cdn.yml` puts content-addressed files into R2 and keeps its
release history in a git repository on Cloudflare. It is a model for an R2
target, not an IG deploy.

**Two things carry over to any host.** The site is built for one base URL
(`SITE_BASEURL`, for example `/<repo>`), so serving it from another path, such
as the root of a custom domain, means building it with that base URL, not
copying the files. And Cloudflare Pages caps each deployment's file count (at
the time of writing, 20,000 files on the free plan) and file size (25 MiB).
An IG with many artefacts and languages can pass the cap, so count the files
on `gh-pages` first.

**Before choosing Cloudflare**, decide three things: who holds the API token
(it is a repository secret, never in a file); whether previews (`branches/`)
move too or stay on GitHub; and whether the canonical URL changes. A
canonical URL that moves breaks every link already published.
