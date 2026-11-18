---
name: blocked-build-dependencies
description: >
  A build or a model download fails from an agent container. Read which of
  three different refusals it is before doing anything — a policy denial (403
  on CONNECT), an upstream rate limit (429), or a host that is simply down —
  because each has a different remedy. Covers the Maven Central mirror that
  gets a Gradle or Maven build through a 429, which hosts were measured open
  and shut, and when the work belongs to an agent with different network
  access instead.
adapters: [document, paper, dak]
profiles: [document, paper]
---

# Blocked build dependencies — read the refusal before you work around it

Outbound HTTPS from an agent container goes through a proxy. A failed download
looks the same from a build log whatever caused it, and the three causes have
nothing in common:

| what you see | what it is | what to do |
|---|---|---|
| `CONNECT tunnel failed, response 403`, curl `000` | **policy**: the environment's network settings deny the host | nothing in the container fixes it. Say which host, point the person at the environment's network settings, or hand the step to an agent that has the access (below) |
| HTTP `429 Too Many Requests` | **the upstream** is rate-limiting the shared egress address | use a mirror of the same content (below). Retrying the same host usually fails again |
| timeouts, `5xx` | the host, or the route to it | retry with backoff, then try a mirror |

**Ask the proxy, not the log.** `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
lists `recentRelayFailures` with the host and the kind of refusal; a
`connect_rejected` there is policy, full stop. Never disable TLS verification
or unset the proxy to get past any of these.

## Maven Central through a 429

Measured 2026-10-06, building Grobid from source:

| host | result |
|---|---|
| `repo.maven.apache.org` | **429** — Gradle's default `mavenCentral()`; the build failed in 28 s |
| `repo1.maven.org` | 200 (intermittently 429 earlier the same hour) |
| `maven-central.storage-download.googleapis.com` | 200 — Google's mirror of Maven Central |
| `plugins.gradle.org`, `services.gradle.org` | 200 |

**Gradle:** pass the init script, which repoints every repository and plugin
lookup at the mirror without touching the project's build files:

```sh
./gradlew build --init-script cat-harness-tools/scripts/gradle-maven-mirror.init.gradle
```

With it the same Grobid build succeeded in 3 min 45 s. `-Dmaven.mirror=<url>`
picks another mirror.

**Maven:** the equivalent is a `<mirror>` in `~/.m2/settings.xml` with
`<mirrorOf>central</mirrorOf>` and the same URL.

**Do not commit the mirror into a project's build files.** The 429 is a
property of this egress path, not of the project; CI runners reach Maven
Central directly.

## Hosts that are policy, not load

Measured from the same container on the same day — re-check before relying on
it, because the policy is the environment's and can change:

- **`huggingface.co`: denied (403 on CONNECT).** Model weights live there
  (Nougat, most transformer checkpoints). The code installs from PyPI; the
  weights do not.
- **`codeload.github.com` archives: denied.** github.com **release assets**
  were denied on 2026-10-06 and answered **200** on 2026-10-09 — re-check, and
  prefer [`finding-software`](finding-software.md)'s pinned, checksummed
  release rung when it is open. `git clone` over HTTPS **works** either way.
- **PyPI and npm: open.**

A change to the environment's network settings may not reach a container that
is already running. When it does not, **hand the step to an agent that has the
access** rather than stall: open a work item whose steps run end to end without this
session (install, run, the exact scoring command, where the result goes), and
give the person a one-line instruction of the form *"do bean X on branch Y of
repo Z"* ([`agent-handoff`](agent-handoff.md)). Code the step needs, such as a
reader for the tool's saved output, lands first, in this session, so the other
agent only runs the tool.

## Running code from outside the repository

Cloning and building a third-party project is running code nobody here wrote.
Do it only when the person has asked for that tool by name, keep it under the
scratch directory rather than the repository, and commit only what reads its
OUTPUT. A session's permission check may refuse the clone until the person
says to go ahead.
