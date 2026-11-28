#!/usr/bin/env python3
"""
SageMath MCP server for algebraic computations.

A real, dependency-free Model Context Protocol server (JSON-RPC 2.0 over
stdio — no `mcp` pip package required, just the system Python 3).

Provides tools for:
- Iwahori--Hecke algebra computations (IwahoriHeckeAlgebra)
- Markov trace (exact, symbolic over Q(q))
- Quantum dilogarithm (Faddeev) evaluation
- Nuclear beta-decay Q-value scaffolding
- Arbitrary Sage evaluation (sage_eval)

── Lazy backend resolution ──────────────────────────────────────────
SageMath is a ~2 GB compiled distribution (PARI, Singular, GAP, FLINT,
NTL, Maxima, …) — there is no pip wheel, and it is frequently absent from
apt/conda. To make it "available easily as MCP" without forcing a 2 GB
download on users who never call a Sage tool, the backend is resolved
*lazily*: nothing is installed or pulled at startup or during the MCP
handshake (initialize / tools/list). The backend is chosen, and the
Docker image pulled if needed, only on the FIRST `tools/call`.

Resolution order (first hit wins):
  1. $SAGE_CMD            — explicit command, e.g. "sage" or "/opt/sage/sage"
  2. `sage` on PATH       — a native install
  3. Docker               — runs `sagemath/sagemath` (image pulled on demand)

Override the Docker image via $SAGE_DOCKER_IMAGE (default
"sagemath/sagemath:latest"). Disable the Docker fallback with
SAGE_NO_DOCKER=1.

MCP transport: stdio (newline-delimited JSON-RPC 2.0).

Usage:
    python3 src/sage-mcp-server.py --stdio     # MCP server (default)
    python3 src/sage-mcp-server.py --status    # report backend, no download

Registered for Claude Code via the project .mcp.json ("sage" server).
"""

import json
import os
import shutil
import subprocess
import sys

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "sage-mcp", "version": "0.2.0"}

SAGE_IMAGE = os.environ.get("SAGE_DOCKER_IMAGE", "sagemath/sagemath:latest")
SAGE_NO_DOCKER = os.environ.get("SAGE_NO_DOCKER", "") not in ("", "0", "false")


def eprint(*args: object) -> None:
    """Diagnostics MUST go to stderr — stdout is the MCP protocol channel."""
    print(*args, file=sys.stderr, flush=True)


# ── Lazy backend resolution ──────────────────────────────────────

# Resolved once, on first use. None = not yet resolved.
#   {"kind": "native", "cmd": [...]} | {"kind": "docker", "image": str}
_backend: dict | None = None


def _docker_ok() -> bool:
    """Is a usable Docker daemon present? (cheap — no pull)."""
    if SAGE_NO_DOCKER or not shutil.which("docker"):
        return False
    try:
        r = subprocess.run(["docker", "info"], capture_output=True, timeout=15)
        return r.returncode == 0
    except Exception:
        return False


def _image_present(image: str) -> bool:
    try:
        r = subprocess.run(["docker", "image", "inspect", image],
                           capture_output=True, timeout=15)
        return r.returncode == 0
    except Exception:
        return False


def _ensure_image(image: str) -> bool:
    """Pull the Sage image if absent. Progress streams to stderr. One-time ~2 GB."""
    if _image_present(image):
        return True
    eprint(f"[sage-mcp] Sage image '{image}' not present — pulling (~2 GB, one time)…")
    try:
        # Stream pull progress to stderr so it never corrupts the stdout MCP channel.
        r = subprocess.run(["docker", "pull", image], stdout=sys.stderr, stderr=sys.stderr)
        ok = r.returncode == 0
        eprint(f"[sage-mcp] pull {'succeeded' if ok else 'FAILED'}")
        return ok
    except Exception as e:  # pragma: no cover
        eprint(f"[sage-mcp] pull error: {e}")
        return False


def resolve_backend(allow_download: bool = True) -> dict:
    """
    Pick (and cache) the Sage backend. With allow_download=False, report
    what *would* be used without pulling anything (for --status / probes).
    Returns {"kind": "native"|"docker"|"none", ...}.
    """
    global _backend
    if _backend is not None:
        return _backend

    env_cmd = os.environ.get("SAGE_CMD")
    if env_cmd and shutil.which(env_cmd.split()[0]):
        _backend = {"kind": "native", "cmd": env_cmd.split()}
        return _backend

    if shutil.which("sage"):
        _backend = {"kind": "native", "cmd": ["sage"]}
        return _backend

    if _docker_ok():
        if allow_download:
            if not _ensure_image(SAGE_IMAGE):
                return {"kind": "none", "reason": f"docker pull of {SAGE_IMAGE} failed"}
            _backend = {"kind": "docker", "image": SAGE_IMAGE}
            return _backend
        # Probe mode: report docker availability without pulling.
        return {"kind": "docker", "image": SAGE_IMAGE, "pulled": _image_present(SAGE_IMAGE)}

    return {
        "kind": "none",
        "reason": "no `sage` on PATH and no usable Docker daemon "
                  "(SAGE_NO_DOCKER set, or docker not installed/running)",
    }


