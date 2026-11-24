#!/usr/bin/env bash
# Build the docs site locally, so a page can be looked at rather than described.
#
# WHY THIS EXISTS
#
# `continual-progress` argues that a human cannot assess a rendered artefact
# from a description of it. The same holds for the agent that wrote it, and it
# was measured here on 2026-09-21: `gen-handler-index.ts` emitted raw
# `<h3><code>kind</code></h3>` blocks, kramdown passed them through without
# assigning heading ids, and the just-the-docs anchor-heading include fell back
# to the page's own id — so all 22 kind headings rendered `href="#published-
# graphs"`, one anchor for every section, with `aria-labelledby` naming a
# heading that is not the one being labelled. Bean `gjli` is the standing
# accessibility rule.
#
# The generator's own output looked correct. `bun run cat gates --all` was green
# across the whole defect. Only a build showed it.
#
# THE TWO THINGS THAT MAKE A NAIVE BUILD FAIL HERE
#
#   1. `bundle exec jekyll` reports "command not found: jekyll" even with the
#      gems installed and `bundle check` satisfied — the binstub is not on the
#      path bundler searches. The gem's own executable works.
#   2. `_config.yml` pins `remote_theme: just-the-docs/just-the-docs@v0.12.0`,
#      and the plugin downloads it from codeload.github.com. In a sandboxed
#      session the egress proxy returns 403 and the build aborts. The
#      `just-the-docs` GEM is installed, so this strips the remote_theme line
#      and uses it.
#
# WHAT THIS IS NOT
#
# It is NOT what CI builds. CI uses `actions/jekyll-build-pages` with the
# `github-pages` gem and the pinned REMOTE theme, so chrome can differ — theme
# version, its CSS, its includes. What does NOT differ is Liquid and kramdown,
# which is where the defects this exists to catch live. Read a layout question
# off the staging preview, not off this.
#
# WHAT IT NOW DOES AFTER JEKYLL, AND WHY
#
# Jekyll builds `docs/` and nothing else. CI then runs a dozen steps that put
# files into `_site` from elsewhere, and WITHOUT THEM THE PREVIEW 404s ON
# THINGS THAT ARE LIVE. Measured cost in one session, 2026-09-23: three
# separate investigations into 404s that were all this — `/smart-trust/`,
# `cat-harness.jsonld`, and `/assets/qa/index/qa-index.json` — plus running
# `mount-instance-docs.ts` by hand after every single build.
#
# A 404 you have to investigate to dismiss is worse than one you can attribute
# at a glance, so the cheap deterministic steps are done here and the rest are
# NAMED at the end of the run. Both halves matter: doing them silently would
# leave the next unexplained 404 just as expensive.
#
# Usage:
#   cat-harness/scripts/preview-site.sh [dest]
#     dest  where to write the built site (default: a temp directory)

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docs="$(bash "$here/lib/harness-root.sh")/docs"  # bean 70lx: the harness's docs
dest="${1:-$(mktemp -d)}"

# The gem executable. Resolved rather than hardcoded, because the rbenv
# version moves — and each candidate is TRIED rather than trusted to exist.
#
# `command -v jekyll` finds an rbenv SHIM here, and the shim exits with
# "rbenv: jekyll: command not found" while helpfully listing the very version
# that has it. A path that resolves is not a path that runs, so the loop below
# asks each candidate for `--version` and takes the first that answers. Same
# rule as everywhere else in this repository: a declared thing is checked, not
# assumed.
jekyll=""
for cand in \
  "$(command -v jekyll || true)" \
  $(find /opt/rbenv/versions -maxdepth 3 -name jekyll -type f -perm -u+x 2>/dev/null) \
  $(find /usr/local /usr/lib -maxdepth 6 -name jekyll -type f -perm -u+x 2>/dev/null)
do
  [ -n "$cand" ] || continue
  if "$cand" --version >/dev/null 2>&1; then jekyll="$cand"; break; fi
done
if [ -z "$jekyll" ]; then
  echo "preview-site: no WORKING jekyll executable found." >&2
  echo "  Candidates were tried with --version; a shim that resolves but exits" >&2
  echo "  non-zero does not count. Try: (cd cat-harness/docs && bundle install)" >&2
  exit 1
fi
echo "preview-site: using $jekyll ($("$jekyll" --version 2>/dev/null))"

# THE LAYOUT GITHUB PAGES GIVES A PAGE THAT NAMES NONE.
#
# CI builds with the `github-pages` gem, which always enables
# `jekyll-default-layout`: a page with no `layout:` gets `page`. That gem is not
# installed here, so without this a page that names no layout (all 75 process
# pages among them) builds as BARE HTML: no theme, no stylesheet, and none of
# the theme's `table_wrappers` layout, which is what gives a table its own
# scrolling box. Measured 2026-09-24 (bean `2r2n`): 60 of the 105 pages that
# looked like they scrolled sideways at 390 px were this and nothing else.
# Front-matter defaults apply only where a page sets no layout, which is the
# same scope as the plugin's.
default_layout() {
  # A config that already declares `defaults:` (the docs graph's sub-graph
  # groups, bean `xka5`) gets ONE MORE ENTRY under it: a second top-level
  # `defaults:` key would replace the first, and YAML says so silently.
  if grep -q '^defaults:' "$cfg"; then
    sed -i 's/^defaults:$/defaults:\n  - scope: { path: "" }\n    values: { layout: page }/' "$cfg"
  else
    printf 'defaults:\n  - scope: { path: "" }\n    values: { layout: page }\n'
  fi
}

