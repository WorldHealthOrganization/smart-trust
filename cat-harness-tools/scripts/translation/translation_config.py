#!/usr/bin/env python3
"""
translation_config.py — Single authoritative module for reading translation
configuration from sushi-config.yaml (primary) or dak.json (fallback),
discovering translation components, and providing configuration to all other
translation scripts.

Translation configuration (languages, plural forms, services) is defined in
sushi-config.yaml under a top-level ``translations`` key.  For backward
compatibility, the module also checks dak.json#translations as a fallback.

This module eliminates all hardcoded language and component lists. Every script
that needs language codes or component paths MUST import from this module.

Usage as library:
    from translation_config import load_dak_config, get_languages, discover_components

Usage standalone (prints discovered config):
    python translation_config.py [--repo-root .]
"""

import gettext as gettext_module
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

try:
    import yaml  # PyYAML — expected in CI; optional for local dev
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# Default GitHub organization for project slug derivation.
DEFAULT_GITHUB_ORG = "worldhealthorganization"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class LanguageEntry:
    """One target language from sushi-config.yaml#translations.languages."""
    code: str
    name: str
    direction: str  # "ltr" or "rtl"
    plural: str = ""


@dataclass
class ServiceConfig:
    """Configuration for one translation service."""
    enabled: bool = False
    url: str = ""
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TranslationsConfig:
    """Parsed translations block from sushi-config.yaml (or dak.json fallback)."""
    source_language: str = "en"
    languages: List[LanguageEntry] = field(default_factory=list)
    services: Dict[str, ServiceConfig] = field(default_factory=dict)


@dataclass
class DakConfig:
    """Top-level dak.json parsed configuration."""
    resource_type: str = ""
    id: str = ""
    name: str = ""
    title: str = ""
    version: str = ""
    status: str = ""
    translations: Optional[TranslationsConfig] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TranslationComponent:
    """A translation component derived from a .pot file in the repo."""
    slug: str           # e.g. "fsh-base"
    pot_path: Path      # absolute path to the .pot file
    translations_dir: Path  # directory containing .po files
    pot_stem: str       # e.g. "base"


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class DakConfigError(Exception):
    """Raised when dak.json is missing, malformed, or has invalid fields."""
    pass


# ---------------------------------------------------------------------------
# Configuration loading
# ---------------------------------------------------------------------------

