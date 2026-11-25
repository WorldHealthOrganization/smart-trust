#!/usr/bin/env python3
"""
pull_weblate_translations.py — Download .po translation files from Weblate API.

Fetches the latest approved Gettext .po files for every (component, language)
combination from the Weblate REST API and writes them into the repository's
translations directories.

Component → directory mapping (aligned with weblate.yaml):

  fhir-resources      → input/translations/
  plantuml-diagrams   → input/images-source/translations/
  svg-images          → input/images/translations/
  archimate-models    → input/archimate/translations/
  uml-diagrams        → input/diagrams/translations/

Supported UN official languages: ar, zh, fr, ru, es
(English is the source language and is not downloaded.)

Usage:
    python pull_weblate_translations.py [options]

Options:
    --weblate-url URL    Weblate base URL  (default: https://hosted.weblate.org)
    --project SLUG       Weblate project slug (default: worldhealthorganization-smart-base)
    --component SLUG     Restrict to one component slug (default: all)
    --language CODE      Restrict to one language code  (default: all)
    --output-root DIR    Repository root for output directories (default: .)
    -h / --help          Show this help message

Environment variables:
    WEBLATE_API_TOKEN    Required. Weblate API token with at least read access.

Exit codes:
    0  All expected files downloaded successfully (or no matching translations)
    1  One or more download errors occurred
    2  Bad arguments or missing WEBLATE_API_TOKEN
"""

import argparse
import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import requests
    from requests import Response
except ImportError:  # pragma: no cover
    sys.exit("ERROR: 'requests' package is required. Run: pip install requests>=2.31.0")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Allowlist of valid Weblate component slugs and their repo-relative
# translation output directories.  Changing these requires matching updates
# to weblate.yaml and any downstream injection scripts.
COMPONENT_MAP: Dict[str, str] = {
    "fhir-resources":    "input/translations",
    "plantuml-diagrams": "input/images-source/translations",
    "svg-images":        "input/images/translations",
    "archimate-models":  "input/archimate/translations",
    "uml-diagrams":      "input/diagrams/translations",
}

# Six UN official languages (English is the source language, not downloaded).
ALL_LANGUAGES: Tuple[str, ...] = ("ar", "zh", "fr", "ru", "es")

# Weblate API path template for downloading a single translation file.
# Reference: https://docs.weblate.org/en/latest/api.html#get--api-translations-(string-project)-(string-component)-(string-language)-file-
_API_FILE_PATH = "/api/translations/{project}/{component}/{language}/file/"

# Maximum bytes we accept as a .po file (10 MiB) — protects against runaway
# downloads from a misconfigured or malicious server.
_MAX_PO_BYTES = 10 * 1024 * 1024

# Timeout in seconds for each Weblate API request.
_DOWNLOAD_TIMEOUT_SECONDS = 60

# ---------------------------------------------------------------------------
# Input validation helpers
# ---------------------------------------------------------------------------

def _validate_slug(value: str, name: str) -> str:
    """
    Verify that *value* is a safe slug string (alphanumeric + hyphens only).

    This prevents path-traversal or shell-injection if a caller somehow
    passes a crafted value through.

    Raises:
        SystemExit(2) if the value does not match the expected pattern.
    """
    import re
    # Weblate slugs typically use hyphens; underscores are also accepted here
    # to handle project slugs and any future component names that use them.
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value):
        sys.exit(
            f"ERROR: Invalid {name} value {value!r}. "
            "Only alphanumerics, hyphens, and underscores are allowed."
        )
    return value


def _validate_url(value: str, name: str) -> str:
    """
    Verify that *value* looks like an https:// or http:// URL.

    Raises:
        SystemExit(2) if the value is not a valid http(s) URL.
    """
    if not (value.startswith("https://") or value.startswith("http://")):
        sys.exit(
            f"ERROR: Invalid {name} value {value!r}. Must start with http:// or https://"
        )
    # Strip trailing slash for consistency
    return value.rstrip("/")


