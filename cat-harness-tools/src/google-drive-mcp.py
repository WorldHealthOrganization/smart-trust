#!/usr/bin/env python3
"""
Google Drive MCP server — upload and manage PDFs in a Drive folder.

Operates in two modes:

  MCP server (stdio)  — registered in .mcp.json; any agent (Claude Code,
                        Copilot, Antigravity, Gemini) calls Drive tools via
                        the Model Context Protocol without knowing about
                        credentials.  All backend selection and auth happen
                        lazily on first tool call.

  CLI mode            — called from bash hooks/scripts when Drive operations
                        are needed inside the render pipeline:
                          --upload  <file>   upload a single file
                          --sync-dir <dir>   upload all PDFs in a directory
                          --sync-manifest <json>  upload from pdf-split-manifest.json
                          --list   <folder>  list a Drive folder
                          --status           report auth status, no upload
                          --json             emit machine-readable JSON output

Credential resolution (first hit wins):
  1. $GOOGLE_APPLICATION_CREDENTIALS  → service account JSON key file
  2. ~/.config/google-drive-mcp/credentials.json  → OAuth2 client JSON
     (triggers a browser consent flow on first use; token cached at
      ~/.config/google-drive-mcp/token.json — never committed)
  3. google.auth.default()             → Application Default Credentials
     (works when `gcloud auth application-default login` has been run)

All credentials live outside the repository.  The script never reads or
writes any file under the repo root except PDFs it is explicitly told to upload.

Drive folder structure managed by this server (under GDRIVE_ROOT_FOLDER):
  <root>/
    main.pdf                # full paper PDF
    front-matter.pdf        # front matter bundle
    chapters/
      introduction.pdf
      ch1-setup.pdf
      ...
    appendices/
      standalone-glossary.pdf
      ...
    blocks/
      def-observable.pdf
      thm-main.pdf
      ...

MCP transport: stdio (newline-delimited JSON-RPC 2.0).

Usage:
    python3 src/google-drive-mcp.py              # MCP server (default)
    python3 src/google-drive-mcp.py --status     # auth check, no upload
    python3 src/google-drive-mcp.py --upload file.pdf --folder "QOU/blocks"
    python3 src/google-drive-mcp.py --sync-dir build/block-pdfs/ --folder "QOU/blocks"
    python3 src/google-drive-mcp.py --sync-manifest build/pdf-split-manifest.json
"""

from __future__ import annotations

import json
import os
import sys
import pathlib
from typing import Any


def _harness_root():
    """The cat-harness root (scripts/_harness_root.py; bean 70lx)."""
    import importlib.util as _u
    from pathlib import Path as _P
    _s = _u.spec_from_file_location("_harness_root", _P(__file__).resolve().parent.parent / "scripts" / "_harness_root.py")
    _m = _u.module_from_spec(_s); _s.loader.exec_module(_m)  # type: ignore[union-attr]
    return _m.HARNESS_ROOT

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "google-drive-mcp", "version": "0.1.0"}

# ── Config from environment ──────────────────────────────────────────────────

# Root folder path in Drive, e.g. "QOU/folio-pdfs".
# Segments are created if absent.  Override with --folder in CLI mode.
GDRIVE_FOLDER_ENV = os.environ.get("GDRIVE_FOLDER_PATH", "folio-pdfs")

# Optional: explicit Drive root folder ID to use as the starting point
# instead of "My Drive".  Useful when sharing a Team Drive.
GDRIVE_ROOT_ID = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "root")

# Credential paths
_CONFIG_DIR = pathlib.Path.home() / ".config" / "google-drive-mcp"
_OAUTH_CREDS = _CONFIG_DIR / "credentials.json"
_OAUTH_TOKEN = _CONFIG_DIR / "token.json"

# ── Stderr logging (never corrupts stdout MCP channel) ──────────────────────

def eprint(*args: object) -> None:
    print(*args, file=sys.stderr, flush=True)


# ── Lazy Drive client ────────────────────────────────────────────────────────

_service: Any = None          # googleapiclient.discovery.Resource
_auth_error: str | None = None


