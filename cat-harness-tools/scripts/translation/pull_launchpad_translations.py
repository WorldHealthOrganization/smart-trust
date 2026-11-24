#!/usr/bin/env python3
"""
pull_launchpad_translations.py — Launchpad translation service adapter.

Fetches .po files from the Launchpad Translations REST API and writes them
into the repository's translations directories.

Usage:
    python pull_launchpad_translations.py [options]

Environment variables:
    LAUNCHPAD_API_TOKEN    Required. Launchpad API token.

Exit codes:
    0  Success
    1  One or more download errors

Author: WHO SMART Guidelines Team
"""

import logging
import os
import sys
import tempfile
from pathlib import Path
from typing import Dict, Optional

try:
    import requests
except ImportError:
    sys.exit("ERROR: 'requests' package is required. Run: pip install requests>=2.31.0")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from translation_config import (
    DakConfigError,
    discover_components,
    get_language_codes,
    load_dak_config,
)
from translation_security import DEFAULT_TIMEOUT_SECONDS, MAX_RESPONSE_BYTES

logger = logging.getLogger(__name__)

# Launchpad API base URL
LAUNCHPAD_API_URL = "https://api.launchpad.net/devel"


def _download_po(
    session: requests.Session,
    project: str,
    component_slug: str,
    language: str,
    output_dir: Path,
) -> str:
    """
    Download a .po file from Launchpad for one (component, language) pair.

    Returns one of: "downloaded", "not_found", "error"
    """
    # Launchpad translation export URL pattern
    url = (
        f"{LAUNCHPAD_API_URL}/{project}/+source/{component_slug}"
        f"/+pots/{component_slug}/{language}/+export"
    )
    logger.info("  GET %s", url)

    try:
        resp = session.get(url, timeout=DEFAULT_TIMEOUT_SECONDS, stream=True)
    except requests.exceptions.RequestException as exc:
        logger.error("  Network error: %s", exc)
        return "error"

    if resp.status_code == 404:
        logger.info("  Not found (404)")
        return "not_found"

    if resp.status_code != 200:
        logger.error("  Unexpected HTTP %d", resp.status_code)
        return "error"

    # Stream into temp file with size guard
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
                if total > MAX_RESPONSE_BYTES:
                    logger.error("  Response exceeds size limit — aborting")
                    tmp_path.unlink(missing_ok=True)
                    return "error"
                tmp_fh.write(chunk)
    except OSError as exc:
        logger.error("  Write error: %s", exc)
        tmp_path.unlink(missing_ok=True)
        return "error"

    # Validate content
    content = tmp_path.read_bytes()
    if b"msgid" not in content:
        logger.warning("  Response is not a valid .po file — skipping")
        tmp_path.unlink(missing_ok=True)
        return "not_found"

    tmp_path.replace(dest_path)
    logger.info("  ✓ Written %s (%d bytes)", dest_path, total)
    return "downloaded"


def pull_translations(
    repo_root: Path,
    project_slug: str,
    component_filter: Optional[str] = None,
    language_filter: Optional[str] = None,
) -> int:
    """
    Pull .po files from Launchpad for all applicable components and languages.

    Returns 0 on success, 1 on error.
    """
    api_token = os.environ.get("LAUNCHPAD_API_TOKEN", "")
    if not api_token:
        logger.error("LAUNCHPAD_API_TOKEN not set")
        return 1

    try:
        config = load_dak_config(repo_root)
    except DakConfigError:
        logger.warning("dak.json not found or invalid — skipping")
        return 0

    languages = get_language_codes(config)
    if language_filter:
        languages = [language_filter] if language_filter in languages else []

    components = discover_components(repo_root)
    if component_filter:
        components = [c for c in components if c.slug == component_filter]

    session = requests.Session()
    session.headers.update({
        "Authorization": f"OAuth oauth_token={api_token}",
        "User-Agent": "SMART-Base-CI/1.0",
    })

    # Launchpad project name from service config
    lp_config = config.translations.services.get("launchpad", None) if config.translations else None
    lp_project = (lp_config.extra.get("project", "") if lp_config else "") or project_slug

    counts: Dict[str, int] = {"downloaded": 0, "not_found": 0, "error": 0}

    for comp in components:
        logger.info("Component: %s", comp.slug)
        for lang in languages:
            result = _download_po(
                session, lp_project, comp.slug, lang, comp.translations_dir,
            )
            counts[result] += 1

    logger.info(
        "Summary: %d downloaded, %d not found, %d errors",
        counts["downloaded"], counts["not_found"], counts["error"],
    )
    return 1 if counts["error"] > 0 else 0


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    parser = argparse.ArgumentParser(description="Pull translations from Launchpad")
    parser.add_argument("--repo-root", default=".")
    parser.add_argument("--component", default="")
    parser.add_argument("--language", default="")
    args = parser.parse_args()

    from translation_config import derive_project_slug_from_env
    project_slug = derive_project_slug_from_env(Path(args.repo_root).resolve())

    sys.exit(pull_translations(
        repo_root=Path(args.repo_root).resolve(),
        project_slug=project_slug,
        component_filter=args.component or None,
        language_filter=args.language or None,
    ))