# A config with the remote theme stripped and the local gem used instead —
# see (2). Written to a temp file so the committed `_config.yml`, which is what
# CI reads, is never touched.
cfg="$(mktemp /tmp/preview-config-XXXXXX.yml)"
grep -v '^remote_theme:' "$docs/_config.yml" \
  | sed 's/^\(\s*\)- jekyll-remote-theme$/\1- jekyll-seo-tag/' > "$cfg"
echo "theme: just-the-docs" >> "$cfg"
default_layout >> "$cfg"

# THE COMPOSED TREE, because that is what CI builds FROM.
#
# `docs-site.yml` runs `compose-docs.ts --out ./_docs` and then points Jekyll
# at `_docs`, not at `cat-harness/docs`. Building the base directly is a
# DIFFERENT SOURCE TREE, and it silently drops every composed directory — which
# is why `/smart-trust/` 404ed here and not live, and cost a session an
# investigation to establish that.
#
# Composed into a temp directory rather than the repository's own `_docs`, so a
# preview never leaves anything behind for the next `git status` to explain.
src="$docs"
composed="$(mktemp -d /tmp/preview-docs-XXXXXX)"
trap 'rm -f "$cfg"; rm -rf "$composed"' EXIT
if bun run "$here/compose-docs.ts" --out "$composed" >/dev/null 2>&1 && [ -f "$composed/_config.yml" ]; then
  src="$composed"
  # The config is stripped from the COMPOSED copy for the same reason as
  # before — see (2) — so the committed one is still never touched.
  grep -v '^remote_theme:' "$composed/_config.yml" \
    | sed 's/^\(\s*\)- jekyll-remote-theme$/\1- jekyll-seo-tag/' > "$cfg"
  echo "theme: just-the-docs" >> "$cfg"
  default_layout >> "$cfg"
  echo "preview-site: composed the docs layers -> $composed"
else
  # A compose failure is REPORTED, not swallowed: the build still works off the
  # base layer, and a reader who is told which tree was used can account for a
  # missing composed page instead of chasing it.
  echo "preview-site: compose-docs failed — building the BASE layer only." >&2
  echo "  Composed directories (smart-trust's docs among them) will 404." >&2
fi

echo "preview-site: building $src -> $dest"
"$jekyll" build --config "$cfg" --source "$src" --destination "$dest" 2>&1 \
  | grep -vE "deprecation|DEPRECATION|^\s*╵|^\s*╷|^\s*[0-9]+ \||WARNING: [0-9]+ repetitive" \
  || true

if [ ! -f "$dest/index.html" ]; then
  echo "preview-site: build produced no index.html — see the output above." >&2
  exit 1
fi

repo="$(dirname "$(bash "$here/lib/harness-root.sh")")"  # bean 70lx: the checkout holding the harness

# ── The post-Jekyll steps, mirroring `docs-site.yml` ──────────────────────
#
# Each is cheap (the slowest is ~2s), offline and deterministic. A step that
# needed the network or a toolchain this environment may not have is NOT run
# here — it is listed at the end instead.

if [ "${PREVIEW_NO_MOUNT:-}" != "1" ]; then
  # `mount-instance-docs.ts --site ./_site --built cat-harness` in CI. Copies
  # each instance's rendered content into the published tree and injects the
  # harness rail into pages Jekyll never sees. Without it `/who-iris/` and
  # every asset under it 404s — including the harness tab marks.
  echo "preview-site: mounting instance-rendered content"
  bun run "$here/mount-instance-docs.ts" --site "$dest" --built cat-harness 2>&1 | sed 's/^/  /' || true
fi

# `set-html-lang.ts --site ./_site` in CI, right after the mount (bean `zru7`).
# The pinned theme writes `<html lang="en-US">` on EVERY page and no `dir`;
# this pass puts each page's own locale back from its `fa-translation-meta`
# block. Without it the preview shows every translated page as English and
# Arabic as left-to-right — a defect the published site does not have. Measured
# cost, 2026-09-30: a high-priority accessibility bean (`c1lo`) filed against
# exactly that, a duplicate of the fixed `zru7`, scrapped once CI's pass was run.
echo "preview-site: putting each page's own locale on <html>"
bun run "$here/set-html-lang.ts" --site "$dest" 2>&1 | sed 's/^/  /' || true

