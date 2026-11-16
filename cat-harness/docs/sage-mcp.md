# Sage as an MCP server (lazily loaded)

> One service among several. Composing several Tool nodes into one MCP service
> — naming, collisions, grouping, versioning — is
> [`mcp-assembly`](reference/skill-instructions/mcp-assembly.html); verifying a
> projected server's tools against the Tool nodes they came from is
> [`mcp-contract`](reference/skill-instructions/mcp-contract.html).

[SageMath](https://www.sagemath.org/) is exposed as a Model Context Protocol
server so agents can call algebra / number-theory tools (Iwahori–Hecke trace,
Faddeev quantum dilogarithm, nuclear β-decay scaffolding, and arbitrary
`sage_eval`).

Sage is a **~2 GB compiled distribution** — there is no pip wheel, and it is
often missing from apt/conda. To keep it "available easily" without forcing that
download on anyone who never uses it, the backend is resolved **lazily**:
nothing is installed or pulled at startup or during the MCP handshake. The
backend is chosen — and the Docker image pulled if needed — only on the **first
actual tool call**.

Backend resolution order (first hit wins):

1. `$SAGE_CMD` — explicit command (e.g. `sage`, `/opt/sage/sage`)
2. `sage` on `PATH` — a native install
3. **Docker** — runs `sagemath/sagemath` (image pulled on demand)

Env knobs: `SAGE_DOCKER_IMAGE` (default `sagemath/sagemath:latest`),
`SAGE_NO_DOCKER=1` (disable the Docker fallback), `SAGE_CMD` (force a command).

Server source: [`src/sage-mcp-server.py`](https://github.com/litlfred/cat-harness-tools/blob/main/src/sage-mcp-server.py) — a
dependency-free JSON-RPC 2.0 stdio server (system Python 3, no `mcp` package).

## Mode 1 — local / dev (Claude Code)

Already wired. The project [`.mcp.json`](https://github.com/litlfred/folio-assistant/blob/main/.mcp.json) registers the `sage`
server via `cat-harness-tools/scripts/sage-mcp.sh`. Registration costs nothing; on the first Sage
tool call the script uses a native `sage` if present, otherwise pulls and runs
the Docker image (mounting the current dir at `/work`).

Check the backend without triggering any download:

```sh
python3 src/sage-mcp-server.py --status
```

Pre-warm the Docker image ahead of time (optional, so the first call isn't slow):

```sh
docker pull sagemath/sagemath:latest   # the image the server pulls (override: SAGE_DOCKER_IMAGE)
```

## Mode 2 — deployed stack (docker compose)

`deploy/docker-compose.yml` defines a `sage` service behind a Compose
**profile**, sharing a `sage_workspace` volume (mounted at `/shared`) with
`folio-assistant`. Because it's profile-gated, a plain `docker compose up` never
starts or pulls it — it activates only on demand:

```sh
# Persistent Sage service (pulls the image the first time this runs):
docker compose --profile sage up -d sage

# Or spawn the Sage MCP server (stdio) on demand inside the service,
# where `sage` is native (no nested Docker) and the repo is at /repo:
docker compose --profile sage run --rm -i sage \
  python3 /repo/folio-assistant/src/sage-mcp-server.py --stdio
```

Files written under `/shared` are visible to `folio-assistant`; the repo is
mounted read-only at `/repo`.

> Note on topology: folio-assistant's deployed stack is a *web* topology
> (Caddy → auth-gateway → folio-assistant), not one container per compute tool.
> Most compute tools (LaTeX, Lean, Python) are baked into the monolithic
> `folio-assistant` image; Sage is kept out of it (size) and supplied as this
> opt-in, lazily-pulled sidecar instead.
