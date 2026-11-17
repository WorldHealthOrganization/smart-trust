#!/usr/bin/env python3
"""
SMART Guidelines Translation Extraction Script

Extracts translatable strings from visual and architectural diagram sources
and markdown narrative pages into Gettext .pot template files for
Weblate-based localisation.

Targeted source types (aligned with the L3 Authoring SOP):
  - PlantUML  (.plantuml)  in input/images-source/
  - Custom SVG (.svg)      in input/images/
  - ArchiMate  (.archimate) in input/archimate/
  - UML diagrams (.svg/.xml) in input/diagrams/
  - Markdown pages (.md)    in input/pagecontent/   ← one .pot per hand-authored page

Note on Prism.js: syntax highlighting in generated pages is provided by
Prism.js, which is already bundled by the base FHIR IG Publisher template
(who.template.root).  No separate Prism.js load is required or performed.

Each .pot file records:
  - #. Source: <github-url>#L<line>   — clickable link to source file/line on GitHub
  - #. URL: <canonical-page-url>      — published page for Weblate context

When GITHUB_REPOSITORY or dak.json previewUrl is available, Source comments
become full GitHub blob URLs.  Otherwise, repository-relative paths are used.

Usage:
    python extract_translations.py [options]

Options:
    --ig-root DIR          Repository root (default: current directory)
    --canonical URL        IG canonical base URL
                           (default: http://smart.who.int/base)
    --preview-url URL      Draft/preview base URL (e.g. the GitHub Pages URL).
                           When provided, each POT entry will include context
                           links for both the release and draft deployments.
    --output-dir DIR       Override a single output directory for all .pot
                           files (useful for testing)
    --help / -h            Print this help
"""

import argparse
import datetime
import glob as glob_module
import io
import logging
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Optional lxml import (graceful fallback to stdlib xml.etree)
# ---------------------------------------------------------------------------
try:
    import lxml.etree as ET
    _HAVE_LXML = True
except ImportError:  # pragma: no cover
    import xml.etree.ElementTree as ET  # type: ignore
    _HAVE_LXML = False

# ---------------------------------------------------------------------------
# Optional translation_config import for GitHub source URL helpers
# ---------------------------------------------------------------------------
try:
    from translation_config import derive_github_blob_base, make_source_url
except ImportError:
    # Graceful fallback when translation_config is unavailable: source URLs
    # remain as repo-relative paths (the pre-existing behaviour).
    derive_github_blob_base = None  # type: ignore[assignment]

    def make_source_url(relative_path: str, blob_base: Optional[str]) -> str:  # type: ignore[misc]
        return relative_path

# ---------------------------------------------------------------------------
# PlantUML syntax exclusion list
# Words/patterns that must NOT be extracted as translatable text.
# ---------------------------------------------------------------------------
PLANTUML_KEYWORDS: frozenset = frozenset([
    # diagram-type declarations
    "startuml", "enduml",
    "startmindmap", "endmindmap",
    "startgantt", "endgantt",
    "startsalt", "endsalt",
    "startwbs", "endwbs",
    "startjson", "endjson",
    "startyaml", "endyaml",
    # layout / style
    "skinparam", "hide", "show", "left", "right", "center",
    "top", "bottom", "up", "down",
    "horizontal", "vertical", "together",
    "newpage", "autonumber", "autoactivate",
    # element keywords
    "participant", "actor", "boundary", "control", "entity",
    "database", "collections", "queue", "component", "interface",
    "package", "node", "cloud", "frame", "rectangle",
    "class", "abstract", "enum", "annotation",
    "usecase", "state", "object", "artifact",
    "folder", "file", "hexagon", "agent", "stack",
    "card", "label", "map", "storage",
    # relation keywords
    "as", "with", "of", "is", "in", "extends", "implements",
    # note / grouping keywords
    "note", "end", "ref", "over", "across",
    "group", "box", "alt", "else", "opt", "loop",
    "par", "break", "critical", "neg",
    "legend", "endlegend",
    # colour / style
    "order", "activate", "deactivate", "destroy", "create",
    "return", "autonumber", "delay", "divider", "space",
    # misc
    "title", "header", "footer", "caption",
    "mainframe", "allow_mixing",
    "!include", "!theme", "!pragma",
    "sprite",
])

# Regex patterns for lines that are purely PlantUML directives (never extract)
_PLANTUML_DIRECTIVE_RE = re.compile(
    r"""^\s*(?:
        @\w+                          |  # @startuml / @enduml etc.
        '.*                           |  # single-quote comment
        /\*|\*/                       |  # block comment delimiters
        skinparam\b                   |  # skinparam block
        \!(?:include|theme|pragma)\b  |  # pre-processor directives
        \#[0-9A-Fa-f]{3,8}\b         |  # inline colour
        [\-\~\.=<>#\[\]\{\}]{2,}        # arrow / box drawing chars
    )""",
    re.VERBOSE,
)

# Pattern to extract a quoted label from a PlantUML declaration line.
# Captures content inside double-quotes (handles escaped quotes).
_QUOTED_LABEL_RE = re.compile(r'"((?:[^"\\]|\\.)+)"')

# Pattern to extract unquoted labels that follow certain keywords, e.g.:
#   title My Title
#   header Some Header
#   footer Some Footer
_UNQUOTED_KEYWORD_LABEL_RE = re.compile(
    r"^\s*(?:title|header|footer|caption)\s+(.+)$", re.IGNORECASE
)