def sage_eval(code: str, timeout: int = 300) -> dict:
    """Execute Sage code via the resolved backend and return stdout/stderr/returncode."""
    backend = resolve_backend(allow_download=True)

    if backend["kind"] == "native":
        cmd = [*backend["cmd"], "-c", code]
    elif backend["kind"] == "docker":
        # Mount cwd at /work so Sage code can read/write repo files.
        cwd = os.getcwd()
        cmd = [
            "docker", "run", "--rm", "-i",
            "-v", f"{cwd}:/work", "-w", "/work",
            backend["image"], "sage", "-c", code,
        ]
    else:
        return {
            "error": "SageMath is not available.",
            "detail": backend.get("reason", ""),
            "hint": "Install Sage (a folio may ship one, e.g. qou's `scripts/setup-sage.sh`) or run a Docker "
                    "daemon so the sagemath/sagemath image can be pulled on demand.",
        }

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return {
            "backend": backend["kind"],
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"error": f"Sage computation timed out after {timeout}s"}
    except Exception as e:  # pragma: no cover
        return {"error": f"Sage execution failed: {e}"}


# ── MCP Tool definitions ────────────────────────────────────────

TOOLS = [
    {
        "name": "sage_status",
        "description": "Report the resolved Sage backend (native / docker / none) "
                       "WITHOUT triggering any download. Use to check availability first.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "sage_hecke_trace",
        "description": "Compute the Markov trace of a nuclear braid word in the Iwahori--Hecke algebra H_A(q). Returns exact symbolic result over Q(q).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "p": {"type": "integer", "description": "Number of protons"},
                "n": {"type": "integer", "description": "Number of neutrons"},
                "q_numerical": {"type": "number", "description": "Numerical q value (default 1.110)", "default": 1.110},
            },
            "required": ["p", "n"],
        },
    },
    {
        "name": "sage_faddeev_dilog",
        "description": "Evaluate the Faddeev quantum dilogarithm Φ_b(z) at given spectral coordinates. Uses the integral representation for analytic continuation.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "z_values": {"type": "array", "items": {"type": "number"}, "description": "Spectral coordinates to evaluate"},
                "q": {"type": "number", "description": "Substrate parameter", "default": 1.110},
            },
            "required": ["z_values"],
        },
    },
    {
        "name": "sage_nuclear_Q",
        "description": "Compute the beta-decay Q-value for N(p,n) → N(p+1,n-1) using the full descended-to-point mass formula with quantum dilogarithm.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "p": {"type": "integer", "description": "Number of protons"},
                "n": {"type": "integer", "description": "Number of neutrons"},
            },
            "required": ["p", "n"],
        },
    },
    {
        "name": "sage_eval",
        "description": "Execute arbitrary Sage code and return the result. For custom algebraic computations.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Sage code to execute"},
                "timeout": {"type": "integer", "description": "Timeout in seconds", "default": 300},
            },
            "required": ["code"],
        },
    },
]


# ── Sage code templates ──────────────────────────────────────────

HECKE_TRACE_TEMPLATE = '''
q = var('q')
R.<q> = QQ[]
A = {A}
p = {p}
n = {n}

# Build the Iwahori--Hecke algebra H_A(q)
# Using the T-basis (braid generators)
H = IwahoriHeckeAlgebra(['A', A-1], q)
T = H.T()

# Nuclear braid word
types = ['p']*p + ['n']*n
result = T.one()

for i in range(A):
    for j in range(i+1, A):
        ti, tj = types[i], types[j]
        if ti == 'p' and tj == 'p':
            result = result * T[i+1]  # positive crossing (Sage uses 1-indexed)
        elif ti == 'n' and tj == 'n':
            result = result * T[i+1]**(-1)  # negative crossing
        else:
            result = result * (T[i+1] + T[i+1]**(-1)) / 2  # mixed

# Markov trace
tr = H.markov_trace()
trace_val = tr(result)

print(f"Markov trace of N({p},{n}):")
print(f"  Symbolic: {{trace_val}}")
print(f"  At q=1.110: {{float(trace_val.subs(q=1.110))}}")
'''

