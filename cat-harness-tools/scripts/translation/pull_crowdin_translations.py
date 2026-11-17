#!/usr/bin/env python3
"""
pull_crowdin_translations.py — Crowdin v2 API translation service adapter.

Fetches .po files from the Crowdin v2 REST API and writes them into the
repository's translations directories.

Usage:
    python pull_crowdin_translations.py [options]

Environment variables:
    CROWDIN_API_TOKEN      Required. Crowdin API token.

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

# Crowdin API v2 base URL
CROWDIN_API_URL = "https://api.crowdin.com/api/v2"


def _list_crowdin_files(
    session: requests.Session,
    project_id: str,
) -> Dict[str, int]:
    """
    List all files in the Crowdin project and return a mapping of
    filename (stem, lowercased) → file ID.

    The Crowdin v2 ``/projects/{id}/files`` endpoint is paginated; this
    helper fetches all pages.
    """
    mapping: Dict[str, int] = {}
    url = f"{CROWDIN_API_URL}/projects/{project_id}/files"
    offset = 0
    limit = 250

    while True:
        params = {"offset": offset, "limit": limit}
        try:
            resp = session.get(url, params=params, timeout=DEFAULT_TIMEOUT_SECONDS)
        except requests.exceptions.RequestException as exc:
            logger.error("  Crowdin list-files request failed: %s", exc)
            break

        if resp.status_code != 200:
            logger.error("  Crowdin list-files HTTP %d: %s",
                         resp.status_code, resp.text[:500])
            break

        data = resp.json().get("data", [])
        if not data:
            break

        for item in data:
            file_data = item.get("data", {})
            file_id = file_data.get("id")
            file_name = file_data.get("name", "")
            if file_id and file_name:
                # Map by stem (without extension) for component matching
                stem = Path(file_name).stem.lower()
                mapping[stem] = file_id
                # Also map by full filename for exact matches
                mapping[file_name.lower()] = file_id

        if len(data) < limit:
            break
        offset += limit

    return mapping


def _build_translation_export(
    session: requests.Session,
    project_id: str,
    file_id: int,
    language: str,
) -> Optional[str]:
    """
    Request a translation export build from Crowdin and return the download URL.

    Returns the download URL or None on failure.
    """
    url = f"{CROWDIN_API_URL}/projects/{project_id}/translations/exports"
    payload = {
        "targetLanguageId": language,
        "fileIds": [file_id],
        "format": "gettext",
    }

    try:
        resp = session.post(url, json=payload, timeout=DEFAULT_TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        logger.error("  Crowdin export request failed: %s", exc)
        return None

    if resp.status_code not in (200, 201):
        logger.error("  Crowdin export HTTP %d: %s",
                      resp.status_code, resp.text[:500])
        return None

    data = resp.json().get("data", {})
    return data.get("url")


def _download_po(
    session: requests.Session,
    download_url: str,
    language: str,
    output_dir: Path,
) -> str:
    """
    Download a .po file from a Crowdin export URL.

    Returns one of: "downloaded", "not_found", "error"
    """
    logger.info("  GET %s", download_url[:80] + "...")

    try:
        resp = session.get(download_url, timeout=DEFAULT_TIMEOUT_SECONDS, stream=True)
    except requests.exceptions.RequestException as exc:
        logger.error("  Network error: %s", exc)
        return "error"

    if resp.status_code == 404:
        logger.info("  Not found (404)")
        return "not_found"

    if resp.status_code != 200:
        logger.error("  Unexpected HTTP %d", resp.status_code)
        return "error"

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
    Pull .po files from Crowdin for all applicable components and languages.

    Returns 0 on success, 1 on error.
    """
    api_token = os.environ.get("CROWDIN_API_TOKEN", "")
    if not api_token:
        logger.error("CROWDIN_API_TOKEN not set")
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

    # Get Crowdin project ID from service config
    cr_config = (
        config.translations.services.get("crowdin", None)
        if config.translations else None
    )
    project_id = (cr_config.extra.get("projectId", "") if cr_config else "") or ""
    if not project_id:
        logger.error("Crowdin projectId not configured in translation config")
        return 1

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "User-Agent": "SMART-Base-CI/1.0",
    })

    counts: Dict[str, int] = {"downloaded": 0, "not_found": 0, "error": 0}

    # Resolve Crowdin file IDs via the files API so we can request
    # per-file translation exports.
    logger.info("Listing Crowdin project files to resolve file IDs…")
    file_id_map = _list_crowdin_files(session, project_id)
    if not file_id_map:
        logger.error("No files found in Crowdin project %s", project_id)
        return 1
    logger.info("  Found %d file entries", len(file_id_map))

    for comp in components:
        logger.info("Component: %s", comp.slug)
        # Match component to a Crowdin file ID by slug or pot stem
        file_id = (
            file_id_map.get(comp.slug)
            or file_id_map.get(comp.pot_stem.lower())
            or file_id_map.get(f"{comp.pot_stem}.pot")
        )
        if file_id is None:
            logger.warning(
                "  No Crowdin file matched for component %s "
                "(tried slug=%r, stem=%r, filename=%r) — skipping",
                comp.slug, comp.slug, comp.pot_stem.lower(),
                f"{comp.pot_stem}.pot",
            )
            counts["not_found"] += len(languages)
            continue

        for lang in languages:
            logger.info("  Language: %s", lang)
            # Build export and get download URL
            download_url = _build_translation_export(
                session, project_id, file_id, lang,
            )
            if not download_url:
                counts["error"] += 1
                continue

            result = _download_po(
                session, download_url, lang, comp.translations_dir,
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

    parser = argparse.ArgumentParser(description="Pull translations from Crowdin")
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
