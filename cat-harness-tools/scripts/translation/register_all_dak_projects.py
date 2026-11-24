#!/usr/bin/env python3
"""
register_all_dak_projects.py — Discover all repos in a GitHub org that contain
a dak.json file, then register each with all enabled translation services.

Uses the GitHub Code Search API to find repos containing dak.json.

Usage:
    python register_all_dak_projects.py [--dry-run] [--org WorldHealthOrganization]

Environment variables:
    GITHUB_TOKEN           GitHub token for API access (read scope)
    WEBLATE_API_TOKEN      Weblate API token (if Weblate enabled)
    CROWDIN_API_TOKEN      Crowdin API token (if Crowdin enabled)
    LAUNCHPAD_API_TOKEN    Launchpad API token (if Launchpad enabled)

Exit codes:
    0  All registrations completed successfully
    1  One or more registrations failed

Author: WHO SMART Guidelines Team
"""

import argparse
import logging
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional

try:
    import requests
except ImportError:
    sys.exit("ERROR: 'requests' package is required. Run: pip install requests>=2.31.0")

sys.path.insert(0, str(Path(__file__).resolve().parent))

from translation_security import (
    DEFAULT_TIMEOUT_SECONDS,
    assert_no_secret_in_env,
    redact_for_log,
)

logger = logging.getLogger(__name__)


def discover_dak_repos(org: str, github_token: str) -> List[str]:
    """
    Use GitHub Code Search API to find all repos in the org that have a dak.json.

    Returns a sorted list of repository names (not full names).
    """
    session = requests.Session()
    session.headers.update({
        "Authorization": f"token {github_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SMART-Base-CI/1.0",
    })

    query = f"filename:dak.json org:{org}"
    url = "https://api.github.com/search/code"
    params = {"q": query, "per_page": 100}

    try:
        resp = session.get(url, params=params, timeout=DEFAULT_TIMEOUT_SECONDS)
    except requests.exceptions.RequestException as exc:
        logger.error("GitHub API error: %s", exc)
        return []

    if resp.status_code != 200:
        logger.error("GitHub search failed: HTTP %d", resp.status_code)
        return []

    data = resp.json()
    repos = set()
    for item in data.get("items", []):
        repo_name = item.get("repository", {}).get("name", "")
        if repo_name:
            repos.add(repo_name)

    return sorted(repos)


def register_single_repo(
    repo_name: str,
    org: str,
    github_token: str,
) -> bool:
    """
    Clone the repo (shallow), then call register_translation_project.py.

    Returns True on success.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        clone_url = f"https://github.com/{org}/{repo_name}.git"
        logger.info("Cloning %s (shallow)...", clone_url)

        result = subprocess.run(
            ["git", "clone", "--depth=1", clone_url, tmpdir],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            # git echoes the URL it was handed. In CI that URL is often
            # rewritten to carry a token (`url.insteadOf`, a credential
            # helper, `http.extraheader`), so clone stderr is a standing
            # way for a credential to reach the log unasked.
            logger.error(
                "Clone failed for %s: %s", repo_name, redact_for_log(result.stderr[:500])
            )
            return False

        # Call register_translation_project.py
        script = Path(__file__).resolve().parent / "register_translation_project.py"
        result = subprocess.run(
            [sys.executable, str(script),
             "--repo-name", repo_name,
             "--repo-root", tmpdir,
             "--org", org],
            timeout=300,
        )
        return result.returncode == 0


def main(argv: Optional[List[str]] = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    parser = argparse.ArgumentParser(
        prog="register_all_dak_projects.py",
        description="Discover all DAK IG repos and register them with translation services",
    )
    parser.add_argument(
        "--org", default="WorldHealthOrganization",
        help="GitHub organization (default: WorldHealthOrganization)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="List discovered repos without registering",
    )
    args = parser.parse_args(argv)

    # Security checks
    for token_env in ("WEBLATE_API_TOKEN", "CROWDIN_API_TOKEN", "LAUNCHPAD_API_TOKEN"):
        try:
            assert_no_secret_in_env(token_env)
        except RuntimeError as exc:
            logger.error("%s", exc)
            return 1

    github_token = os.environ.get("GITHUB_TOKEN", "")
    if not github_token:
        logger.error("GITHUB_TOKEN not set — cannot discover repos")
        return 1

    logger.info("Discovering DAK repos in org: %s", args.org)
    repos = discover_dak_repos(args.org, github_token)

    if not repos:
        logger.info("No DAK repos found")
        return 0

    logger.info("Found %d DAK repo(s): %s", len(repos), ", ".join(repos))

    if args.dry_run:
        logger.info("Dry run — not registering")
        return 0

    errors = 0
    for repo_name in repos:
        logger.info("── Registering: %s ──", repo_name)
        if not register_single_repo(repo_name, args.org, github_token):
            errors += 1

    if errors:
        logger.error("%d/%d registrations failed", errors, len(repos))
        return 1

    logger.info("All %d registrations completed successfully", len(repos))
    return 0


if __name__ == "__main__":
    sys.exit(main())