def _resolve_credentials():
    """Return google.oauth2 credentials or raise ImportError / RuntimeError."""
    # Attempt 1: service account via GOOGLE_APPLICATION_CREDENTIALS
    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if sa_path and pathlib.Path(sa_path).exists():
        from google.oauth2 import service_account
        return service_account.Credentials.from_service_account_file(
            sa_path,
            scopes=["https://www.googleapis.com/auth/drive.file"],
        )

    # Attempt 2: OAuth2 client credentials (interactive on first run)
    if _OAUTH_CREDS.exists():
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        scopes = ["https://www.googleapis.com/auth/drive.file"]
        creds = None
        if _OAUTH_TOKEN.exists():
            creds = Credentials.from_authorized_user_file(str(_OAUTH_TOKEN), scopes)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(_OAUTH_CREDS), scopes
                )
                # Run local server flow; opens browser for consent once
                creds = flow.run_local_server(port=0)
            _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            _OAUTH_TOKEN.write_text(creds.to_json())
        return creds

    # Attempt 3: Application Default Credentials (gcloud auth application-default)
    from google.auth import default as gauth_default
    creds, _ = gauth_default(
        scopes=["https://www.googleapis.com/auth/drive.file"]
    )
    return creds


def get_service():
    """Return (and cache) an authenticated Drive v3 service client."""
    global _service, _auth_error
    if _service is not None:
        return _service
    if _auth_error is not None:
        raise RuntimeError(_auth_error)
    try:
        from googleapiclient.discovery import build as gdiscovery_build
        creds = _resolve_credentials()
        _service = gdiscovery_build("drive", "v3", credentials=creds, cache_discovery=False)
        eprint("[google-drive-mcp] Drive client authenticated")
        return _service
    except ImportError as e:
        _auth_error = (
            f"Google API client libraries not installed: {e}\n"
            "Install with: pip install google-api-python-client google-auth-httplib2 "
            "google-auth-oauthlib"
        )
        raise RuntimeError(_auth_error)
    except Exception as e:
        _auth_error = str(e)
        raise


# ── Folder resolution / creation ─────────────────────────────────────────────