# Arrow message: A -> B : some text   (extract "some text")
_ARROW_MESSAGE_RE = re.compile(r":\s*([^:\n]+)\s*$")

# Multi-line note block pattern
_NOTE_START_RE = re.compile(
    r"^\s*note\s+(?:left|right|over[\w\s,]*|across|as\s+\w+)\s*$", re.IGNORECASE
)
_NOTE_END_RE = re.compile(r"^\s*end\s+note\s*$", re.IGNORECASE)
_INLINE_NOTE_RE = re.compile(
    r"^\s*note\s+(?:left|right|over|across)[^:]*:\s*(.+)$", re.IGNORECASE
)

# Legend block
_LEGEND_START_RE = re.compile(r"^\s*legend\s*(?:left|right|center)?\s*$", re.IGNORECASE)
_LEGEND_END_RE = re.compile(r"^\s*end\s*legend\s*$", re.IGNORECASE)


# ---------------------------------------------------------------------------
# POT file helpers
# ---------------------------------------------------------------------------

POT_HEADER = """\
# WHO SMART Guidelines Translation Template
# Copyright (C) {year} World Health Organization
# This file is distributed under the CC-BY-SA-3.0-IGO license.
#
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: WHO SMART Guidelines\\n"
"POT-Creation-Date: {timestamp}\\n"
"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n"
"Language-Team: LANGUAGE <LL@li.org>\\n"
"Language: \\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=6; plural=(n==1 ? 0 : n==2 ? 1 : n>=3 && n<=10 ? 2 : n>=11 && n<=99 ? 3 : 4);\\n"

"""


# Regex patterns for lines that vary only by timestamp/year in .pot files.
_POT_CREATION_DATE_RE = re.compile(r'^"POT-Creation-Date:.*\\n"\s*$')
_POT_COPYRIGHT_RE = re.compile(r"^# Copyright \(C\) \d{4} ")


def _reproducible_timestamp() -> datetime.datetime:
    """Return a deterministic UTC timestamp for .pot file headers.

    Checks ``SOURCE_DATE_EPOCH`` (standard reproducible-builds env var) first,
    then falls back to the git author date of HEAD so that the same commit
    always produces the same .pot timestamp regardless of wall-clock time.
    This prevents timestamp-only diffs that cause merge conflicts across
    branches.  Falls back to ``datetime.now(UTC)`` when git is unavailable.
    """
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch:
        try:
            return datetime.datetime.fromtimestamp(int(epoch), tz=datetime.timezone.utc)
        except (ValueError, OSError):
            pass
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            return datetime.datetime.fromtimestamp(
                int(result.stdout.strip()), tz=datetime.timezone.utc
            )
    except (OSError, subprocess.TimeoutExpired, ValueError):
        pass
    return datetime.datetime.now(datetime.timezone.utc)


def _normalize_pot_content(content: str) -> str:
    """Strip timestamp-varying lines from ``.pot`` content for comparison.

    Removes ``POT-Creation-Date`` header values and ``# Copyright (C) YYYY``
    comment lines so that two ``.pot`` files can be compared ignoring
    metadata that changes on every regeneration.
    """
    lines = content.splitlines(True)
    return "".join(
        line for line in lines
        if not _POT_CREATION_DATE_RE.match(line)
        and not _POT_COPYRIGHT_RE.match(line)
    )


def _escape_pot(text: str) -> str:
    """Escape a string for inclusion in a msgid / msgstr value."""
    text = text.replace("\\", "\\\\")
    text = text.replace('"', '\\"')
    text = text.replace("\n", "\\n\"\n\"")
    return text


def _make_context_url(canonical: str, source_rel: str) -> str:
    """
    Derive the published URL for a source diagram file.

    PlantUML files in input/images-source/foo.plantuml are rendered to
    output/foo.svg, accessible at <canonical>/foo.svg.
    SVGs in input/images/foo.svg are accessible at <canonical>/foo.svg.
    ArchiMate files have no direct published equivalent; link to the IG root.
    """
    canonical = canonical.rstrip("/")
    source_path = Path(source_rel)
    stem = source_path.stem
    suffix = source_path.suffix.lower()

    if suffix == ".plantuml":
        return f"{canonical}/{stem}.svg"
    elif suffix == ".svg":
        return f"{canonical}/{stem}.svg"
    elif suffix in (".archimate", ".xml"):
        return f"{canonical}/"
    return f"{canonical}/"


# ---------------------------------------------------------------------------
# Entry dataclass (named tuple) for a single translatable string
# ---------------------------------------------------------------------------

class TranslationEntry:
    """Represents a single extractable translatable string."""

    __slots__ = ("source_file", "line_number", "text", "context_url")

    def __init__(self, source_file: str, line_number: int, text: str, context_url: str):
        self.source_file = source_file
        self.line_number = line_number
        self.text = text.strip()
        self.context_url = context_url


# ---------------------------------------------------------------------------
# PlantUML extractor
# ---------------------------------------------------------------------------

def _is_plantuml_keyword_only(text: str) -> bool:
    """Return True if a candidate label is a bare PlantUML keyword."""
    words = re.split(r"[\s_\-]+", text.strip().lower())
    return all(w in PLANTUML_KEYWORDS or not w for w in words)


