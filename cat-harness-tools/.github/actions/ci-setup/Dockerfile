# The prepared CI image (ghcr.io/<owner>/<repo>-ci:<key>, key from
# key.sh). It is a FILE CARRIER, not an environment: FROM scratch, nothing in it
# runs, and no job executes inside it. The ci-setup action (this directory) streams its
# layers straight onto the runner — the mounted layers and node_modules into
# the workspace, Playwright's Chromium into ~/.cache/ms-playwright — so a job
# keeps the runner's own tools (Java, Python, Ruby, apt) and its paths.
#
# Built by the sibling `ci-image` action from a context that prepare.sh lays
# out: layers/<n>/ holds one layer's files, and the label says where each
# layer goes. Several layers, because a registry serves layers in parallel and
# ci-setup fetches and unpacks them concurrently.
#
# No secrets: every file comes from a public repository at the commit the
# committed lock pins, or from the public npm registry through bun.lock.
FROM scratch
# The repository the package is linked to on GHCR; build.sh passes it, so the
# recipe carries no repository name and any harness repo can build its own.
ARG SOURCE
LABEL org.opencontainers.image.source="${SOURCE}"
LABEL org.opencontainers.image.description="CI setup: mounted layers, node_modules and Chromium, keyed by cat-harness-tools .github/actions/ci-setup/key.sh"
LABEL ci-image.layers="ws ws ws ws ws pw pw"
COPY layers/1/ /
COPY layers/2/ /
COPY layers/3/ /
COPY layers/4/ /
COPY layers/5/ /
COPY layers/6/ /
COPY layers/7/ /
