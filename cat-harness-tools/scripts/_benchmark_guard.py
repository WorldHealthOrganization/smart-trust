"""
Guard against benchmark outputs writing into declared knowledge-graph directories.

Bean: folio-assistant-wp49 ("TEST MODE: benchmarking output is a report, and deliberately not KG content")
Issue: #363
"""

from __future__ import annotations

import json
import os
import sys

DEFAULT_GRAPH_DIRECTORIES = [
    "validators",
    "tools",
    "external-schemas",
    "subscriptions",
    "code-lists",
    "vocab-mappings",
    "tool-releases",
    "schemas",
    "uml",
    "skills",
    "scenarios",
    "policies",
    "processes",
    "methodologies",
    "test/results",
    "test/attestations",
    "test/health/results",
    "uploads",
    "library",
    "translations",
    "folio",
    "docs",
    "site",
    "glossary",
    "scripts",
    "src",
    "adapters",
    "test",
    "templates",
    "deploy",
    "upstream",
    "openapi",
    "memory",
    "fsh-guts",
    "beans",
    "todos",
    "issue-marks",
]


def get_declared_graph_dirs(root_dir: str | None = None) -> list[str]:
    dirs = set(DEFAULT_GRAPH_DIRECTORIES)
    if not root_dir:
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    candidates = [
        os.path.join(root_dir, "cat-harness.json"),
        os.path.join(root_dir, "cat-harness", "cat-harness.json"),
        os.path.join(root_dir, "..", "cat-harness.json"),
    ]
    for c in candidates:
        if os.path.isfile(c):
            try:
                with open(c, "r", encoding="utf-8") as f:
                    decl = json.load(f)
                if isinstance(decl.get("directories"), list):
                    for d in decl["directories"]:
                        if isinstance(d, dict) and isinstance(d.get("path"), str):
                            clean = d["path"].strip("/")
                            if clean:
                                dirs.add(clean)
            except Exception:
                pass
            break
    # Sort longest path first so specific subpaths match before parent directories
    return sorted(dirs, key=lambda d: (-len(d), d))


def is_declared_graph_path(target_path: str, root_dir: str | None = None) -> tuple[bool, str | None]:
    norm = os.path.normpath(target_path).replace("\\", "/").lstrip("./")
    graph_dirs = get_declared_graph_dirs(root_dir)

    for g in graph_dirs:
        norm_g = g.strip("/")
        if norm == norm_g or norm.startswith(norm_g + "/"):
            return True, norm_g

    if root_dir:
        abs_root = os.path.abspath(root_dir)
        abs_target = (
            os.path.abspath(target_path)
            if os.path.isabs(target_path)
            else os.path.abspath(os.path.join(root_dir, target_path))
        )
        try:
            rel = os.path.relpath(abs_target, abs_root).replace("\\", "/")
            if not rel.startswith(".."):
                for g in graph_dirs:
                    norm_g = g.strip("/")
                    if rel == norm_g or rel.startswith(norm_g + "/"):
                        return True, norm_g
        except ValueError:
            pass

    return False, None


def assert_not_declared_graph_path(target_path: str, root_dir: str | None = None) -> None:
    is_graph, matched = is_declared_graph_path(target_path, root_dir)
    if is_graph:
        raise ValueError(
            f"Benchmark output path '{target_path}' resolves inside declared graph directory '{matched}'. "
            f"Benchmarking output is a report about model performance, not KG content, and is deliberately excluded from "
            f"declared graphs (folio-assistant-wp49, #363). Default your output to build/benchmarks/ or reports/."
        )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: _benchmark_guard.py <target-path> [root-dir]", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[1]
    root = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        assert_not_declared_graph_path(path, root)
        print(f"OK: '{path}' is not a declared graph path")
        sys.exit(0)
    except ValueError as e:
        print(f"REFUSED: {e}", file=sys.stderr)
        sys.exit(1)