def extract_plantuml(file_path: str, canonical: str) -> List[TranslationEntry]:
    """
    Extract translatable strings from a PlantUML source file.

    Args:
        file_path: Relative path to the .plantuml file
        canonical: IG canonical base URL

    Returns:
        List of TranslationEntry objects
    """
    entries: List[TranslationEntry] = []
    context_url = _make_context_url(canonical, file_path)

    try:
        with open(file_path, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError as exc:
        logging.getLogger(__name__).warning(f"Cannot read {file_path}: {exc}")
        return entries

    in_note = False
    in_legend = False
    block_lines: List[Tuple[int, str]] = []

    for lineno, raw_line in enumerate(lines, start=1):
        line = raw_line.rstrip("\n")

        # Skip pure directive / comment lines
        if _PLANTUML_DIRECTIVE_RE.match(line):
            continue

        # --- Multi-line note block ---
        if _NOTE_START_RE.match(line):
            in_note = True
            block_lines = []
            continue
        if in_note:
            if _NOTE_END_RE.match(line):
                in_note = False
                combined = "\n".join(l for _, l in block_lines if l.strip())
                if combined.strip():
                    entries.append(TranslationEntry(file_path, block_lines[0][0] if block_lines else lineno, combined, context_url))
                block_lines = []
            else:
                block_lines.append((lineno, line.strip()))
            continue

        # --- Legend block ---
        if _LEGEND_START_RE.match(line):
            in_legend = True
            block_lines = []
            continue
        if in_legend:
            if _LEGEND_END_RE.match(line):
                in_legend = False
                combined = "\n".join(l for _, l in block_lines if l.strip())
                if combined.strip():
                    entries.append(TranslationEntry(file_path, block_lines[0][0] if block_lines else lineno, combined, context_url))
                block_lines = []
            else:
                block_lines.append((lineno, line.strip()))
            continue

        # --- Inline note ---
        m = _INLINE_NOTE_RE.match(line)
        if m:
            text = m.group(1).strip()
            if text and not _is_plantuml_keyword_only(text):
                entries.append(TranslationEntry(file_path, lineno, text, context_url))
            continue

        # --- Unquoted keyword labels (title, header, footer, caption) ---
        m = _UNQUOTED_KEYWORD_LABEL_RE.match(line)
        if m:
            text = m.group(1).strip()
            if text and not _is_plantuml_keyword_only(text):
                entries.append(TranslationEntry(file_path, lineno, text, context_url))

        # --- Quoted labels ---
        for m in _QUOTED_LABEL_RE.finditer(line):
            text = m.group(1).strip()
            # Skip if it looks like a URL, color, or pure keyword
            if text and not _is_plantuml_keyword_only(text) and not text.startswith("#") and "://" not in text:
                entries.append(TranslationEntry(file_path, lineno, text, context_url))

        # --- Arrow messages (after ":" at end of line) ---
        # Only when line contains an arrow operator.
        # Skip if the message is a quoted string — the quoted-label pass
        # above already extracted it to avoid duplicates.
        # (Plain string check avoids false-positive HTML-comment-filter warnings.)
        if any(op in line for op in ("->", "<-", "->>", "<<-")):
            m = _ARROW_MESSAGE_RE.search(line)
            if m:
                text = m.group(1).strip()
                # If the arrow message is quoted, it was already captured above
                if text.startswith('"') and text.endswith('"'):
                    pass  # already extracted by _QUOTED_LABEL_RE
                elif text and not _is_plantuml_keyword_only(text) and not text.startswith("#"):
                    entries.append(TranslationEntry(file_path, lineno, text, context_url))

    return entries


# ---------------------------------------------------------------------------
# SVG extractor
# ---------------------------------------------------------------------------

# SVG namespace
_SVG_NS = "http://www.w3.org/2000/svg"

# XHTML namespace (used in SVG <foreignObject> content)
_XHTML_NS = "http://www.w3.org/1999/xhtml"

# Text-bearing SVG element tags (with/without namespace).
# Includes XHTML elements that appear inside <foreignObject> blocks.
_SVG_TEXT_TAGS = {
    f"{{{_SVG_NS}}}text",
    f"{{{_SVG_NS}}}tspan",
    f"{{{_SVG_NS}}}title",
    f"{{{_SVG_NS}}}desc",
    "text", "tspan", "title", "desc",
    f"{{{_XHTML_NS}}}div",
    f"{{{_XHTML_NS}}}span",
    f"{{{_XHTML_NS}}}p",
    "div", "span", "p",
}


def _get_text_content(element) -> str:
    """Recursively collect all text from an XML element."""
    parts = []
    if element.text:
        parts.append(element.text.strip())
    for child in element:
        parts.append(_get_text_content(child))
        if child.tail:
            parts.append(child.tail.strip())
    return " ".join(p for p in parts if p)


def extract_svg(file_path: str, canonical: str) -> List[TranslationEntry]:
    """
    Extract translatable text from a custom SVG file.

    Args:
        file_path: Relative path to the .svg file
        canonical: IG canonical base URL

    Returns:
        List of TranslationEntry objects
    """
    entries: List[TranslationEntry] = []
    context_url = _make_context_url(canonical, file_path)

    try:
        if _HAVE_LXML:
            parser = ET.XMLParser(recover=True)
            tree = ET.parse(file_path, parser)
        else:
            tree = ET.parse(file_path)
        root = tree.getroot()
    except Exception as exc:
        logging.getLogger(__name__).warning(f"Cannot parse SVG {file_path}: {exc}")
        return entries

    # Walk all elements and collect text-bearing ones
    for element in root.iter():
        tag = element.tag
        if tag not in _SVG_TEXT_TAGS:
            continue

        # Try to get an approximate line number from lxml
        lineno = getattr(element, "sourceline", 0) or 0
        text = _get_text_content(element).strip()
        if text:
            entries.append(TranslationEntry(file_path, lineno, text, context_url))

    return entries


# ---------------------------------------------------------------------------
# ArchiMate extractor
# ---------------------------------------------------------------------------

def extract_archimate(file_path: str, canonical: str) -> List[TranslationEntry]:
    """
    Extract translatable strings from an ArchiMate Open Exchange XML file.

    ArchiMate Open Exchange Format is XML-based.  Translatable content lives in:
      - <name> element text
      - <documentation> element text
      - <label> element text (inside <labelExpression>)

    Args:
        file_path: Relative path to the .archimate file
        canonical: IG canonical base URL

    Returns:
        List of TranslationEntry objects
    """
    entries: List[TranslationEntry] = []
    context_url = _make_context_url(canonical, file_path)

    try:
        if _HAVE_LXML:
            parser = ET.XMLParser(recover=True)
            tree = ET.parse(file_path, parser)
        else:
            tree = ET.parse(file_path)
        root = tree.getroot()
    except Exception as exc:
        logging.getLogger(__name__).warning(f"Cannot parse ArchiMate {file_path}: {exc}")
        return entries

    _TARGET_LOCAL_NAMES = {"name", "documentation", "label", "content", "value"}

    for element in root.iter():
        # Strip namespace to get local name
        tag = element.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag.lower() not in _TARGET_LOCAL_NAMES:
            continue

        lineno = getattr(element, "sourceline", 0) or 0
        text = (element.text or "").strip()
        if text:
            entries.append(TranslationEntry(file_path, lineno, text, context_url))

    return entries


# ---------------------------------------------------------------------------
# Markdown extractor
# ---------------------------------------------------------------------------

# Patterns used by the markdown extractor
_MD_FRONT_MATTER_DELIM = re.compile(r"^---\s*$")
_MD_HEADING_RE = re.compile(r"^#{1,6}\s+(.+)$")
_MD_CODE_FENCE_RE = re.compile(r"^(`{3,}|~{3,})")
_MD_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_MD_INLINE_CODE_RE = re.compile(r"`[^`]+`")
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_MD_ANGLE_LINK_RE = re.compile(r"<https?://[^>]+>")
_MD_HTML_TAG_RE = re.compile(r"<[^>]+>")
# Match bold/italic emphasis separately to avoid backreference failures with
# mismatched markers (e.g. *text_ or nested emphasis).
_MD_BOLD_RE = re.compile(r"\*{2,3}([^*]+)\*{2,3}")
_MD_ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)")
# Liquid control-flow / block tags — removed during text cleaning.
_MD_LIQUID_TAG_RE = re.compile(r"\{%.*?%\}", re.DOTALL)
# Liquid output expressions (e.g. ``{{ variable }}``, ``{{ user.name }}``) are
# transformed to gettext brace-format variables with a distinguishing prefix so
# that only variables that originated from Liquid templates are ever back-converted
# to ``{{ }}`` syntax during injection.  Variables whose source is not a Liquid
# expression are left as plain text and never touched by the injector.
#
# Example:  ``{{ count }}`` → ``{lqd_count}``
_MD_LIQUID_OUTPUT_RE = re.compile(r"\{\{\s*(.*?)\s*\}\}", re.DOTALL)
# Prefix prepended to every Liquid output variable name in the gettext msgid.
# The injector uses this prefix to distinguish Liquid-originated variables from
# any other brace groups that may appear in a .po file.
_LQD_PREFIX: str = "lqd_"
# Detects prefixed brace variables produced by the Liquid→gettext transform that
# are valid Python dotted identifiers — used to decide whether to emit the
# ``#, python-brace-format`` flag in the POT.
_MD_SIMPLE_BRACE_VAR_RE = re.compile(
    r"\{lqd_[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\}"
)
# Any prefixed brace group in the cleaned msgid (to detect presence of Liquid
# variables at all; non-prefixed brace groups are ignored).
_MD_ANY_BRACE_RE = re.compile(r"\{lqd_[^{}\n]+\}")
# Kramdown / Jekyll attribute list syntax (e.g. {: .no_toc} or {:toc})
_MD_KRAMDOWN_ATTR_RE = re.compile(r"^\{[:%][^}]*\}\s*$")
# HTML block elements whose content must not be extracted (CSS, JS, pre-formatted)
_MD_HTML_SKIP_OPEN_RE = re.compile(r"<(style|script|pre)\b", re.IGNORECASE)
_MD_HTML_CLOSE_TAG_RE = re.compile(r"</(\w+)\s*>", re.IGNORECASE)
# Horizontal rule pattern
_MD_HLINE_RE = re.compile(r"^[-*_]{3,}\s*$")
# Table separator row (e.g. |---|---|)
_MD_TABLE_SEP_RE = re.compile(r"^\|[-| :]+\|?\s*$")
# List item (unordered or ordered)
_MD_LIST_ITEM_RE = re.compile(r"^(\s*)(?:[-*+]|\d+\.)\s+(.*)")
# Blockquote line
_MD_BLOCKQUOTE_RE = re.compile(r"^>+\s?(.*)")