# The QA evidence, as `docs-site.yml` publishes it (bean `tfqf`, F6): FETCH,
# copy, VERIFY. The witnesses are served from `/assets/qa/` (what every
# `data-qa-src` says); without them every badge fetch 404s, and `paintQaBadges`
# renders that as `unknown` — "could not determine", not "not swept".
#
# The fetch asks `qa-reports` for the newest `main` entry. While
# `test/results/` is committed the checkout wins and nothing in it is touched;
# when the corpus is ABSENT a hit is materialised into the checkout's
# `test/results/` paths (that is what `qa:fetch` does), and a miss is SAID —
# this used to skip the copy silently and leave every badge `unknown`.
# `verify` then counts what landed and writes `assets/qa/availability.json`.
qa_state="$(mktemp /tmp/preview-qa-state-XXXXXX.json)"
(cd "$repo" && bun run "$here/qa-site-assets.ts" fetch --ref main \
  --results cat-harness/test/results --state "$qa_state") 2>&1 | sed 's/^/  /' || true
mkdir -p "$dest/assets/qa"
if [ -d "$repo/cat-harness/test/results/witnesses" ]; then
  cp -rT "$repo/cat-harness/test/results/witnesses" "$dest/assets/qa"
fi
if [ -d "$repo/cat-harness/test/results" ]; then
  find "$repo/cat-harness/test/results" -maxdepth 1 -name '*.qa-results.json' -exec cp {} "$dest/assets/qa/" \;
fi
if ! (cd "$repo" && bun run "$here/qa-site-assets.ts" verify --site "$dest" \
      --results cat-harness/test/results --state "$qa_state") 2>&1 | sed 's/^/  /'; then
  echo "preview-site: the QA evidence check FAILED — see above; badges may render \`unknown\`." >&2
fi
rm -f "$qa_state"

# The knowledge graph and the glossary, at the paths the launcher's tiles point
# at. The stub is ASKED FOR rather than assumed — `print-stub.ts` is what CI
# uses, and hardcoding `cat-harness` here would be a second answer to a
# question the declaration already settles.
stub="$(bun run "$here/print-stub.ts" "$repo/cat-harness" 2>/dev/null | tr -d '[:space:]')"
if [ -n "$stub" ]; then
  bun run "$here/kg-export.ts" --out "$dest/$stub.jsonld" >/dev/null 2>&1 \
    && cp "$dest/$stub.jsonld" "$dest/$stub.json" \
    && echo "preview-site: exported $stub.jsonld (+ the .json twin Pages needs)"
  bun run "$here/glossary-export.ts" --out "$dest/$stub-glossary.jsonld" >/dev/null 2>&1 \
    && cp "$dest/$stub-glossary.jsonld" "$dest/$stub-glossary.json" || true
fi

echo
echo "preview-site: STILL NOT DONE HERE, so a 404 on one of these is expected:"
echo "  - the TypeDoc API reference        (a toolchain run, minutes)"
echo "  - bootstrap's own graph + glossary (\`--instance ./bootstrap\` variants)"
echo "  - the kg-viewer page and the schema export"
echo "  - the staging banner and its \`STAGING/<branch>/\` prefix"
echo "  - the pinned REMOTE theme          (see WHAT THIS IS NOT, above)"
echo "    To see the REAL build instead of this one, take the staging"
echo "    preview off gh-pages -- it is committed, so git reaches it even"
echo "    where the proxy refuses the published URL:"
echo "      git fetch origin gh-pages"
echo "      git archive FETCH_HEAD:STAGING/<slug> | tar -x -C d/<base>/STAGING/<slug>"
echo "    Serve it at THAT path: the pages address assets under the staging"
echo "    baseurl, so mounting them anywhere else 404s every stylesheet and"
echo "    still renders a page a careless check calls a pass (measured"
echo "    2026-09-23, bean vfr8)."
echo "  - a SITE-WIDE default layout. Measured 2026-09-23 (bean \`ga8a\`):"
echo "    \`actions/jekyll-build-pages\` applies \`layout: default\` to every"
echo "    page, and a plain \`jekyll build\` does not. A page whose front"
echo "    matter names no layout therefore renders BARE here and themed in"
echo "    CI — smart-trust's 674 artefact pages are 2.3 KiB each locally"
echo "    against ~164 KiB published, so this build under-represents that"
echo "    subtree by roughly 108 MB. Size measured here is a FLOOR, never"
echo "    the published figure; measure a size question on gh-pages."
echo "  Authority is \`.github/workflows/docs-site.yml\`; this list is a"
echo "  convenience and can go stale, so check there before concluding."

echo
echo "preview-site: built. Some things worth opening:"
for p in index.html platform.html cat-harness/index.html cat-harness/voices/index.html; do
  [ -f "$dest/$p" ] && printf '  %-34s %s bytes\n' "$p" "$(wc -c < "$dest/$p" | tr -d ' ')"
done
echo
echo "  Serve it:  python3 -m http.server -d $dest 8099"
echo "  Anchors:   grep -o 'href=\"#[^\"]*\"' $dest/cat-harness/index.html | sort -u | head"