def load_dak_config(repo_root: Path) -> DakConfig:
    """
    Load DAK identity from dak.json and translation config from
    sushi-config.yaml (with dak.json as fallback).

    Translation configuration is read from *sushi-config.yaml#translations*
    first.  If that key is absent, *dak.json#translations* is tried for
    backward compatibility.

    Raises:
        DakConfigError: if dak.json is missing, unparseable, or lacks
                        required fields.
    """
    dak_path = repo_root / "dak.json"
    if not dak_path.is_file():
        raise DakConfigError(f"dak.json not found at {dak_path}")

    try:
        raw = json.loads(dak_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise DakConfigError(f"Cannot parse dak.json: {exc}") from exc

    if not isinstance(raw, dict):
        raise DakConfigError("dak.json must be a JSON object")

    # Required top-level fields
    for fld in ("id", "name", "version", "status"):
        if fld not in raw:
            raise DakConfigError(f"dak.json missing required field: {fld}")

    config = DakConfig(
        resource_type=raw.get("resourceType", ""),
        id=raw.get("id", ""),
        name=raw.get("name", ""),
        title=raw.get("title", ""),
        version=raw.get("version", ""),
        status=raw.get("status", ""),
        raw=raw,
    )

    # ── Translation config: sushi-config.yaml first, dak.json fallback ──
    tr_raw = _load_translations_from_sushi(repo_root)
    if tr_raw is None:
        # Fallback to dak.json#translations for backward compatibility
        tr_raw = raw.get("translations")
        if tr_raw and isinstance(tr_raw, dict):
            logger.debug("Loaded translations from dak.json (fallback)")
    else:
        logger.debug("Loaded translations from sushi-config.yaml")

    if tr_raw and isinstance(tr_raw, dict):
        config.translations = _parse_translations(tr_raw)

    return config


def _load_translations_from_sushi(repo_root: Path) -> Optional[Dict[str, Any]]:
    """Read the ``translations`` block from sushi-config.yaml, if present.

    Returns the raw dict or *None* when:
    - sushi-config.yaml does not exist
    - PyYAML is not installed
    - the file has no ``translations`` key
    """
    sushi_path = repo_root / "sushi-config.yaml"
    if not sushi_path.is_file():
        return None

    if yaml is None:
        logger.debug("PyYAML not available — skipping sushi-config.yaml")
        return None

    try:
        sushi_raw = yaml.safe_load(sushi_path.read_text(encoding="utf-8"))
    except (yaml.YAMLError, OSError) as exc:
        logger.warning("Cannot parse sushi-config.yaml: %s", exc)
        return None

    if not isinstance(sushi_raw, dict):
        return None

    tr = sushi_raw.get("translations")
    if tr and isinstance(tr, dict):
        return tr
    return None


def _parse_translations(tr_raw: Dict[str, Any]) -> TranslationsConfig:
    """Parse a translations block (from sushi-config.yaml or dak.json)."""
    tc = TranslationsConfig()
    tc.source_language = tr_raw.get("sourceLanguage", "en")

    langs_raw = tr_raw.get("languages", [])
    if not isinstance(langs_raw, list):
        raise DakConfigError("translations.languages must be an array")

    for entry in langs_raw:
        if not isinstance(entry, dict):
            raise DakConfigError("Each language entry must be a JSON object")
        code = entry.get("code", "")
        if not code:
            raise DakConfigError("Language entry missing required field: code")
        tc.languages.append(LanguageEntry(
            code=code,
            name=entry.get("name", ""),
            direction=entry.get("direction", "ltr"),
            plural=entry.get("plural", ""),
        ))

    svcs_raw = tr_raw.get("services", {})
    if isinstance(svcs_raw, dict):
        for svc_name, svc_data in svcs_raw.items():
            if not isinstance(svc_data, dict):
                continue
            sc = ServiceConfig(
                enabled=bool(svc_data.get("enabled", False)),
                url=svc_data.get("url", ""),
                extra={k: v for k, v in svc_data.items()
                       if k not in ("enabled", "url")},
            )
            tc.services[svc_name] = sc

    return tc


# ---------------------------------------------------------------------------
# Accessors
# ---------------------------------------------------------------------------

def get_languages(config: DakConfig) -> List[LanguageEntry]:
    """Return target language list from translations config."""
    if config.translations is None:
        return []
    return list(config.translations.languages)


def get_language_codes(config: DakConfig) -> List[str]:
    """Return just the language code strings."""
    return [lang.code for lang in get_languages(config)]


def get_enabled_services(config: DakConfig) -> Dict[str, ServiceConfig]:
    """Return dict of enabled translation services and their config."""
    if config.translations is None:
        return {}
    return {
        name: svc for name, svc in config.translations.services.items()
        if svc.enabled
    }


def get_project_slug(github_org: str, repo_name: str) -> str:
    """Derive translation service project slug: '{github_org}-{repo_name}' (lowercase)."""
    return f"{github_org}-{repo_name}".lower()


def derive_project_slug_from_env(repo_root: Optional[Path] = None) -> str:
    """Derive project slug from ``GITHUB_REPOSITORY`` env var, falling back to
    *DEFAULT_GITHUB_ORG* and the repo directory name."""
    github_repo = os.environ.get("GITHUB_REPOSITORY", "")
    if github_repo and "/" in github_repo:
        org, repo_name = github_repo.split("/", 1)
    else:
        org = DEFAULT_GITHUB_ORG
        repo_name = (repo_root or Path(".")).resolve().name
    return get_project_slug(org, repo_name)


def derive_github_blob_base(repo_root: Optional[Path] = None) -> Optional[str]:
    """Derive the GitHub blob URL prefix for source file links.

    The returned string (when not ``None``) has the form::

        https://github.com/{org}/{repo}/blob/{branch}

    with **no** trailing slash.  Callers append ``/{relative_path}`` to
    obtain a clickable link to a specific file.

    Resolution order:

    1. ``GITHUB_REPOSITORY`` + ``GITHUB_REF_NAME`` environment variables
       (always available in GitHub Actions).
    2. ``dak.json#previewUrl`` — the GitHub Pages preview URL encodes the
       org and repo name (e.g. ``https://Org.github.io/repo``).  The
       branch defaults to ``main`` in this case.
    3. ``None`` when no repository information can be determined.
    """
    github_repo = os.environ.get("GITHUB_REPOSITORY", "")
    if github_repo and "/" in github_repo:
        # Always link to main — source references in .pot files should be
        # stable and not reflect transient feature/CI branches.
        return f"https://github.com/{github_repo}/blob/main"

    # Fallback: parse dak.json previewUrl
    if repo_root is not None:
        dak_path = repo_root / "dak.json"
        if dak_path.is_file():
            try:
                data = json.loads(dak_path.read_text(encoding="utf-8"))
                preview = data.get("previewUrl", "")
                if preview:
                    # e.g. "https://WorldHealthOrganization.github.io/smart-base"
                    # → org = WorldHealthOrganization, repo = smart-base
                    parts = preview.rstrip("/").split("/")
                    if len(parts) >= 4:
                        host = parts[2]  # "WorldHealthOrganization.github.io"
                        org = host.split(".")[0]
                        repo_name = parts[3]
                        return f"https://github.com/{org}/{repo_name}/blob/main"
            except (json.JSONDecodeError, OSError):
                pass

    return None


_LINE_SUFFIX_RE = re.compile(r'^(.+):(\d+)$')


def make_source_url(relative_path: str, blob_base: Optional[str]) -> str:
    """Convert a repository-relative file path into a clickable URL.

    When *blob_base* is available the returned string is a full GitHub
    blob URL.  A trailing ``:LINE`` suffix is converted to GitHub's
    ``#LLINE`` fragment format (e.g.
    ``https://github.com/Org/repo/blob/main/input/images/foo.svg#L42``).

    When *blob_base* is ``None`` the original *relative_path* is
    returned unchanged so that .pot files remain valid even when the
    GitHub context is unknown (local development).
    """
    if blob_base:
        # Convert trailing :LINE to GitHub #LLINE fragment
        m = _LINE_SUFFIX_RE.match(relative_path)
        if m:
            return f"{blob_base}/{m.group(1)}#L{m.group(2)}"
        return f"{blob_base}/{relative_path}"
    return relative_path


# ---------------------------------------------------------------------------
# Component discovery
# ---------------------------------------------------------------------------

def _derive_component_slug(pot_path: Path, repo_root: Path) -> str:
    """
    Derive a component slug from a .pot file path.

    Algorithm: take the path segments between 'input/' and '/translations/',
    plus the .pot stem, joined with '-'. Lowercase, non-alphanumeric → '-'.

    Example: input/fsh/translations/base.pot → fsh-base
    """
    rel = pot_path.relative_to(repo_root)
    parts = rel.parts  # e.g. ('input', 'fsh', 'translations', 'base.pot')

    # Find 'input' and 'translations' indices
    try:
        input_idx = list(parts).index("input")
    except ValueError:
        # fallback: use parent dir name + stem
        return re.sub(r"[^a-z0-9]+", "-",
                       f"{pot_path.parent.parent.name}-{pot_path.stem}".lower()).strip("-")

    try:
        trans_idx = list(parts).index("translations")
    except ValueError:
        trans_idx = len(parts) - 1

    # Segments between input/ and translations/
    middle = parts[input_idx + 1:trans_idx]
    stem = pot_path.stem

    raw_slug = "-".join(list(middle) + [stem])
    slug = re.sub(r"[^a-z0-9]+", "-", raw_slug.lower()).strip("-")
    return slug


def discover_components(repo_root: Path) -> List[TranslationComponent]:
    """
    Scan repo_root for all *.pot files in translations/ directories and derive
    component definitions.

    Returns components sorted by pot_path for deterministic ordering.
    """
    components: List[TranslationComponent] = []

    for pot_path in sorted(repo_root.rglob("**/translations/*.pot")):
        # Skip any paths in output/temp/fsh-generated directories
        rel = str(pot_path.relative_to(repo_root))
        if any(rel.startswith(skip) for skip in
               ("output/", "temp/", "fsh-generated/", "node_modules/")):
            continue

        slug = _derive_component_slug(pot_path, repo_root)
        components.append(TranslationComponent(
            slug=slug,
            pot_path=pot_path,
            translations_dir=pot_path.parent,
            pot_stem=pot_path.stem,
        ))

    return components


def get_component_map(repo_root: Path) -> Dict[str, str]:
    """
    Return a dict mapping component slug → repo-relative translations directory.
    This provides backward-compatibility with the old COMPONENT_MAP constant.
    """
    components = discover_components(repo_root)
    return {
        comp.slug: str(comp.translations_dir.relative_to(repo_root))
        for comp in components
    }


# ---------------------------------------------------------------------------
# Gettext setup helper for script translation
# ---------------------------------------------------------------------------

def setup_gettext(
    script_file: str,
    domain: str = "scripts",
    lang: Optional[str] = None,
) -> Callable[[str], str]:
    """
    Set up gettext for a script file, looking for .mo files in the
    translations/ sibling directory.

    Args:
        script_file: Path to the calling script (typically ``__file__``).
        domain: Gettext domain name.
        lang: Language code to load (e.g. ``"fr"``).  When *None* the
              ``LANGUAGE`` environment variable is consulted, falling back
              to ``"en"`` (source strings returned as-is).

    Returns:
        A callable translation function (the ``_`` function).

    Usage in scripts::

        from translation_config import setup_gettext
        _ = setup_gettext(__file__)           # default / env
        _ = setup_gettext(__file__, lang="fr")  # explicit French
    """
    script_dir = Path(script_file).resolve().parent
    locale_dir = script_dir / "translations"

    if lang is None:
        lang = os.environ.get("LANGUAGE", "en")

    try:
        translation = gettext_module.translation(
            domain, localedir=str(locale_dir), languages=[lang],
        )
        return translation.gettext
    except FileNotFoundError:
        return gettext_module.gettext


# ---------------------------------------------------------------------------
# CLI (standalone diagnostics)
# ---------------------------------------------------------------------------

def main() -> int:
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    parser = argparse.ArgumentParser(
        description="Show translation configuration from sushi-config.yaml / dak.json")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    args = parser.parse_args()

    repo_root = Path(args.repo_root).resolve()
    try:
        config = load_dak_config(repo_root)
    except DakConfigError as exc:
        logger.error("Configuration error: %s", exc)
        return 1

    print(f"DAK: {config.id} ({config.name})")

    if config.translations:
        print(f"Source language: {config.translations.source_language}")
        print("Target languages:")
        for lang in config.translations.languages:
            print(f"  {lang.code} - {lang.name} ({lang.direction})")
        print("Services:")
        for name, svc in config.translations.services.items():
            status = "enabled" if svc.enabled else "disabled"
            print(f"  {name}: {status}" + (f" ({svc.url})" if svc.url else ""))
    else:
        print("No translations block found in sushi-config.yaml or dak.json")

    print("\nDiscovered components:")
    components = discover_components(repo_root)
    if components:
        for comp in components:
            print(f"  {comp.slug} → {comp.pot_path.relative_to(repo_root)}")
    else:
        print("  (no .pot files found)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