# Minimum character length for a string to be considered translatable
_MD_MIN_TEXT_LEN: int = 3

# ---------------------------------------------------------------------------
# Auto-generated pagecontent detection
# ---------------------------------------------------------------------------

# Substrings that, when found within the first few lines of a file in
# input/pagecontent/, indicate the file was produced by a script (SUSHI,
# generate_dak_api_hub.py, generate_smart_liquid.py, etc.) and must be
# excluded from translation extraction.
_PAGECONTENT_AUTOGEN_MARKERS: Tuple[str, ...] = (
    "<!-- DAK_API_PLACEHOLDER:",
    "<!-- This content is automatically generated",
    "<!-- auto-generated",
    "This page is auto-generated by",
)

# Only inspect this many lines when probing for auto-generation markers.
_PAGECONTENT_AUTOGEN_SCAN_LINES: int = 20


def _is_autogenerated_pagecontent(file_path: str) -> bool:
    """Return True if *file_path* appears to be an auto-generated Markdown page.

    Scans the first :data:`_PAGECONTENT_AUTOGEN_SCAN_LINES` lines of the file
    for any of the substrings in :data:`_PAGECONTENT_AUTOGEN_MARKERS`.  Files
    matching any marker are skipped by the pagecontent translation extractor so
    that only hand-authored narrative pages end up in ``pages.pot``.

    Args:
        file_path: Absolute or relative path to a ``.md`` file.

    Returns:
        ``True`` if the file contains an auto-generation marker, ``False``
        otherwise (including when the file cannot be opened).
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as fh:
            for i, line in enumerate(fh):
                if i >= _PAGECONTENT_AUTOGEN_SCAN_LINES:
                    break
                for marker in _PAGECONTENT_AUTOGEN_MARKERS:
                    if marker in line:
                        return True
    except OSError:
        pass
    return False


def _clean_markdown_text(text: str) -> str:
    """Strip markdown formatting from a text fragment to obtain plain text.

    Removes inline code, emphasis markers, links (keeping link text), images
    (keeping alt text), HTML tags, and Liquid ``{% %}`` control tags.

    Liquid output expressions (``{{ variable }}``) are **transformed** into
    prefixed gettext brace-format variables (``{lqd_variable}``) so that:

    * Translators can see the placeholder and reposition it in their translation.
    * ``plural forms`` in target languages can be expressed correctly relative
      to the numeric variable (e.g. ``{lqd_count}``).
    * ``msgfmt --check-format`` can validate variable consistency when the entry
      is annotated with ``#, python-brace-format``.
    * **Only** variables prefixed with ``lqd_`` are ever back-converted to
      ``{{ }}`` syntax during injection, so any other ``{…}`` text in a
      ``.po`` file is never accidentally treated as a Liquid expression.

    The reverse transformation (``{lqd_variable}`` → ``{{ variable }}``) is
    performed by :func:`inject_translations._gettext_to_liquid` when writing
    translated Markdown files.

    Implementation note:  Liquid expressions are **tokenised** (replaced with
    NUL-byte sentinels) before bold/italic processing so that underscores
    inside variable names like ``{{ cell_var }}`` are never consumed by the
    italic ``_..._`` regex.  The sentinels are then restored as ``{lqd_...}``
    after all other markdown cleaning has been applied.

    Args:
        text: Raw markdown text fragment.

    Returns:
        Plain-text representation suitable for a msgid value.
    """
    # Remove Liquid/Jekyll control tags ({% ... %}) first.
    text = _MD_LIQUID_TAG_RE.sub("", text)
    # Tokenise Liquid output expressions with NUL-byte sentinels so that the
    # bold/italic regexes cannot accidentally consume underscores inside variable
    # names (e.g. {{ cell_var }} → \x00LQD0\x00 so _cell_ is never seen).
    _lqd_tokens: List[str] = []

    def _save_lqd(m: re.Match) -> str:  # type: ignore[type-arg]
        _lqd_tokens.append(m.group(1).strip())
        return f"\x00LQD{len(_lqd_tokens) - 1}\x00"

    text = _MD_LIQUID_OUTPUT_RE.sub(_save_lqd, text)
    # Remove HTML comments
    text = _MD_HTML_COMMENT_RE.sub("", text)
    # Replace images with alt text
    text = _MD_IMAGE_RE.sub(r"\1", text)
    # Replace links with link text
    text = _MD_LINK_RE.sub(r"\1", text)
    # Remove angle-bracket auto-links
    text = _MD_ANGLE_LINK_RE.sub("", text)
    # Remove inline code spans
    text = _MD_INLINE_CODE_RE.sub("", text)
    # Strip bold/italic markers while keeping the content
    text = _MD_BOLD_RE.sub(r"\1", text)
    text = _MD_ITALIC_RE.sub(lambda m: m.group(1) or m.group(2), text)
    # Remove remaining HTML tags
    text = _MD_HTML_TAG_RE.sub("", text)
    # Restore tokenised Liquid expressions as {lqd_expr} gettext variables.
    for i, expr in enumerate(_lqd_tokens):
        text = text.replace(f"\x00LQD{i}\x00", "{" + _LQD_PREFIX + expr + "}")
    return text.strip()


def extract_markdown(file_path: str, canonical: str) -> List[TranslationEntry]:
    """Extract translatable strings from a Markdown narrative page.

    This function replaces the FHIR IG Publisher's markdown POT generation
    for ``input/pagecontent/`` files.  It extracts heading text and
    paragraph/list-item text while skipping YAML front matter, fenced code
    blocks, HTML ``<style>`` / ``<script>`` blocks, and lines that consist
    entirely of markup or whitespace.

    Args:
        file_path: Relative path to the ``.md`` file (from ig_root).
        canonical: IG canonical base URL.

    Returns:
        List of TranslationEntry objects.
    """
    entries: List[TranslationEntry] = []
    context_url = _make_markdown_context_url(canonical, file_path)

    try:
        with open(file_path, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError as exc:
        logging.getLogger(__name__).warning(f"Cannot read {file_path}: {exc}")
        return entries

    in_front_matter = False
    in_code_block = False
    code_fence: Optional[str] = None
    in_html_block = False      # inside <style>, <script>, or <pre> blocks
    html_close_tag: str = ""   # closing tag we're waiting for
    paragraph_lines: List[Tuple[int, str]] = []

    def _flush_paragraph() -> None:
        """Emit a TranslationEntry for the accumulated paragraph lines."""
        if not paragraph_lines:
            return
        raw = " ".join(l for _, l in paragraph_lines)
        text = _clean_markdown_text(raw)
        if len(text) >= _MD_MIN_TEXT_LEN:
            entries.append(TranslationEntry(
                file_path, paragraph_lines[0][0], text, context_url
            ))
        paragraph_lines.clear()

    for lineno, raw_line in enumerate(lines, start=1):
        line = raw_line.rstrip("\n")

        # --- YAML front matter ---
        if lineno == 1 and _MD_FRONT_MATTER_DELIM.match(line):
            in_front_matter = True
            continue
        if in_front_matter:
            if _MD_FRONT_MATTER_DELIM.match(line) and lineno > 1:
                in_front_matter = False
            continue

        # --- Fenced code blocks ---
        fence_m = _MD_CODE_FENCE_RE.match(line)
        if fence_m:
            if not in_code_block:
                _flush_paragraph()
                in_code_block = True
                # Store the full opening fence string so closing detection is
                # correct for fences with more than 3 backticks/tildes.
                code_fence = fence_m.group(1)
            elif code_fence and line.startswith(code_fence[0] * len(code_fence)):
                in_code_block = False
                code_fence = None
            continue
        if in_code_block:
            continue

        stripped = line.strip()

        # --- HTML blocks that should not be extracted (<style>, <script>, <pre>) ---
        if in_html_block:
            # Check for the precise closing tag using regex to avoid partial matches.
            close_m = _MD_HTML_CLOSE_TAG_RE.search(stripped)
            if close_m and close_m.group(1).lower() == html_close_tag:
                in_html_block = False
                html_close_tag = ""
            continue
        # Detect opening of a block-level HTML element whose content is not
        # human-readable prose (style sheets, scripts, preformatted source).
        open_m = _MD_HTML_SKIP_OPEN_RE.search(stripped)
        if open_m:
            tag_name = open_m.group(1).lower()
            _flush_paragraph()
            # Check if the closing tag appears on the same line.
            close_m = _MD_HTML_CLOSE_TAG_RE.search(stripped)
            if close_m and close_m.group(1).lower() == tag_name:
                continue
            in_html_block = True
            html_close_tag = tag_name
            continue

        # --- Blank line: end of paragraph ---
        if not stripped:
            _flush_paragraph()
            continue

        # --- Headings ---
        heading_m = _MD_HEADING_RE.match(line)
        if heading_m:
            _flush_paragraph()
            text = _clean_markdown_text(heading_m.group(1))
            if len(text) >= _MD_MIN_TEXT_LEN:
                entries.append(TranslationEntry(file_path, lineno, text, context_url))
            continue

        # --- Horizontal rules / table separators (skip) ---
        if _MD_HLINE_RE.match(stripped) or _MD_TABLE_SEP_RE.match(stripped):
            _flush_paragraph()
            continue

        # --- List items: strip leading bullet/number, then treat as paragraph text ---
        list_m = _MD_LIST_ITEM_RE.match(line)
        if list_m:
            _flush_paragraph()
            item_text = list_m.group(2).strip()
            text = _clean_markdown_text(item_text)
            if len(text) >= _MD_MIN_TEXT_LEN:
                entries.append(TranslationEntry(file_path, lineno, text, context_url))
            continue

        # --- Block-quote lines: strip leading "> " ---
        bq_m = _MD_BLOCKQUOTE_RE.match(line)
        if bq_m:
            _flush_paragraph()
            text = _clean_markdown_text(bq_m.group(1))
            if len(text) >= _MD_MIN_TEXT_LEN:
                entries.append(TranslationEntry(file_path, lineno, text, context_url))
            continue

        # --- Table rows: extract cell content ---
        if stripped.startswith("|") and stripped.endswith("|"):
            _flush_paragraph()
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            for cell in cells:
                text = _clean_markdown_text(cell)
                if len(text) >= _MD_MIN_TEXT_LEN:
                    entries.append(TranslationEntry(file_path, lineno, text, context_url))
            continue

        # --- Kramdown / Jekyll attribute lists (skip entirely) ---
        if _MD_KRAMDOWN_ATTR_RE.match(stripped):
            _flush_paragraph()
            continue

        # --- Continuation of a paragraph ---
        paragraph_lines.append((lineno, stripped))

    # Flush any remaining paragraph
    _flush_paragraph()

    return entries


def _make_markdown_context_url(canonical: str, source_rel: str) -> str:
    """Derive the published URL for a markdown page source file.

    Markdown pages in ``input/pagecontent/foo.md`` are published as
    ``<canonical>/foo.html``.

    Args:
        canonical: IG canonical base URL.
        source_rel: Relative path to the source ``.md`` file.

    Returns:
        Absolute published URL string.
    """
    canonical = canonical.rstrip("/")
    stem = Path(source_rel).stem
    return f"{canonical}/{stem}.html"



def write_pot(
    entries: List[TranslationEntry],
    output_path: str,
    canonical: str,
    blob_base: Optional[str] = None,
) -> None:
    """
    Write a Gettext .pot template file from a list of TranslationEntry objects.

    Duplicate msgids are deduplicated while merging their source comments.

    Args:
        entries: List of extracted translation entries
        output_path: Path to the output .pot file
        canonical: IG canonical base URL (for header comments)
        blob_base: GitHub blob URL prefix for clickable source links.
                   When provided, ``#. Source:`` comments become full
                   GitHub URLs.  Optional.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Deduplicate: map msgid -> list of (source_file, line, context_url)
    deduped: Dict[str, List[Tuple[str, int, str]]] = {}
    for entry in entries:
        key = entry.text
        if key not in deduped:
            deduped[key] = []
        deduped[key].append((entry.source_file, entry.line_number, entry.context_url))

    now = _reproducible_timestamp()
    timestamp = now.strftime("%Y-%m-%d %H:%M+0000")
    year = now.year

    buf = io.StringIO()
    buf.write(POT_HEADER.format(year=year, timestamp=timestamp))

    for msgid, locations in sorted(deduped.items(), key=lambda kv: kv[0].lower()):
        # Write source/location comments, deduplicating source locations and URLs.
        # The same (source_file, line) can appear more than once when entries for
        # both the publication URL and the preview URL are merged together, so we
        # suppress duplicate #. Source: lines while still emitting every unique URL.
        seen_sources: set = set()
        seen_urls: set = set()
        for src_file, lineno, ctx_url in locations:
            src_key = (src_file, lineno)
            if src_key not in seen_sources:
                source_ref = make_source_url(f"{src_file}:{lineno}", blob_base)
                buf.write(f"#. Source: {source_ref}\n")
                seen_sources.add(src_key)
            if ctx_url not in seen_urls:
                buf.write(f"#. URL: {ctx_url}\n")
                seen_urls.add(ctx_url)

        # Standard gettext file:line reference (deduplicated)
        seen_refs: set = set()
        for src_file, lineno, _ in locations:
            ref_key = (src_file, lineno)
            if ref_key not in seen_refs:
                buf.write(f"#: {src_file}:{lineno}\n")
                seen_refs.add(ref_key)

        # Emit python-brace-format flag when the msgid contains brace
        # variables produced by the Liquid {{ }} → {var} transformation.
        # Only emit the flag when ALL brace groups are valid Python
        # identifiers (possibly dotted) so that msgfmt --check-format
        # can validate translations without false positives.
        brace_vars = _MD_ANY_BRACE_RE.findall(msgid)
        if brace_vars and all(
            _MD_SIMPLE_BRACE_VAR_RE.fullmatch(v) for v in brace_vars
        ):
            buf.write("#, python-brace-format\n")

        escaped = _escape_pot(msgid)
        buf.write(f'msgid "{escaped}"\n')
        buf.write('msgstr ""\n\n')

    new_content = buf.getvalue()

    logger = logging.getLogger(__name__)

    # Skip writing when the only differences are timestamp metadata
    # (POT-Creation-Date / Copyright year) to avoid noisy commits.
    if os.path.isfile(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as fh:
                old_content = fh.read()
            if _normalize_pot_content(old_content) == _normalize_pot_content(new_content):
                logger.info(
                    f"Skipped {output_path}: only timestamp changed "
                    f"({len(deduped)} msgids unchanged)"
                )
                return
        except OSError:
            pass  # fall through to write

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(new_content)

    logger.info(f"Wrote {len(deduped)} unique msgids to {output_path}")


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def collect_entries(
    ig_root: str,
    canonical: str,
) -> Dict[str, List[TranslationEntry]]:
    """
    Scan all diagram source directories and return per-component entry lists.

    Returns:
        Dict mapping output .pot path -> list of TranslationEntry
    """
    result: Dict[str, List[TranslationEntry]] = {}

    # Helper: scan a directory for source files and collect entries.
    # Returns None when the directory does not exist or contains no matching
    # files so the caller can skip writing an empty .pot for that component.
    def _scan(
        src_dir: str,
        patterns: List[str],
        extractor_fn,
        exclude_fn=None,
    ) -> Optional[List[TranslationEntry]]:
        if not os.path.isdir(src_dir):
            return None
        found: List[TranslationEntry] = []
        for pat in patterns:
            for fpath in sorted(glob_module.glob(os.path.join(src_dir, pat))):
                if exclude_fn is not None and exclude_fn(fpath):
                    logging.getLogger(__name__).debug(
                        "Skipping auto-generated file: %s", fpath
                    )
                    continue
                rel = os.path.relpath(fpath, ig_root)
                found.extend(extractor_fn(rel, canonical))
        return found if found else None

    # --- PlantUML in input/images-source/ ---
    plantuml_dir = os.path.join(ig_root, "input", "images-source")
    plantuml_entries = _scan(plantuml_dir, ["*.plantuml"], extract_plantuml)
    if plantuml_entries is not None:
        result[os.path.join(plantuml_dir, "translations", "diagrams.pot")] = plantuml_entries

    # --- Custom SVG in input/images/ ---
    images_dir = os.path.join(ig_root, "input", "images")
    svg_entries = _scan(images_dir, ["*.svg"], extract_svg)
    if svg_entries is not None:
        result[os.path.join(images_dir, "translations", "images.pot")] = svg_entries

    # --- ArchiMate in input/archimate/ ---
    archimate_dir = os.path.join(ig_root, "input", "archimate")
    archimate_entries = _scan(archimate_dir, ["*.archimate"], extract_archimate)
    if archimate_entries is not None:
        result[os.path.join(archimate_dir, "translations", "models.pot")] = archimate_entries

    # --- UML diagrams in input/diagrams/ (SVG and XML) ---
    diagrams_dir = os.path.join(ig_root, "input", "diagrams")
    diagrams_entries = _scan(diagrams_dir, ["*.svg", "*.xml"], extract_svg)
    if diagrams_entries is not None:
        result[os.path.join(diagrams_dir, "translations", "diagrams.pot")] = diagrams_entries

    # --- Markdown narrative pages in input/pagecontent/ ---
    # This replaces the FHIR IG Publisher's markdown POT generation.  The IG
    # Publisher is now invoked with -generation-off so it only processes FHIR
    # resources; markdown strings are extracted here via Python instead.
    # Auto-generated pages (StructureDefinition-*.md, ValueSet-*.md, etc.) are
    # excluded via _is_autogenerated_pagecontent so that only hand-authored
    # narrative pages are extracted.
    # Each hand-authored .md file gets its own .pot file (e.g. index.md →
    # input/pagecontent/translations/index.pot) so that each page is a
    # separate translation component in Weblate.
    pagecontent_dir = os.path.join(ig_root, "input", "pagecontent")
    if os.path.isdir(pagecontent_dir):
        for md_path in sorted(glob_module.glob(os.path.join(pagecontent_dir, "*.md"))):
            if _is_autogenerated_pagecontent(md_path):
                logging.getLogger(__name__).debug(
                    "Skipping auto-generated file: %s", md_path
                )
                continue
            rel = os.path.relpath(md_path, ig_root)
            entries = extract_markdown(rel, canonical)
            if entries:
                stem = os.path.splitext(os.path.basename(md_path))[0]
                pot_path = os.path.join(pagecontent_dir, "translations", f"{stem}.pot")
                result[pot_path] = entries

    return result


def main() -> int:
    """Entry point."""
    parser = argparse.ArgumentParser(
        description=(
            "Extract translatable strings from SMART diagram sources and "
            "markdown narrative pages into .pot files"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--ig-root",
        default=".",
        help="Repository root directory (default: current directory)",
    )
    parser.add_argument(
        "--canonical",
        default="http://smart.who.int/base",
        help="IG canonical base URL (default: http://smart.who.int/base)",
    )
    parser.add_argument(
        "--preview-url",
        default=None,
        help=(
            "Draft/preview base URL for the IG (e.g. "
            "https://worldhealthorganization.github.io/smart-base). "
            "When provided, each POT entry will include a second #. URL: comment "
            "pointing to the draft deployment so translators see both the release "
            "and draft context links."
        ),
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Override output directory for all .pot files (useful for testing)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    logger = logging.getLogger(__name__)

    ig_root = os.path.abspath(args.ig_root)
    canonical = args.canonical.rstrip("/")
    preview_canonical = args.preview_url.rstrip("/") if args.preview_url else None

    # Derive GitHub blob URL prefix so that #. Source: comments become
    # clickable links in translation platforms (Weblate, Crowdin, etc.).
    blob_base: Optional[str] = None
    if derive_github_blob_base is not None:
        blob_base = derive_github_blob_base(Path(ig_root))

    logger.info(f"Extracting translations from {ig_root} (canonical: {canonical})")
    if preview_canonical:
        logger.info(f"Preview URL: {preview_canonical}")
    if blob_base:
        logger.info(f"GitHub source base: {blob_base}")

    per_component = collect_entries(ig_root, canonical)

    # When a preview URL is supplied, extract a second set of entries using the
    # preview base URL and merge them into the primary results.  The write_pot
    # function deduplicates source locations so that each (file, line) pair
    # produces only one #. Source: line, while both the canonical and preview
    # #. URL: comments are emitted for every entry.
    if preview_canonical:
        preview_component = collect_entries(ig_root, preview_canonical)
        for pot_path, preview_entries in preview_component.items():
            if pot_path in per_component:
                per_component[pot_path].extend(preview_entries)
            else:
                per_component[pot_path] = preview_entries

    if not per_component:
        logger.info("No diagram or markdown source files found — nothing to extract")
        return 0

    total_written = 0
    for pot_path, entries in per_component.items():
        if args.output_dir:
            pot_path = os.path.join(args.output_dir, os.path.basename(pot_path))
        write_pot(entries, pot_path, canonical, blob_base=blob_base)
        total_written += 1

    logger.info(f"Extraction complete: {total_written} .pot file(s) written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
