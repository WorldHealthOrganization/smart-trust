#!/usr/bin/env python3
"""
register_translation_project.py — Idempotently create or verify the translation
project and all dynamically discovered components for the current IG repo on
every enabled translation service.

Usage:
    python register_translation_project.py [--service all|weblate|launchpad|crowdin]

    Repo name and org are derived from the GITHUB_REPOSITORY environment variable
    (format ``org/repo-name``).  When GITHUB_REPOSITORY is not set (local dev),
    the ``id`` field from dak.json is used as a fallback.

Environment variables:
    GITHUB_REPOSITORY      Set automatically in GitHub Actions (org/repo-name)
    WEBLATE_API_TOKEN      Weblate API token (if Weblate enabled)
    CROWDIN_API_TOKEN      Crowdin API token (if Crowdin enabled)
    LAUNCHPAD_API_TOKEN    Launchpad API token (if Launchpad enabled)

Exit codes:
    0  Registration completed (or dak.json not found — warning + skip)
    1  Registration error
    2  Invalid --service value

Author: WHO SMART Guidelines Team
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

try:
    import requests
except ImportError:
    sys.exit("ERROR: 'requests' package is required. Run: pip install requests>=2.31.0")

# Add parent directory to path for sibling imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from translation_config import (
    DakConfig,
    DakConfigError,
    TranslationComponent,
    discover_components,
    get_enabled_services,
    get_project_slug,
    load_dak_config,
)
from translation_security import (
    DEFAULT_TIMEOUT_SECONDS,
    assert_no_secret_in_env,
    redact_for_log,
    sanitize_slug,
    sanitize_url,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Weblate registration
# ---------------------------------------------------------------------------

def _register_weblate_project(
    project_slug: str,
    config: DakConfig,
    components: List[TranslationComponent],
    api_token: str,
    weblate_url: str,
    repo_root: Path = Path("."),
) -> bool:
    """
    Idempotently create/verify a Weblate project and its components.

    Returns True on success, False on error.
    """
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json",
        "User-Agent": "SMART-Base-CI/1.0",
    })

    # Check if project exists
    project_url = f"{weblate_url}/api/projects/{project_slug}/"
    try:
        resp = session.get(project_url, timeout=DEFAULT_TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        logger.error("Network error checking project: %s", exc)
        return False

    if resp.status_code == 404:
        # Create project
        logger.info("Creating Weblate project: %s", project_slug)
        create_url = f"{weblate_url}/api/projects/"
        payload = {
            "name": config.title or config.name,
            "slug": project_slug,
            "web": config.raw.get("publicationUrl", ""),
        }
        try:
            resp = session.post(
                create_url, json=payload, timeout=DEFAULT_TIMEOUT_SECONDS
            )
            if resp.status_code not in (200, 201):
                logger.error(
                    "Failed to create project %s: HTTP %d %s",
                    project_slug, resp.status_code, resp.text[:500],
                )
                return False
            logger.info("✓ Created project: %s", project_slug)
        except requests.exceptions.RequestException as exc:
            logger.error("Network error creating project: %s", exc)
            return False
    elif resp.status_code == 200:
        logger.info("✓ Project already exists: %s", project_slug)
    else:
        logger.error(
            "Unexpected HTTP %d checking project %s", resp.status_code, project_slug
        )
        return False

    # Register each component
    all_ok = True
    for comp in components:
        ok = _register_weblate_component(
            session, weblate_url, project_slug, comp, repo_root
        )
        if not ok:
            all_ok = False

    return all_ok


def _register_weblate_component(
    session: requests.Session,
    weblate_url: str,
    project_slug: str,
    comp: TranslationComponent,
    repo_root: Path,
) -> bool:
    """Idempotently register one Weblate component."""
    comp_url = f"{weblate_url}/api/components/{project_slug}/{comp.slug}/"

    try:
        resp = session.get(comp_url, timeout=DEFAULT_TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        logger.error("Network error checking component %s: %s", comp.slug, exc)
        return False

    if resp.status_code == 200:
        logger.info("  ✓ Component already exists: %s", comp.slug)
        return True

    if resp.status_code == 404:
        logger.info("  Creating component: %s", comp.slug)
        create_url = f"{weblate_url}/api/projects/{project_slug}/components/"

        # Weblate expects repo-relative paths, not absolute filesystem paths.
        try:
            rel_translations_dir = comp.translations_dir.relative_to(repo_root)
        except ValueError:
            rel_translations_dir = comp.translations_dir
        try:
            rel_pot_path = comp.pot_path.relative_to(repo_root)
        except ValueError:
            rel_pot_path = comp.pot_path

        payload = {
            "name": comp.slug,
            "slug": comp.slug,
            "file_format": "po",
            "filemask": f"{rel_translations_dir}/*.po",
            # new_base: used by Weblate to create new translation files.
            # template: used by Weblate to locate the source .pot file.
            # Both point to the same POT file per Weblate component config.
            "new_base": str(rel_pot_path),
            "template": str(rel_pot_path),
            "vcs": "github",
        }
        try:
            resp = session.post(
                create_url, json=payload, timeout=DEFAULT_TIMEOUT_SECONDS
            )
            if resp.status_code in (200, 201):
                logger.info("  ✓ Created component: %s", comp.slug)
                return True
            else:
                logger.error(
                    "  Failed to create component %s: HTTP %d %s",
                    comp.slug, resp.status_code, resp.text[:500],
                )
                return False
        except requests.exceptions.RequestException as exc:
            logger.error("Network error creating component %s: %s", comp.slug, exc)
            return False
    else:
        logger.error(
            "  Unexpected HTTP %d checking component %s",
            resp.status_code, comp.slug,
        )
        return False


# ---------------------------------------------------------------------------
# Crowdin registration
# ---------------------------------------------------------------------------

# Crowdin API v2 base URL
_CROWDIN_API_URL = "https://api.crowdin.com/api/v2"


def _register_crowdin_project(
    project_slug: str,
    config: DakConfig,
    components: List[TranslationComponent],
    api_token: str,
    repo_root: Path = Path("."),
) -> bool:
    """
    Idempotently verify a Crowdin project and upload source .pot files.

    The project must already exist in Crowdin (created via the Crowdin UI or
    API with the configured ``projectId``).  This function verifies the
    project is reachable and uploads each component's ``.pot`` file, creating
    or updating the file as appropriate.

    Returns True on success, False on error.
    """
    cr_config = (
        config.translations.services.get("crowdin", None)
        if config.translations else None
    )
    project_id = (cr_config.extra.get("projectId", "") if cr_config else "") or ""
    if not project_id:
        logger.error("Crowdin projectId not configured in sushi-config.yaml")
        return False

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
        "User-Agent": "SMART-Base-CI/1.0",
    })

    # Verify the project is reachable
    project_url = f"{_CROWDIN_API_URL}/projects/{project_id}"
    try:
        resp = session.get(project_url, timeout=DEFAULT_TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        logger.error("Network error checking Crowdin project: %s", exc)
        return False

    if resp.status_code == 404:
        logger.error(
            "Crowdin project %s not found. "
            "Create the project in Crowdin first, then set the projectId in sushi-config.yaml.",
            project_id,
        )
        return False
    if resp.status_code != 200:
        logger.error(
            "Unexpected HTTP %d checking Crowdin project %s: %s",
            resp.status_code, project_id, resp.text[:500],
        )
        return False

    project_data = resp.json().get("data", {})
    logger.info("✓ Crowdin project found: %s (id=%s)",
                project_data.get("name", "?"), project_id)

    # List existing files to detect updates vs. creates
    existing_files = _list_crowdin_project_files(session, project_id)

    # Upload each component's .pot file
    all_ok = True
    for comp in components:
        if not comp.pot_path.is_file():
            logger.warning("  .pot file not found: %s — skipping", comp.pot_path)
            continue
        ok = _upload_crowdin_source_file(
            session, project_id, comp, existing_files, repo_root,
        )
        if not ok:
            all_ok = False

    return all_ok


def _list_crowdin_project_files(
    session: requests.Session,
    project_id: str,
) -> Dict[str, int]:
    """List files in a Crowdin project, returning a name→id mapping."""
    mapping: Dict[str, int] = {}
    url = f"{_CROWDIN_API_URL}/projects/{project_id}/files"
    offset = 0
    limit = 250

    while True:
        params = {"offset": offset, "limit": limit}
        try:
            resp = session.get(url, params=params, timeout=DEFAULT_TIMEOUT_SECONDS)
        except requests.exceptions.RequestException as exc:
            logger.error("  Crowdin list-files failed: %s", exc)
            break

        if resp.status_code != 200:
            # A service's error body is text of unknown provenance; some
            # echo the offending request, auth header included.
            logger.error("  Crowdin list-files HTTP %d: %s",
                         resp.status_code, redact_for_log(resp.text[:500]))
            break

        data = resp.json().get("data", [])
        if not data:
            break

        for item in data:
            file_data = item.get("data", {})
            file_id = file_data.get("id")
            file_name = file_data.get("name", "")
            if file_id and file_name:
                mapping[file_name] = file_id

        if len(data) < limit:
            break
        offset += limit

    return mapping


def _upload_crowdin_source_file(
    session: requests.Session,
    project_id: str,
    comp: TranslationComponent,
    existing_files: Dict[str, int],
    repo_root: Path,
) -> bool:
    """Upload or update a single .pot source file in Crowdin.

    Returns True on success, False on error.
    """
    pot_filename = f"{comp.pot_stem}.pot"
    logger.info("  Component: %s → %s", comp.slug, pot_filename)

    # Step 1: Upload file content to Crowdin storage
    storage_url = f"{_CROWDIN_API_URL}/storages"
    try:
        pot_content = comp.pot_path.read_bytes()
    except OSError as exc:
        logger.error("  Cannot read %s: %s", comp.pot_path, exc)
        return False

    try:
        resp = session.post(
            storage_url,
            headers={
                "Crowdin-API-FileName": pot_filename,
                "Content-Type": "application/octet-stream",
            },
            data=pot_content,
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )
    except requests.exceptions.RequestException as exc:
        logger.error("  Storage upload failed: %s", exc)
        return False

    if resp.status_code not in (200, 201):
        logger.error("  Storage upload HTTP %d: %s",
                      resp.status_code, resp.text[:500])
        return False

    storage_id = resp.json().get("data", {}).get("id")
    if not storage_id:
        logger.error("  Storage upload returned no storage ID")
        return False

    # Step 2: Create or update the file in the project
    file_id = existing_files.get(pot_filename)
    if file_id:
        # Update existing file
        update_url = f"{_CROWDIN_API_URL}/projects/{project_id}/files/{file_id}"
        payload = {"storageId": storage_id}
        try:
            resp = session.put(
                update_url, json=payload, timeout=DEFAULT_TIMEOUT_SECONDS
            )
        except requests.exceptions.RequestException as exc:
            logger.error("  File update failed: %s", exc)
            return False

        if resp.status_code != 200:
            logger.error("  File update HTTP %d: %s",
                          resp.status_code, resp.text[:500])
            return False
        logger.info("  ✓ Updated: %s (file_id=%d)", pot_filename, file_id)
    else:
        # Create new file
        create_url = f"{_CROWDIN_API_URL}/projects/{project_id}/files"
        payload = {
            "storageId": storage_id,
            "name": pot_filename,
            "type": "gettext",
        }
        try:
            resp = session.post(
                create_url, json=payload, timeout=DEFAULT_TIMEOUT_SECONDS
            )
        except requests.exceptions.RequestException as exc:
            logger.error("  File create failed: %s", exc)
            return False

        if resp.status_code not in (200, 201):
            logger.error("  File create HTTP %d: %s",
                          resp.status_code, resp.text[:500])
            return False

        new_id = resp.json().get("data", {}).get("id", "?")
        logger.info("  ✓ Created: %s (file_id=%s)", pot_filename, new_id)

    return True


# ---------------------------------------------------------------------------
# Main registration logic
# ---------------------------------------------------------------------------

_VALID_SERVICES = {"all", "weblate", "launchpad", "crowdin"}


def _derive_repo_info(repo_root: Path) -> tuple[str, str]:
    """
    Return ``(org, repo_name)`` derived from the GITHUB_REPOSITORY env var.

    Falls back to the ``id`` field of dak.json when GITHUB_REPOSITORY is not
    set (e.g. during local development).  The dak.json ``id`` is expected to
    carry the repo name only (not ``org/name``); the org defaults to
    ``worldhealthorganization`` in that case.
    """
    github_repository = os.environ.get("GITHUB_REPOSITORY", "")
    if github_repository:
        parts = github_repository.split("/", 1)
        if len(parts) == 2:
            return parts[0], parts[1]

    # Fallback: read repo name from dak.json id field
    dak_json = repo_root / "dak.json"
    if dak_json.is_file():
        try:
            data = json.loads(dak_json.read_text(encoding="utf-8"))
            repo_name = data.get("id", "")
            if repo_name:
                logger.warning(
                    "GITHUB_REPOSITORY not set — using dak.json id '%s' as repo name",
                    repo_name,
                )
                return "worldhealthorganization", repo_name
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read dak.json id: %s", exc)

    raise RuntimeError(
        "Cannot determine repo name: GITHUB_REPOSITORY is not set and dak.json id is missing. "
        "Set the GITHUB_REPOSITORY environment variable or ensure dak.json contains a valid id field."
    )


def register_project(
    repo_root: Path,
    service_filter: str = "all",
) -> int:
    """
    Register the current IG repo with enabled translation services.

    ``service_filter`` is ``all`` or one of ``weblate``/``launchpad``/``crowdin``.
    When a specific service is given, only that service is registered (provided
    it is also enabled in dak.json).

    Returns 0 on success, 1 on error.
    """
    # Load configuration
    try:
        config = load_dak_config(repo_root)
    except DakConfigError:
        logger.warning("dak.json not found or invalid at %s — skipping", repo_root)
        return 0  # REG-002: missing dak.json → warning + exit 0

    # Derive repo identity
    try:
        github_org, repo_name = _derive_repo_info(repo_root)
    except RuntimeError as exc:
        logger.error("%s", exc)
        return 1

    try:
        github_org = sanitize_slug(github_org, "org")
        repo_name = sanitize_slug(repo_name, "repo-name")
    except ValueError as exc:
        logger.error("%s", exc)
        return 1

    # Discover components
    components = discover_components(repo_root)
    if not components:
        logger.info("No .pot files found — no components to register")

    project_slug = get_project_slug(github_org, repo_name)
    logger.info("Project slug: %s", project_slug)

    enabled_services = get_enabled_services(config)
    if not enabled_services:
        logger.info("No translation services enabled")
        return 0

    # Apply service filter
    if service_filter != "all":
        enabled_services = {
            k: v for k, v in enabled_services.items() if k == service_filter
        }
        if not enabled_services:
            logger.info("Service '%s' is not enabled in dak.json — nothing to do", service_filter)
            return 0

    errors = False

    # Weblate
    if "weblate" in enabled_services:
        api_token = os.environ.get("WEBLATE_API_TOKEN", "")
        if not api_token:
            logger.error("WEBLATE_API_TOKEN not set — cannot register with Weblate")
            errors = True
        else:
            weblate_url = enabled_services["weblate"].url or "https://hosted.weblate.org"
            try:
                weblate_url = sanitize_url(weblate_url, "weblate_url")
            except ValueError as exc:
                logger.error("Invalid Weblate URL: %s", exc)
                errors = True
            else:
                logger.info(
                    "Registering with Weblate (token: %s)",
                    redact_for_log(api_token),
                )
                ok = _register_weblate_project(
                    project_slug, config, components, api_token, weblate_url,
                    repo_root=repo_root,
                )
                if not ok:
                    errors = True

    # Launchpad (stub — logs info about what would be registered)
    if "launchpad" in enabled_services:
        api_token = os.environ.get("LAUNCHPAD_API_TOKEN", "")
        if not api_token:
            logger.error("LAUNCHPAD_API_TOKEN not set — cannot register with Launchpad")
            errors = True
        else:
            logger.info("Launchpad registration: project=%s (%d components)",
                        project_slug, len(components))
            # Launchpad API integration would go here
            logger.info("✓ Launchpad registration completed (stub)")

    # Crowdin
    if "crowdin" in enabled_services:
        api_token = os.environ.get("CROWDIN_API_TOKEN", "")
        if not api_token:
            logger.error("CROWDIN_API_TOKEN not set — cannot register with Crowdin")
            errors = True
        else:
            logger.info(
                "Registering with Crowdin (token: %s)",
                redact_for_log(api_token),
            )
            ok = _register_crowdin_project(
                project_slug, config, components, api_token,
                repo_root=repo_root,
            )
            if not ok:
                errors = True

    return 1 if errors else 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: Optional[List[str]] = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    parser = argparse.ArgumentParser(
        prog="register_translation_project.py",
        description="Register the current IG repo with enabled translation services",
    )
    parser.add_argument(
        "--service",
        default="all",
        help="Translation service to register with: all, weblate, launchpad, crowdin (default: all)",
    )
    args = parser.parse_args(argv)

    if args.service not in _VALID_SERVICES:
        logger.error(
            "Invalid --service value '%s'. Must be one of: %s",
            args.service, ", ".join(sorted(_VALID_SERVICES)),
        )
        return 2

    repo_root = Path(".").resolve()

    # Security: verify tokens are from secrets, not workflow inputs
    for token_env in ("WEBLATE_API_TOKEN", "CROWDIN_API_TOKEN", "LAUNCHPAD_API_TOKEN"):
        try:
            assert_no_secret_in_env(token_env)
        except RuntimeError as exc:
            logger.error("%s", exc)
            return 1

    return register_project(repo_root, service_filter=args.service)


if __name__ == "__main__":
    sys.exit(main())