def _find_or_create_folder(service, name: str, parent_id: str) -> str:
    """Return the Drive folder ID for `name` under `parent_id`, creating it if absent."""
    q = (
        f"name = {json.dumps(name)} "
        f"and '{parent_id}' in parents "
        f"and mimeType = 'application/vnd.google-apps.folder' "
        f"and trashed = false"
    )
    resp = service.files().list(q=q, fields="files(id,name)", spaces="drive").execute()
    files = resp.get("files", [])
    if files:
        return files[0]["id"]
    # Create the folder
    meta = {
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    folder = service.files().create(body=meta, fields="id").execute()
    eprint(f"[google-drive-mcp] Created folder '{name}' under parent {parent_id}")
    return folder["id"]


def resolve_folder_path(service, folder_path: str, root_id: str = "root") -> str:
    """
    Traverse (and create) a slash-separated folder path, starting from root_id.
    e.g. "QOU/folio-pdfs/blocks" → Drive folder ID for "blocks".
    Returns the folder ID of the deepest segment.
    """
    segments = [s for s in folder_path.replace("\\", "/").split("/") if s]
    current = root_id
    for seg in segments:
        current = _find_or_create_folder(service, seg, current)
    return current


# ── File upload / upsert ─────────────────────────────────────────────────────

def upload_file(local_path: str, folder_path: str, root_id: str = "root") -> dict:
    """
    Upload (or update) a local file to the specified Drive folder path.
    If a file with the same name already exists in the folder, a new
    revision is created (upsert behaviour).

    Returns a dict with keys: id, name, webViewLink, size.
    """
    import mimetypes
    from googleapiclient.http import MediaFileUpload

    service = get_service()
    folder_id = resolve_folder_path(service, folder_path, root_id)
    file_name = pathlib.Path(local_path).name
    mime, _ = mimetypes.guess_type(local_path)
    mime = mime or "application/octet-stream"
    size = pathlib.Path(local_path).stat().st_size

    # Check for existing file with the same name in the folder
    q = (
        f"name = {json.dumps(file_name)} "
        f"and '{folder_id}' in parents "
        f"and trashed = false"
    )
    resp = service.files().list(q=q, fields="files(id,name)", spaces="drive").execute()
    existing = resp.get("files", [])

    media = MediaFileUpload(local_path, mimetype=mime, resumable=True)

    if existing:
        # Update existing file
        file_id = existing[0]["id"]
        updated = service.files().update(
            fileId=file_id,
            media_body=media,
            fields="id,name,webViewLink,size",
        ).execute()
        eprint(f"[google-drive-mcp] Updated: {file_name} (id={file_id})")
        return updated
    else:
        # Create new file
        meta = {"name": file_name, "parents": [folder_id]}
        created = service.files().create(
            body=meta,
            media_body=media,
            fields="id,name,webViewLink,size",
        ).execute()
        eprint(f"[google-drive-mcp] Uploaded: {file_name} (id={created['id']})")
        # Make the file readable by anyone with the link
        try:
            service.permissions().create(
                fileId=created["id"],
                body={"type": "anyone", "role": "reader"},
            ).execute()
        except Exception:
            pass  # non-fatal — file is still accessible to owner
        return created


def list_folder(folder_path: str, root_id: str = "root") -> list[dict]:
    """List files in a Drive folder path. Returns list of {name, id, webViewLink, mimeType}."""
    service = get_service()
    folder_id = resolve_folder_path(service, folder_path, root_id)
    q = f"'{folder_id}' in parents and trashed = false"
    resp = service.files().list(
        q=q,
        fields="files(id,name,webViewLink,mimeType,size)",
        spaces="drive",
        pageSize=1000,
    ).execute()
    return resp.get("files", [])


def check_auth_status() -> dict:
    """Check auth without uploading. Returns status dict."""
    try:
        get_service()
        return {"authenticated": True, "error": None}
    except Exception as e:
        # Redact the raw exception string to avoid leaking credential path/content.
        error_type = type(e).__name__
        return {
            "authenticated": False,
            "error": error_type,
            "hint": (
                "Set GOOGLE_APPLICATION_CREDENTIALS to a service account key, "
                "or place OAuth2 client credentials at "
                "~/.config/google-drive-mcp/credentials.json, "
                "or run: gcloud auth application-default login"
            ),
        }


# ── Manifest sync ─────────────────────────────────────────────────────────────

def sync_from_manifest(manifest_path: str, root_folder: str, root_id: str = "root") -> list[dict]:
    """
    Sync PDFs listed in a pdf-split-manifest.json to Drive.

    Folder structure under root_folder:
      root_folder/main.pdf              (or front-matter.pdf — the bundle)
      root_folder/chapters/<slug>.pdf   (content chapters)
      root_folder/appendices/<slug>.pdf (standalone appendices, if slug starts with 'appendix-')

    Returns a list of upload result dicts.
    """
    data = json.loads(pathlib.Path(manifest_path).read_text())
    out_dir = str(pathlib.Path(manifest_path).parent)
    results = []

    for entry in data.get("outputs", []):
        slug = entry.get("slug", "")
        pdf_name = entry.get("path", "")
        local_path = str(pathlib.Path(out_dir) / pdf_name)
        if not pathlib.Path(local_path).exists():
            eprint(f"[google-drive-mcp] Skipping missing file: {local_path}")
            continue

        # Determine subfolder
        if slug in ("main", "front-matter"):
            folder = root_folder
        elif slug.startswith("appendix-"):
            folder = f"{root_folder}/appendices"
        else:
            folder = f"{root_folder}/chapters"

        try:
            result = upload_file(local_path, folder, root_id)
            results.append({**result, "slug": slug, "localPath": local_path})
        except Exception as e:
            eprint(f"[google-drive-mcp] Upload failed for {pdf_name}: {e}")
            results.append({"slug": slug, "error": str(e)})

    return results


def sync_directory(local_dir: str, drive_folder: str, root_id: str = "root",
                   pattern: str = "*.pdf") -> list[dict]:
    """Upload all PDFs in a local directory to a Drive folder."""
    import glob as globmod
    results = []
    for path in globmod.glob(str(pathlib.Path(local_dir) / pattern)):
        try:
            result = upload_file(path, drive_folder, root_id)
            results.append({**result, "localPath": path})
        except Exception as e:
            eprint(f"[google-drive-mcp] Upload failed for {path}: {e}")
            results.append({"localPath": path, "error": str(e)})
    return results


# ── MCP Tool definitions ──────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "drive_status",
        "description": (
            "Check Google Drive authentication status without uploading anything. "
            "Returns whether credentials are configured and which method is active."
        ),
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "drive_upload_file",
        "description": (
            "Upload (or update) a local file to a Google Drive folder path. "
            "Creates intermediate folders if they don't exist. "
            "If a file with the same name already exists, it is updated (upserted). "
            "Returns the Drive file ID and a shareable web link."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "local_path": {"type": "string", "description": "Absolute path to the local file"},
                "drive_folder": {
                    "type": "string",
                    "description": (
                        "Destination folder path in Drive, e.g. 'QOU/blocks'. "
                        f"Defaults to the configured folder ({GDRIVE_FOLDER_ENV})."
                    ),
                },
            },
            "required": ["local_path"],
        },
    },
    {
        "name": "drive_list_folder",
        "description": "List the contents of a Google Drive folder path. Returns file names and links.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "drive_folder": {
                    "type": "string",
                    "description": "Drive folder path to list, e.g. 'QOU/blocks'",
                },
            },
            "required": ["drive_folder"],
        },
    },
    {
        "name": "drive_sync_manifest",
        "description": (
            "Sync PDFs from a pdf-split-manifest.json to Google Drive. "
            "Uploads main.pdf, front-matter.pdf, chapter PDFs, and appendix PDFs "
            "to the appropriate subfolders under the root Drive folder."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "manifest_path": {
                    "type": "string",
                    "description": "Path to pdf-split-manifest.json",
                },
                "root_folder": {
                    "type": "string",
                    "description": (
                        "Root folder in Drive under which chapters/, appendices/ etc. live. "
                        f"Defaults to {GDRIVE_FOLDER_ENV}."
                    ),
                },
            },
            "required": ["manifest_path"],
        },
    },
    {
        "name": "drive_sync_block_pdfs",
        "description": (
            "Upload all block PDFs from a local directory to the Drive blocks/ subfolder. "
            "Typically called after render-changed-blocks.ts to push newly-compiled block PDFs."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "local_dir": {
                    "type": "string",
                    "description": "Local directory containing block PDFs (default: build/block-pdfs/)",
                },
                "root_folder": {
                    "type": "string",
                    "description": f"Root Drive folder. Defaults to {GDRIVE_FOLDER_ENV}.",
                },
            },
        },
    },
]


