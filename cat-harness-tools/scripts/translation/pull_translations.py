#!/usr/bin/env python3
"""
pull_translations.py — Multi-service translation pull orchestrator.

For each enabled service in sushi-config.yaml (or dak.json fallback), calls
the appropriate service adapter script, collects updated .po files, and writes
them to the repo. This is the single entry point called by the
pull_translations.yml workflow; it never contains service-specific logic.

Usage:
    python pull_translations.py [--service weblate|launchpad|crowdin|all]
        [--component SLUG] [--language CODE] [--repo-root .]

Environment variables:
    WEBLATE_API_TOKEN      Weblate API token (if pulling from Weblate)
    CROWDIN_API_TOKEN      Crowdin API token (if pulling from Crowdin)
    LAUNCHPAD_API_TOKEN    Launchpad API token (if pulling from Launchpad)

Exit codes:
    0  Success (or dak.json not found — warning + skip)
    1  One or more pull errors occurred
    2  Bad arguments

Author: WHO SMART Guidelines Team
"""

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from translation_config import (
    DakConfigError,
    derive_project_slug_from_env,
    get_enabled_services,
    load_dak_config,
)
from translation_security import (
    assert_no_secret_in_env,
    redact_for_log,
    sanitize_lang_code,
    sanitize_slug,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Service adapters (imported on demand to avoid hard dependency)
# ---------------------------------------------------------------------------

def _pull_weblate(
    repo_root: Path,
    project_slug: str,
    component_filter: Optional[str],
    language_filter: Optional[str],
    weblate_url: str,
) -> int:
    """Delegate to pull_weblate_translations.py."""
    from pull_weblate_translations import pull_translations as weblate_pull

    api_token = os.environ.get("WEBLATE_API_TOKEN", "")
    if not api_token:
        logger.error("WEBLATE_API_TOKEN not set — cannot pull from Weblate")
        return 1

    return weblate_pull(
        weblate_url=weblate_url,
        project=project_slug,
        output_root=repo_root,
        component_filter=component_filter,
        language_filter=language_filter,
        api_token=api_token,
    )


def _pull_launchpad(
    repo_root: Path,
    project_slug: str,
    component_filter: Optional[str],
    language_filter: Optional[str],
) -> int:
    """Delegate to pull_launchpad_translations.py."""
    try:
        from pull_launchpad_translations import pull_translations as lp_pull
        return lp_pull(
            repo_root=repo_root,
            project_slug=project_slug,
            component_filter=component_filter,
            language_filter=language_filter,
        )
    except ImportError:
        logger.error("pull_launchpad_translations module not available")
        return 1


def _pull_crowdin(
    repo_root: Path,
    project_slug: str,
    component_filter: Optional[str],
    language_filter: Optional[str],
) -> int:
    """Delegate to pull_crowdin_translations.py."""
    try:
        from pull_crowdin_translations import pull_translations as cr_pull
        return cr_pull(
            repo_root=repo_root,
            project_slug=project_slug,
            component_filter=component_filter,
            language_filter=language_filter,
        )
    except ImportError:
        logger.error("pull_crowdin_translations module not available")
        return 1


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def pull_all(
    repo_root: Path,
    service_filter: str = "all",
    component_filter: Optional[str] = None,
    language_filter: Optional[str] = None,
) -> int:
    """
    Pull translations from all enabled services.

    Returns 0 on success, 1 on error.
    """
    try:
        config = load_dak_config(repo_root)
    except DakConfigError:
        logger.warning("Configuration error — skipping translation pull")
        return 0

    enabled = get_enabled_services(config)
    if not enabled:
        logger.info("No translation services enabled")
        return 0

    # Derive project slug from GITHUB_REPOSITORY or fallback
    project_slug = derive_project_slug_from_env(repo_root)

    logger.info("Project slug: %s", project_slug)
    logger.info("Enabled services: %s", ", ".join(enabled.keys()))

    errors = 0

    # Filter services
    services_to_pull = (
        enabled if service_filter == "all"
        else {service_filter: enabled[service_filter]}
        if service_filter in enabled
        else {}
    )

    if not services_to_pull:
        if service_filter != "all":
            logger.warning("Service %r not enabled in translation config", service_filter)
        return 0

    for svc_name, svc_config in services_to_pull.items():
        logger.info("── Pulling from: %s ──", svc_name)

        if svc_name == "weblate":
            weblate_url = svc_config.url or "https://hosted.weblate.org"
            rc = _pull_weblate(
                repo_root, project_slug,
                component_filter, language_filter, weblate_url,
            )
        elif svc_name == "launchpad":
            rc = _pull_launchpad(
                repo_root, project_slug,
                component_filter, language_filter,
            )
        elif svc_name == "crowdin":
            rc = _pull_crowdin(
                repo_root, project_slug,
                component_filter, language_filter,
            )
        else:
            logger.warning("Unknown service: %s — skipping", svc_name)
            continue

        if rc != 0:
            errors += 1

    return 1 if errors > 0 else 0


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
        prog="pull_translations.py",
        description="Pull translations from all enabled services",
    )
    parser.add_argument(
        "--service", default="all",
        choices=["all", "weblate", "launchpad", "crowdin"],
        help="Service to pull from (default: all enabled)",
    )
    parser.add_argument(
        "--component", default="",
        help="Restrict to one component slug",
    )
    parser.add_argument(
        "--language", default="",
        help="Restrict to one language code",
    )
    parser.add_argument(
        "--repo-root", default=".",
        help="Repository root (default: current directory)",
    )
    args = parser.parse_args(argv)

    repo_root = Path(args.repo_root).resolve()

    component_filter = None
    if args.component:
        try:
            component_filter = sanitize_slug(args.component, "component")
        except ValueError as exc:
            # Echoes a CLI argument verbatim. If a token was passed as
            # --component or --language by mistake, this is where it lands.
            logger.error("%s", redact_for_log(exc))
            return 2

    language_filter = None
    if args.language:
        try:
            language_filter = sanitize_lang_code(args.language)
        except ValueError as exc:
            # Echoes a CLI argument verbatim. If a token was passed as
            # --component or --language by mistake, this is where it lands.
            logger.error("%s", redact_for_log(exc))
            return 2

    # Security checks
    for token_env in ("WEBLATE_API_TOKEN", "CROWDIN_API_TOKEN", "LAUNCHPAD_API_TOKEN"):
        try:
            assert_no_secret_in_env(token_env)
        except RuntimeError as exc:
            # Echoes a CLI argument verbatim. If a token was passed as
            # --component or --language by mistake, this is where it lands.
            logger.error("%s", redact_for_log(exc))
            return 1

    return pull_all(
        repo_root=repo_root,
        service_filter=args.service,
        component_filter=component_filter,
        language_filter=language_filter,
    )


if __name__ == "__main__":
    sys.exit(main())
