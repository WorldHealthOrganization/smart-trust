#!/usr/bin/env python3
"""Serve an instance's renderings over local HTTP with their DECLARED media types.

Satisfies `skills/requirements/serving-a-rendering.json` (`req:serving-a-rendering`).
Bean `folio-assistant-0hi8`, issue #363.

This is the second tool satisfying `req:serving-a-rendering`, providing a Python 3
standard-library implementation alongside `scripts/serve-rendering.ts`.

## Conformance to `serving-a-rendering.json`:
- `declared-media-type`: Sets Content-Type from `RENDERING_MEDIA_TYPES`.
- `compound-extension-wins`: `.schema.json` resolves before `.json` to
  `application/schema+json`.
- `bare-stub-opens`: A request for `<stub>/` resolves to `index.html` as `text/html`.
- `alias-is-byte-identical`: Files are served without synthesis or mutation.
- `undeclared-is-not-forced`: Unknown files fall back to standard MIME inference
  (via `mimetypes`), never forcing `application/octet-stream`.
- `contained`: Lexical and realpath checks ensure no file outside the served root
  can be accessed via traversal or symbolic links.
- `loopback-by-default`: Binds 127.0.0.1 unless explicit host is requested.

Usage:
  python3 scripts/serve-rendering.py [--dir <path>] [--port <n>] [--host <iface>]
"""

from __future__ import annotations

import argparse
import http.server
import mimetypes
import os
import posixpath
import re
import sys
import urllib.parse
from typing import Any

RENDERING_MEDIA_TYPES: tuple[tuple[str, str], ...] = (
    (".schema.json", "application/schema+json"),
    (".jsonld", "application/ld+json"),
    (".json", "application/json"),
    (".html", "text/html"),
)


def rendering_media_type(path: str) -> str | None:
    """Return declared media type for path if matching RENDERING_MEDIA_TYPES, else None."""
    lower = path.lower()
    for ext, media_type in RENDERING_MEDIA_TYPES:
        if lower.endswith(ext):
            return media_type
    return None


def resolve_within(root: str, url_path: str) -> str | None:
    """Resolve a URL path to a lexical path inside root, or None if malformed or escaping.

    Absorbs leading `..` segments against a virtual root `/`.
    Rejects malformed percent-escapes (e.g. `/%zz`) and NUL bytes.
    """
    if re.search(r"%(?![0-9a-fA-F]{2})", url_path):
        return None
    try:
        decoded = urllib.parse.unquote(url_path)
    except Exception:
        return None
    if "\0" in decoded:
        return None

    base = os.path.abspath(root)
    norm = posixpath.normpath("/" + decoded.lstrip("/"))
    rel = norm.lstrip("/")
    target = os.path.abspath(os.path.join(base, rel))

    if target != base and not target.startswith(base + os.sep):
        return None
    return target


def resolve_file(root: str, url_path: str) -> str | None:
    """Resolve a URL path to an existing filesystem file within root, or None.

    Verifies filesystem containment using realpath so that symlinks pointing
    outside root are refused. Also resolves directory index (`index.html`).
    """
    target = resolve_within(root, url_path)
    if not target or not os.path.exists(target):
        return None

    try:
        base = os.path.realpath(root)
        real = os.path.realpath(target)
    except OSError:
        return None

    if real != base and not real.startswith(base + os.sep):
        return None

    if os.path.isdir(real):
        index = os.path.join(real, "index.html")
        if not os.path.exists(index):
            return None
        try:
            real_index = os.path.realpath(index)
        except OSError:
            return None
        if real_index != base and not real_index.startswith(base + os.sep):
            return None
        return real_index

    return real


class RenderingHTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    """HTTP request handler serving renderings with declared media types and strict containment."""

    root: str = "."

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress standard stderr request logging unless explicitly overridden."""
        pass

    def do_HEAD(self) -> None:
        self._handle_request(is_head=True)

    def do_GET(self) -> None:
        self._handle_request(is_head=False)

    def _handle_request(self, is_head: bool = False) -> None:
        url_path = urllib.parse.urlsplit(self.path).path
        file_path = resolve_file(self.root, url_path)
        if file_path is None:
            self._send_not_found(is_head=is_head)
            return

        declared = rendering_media_type(file_path)
        if declared:
            content_type = declared
        else:
            guessed, _ = mimetypes.guess_type(file_path)
            content_type = guessed or "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
        except OSError:
            self._send_not_found(is_head=is_head)
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if not is_head:
            self.wfile.write(content)

    def _send_not_found(self, is_head: bool = False) -> None:
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        body = b"Not found\n"
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if not is_head:
            self.wfile.write(body)


def create_server(
    dir_path: str,
    port: int = 4007,
    host: str = "127.0.0.1",
) -> http.server.ThreadingHTTPServer:
    """Create and bind a ThreadingHTTPServer serving dir_path."""
    resolved_root = os.path.realpath(dir_path)
    if not os.path.exists(resolved_root):
        raise FileNotFoundError(f"serve-rendering: no such directory: {resolved_root}")

    class BoundHandler(RenderingHTTPRequestHandler):
        root = resolved_root

    server = http.server.ThreadingHTTPServer((host, port), BoundHandler)
    return server


def default_dir() -> str:
    """Determine the default directory to serve when --dir is not provided."""
    for candidate in ("docs/_site", "docs"):
        if os.path.isdir(candidate):
            return candidate
    return "."


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Serve an instance's renderings over local HTTP with their declared media types.",
    )
    parser.add_argument(
        "--dir",
        dest="dir",
        default=None,
        help="directory to serve (default: the declared site root, else .)",
    )
    parser.add_argument(
        "--port",
        dest="port",
        type=int,
        default=4007,
        help="port to bind (default 4007; 0 binds a free port)",
    )
    parser.add_argument(
        "--host",
        "--hostname",
        dest="host",
        default="127.0.0.1",
        help="interface (default 127.0.0.1 — loopback, deliberately)",
    )
    args = parser.parse_args(argv)

    dir_to_serve = args.dir if args.dir is not None else default_dir()
    resolved_dir = os.path.realpath(dir_to_serve)
    if not os.path.exists(resolved_dir):
        sys.stderr.write(f"serve-rendering: no such directory: {resolved_dir}\n")
        return 1

    server = create_server(resolved_dir, port=args.port, host=args.host)
    actual_host = server.server_address[0]
    actual_port = server.server_address[1]

    # Always print the RESOLVED directory and bound address, matching serve-rendering.ts
    print(f"serving {resolved_dir} at http://{actual_host}:{actual_port}", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