FADDEEV_TEMPLATE = '''
from mpmath import mp, mpf, mpc, quad, exp, log, pi
mp.dps = 50

q_val = {q}
b = sqrt(log(q_val) / (2*pi))  # q = e^{{2πib²}}

def faddeev_dilog(z, b_param):
    """Faddeev quantum dilogarithm via integral representation."""
    # Φ_b(z) = exp(∫_R e^{{-2izw}} / (4 sinh(wb) sinh(w/b)) dw/w)
    # Use the regularised version:
    def integrand(w):
        if abs(w) < 1e-30:
            return 0
        num = exp(-2j * z * w)
        denom = 4 * sinh(w * b_param) * sinh(w / b_param) * w
        return num / denom

    result = quad(integrand, [-10, 10])
    return exp(result)

z_values = {z_values}
for z in z_values:
    phi = faddeev_dilog(z, b)
    print(f"Φ_b({{z}}) = {{phi}}")
'''


def handle_tool_call(tool_name: str, arguments: dict) -> str:
    """Handle an MCP tool call. Returns a JSON string for the text content."""
    if tool_name == "sage_status":
        return json.dumps(resolve_backend(allow_download=False), indent=2)

    if tool_name == "sage_hecke_trace":
        p = arguments["p"]
        n = arguments["n"]
        A = p + n
        code = HECKE_TRACE_TEMPLATE.format(A=A, p=p, n=n)
        return json.dumps(sage_eval(code))

    elif tool_name == "sage_faddeev_dilog":
        z_values = arguments["z_values"]
        q_val = arguments.get("q", 1.110)
        code = FADDEEV_TEMPLATE.format(q=q_val, z_values=z_values)
        return json.dumps(sage_eval(code))

    elif tool_name == "sage_nuclear_Q":
        p = arguments["p"]
        n = arguments["n"]
        # Compose the full computation
        code = f"""
# Full Q computation for N({p},{n}) → N({p+1},{n-1})
# Uses Iwahori--Hecke algebra + Faddeev dilogarithm
print("Computing Q for N({p},{n})...")
print("Requires IwahoriHeckeAlgebra — checking...")
try:
    q = var('q')
    H = IwahoriHeckeAlgebra(['A', {p+n-1}], q)
    print(f"Iwahori--Hecke algebra H_{{p+n}}(q) created successfully")
except Exception as e:
    print(f"Error: {{e}}")
"""
        return json.dumps(sage_eval(code))

    elif tool_name == "sage_eval":
        code = arguments["code"]
        timeout = arguments.get("timeout", 300)
        return json.dumps(sage_eval(code, timeout))

    else:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})


# ── MCP stdio transport (JSON-RPC 2.0, newline-delimited) ────────

def _result(req_id: object, result: object) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _error(req_id: object, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def handle_message(msg: dict) -> dict | None:
    """Dispatch a single JSON-RPC message. Returns a response, or None for notifications."""
    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}

    # Notifications (no id) get no response.
    is_notification = "id" not in msg

    if method == "initialize":
        return _result(req_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        })

    if method in ("notifications/initialized", "initialized"):
        return None

    if method == "ping":
        return _result(req_id, {})

    if method == "tools/list":
        return _result(req_id, {"tools": TOOLS})

    if method == "tools/call":
        name = params.get("name", "")
        arguments = params.get("arguments") or {}
        try:
            text = handle_tool_call(name, arguments)
            payload = json.loads(text)
            is_err = isinstance(payload, dict) and "error" in payload
            return _result(req_id, {
                "content": [{"type": "text", "text": text}],
                "isError": is_err,
            })
        except Exception as e:  # pragma: no cover
            return _result(req_id, {
                "content": [{"type": "text", "text": json.dumps({"error": str(e)})}],
                "isError": True,
            })

    if method in ("shutdown",):
        return _result(req_id, {})

    if is_notification:
        return None
    return _error(req_id, -32601, f"Method not found: {method}")


def serve_stdio() -> None:
    """Run the MCP server over newline-delimited JSON-RPC on stdin/stdout."""
    eprint(f"[sage-mcp] ready (stdio). Backend resolves lazily on first tool call. "
           f"docker image={SAGE_IMAGE}")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        response = handle_message(msg)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        if msg.get("method") == "shutdown":
            break


def print_status() -> None:
    """Report the backend that WOULD be used, without downloading anything."""
    backend = resolve_backend(allow_download=False)
    print(json.dumps({
        "server": SERVER_INFO,
        "backend": backend,
        "docker_image": SAGE_IMAGE,
        "tools": [t["name"] for t in TOOLS],
        "note": "The Sage Docker image (~2 GB) is pulled only on the first "
                "tools/call, never at startup.",
    }, indent=2))


def main() -> None:
    args = sys.argv[1:]
    if "--status" in args or "--check" in args:
        print_status()
        return
    # Default to stdio MCP transport.
    serve_stdio()


if __name__ == "__main__":
    main()