# ---------------------------------------------------------------------------
# Download logic
# ---------------------------------------------------------------------------

def _is_valid_po_content(content: bytes) -> bool:
    """Return True if *content* looks like a Gettext .po / .pot file."""
    # A valid .po file must contain at least one msgid declaration.
    return b"msgid" in content


def download_translation(
    session: "requests.Session",
    weblate_url: str,
    project: str,
    component: str,
    language: str,
    output_dir: Path,
) -> str:
    """
    Download the .po file for one (component, language) pair from Weblate.

    Args:
        session:      Authenticated requests.Session.
        weblate_url:  Weblate base URL (no trailing slash).
        project:      Weblate project slug.
        component:    Weblate component slug.
        language:     BCP-47 language code.
        output_dir:   Repository directory in which to write <language>.po.

    Returns:
        One of: "downloaded", "not_found", "skipped", "error"
    """
    logger = logging.getLogger(__name__)

    api_path = _API_FILE_PATH.format(
        project=project, component=component, language=language
    )
    # force Gettext PO format regardless of the component's storage type
    url = f"{weblate_url}{api_path}?format=po"

    logger.info("  GET %s", url)

    try:
        resp: Response = session.get(url, timeout=_DOWNLOAD_TIMEOUT_SECONDS, stream=True)
    except requests.exceptions.RequestException as exc:
        logger.error("  Network error: %s", exc)
        return "error"

    if resp.status_code == 404:
        logger.info("  Not found (404) — no translation exists yet")
        return "not_found"

    if resp.status_code != 200:
        logger.error("  Unexpected HTTP %d", resp.status_code)
        return "error"

    # Stream response into a temp file to avoid unbounded memory use
    output_dir.mkdir(parents=True, exist_ok=True)
    dest_path = output_dir / f"{language}.po"

    try:
        with tempfile.NamedTemporaryFile(
            dir=output_dir, suffix=".po.tmp", delete=False
        ) as tmp_fh:
            tmp_path = Path(tmp_fh.name)
            total = 0
            for chunk in resp.iter_content(chunk_size=65536):
                total += len(chunk)
                if total > _MAX_PO_BYTES:
                    logger.error(
                        "  Response exceeds %d bytes — aborting download", _MAX_PO_BYTES
                    )
                    tmp_path.unlink(missing_ok=True)
                    return "error"
                tmp_fh.write(chunk)
    except OSError as exc:
        logger.error("  Cannot write to %s: %s", output_dir, exc)
        tmp_path.unlink(missing_ok=True)
        return "error"

    # Validate content before accepting
    content = tmp_path.read_bytes()
    if not _is_valid_po_content(content):
        logger.warning("  Response body is not a valid .po file — skipping")
        tmp_path.unlink(missing_ok=True)
        return "skipped"

    tmp_path.replace(dest_path)
    logger.info("  ✓ Written to %s (%d bytes)", dest_path, total)
    return "downloaded"


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def pull_translations(
    weblate_url: str,
    project: str,
    output_root: Path,
    component_filter: Optional[str],
    language_filter: Optional[str],
    api_token: str,
) -> int:
    """
    Pull .po files from Weblate for every applicable (component, language) pair.

    Returns:
        0 on full success, 1 if any download produced an error.
    """
    logger = logging.getLogger(__name__)

    # Determine which components to process
    if component_filter:
        if component_filter not in COMPONENT_MAP:
            logger.error(
                "Unknown component %r. Valid components: %s",
                component_filter,
                ", ".join(sorted(COMPONENT_MAP)),
            )
            return 1
        components = {component_filter: COMPONENT_MAP[component_filter]}
    else:
        components = dict(COMPONENT_MAP)

    # Determine which languages to process
    if language_filter:
        if language_filter not in ALL_LANGUAGES:
            logger.error(
                "Unknown language %r. Valid languages: %s",
                language_filter,
                ", ".join(ALL_LANGUAGES),
            )
            return 1
        languages: Tuple[str, ...] = (language_filter,)
    else:
        languages = ALL_LANGUAGES

    session = requests.Session()
    session.headers.update(
        {
            # Weblate uses the "Token <token>" authorization scheme
            # (not "Bearer"), as documented at:
            # https://docs.weblate.org/en/latest/api.html#authentication
            "Authorization": f"Token {api_token}",
            "Accept": "text/x-po",
            "User-Agent": "SMART-Base-CI/1.0",
        }
    )

    counts: Dict[str, int] = {"downloaded": 0, "not_found": 0, "skipped": 0, "error": 0}

    for slug, rel_dir in components.items():
        output_dir = output_root / rel_dir
        logger.info("Component: %s  →  %s", slug, output_dir)

        for lang in languages:
            logger.info("  Language: %s", lang)
            result = download_translation(
                session=session,
                weblate_url=weblate_url,
                project=project,
                component=slug,
                language=lang,
                output_dir=output_dir,
            )
            counts[result] += 1

    logger.info(
        "Summary: %d downloaded, %d not found, %d skipped, %d errors",
        counts["downloaded"],
        counts["not_found"],
        counts["skipped"],
        counts["error"],
    )

    return 1 if counts["error"] > 0 else 0


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="pull_weblate_translations.py",
        description="Download .po translation files from the Weblate REST API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--weblate-url",
        default="https://hosted.weblate.org",
        help="Weblate base URL (default: https://hosted.weblate.org)",
    )
    parser.add_argument(
        "--project",
        default="worldhealthorganization-smart-base",
        help="Weblate project slug (default: worldhealthorganization-smart-base)",
    )
    parser.add_argument(
        "--component",
        default="",
        help=(
            "Restrict download to a single component slug. "
            f"Valid values: {', '.join(sorted(COMPONENT_MAP))}. "
            "Default: all components."
        ),
    )
    parser.add_argument(
        "--language",
        default="",
        help=(
            "Restrict download to a single language code. "
            f"Valid values: {', '.join(ALL_LANGUAGES)}. "
            "Default: all languages."
        ),
    )
    parser.add_argument(
        "--output-root",
        default=".",
        help="Repository root for output directories (default: current directory)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    logger = logging.getLogger(__name__)

    args = _parse_args(argv)

    # ── Validate / sanitize user-supplied values ────────────────────────────
    weblate_url = _validate_url(args.weblate_url, "--weblate-url")
    project = _validate_slug(args.project, "--project")
    component_filter: Optional[str] = None
    if args.component:
        component_filter = _validate_slug(args.component, "--component")
    language_filter: Optional[str] = None
    if args.language:
        language_filter = _validate_slug(args.language, "--language")

    output_root = Path(args.output_root).resolve()
    if not output_root.is_dir():
        sys.exit(f"ERROR: --output-root {output_root!r} is not a directory")

    # ── Require API token from environment only (never from CLI) ────────────
    api_token = os.environ.get("WEBLATE_API_TOKEN", "")
    if not api_token:
        sys.exit(
            "ERROR: WEBLATE_API_TOKEN environment variable is not set.\n"
            "  Create a token at: https://hosted.weblate.org/accounts/profile/#api\n"
            "  Then add it as a repository secret: Settings → Secrets → Actions → New secret"
        )

    logger.info(
        "Pulling translations from %s (project: %s)", weblate_url, project
    )
    if component_filter:
        logger.info("  Component filter: %s", component_filter)
    if language_filter:
        logger.info("  Language filter:  %s", language_filter)

    return pull_translations(
        weblate_url=weblate_url,
        project=project,
        output_root=output_root,
        component_filter=component_filter,
        language_filter=language_filter,
        api_token=api_token,
    )


if __name__ == "__main__":
    sys.exit(main())