def handle_tool_call(name: str, arguments: dict) -> str:
    if name == "drive_status":
        return json.dumps(check_auth_status(), indent=2)

    if name == "drive_upload_file":
        local_path = arguments["local_path"]
        folder = arguments.get("drive_folder", GDRIVE_FOLDER_ENV)
        try:
            result = upload_file(local_path, folder, GDRIVE_ROOT_ID)
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    if name == "drive_list_folder":
        folder = arguments.get("drive_folder", GDRIVE_FOLDER_ENV)
        try:
            files = list_folder(folder, GDRIVE_ROOT_ID)
            return json.dumps({"folder": folder, "files": files}, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    if name == "drive_sync_manifest":
        manifest = arguments["manifest_path"]
        root = arguments.get("root_folder", GDRIVE_FOLDER_ENV)
        try:
            results = sync_from_manifest(manifest, root, GDRIVE_ROOT_ID)
            return json.dumps({"synced": len(results), "results": results}, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    if name == "drive_sync_block_pdfs":
        import os as _os
        repo_root = str(_harness_root())  # bean 70lx: the harness, now a sibling of this layer
        local_dir = arguments.get("local_dir", _os.path.join(repo_root, "build", "block-pdfs"))
        root = arguments.get("root_folder", GDRIVE_FOLDER_ENV)
        folder = f"{root}/blocks"
        try:
            results = sync_directory(local_dir, folder, GDRIVE_ROOT_ID)
            return json.dumps({"synced": len(results), "folder": folder, "results": results}, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    return json.dumps({"error": f"Unknown tool: {name}"})


# ── MCP stdio transport (JSON-RPC 2.0) ───────────────────────────────────────

def _result(req_id, result):
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _error(req_id, code: int, message: str):
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def handle_message(msg: dict):
    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}
    is_notification = "id" not in msg

    if method == "initialize":
        return _result(req_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        })
    if method in ("notifications/initialized", "initialized", "ping"):
        return None if is_notification else _result(req_id, {})
    if method == "tools/list":
        return _result(req_id, {"tools": TOOLS})
    if method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments") or {}
        try:
            text = handle_tool_call(tool_name, arguments)
            payload = json.loads(text)
            is_err = isinstance(payload, dict) and "error" in payload
            return _result(req_id, {
                "content": [{"type": "text", "text": text}],
                "isError": is_err,
            })
        except Exception as e:
            return _result(req_id, {
                "content": [{"type": "text", "text": json.dumps({"error": str(e)})}],
                "isError": True,
            })
    if method == "shutdown":
        return _result(req_id, {})
    if is_notification:
        return None
    return _error(req_id, -32601, f"Method not found: {method}")


def serve_stdio() -> None:
    eprint(
        f"[google-drive-mcp] ready (stdio). Auth resolves lazily on first tool call. "
        f"Default folder: {GDRIVE_FOLDER_ENV}"
    )
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


# ── CLI mode ──────────────────────────────────────────────────────────────────

def cli_main(argv: list[str]) -> int:
    """
    CLI entry point for use from bash scripts.
    Returns exit code (0 = success).
    """
    as_json = "--json" in argv

    def out(data: dict) -> None:
        if as_json:
            print(json.dumps(data))
        else:
            if "error" in data:
                eprint(f"ERROR: {data['error']}")
                if "hint" in data:
                    eprint(f"  {data['hint']}")
            elif "webViewLink" in data:
                print(data["webViewLink"])
            elif "synced" in data:
                print(f"Synced {data['synced']} file(s)")
                for r in data.get("results", []):
                    link = r.get("webViewLink", "")
                    name = r.get("name", r.get("localPath", ""))
                    if "error" in r:
                        eprint(f"  ✗ {name}: {r['error']}")
                    else:
                        print(f"  ✓ {name}  {link}")
            elif "files" in data:
                for f in data["files"]:
                    print(f"  {f.get('name','')}  {f.get('webViewLink','')}")
            else:
                print(json.dumps(data, indent=2))

    if "--status" in argv:
        status = check_auth_status()
        out(status)
        return 0 if status["authenticated"] else 1

    folder = GDRIVE_FOLDER_ENV
    # --folder overrides env for this invocation
    if "--folder" in argv:
        idx = argv.index("--folder")
        if idx + 1 < len(argv):
            folder = argv[idx + 1]

    if "--upload" in argv:
        idx = argv.index("--upload")
        if idx + 1 >= len(argv):
            eprint("--upload requires a file path argument")
            return 2
        local_path = argv[idx + 1]
        try:
            result = upload_file(local_path, folder, GDRIVE_ROOT_ID)
            out(result)
            return 0
        except Exception as e:
            out({"error": str(e)})
            return 1

    if "--sync-dir" in argv:
        idx = argv.index("--sync-dir")
        if idx + 1 >= len(argv):
            eprint("--sync-dir requires a directory path argument")
            return 2
        local_dir = argv[idx + 1]
        try:
            results = sync_directory(local_dir, folder, GDRIVE_ROOT_ID)
            errors = [r for r in results if "error" in r]
            out({"synced": len(results) - len(errors), "results": results})
            return 1 if errors else 0
        except Exception as e:
            out({"error": str(e)})
            return 1

    if "--sync-manifest" in argv:
        idx = argv.index("--sync-manifest")
        if idx + 1 >= len(argv):
            eprint("--sync-manifest requires a manifest path argument")
            return 2
        manifest_path = argv[idx + 1]
        try:
            results = sync_from_manifest(manifest_path, folder, GDRIVE_ROOT_ID)
            errors = [r for r in results if "error" in r]
            out({"synced": len(results) - len(errors), "results": results})
            return 1 if errors else 0
        except Exception as e:
            out({"error": str(e)})
            return 1

    if "--list" in argv:
        idx = argv.index("--list")
        list_folder_path = argv[idx + 1] if idx + 1 < len(argv) else folder
        try:
            files = list_folder(list_folder_path, GDRIVE_ROOT_ID)
            out({"folder": list_folder_path, "files": files})
            return 0
        except Exception as e:
            out({"error": str(e)})
            return 1

    eprint("No CLI action specified.  Use --upload, --sync-dir, --sync-manifest, --list, or --status")
    eprint("For MCP server mode, omit all CLI flags.")
    return 2


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    argv = sys.argv[1:]
    cli_flags = {"--upload", "--sync-dir", "--sync-manifest", "--list", "--status",
                 "--folder", "--json"}
    is_cli = any(f in argv for f in cli_flags)

    if is_cli:
        sys.exit(cli_main(argv))
    else:
        serve_stdio()


if __name__ == "__main__":
    main()
