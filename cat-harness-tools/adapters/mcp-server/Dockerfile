# QOU Paper Writing Assistant — Unified Docker Image
#
# Single image for both the folio MCP server AND all CI/CD workflows.
# Includes: Bun, TeX Live (full), Pandoc, Lean 4, lean-lsp-mcp,
#           hecke-engine (Rust), ripgrep, graphviz, latexdiff,
#           gh CLI, Python + requests
#
# Build:
#   docker build -t paper-assistant -f cat-harness-tools/adapters/mcp-server/Dockerfile .
#
# Run (MCP server — stdio mode):
#   docker run -i --rm paper-assistant --stdio
#
# Run (MCP server — HTTP mode):
#   docker run -d -p 8080:8080 paper-assistant --http
#
# Run (CI toolbox — override entrypoint):
#   docker run --rm --entrypoint "" -v $(pwd):/workspace -w /workspace paper-assistant <command>
#
# The image expects the repo to be mounted at /workspace or baked in at build time.

FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/root
ENV PATH="/root/.bun/bin:/root/.elan/bin:/root/.local/bin:${PATH}"

# ── System dependencies ──────────────────────────────────────────
# Everything needed for: MCP server, PDF build, Lean build, CI scripts.
# All apt-installed packages live in a single layer:
#   - base toolchain (curl/git/jq/...)
#   - TeX Live full + LaTeX helpers
#   - document tools (pandoc, latexdiff, graphviz, poppler-utils)
#   - ripgrep (lean-lsp-mcp local search)
#   - Python (uv/lean-lsp-mcp + CI scripts)
#   - GitHub CLI (PR comments in CI; needs a third-party apt source)
#   - GMP/MPFR/MPC runtime libs (for the hecke-engine binaries copied
#     in from the hecke-build stage; -dev packages stay in that stage)
#
# Combining these into one RUN avoids three round-trips through
# `apt-get update` and `rm -rf /var/lib/apt/lists/*`, drops two
# layers from the final image, and trims ~50 MB of apt-list cruft
# that survives separate `&& rm -rf` invocations.
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget git unzip jq \
        texlive-full latexmk \
        pandoc latexdiff graphviz \
        poppler-utils \
        ripgrep \
        python3 python3-pip \
        libgmp10 libmpfr6 libmpc3 \
    && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       | tee /etc/apt/sources.list.d/github-cli.list >/dev/null \
    && apt-get update -qq && apt-get install -y -qq gh \
    && rm -rf /var/lib/apt/lists/*

# ── Python packages: the GENERATED set, never a retyped list ────
# `cat-harness-tools/python/requirements.txt` is written from
# `cat-harness/schemas/python-deps.ts`; `bun run deps:python:check` fails
# if this image names a declared package itself (bean ar1s, phase 2).
COPY cat-harness-tools/python/requirements.txt /tmp/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir \
    -r /tmp/requirements.txt

# ── Bun ──────────────────────────────────────────────────────────

RUN curl -fsSL https://bun.sh/install | bash

# ── uv (Python package manager, for lean-lsp-mcp) ───────────────

RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# ── Pre-warm TeX font/format caches ─────────────────────────────
# Running a minimal compile ensures font maps, format files, and
# kpathsea databases are fully built inside the image.
RUN mkdir -p /tmp/texwarm && \
    printf '\\documentclass{report}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{amsmath,amssymb,amsthm,mathtools}\n\\usepackage{hyperref}\n\\usepackage{graphicx}\n\\usepackage{cite}\n\\usepackage{titlesec}\n\\usepackage{tikz}\n\\usepackage{tikz-cd}\n\\usepackage[dvipsnames]{xcolor}\n\\begin{document}\nHello.\n\\end{document}\n' \
      > /tmp/texwarm/warm.tex && \
    cd /tmp/texwarm && \
    pdflatex -interaction=nonstopmode warm.tex && \
    rm -rf /tmp/texwarm

# ── Verify base tools ───────────────────────────────────────────
RUN echo "=== Base tools ===" && \
    bun --version && \
    pdflatex --version | head -1 && \
    latexmk --version | head -1 && \
    dvisvgm --version | head -1 && \
    pandoc --version | head -1 && \
    gh --version | head -1 && \
    python3 --version && \
    python3 -c "import requests; print(f'requests {requests.__version__}')"

# ── Hecke engine (Rust, multi-stage) ─────────────────────────────
# Build all hecke-engine binaries in an isolated stage; only the
# stripped executables are copied into the final image.

FROM base AS hecke-build

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    build-essential \
    m4 \
    libgmp-dev \
    libmpfr-dev \
    libmpc-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Rust via rustup (minimal profile — no docs/clippy/rustfmt)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

COPY tools/hecke-engine/ /build/hecke-engine/

# Build all release binaries and collect them in /hecke-bins
RUN cd /build/hecke-engine && cargo build --release && \
    mkdir -p /hecke-bins && \
    find target/release -maxdepth 1 -type f -executable -name 'hecke*' \
      -exec cp {} /hecke-bins/ \;

# ── pyhecke-native wheel, built from THIS tree ──────────────────
#
# Built here, in the same stage and from the same source as the
# hecke-engine binaries, so the wheel in the image cannot disagree
# with the engine it was compiled from.
#
# Why this exists: on 2026-08-09 the pyhecke_native installed in a
# session container returned trace convention C
# (markov_z(q0) = 0.4993203341836945) while tools/hecke-engine/src/gram.rs
# read convention D — the wheel predated the C -> D migration
# (litlfred/qou b5f4cb5b9) by a day. Source review could not see it,
# the content-layer QA axis passed, the registry was correct, and only
# calling the binary exposed it. Because the standing rule in that folio
# is "never hand-edit witness numbers, regenerate from the producer",
# a stale wheel turns the remediation into a reintroduction vector:
# fresh convention-C numbers, stamped into witnesses with a producer's
# authority.
#
# The wheel was NOT previously built here at all, so whatever wheel a
# container ended up with came from outside the image and could drift
# arbitrarily. Building it in-stage removes that degree of freedom
# rather than merely detecting it.
#
# --no-default-features drops the clarabel-lp backend (the litlfred
# Clarabel.rs fork), which is unreachable from restricted-network
# builders and is NOT needed by the Gram / seminormal / Markov-trace
# primitives — only by `operator_selection_lp`. Callers that need the LP
# should install the default-feature wheel separately; see
# tools/pyhecke-native/README.md §"Clarabel (litlfred fork)".
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
        python3-dev python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages --no-cache-dir maturin

COPY tools/pyhecke-native/ /build/pyhecke-native/
COPY docs/coordination/trace-convention-registry.json /build/registry.json

RUN cd /build/pyhecke-native \
    && maturin build --release --no-default-features \
    && mkdir -p /hecke-wheels \
    && find target/wheels -name 'pyhecke_native*.whl' -exec cp {} /hecke-wheels/ \;

# ── Lean 4 (via elan) ───────────────────────────────────────────

FROM base AS lean-setup

WORKDIR /workspace

# Copy root toolchain file first to cache the Lean download.
# The root toolchain is the single source of truth for the folio
# Lake workspace; each paper's per-package toolchain matches it.
COPY lean-toolchain ./lean-toolchain

RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | \
    sh -s -- -y --default-toolchain none && \
    elan toolchain install $(cat lean-toolchain)

# ── Project setup ────────────────────────────────────────────────

FROM lean-setup AS project

WORKDIR /workspace

# Copy dependency files first (better caching).
# The root lakefile aggregates all paper packages; copying it plus
# every per-paper lakefile lets `lake exe cache get` warm Mathlib
# and resolve the path-based [[require]] stanzas without pulling
# in the rest of the source tree (which would bust the layer
# cache on any unrelated change).
COPY lakefile.toml ./
COPY content/quantum-observable-universe/lean/lakefile.toml \
     content/quantum-observable-universe/lean/lean-toolchain \
     content/quantum-observable-universe/lean/lake-manifest.json \
     content/quantum-observable-universe/lean/
COPY content/unital-groebner-bases/lean/lakefile.toml \
     content/unital-groebner-bases/lean/lean-toolchain \
     content/unital-groebner-bases/lean/
COPY content/fred2005-formal-groups/lean/lakefile.toml \
     content/fred2005-formal-groups/lean/lean-toolchain \
     content/fred2005-formal-groups/lean/
COPY scripts/mcp-server/package.json scripts/mcp-server/
COPY content/package.json content/

# Copy pre-built hecke-engine binaries from the Rust build stage
COPY --from=hecke-build /hecke-bins/ /usr/local/bin/

# ── pyhecke-native: install from THIS image's build, then gate it ───
#
# The install is deliberately NOT tolerated on failure, unlike the Lean
# steps above. A missing pyhecke_native degrades gracefully (producers
# have Python fallbacks); a pyhecke_native carrying the WRONG TRACE
# CONVENTION does not — it silently produces convention-C numbers that
# look like ordinary producer output. Fail the build instead.
COPY --from=hecke-build /hecke-wheels/ /tmp/hecke-wheels/
RUN pip3 install --break-system-packages --no-cache-dir \
        /tmp/hecke-wheels/pyhecke_native*.whl \
    && rm -rf /tmp/hecke-wheels

# Trace-convention gate. Compares the INSTALLED BINARY against the
# registry, which is the only check that can see a stale artifact:
# source review, the content-layer axis and the registry itself were all
# green while the binary was wrong. Reads z from the registry rather
# than a literal, so changing the production convention re-arms this
# automatically instead of grandfathering the old value.
COPY docs/coordination/trace-convention-registry.json /tmp/registry.json
RUN python3 - <<'PYGATE' && rm -f /tmp/registry.json
import json, sys
reg = json.load(open("/tmp/registry.json"))
q0 = float(reg["meta"]["q0"]["value"])
want = float(next(c for c in reg["conventions"] if c["id"] == "D")["z_at_q0"])
import pyhecke_native as pn
got = pn.markov_z(q0)
d = abs(got - want)
print(f"[pyhecke-native] markov_z(q0) = {got!r}")
print(f"[pyhecke-native] registry D   = {want!r}")
print(f"[pyhecke-native] |difference| = {d:.3e}  (tol 1e-15, f64 path)")
if d > 1e-15:
    zc = 1.0 / (q0 ** 0.5 + q0 ** -0.5)
    if abs(got - zc) <= 1e-15:
        sys.exit("[pyhecke-native] FATAL: wheel is CONVENTION C. The image would "
                 "ship a producer that silently reintroduces the excised convention.")
    sys.exit("[pyhecke-native] FATAL: wheel matches neither convention D nor C.")
print("[pyhecke-native] convention D confirmed — wheel agrees with the registry.")
PYGATE

# Resolve dependencies and warm the Mathlib olean cache for the
# whole folio workspace (QOU + UGB + Fred2005).  Failures are
# tolerated (project policy: the image must still build with TeX,
# Bun, and hecke-engine usable even when Lean steps regress) but
# we surface a loud warning so a silently un-warmed image is
# obvious in the build log.
RUN lake update \
    || echo "WARNING: 'lake update' failed; manifest may be stale" >&2; \
    lake exe cache get \
    || echo "WARNING: 'lake exe cache get' failed; Mathlib oleans NOT pre-warmed — first lean_build inside the container will be slow" >&2
RUN cd scripts/mcp-server && bun install
RUN cd content && bun install

# Copy full repo
COPY . .

# Build the entire folio workspace from the root. `lake build`
# with no target builds `defaultTargets = ["QOU", "UGB", "Fred2005"]`,
# baking oleans for every paper into the image.  Failures are
# tolerated for the same project-policy reason as `lake update`
# above, but we surface a loud warning so a partially-baked
# image is obvious in the build log.
RUN lake build \
    || echo "WARNING: 'lake build' failed; one or more paper packages did NOT compile — image will publish without warm oleans for the failing target(s)" >&2

# Verify lean-lsp-mcp works
RUN uvx lean-lsp-mcp --help > /dev/null 2>&1 || echo "lean-lsp-mcp not yet cached"

# Verify hecke-engine binaries
RUN hecke-engine --help > /dev/null 2>&1 || echo "hecke-engine not available"

# ── Runtime ──────────────────────────────────────────────────────

WORKDIR /workspace/scripts/mcp-server

EXPOSE 8080

ENTRYPOINT ["bun", "run", "server.ts"]
CMD ["--http"]
