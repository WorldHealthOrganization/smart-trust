#!/usr/bin/env python3
"""
WHO SMART Guidelines Translation Injection Script

Reads Gettext .po translation files and re-injects translated strings back
into diagram source files (PlantUML, SVG, ArchiMate) before the FHIR IG
Publisher renders them.

For each language that has a .po file the script produces language-specific
copies of every source file under a <lang>/ sub-directory:

  input/images-source/<lang>/<file>.plantuml
  input/images/<lang>/<file>.svg
  input/archimate/<lang>/<file>.archimate
  input/diagrams/<lang>/<file>.svg

The IG Publisher's directory mirroring then picks those up and renders the
translated diagrams alongside the English originals.

Usage:
    python inject_translations.py [options]

Options:
    --ig-root DIR      Repository root (default: current directory)
    --lang LANG        Only process a specific language code (e.g. fr)
    --dry-run          Show what would be done without writing files
    --help / -h        Print this help

Author: WHO SMART Guidelines Team
"""

import argparse
import glob as glob_module
import logging
import os
import re
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
# PO file parser
# ---------------------------------------------------------------------------

def parse_po_file(po_path: str) -> Dict[str, str]:
    """
    Parse a Gettext .po file and return a dict of msgid -> msgstr mappings.

    Only entries with a non-empty msgstr are included.  Fuzzy entries are
    skipped to avoid injecting uncertain translations.

    Args:
        po_path: Path to the .po file

    Returns:
        Dictionary mapping source strings (msgid) to translations (msgstr)
    """
    translations: Dict[str, str] = {}
    logger = logging.getLogger(__name__)

    try:
        with open(po_path, "r", encoding="utf-8") as fh:
            content = fh.read()
    except OSError as exc:
        logger.warning(f"Cannot read {po_path}: {exc}")
        return translations

    # Split into blocks separated by blank lines
    blocks = re.split(r"\n{2,}", content.strip())
    for block in blocks:
        lines = block.splitlines()

        # Skip header block (first msgid is empty string)
        if 'msgid ""' in lines and 'msgstr ""' not in lines:
            continue

        # Skip fuzzy entries
        if any(line.strip().startswith("#,") and "fuzzy" in line for line in lines):
            continue

        msgid = _extract_po_value(lines, "msgid")
        msgstr = _extract_po_value(lines, "msgstr")

        if msgid and msgstr:
            # Unescape Gettext escape sequences
            translations[_unescape_po(msgid)] = _unescape_po(msgstr)

    logger.info(f"Loaded {len(translations)} translations from {po_path}")
    return translations


def _extract_po_value(lines: List[str], keyword: str) -> str:
    """
    Extract the string value associated with a PO keyword (msgid or msgstr).

    Handles multi-line string values that continue on subsequent lines.
    """
    collecting = False
    parts: List[str] = []

    for line in lines:
        line = line.strip()
        if line.startswith(keyword + " "):
            raw = line[len(keyword):].strip()
            if raw.startswith('"') and raw.endswith('"'):
                parts.append(raw[1:-1])
            collecting = True
        elif collecting:
            if line.startswith('"') and line.endswith('"'):
                parts.append(line[1:-1])
            else:
                break

    return "".join(parts)


def _unescape_po(text: str) -> str:
    """Convert Gettext escape sequences back to literal characters."""
    return (
        text
        .replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace('\\"', '"')
        .replace("\\\\", "\\")
    )


# ---------------------------------------------------------------------------
# PlantUML injector
# ---------------------------------------------------------------------------

# Re-use the same regexes as the extractor (copied here to keep this module
# independently importable).
_QUOTED_LABEL_RE = re.compile(r'"((?:[^"\\]|\\.)+)"')
_UNQUOTED_KEYWORD_LABEL_RE = re.compile(
    r"(^\s*(?:title|header|footer|caption)\s+)(.+)$", re.IGNORECASE
)
_ARROW_MESSAGE_RE = re.compile(r"(:\s*)([^:\n]+)(\s*)$")
_NOTE_START_RE = re.compile(
    r"^\s*note\s+(?:left|right|over[\w\s,]*|across|as\s+\w+)\s*$", re.IGNORECASE
)
_NOTE_END_RE = re.compile(r"^\s*end\s+note\s*$", re.IGNORECASE)
_INLINE_NOTE_RE = re.compile(
    r"(^\s*note\s+(?:left|right|over|across)[^:]*:\s*)(.+)$", re.IGNORECASE
)
_LEGEND_START_RE = re.compile(r"^\s*legend\s*(?:left|right|center)?\s*$", re.IGNORECASE)
_LEGEND_END_RE = re.compile(r"^\s*end\s*legend\s*$", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Liquid ↔ gettext variable conversion helpers
# ---------------------------------------------------------------------------
#
# Markdown pages use Liquid templating (Jekyll/FHIR IG Publisher).  Output
# expressions like ``{{ variable }}`` or ``{{ user.name }}`` must survive the
# translation round-trip as gettext brace-format variables.
#
# A distinguishing prefix (``lqd_``) is prepended during extraction so that
# only variables that originated from Liquid templates are ever back-converted
# to ``{{ }}`` syntax here.  Any other ``{something}`` that appears in a
# translator's msgstr (not from a Liquid template) is left completely alone.
#
# Forward  (extract → POT):  {{ expr }}     →  {lqd_expr}   (extract_translations.py)
# Backward (PO  → markdown): {lqd_expr}    →  {{ expr }}    (this file)
# Untouched:                 {other_thing}  →  {other_thing} (never touched)

# Prefix prepended to every Liquid output variable name.  Must match the
# constant ``_LQD_PREFIX`` in extract_translations.py.
_LQD_PREFIX: str = "lqd_"

# Matches Liquid output expressions: {{ ... }}
_LIQUID_OUTPUT_RE = re.compile(r"\{\{\s*(.*?)\s*\}\}", re.DOTALL)
# Matches only prefixed gettext brace variables produced by our extractor:
# {lqd_...} — leaves other {something} groups untouched.
_GETTEXT_LQD_VAR_RE = re.compile(r"\{lqd_([^{}\n]+)\}")


def _liquid_to_gettext(text: str) -> str:
    """Convert Liquid output expressions to prefixed gettext brace-format variables.

    ``{{ expr }}`` → ``{lqd_expr}``

    Used to derive the msgid key for a markdown text span so that the correct
    translation can be looked up from the .po dictionary.
    """
    return _LIQUID_OUTPUT_RE.sub(lambda m: "{" + _LQD_PREFIX + m.group(1) + "}", text)


def _gettext_to_liquid(text: str) -> str:
    """Convert prefixed gettext brace-format variables back to Liquid output expressions.

    ``{lqd_expr}`` → ``{{ expr }}``

    Only ``{lqd_…}`` groups (produced by the extractor) are converted.  Any
    other ``{something}`` groups that appear in the translated string are left
    completely untouched so that non-Liquid brace text is never accidentally
    wrapped in ``{{ }}``.

    Applied to the translated msgstr before writing it into the output
    Markdown file so that the Liquid templating engine can still evaluate
    the expressions at render time.
    """
    return _GETTEXT_LQD_VAR_RE.sub(lambda m: "{{ " + m.group(1) + " }}", text)


# ---------------------------------------------------------------------------
# Markdown cleaning helpers (mirrors extract_translations._clean_markdown_text)
# ---------------------------------------------------------------------------
#
# These regexes and the _clean_md_for_lookup function must be kept in sync
# with the corresponding code in extract_translations.py so that the same
# msgid keys are produced during both extraction and injection.

_MD_HTML_COMMENT_RE_INJ = re.compile(r"<!--.*?-->", re.DOTALL)
_MD_IMAGE_RE_INJ = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_MD_LINK_RE_INJ = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_MD_ANGLE_LINK_RE_INJ = re.compile(r"<https?://[^>]+>")
_MD_INLINE_CODE_RE_INJ = re.compile(r"`[^`]+`")
_MD_BOLD_RE_INJ = re.compile(r"\*{2,3}([^*]+)\*{2,3}")
_MD_ITALIC_RE_INJ = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)")
_MD_HTML_TAG_RE_INJ = re.compile(r"<[^>]+>")
_MD_LIQUID_TAG_RE_INJ = re.compile(r"\{%.*?%\}", re.DOTALL)


def _clean_md_for_lookup(text: str) -> str:
    """Derive the gettext msgid for a raw Markdown text fragment.

    Mirrors ``extract_translations._clean_markdown_text``: applies the same
    transformations (including the Liquid tokenisation trick) so that the same
    msgid key is produced and the translation can be found in the .po dictionary.
    """
    # Remove Liquid/Jekyll control tags ({% ... %}) first.
    text = _MD_LIQUID_TAG_RE_INJ.sub("", text)
    # Tokenise Liquid output expressions before bold/italic processing so that
    # underscores inside variable names are not consumed by the italic regex.
    _lqd_tokens: List[str] = []

    def _save_lqd(m: re.Match) -> str:  # type: ignore[type-arg]
        _lqd_tokens.append(m.group(1).strip())
        return f"\x00LQD{len(_lqd_tokens) - 1}\x00"

    text = _LIQUID_OUTPUT_RE.sub(_save_lqd, text)
    # Remove HTML comments.
    text = _MD_HTML_COMMENT_RE_INJ.sub("", text)
    # Replace images with alt text.
    text = _MD_IMAGE_RE_INJ.sub(r"\1", text)
    # Replace links with link text.
    text = _MD_LINK_RE_INJ.sub(r"\1", text)
    # Remove angle-bracket auto-links.
    text = _MD_ANGLE_LINK_RE_INJ.sub("", text)
    # Remove inline code spans.
    text = _MD_INLINE_CODE_RE_INJ.sub("", text)
    # Strip bold/italic markers while keeping content.
    text = _MD_BOLD_RE_INJ.sub(r"\1", text)
    text = _MD_ITALIC_RE_INJ.sub(lambda m: m.group(1) or m.group(2), text)
    # Remove remaining HTML tags.
    text = _MD_HTML_TAG_RE_INJ.sub("", text)
    # Restore tokenised Liquid expressions as {lqd_expr} gettext variables.
    for i, expr in enumerate(_lqd_tokens):
        text = text.replace(f"\x00LQD{i}\x00", "{" + _LQD_PREFIX + expr + "}")
    return text.strip()


def inject_plantuml(
    source_path: str,
    translations: Dict[str, str],
    output_path: str,
    dry_run: bool = False,
) -> bool:
    """
    Apply translations to a PlantUML source file and write the result.

    Args:
        source_path: Path to the original .plantuml file
        translations: msgid -> msgstr dictionary
        output_path:  Where to write the translated copy
        dry_run:      If True, only log what would be done

    Returns:
        True if any substitutions were made (or dry_run), False on error
    """
    logger = logging.getLogger(__name__)
    try:
        with open(source_path, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError as exc:
        logger.warning(f"Cannot read {source_path}: {exc}")
        return False

    in_note = False
    in_legend = False
    note_buf: List[str] = []
    note_start_idx = -1
    out_lines = list(lines)
    changed = False

    def _replace_first(text: str) -> str:
        """Replace original text with translation if available."""
        stripped = text.strip()
        translated = translations.get(stripped)
        if translated and translated != stripped:
            return translated
        return text

    for i, raw_line in enumerate(lines):
        line = raw_line.rstrip("\n")

        # --- Note block accumulation ---
        if _NOTE_START_RE.match(line):
            in_note = True
            note_buf = []
            note_start_idx = i
            continue
        if in_note:
            if _NOTE_END_RE.match(line):
                in_note = False
                original = "\n".join(l.strip() for l in note_buf if l.strip())
                translated = translations.get(original)
                if translated and translated != original:
                    # Rebuild the note block with translated text
                    translated_lines = translated.split("\n")
                    # Replace lines note_start_idx+1 .. i-1
                    new_note: List[str] = []
                    for tl in translated_lines:
                        new_note.append(tl + "\n")
                    start = note_start_idx + 1
                    end = i  # exclusive (end note line kept)
                    out_lines[start:end] = new_note
                    # Adjust index offset for remaining iterations
                    changed = True
                note_buf = []
            else:
                note_buf.append(line)
            continue

        # --- Legend block ---
        if _LEGEND_START_RE.match(line):
            in_legend = True
            note_buf = []
            note_start_idx = i
            continue
        if in_legend:
            if _LEGEND_END_RE.match(line):
                in_legend = False
                original = "\n".join(l.strip() for l in note_buf if l.strip())
                translated = translations.get(original)
                if translated and translated != original:
                    translated_lines = translated.split("\n")
                    new_legend: List[str] = []
                    for tl in translated_lines:
                        new_legend.append(tl + "\n")
                    start = note_start_idx + 1
                    end = i
                    out_lines[start:end] = new_legend
                    changed = True
                note_buf = []
            else:
                note_buf.append(line)
            continue

        # --- Inline note ---
        m = _INLINE_NOTE_RE.match(line)
        if m:
            prefix, text = m.group(1), m.group(2).strip()
            translated = translations.get(text)
            if translated and translated != text:
                out_lines[i] = prefix + translated + "\n"
                changed = True
            continue

        # --- Unquoted keyword labels ---
        m = _UNQUOTED_KEYWORD_LABEL_RE.match(line)
        if m:
            prefix, text = m.group(1), m.group(2).strip()
            translated = translations.get(text)
            if translated and translated != text:
                out_lines[i] = prefix + translated + "\n"
                changed = True
            continue

        # --- Quoted labels ---
        def _replace_quoted(match: re.Match[str]) -> str:
            inner = match.group(1).strip()
            translated = translations.get(inner)
            if translated and translated != inner:
                return f'"{translated}"'
            return match.group(0)

        new_line = _QUOTED_LABEL_RE.sub(_replace_quoted, line)
        if new_line != line:
            out_lines[i] = new_line + "\n"
            changed = True
            line = new_line

        # --- Arrow messages ---
        # Quoted arrow messages are already handled by _QUOTED_LABEL_RE above.
        # Only process unquoted messages here to avoid double-substitution.
        # (Plain string check avoids false-positive HTML-comment-filter warnings.)
        if any(op in line for op in ("->", "<-", "->>", "<<-")):
            m = _ARROW_MESSAGE_RE.search(line)
            if m:
                sep, text, trail = m.group(1), m.group(2).strip(), m.group(3)
                # Skip if the message is quoted — already handled above
                if not (text.startswith('"') and text.endswith('"')):
                    translated = translations.get(text)
                    if translated and translated != text:
                        replacement = line[: m.start()] + sep + translated + trail
                        out_lines[i] = replacement + "\n"
                        changed = True

    if dry_run:
        logger.info(f"[dry-run] Would write translated {source_path} -> {output_path} (changed={changed})")
        return True

    if not changed:
        logger.debug(f"No changes for {source_path}, skipping output")
        return False

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        fh.writelines(out_lines)
    logger.info(f"Written translated PlantUML: {output_path}")
    return True


# ---------------------------------------------------------------------------
# SVG injector
# ---------------------------------------------------------------------------

_SVG_NS = "http://www.w3.org/2000/svg"
_SVG_TEXT_TAGS = {
    f"{{{_SVG_NS}}}text",
    f"{{{_SVG_NS}}}tspan",
    f"{{{_SVG_NS}}}title",
    f"{{{_SVG_NS}}}desc",
    "text", "tspan", "title", "desc",
}


def inject_svg(
    source_path: str,
    translations: Dict[str, str],
    output_path: str,
    dry_run: bool = False,
) -> bool:
    """
    Apply translations to an SVG file and write the translated copy.

    Args:
        source_path: Path to the original .svg file
        translations: msgid -> msgstr dictionary
        output_path:  Where to write the translated copy
        dry_run:      If True, only log what would be done

    Returns:
        True if any substitutions were made (or dry_run), False on error
    """
    logger = logging.getLogger(__name__)

    try:
        if _HAVE_LXML:
            parser = ET.XMLParser(recover=True)
            tree = ET.parse(source_path, parser)
        else:
            tree = ET.parse(source_path)
        root = tree.getroot()
    except Exception as exc:
        logger.warning(f"Cannot parse SVG {source_path}: {exc}")
        return False

    changed = False

    for element in root.iter():
        tag = element.tag
        if tag not in _SVG_TEXT_TAGS:
            continue

        # Collect current text content for lookup
        current_text = (element.text or "").strip()
        if not current_text:
            continue

        translated = translations.get(current_text)
        if translated and translated != current_text:
            element.text = translated
            # Propagate RTL direction for Arabic (ar) language
            # The caller is responsible for setting the lang; here we rely on
            # the dir attribute being set on the SVG root or the element.
            changed = True

    if dry_run:
        logger.info(f"[dry-run] Would write translated {source_path} -> {output_path} (changed={changed})")
        return True

    if not changed:
        logger.debug(f"No changes for {source_path}, skipping output")
        return False

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if _HAVE_LXML:
        tree.write(output_path, encoding="UTF-8", xml_declaration=True, pretty_print=True)
    else:
        tree.write(output_path, encoding="unicode", xml_declaration=False)
    logger.info(f"Written translated SVG: {output_path}")
    return True


# ---------------------------------------------------------------------------
# ArchiMate injector
# ---------------------------------------------------------------------------

def inject_archimate(
    source_path: str,
    translations: Dict[str, str],
    output_path: str,
    dry_run: bool = False,
) -> bool:
    """
    Apply translations to an ArchiMate Open Exchange XML file.

    Args:
        source_path: Path to the original .archimate file
        translations: msgid -> msgstr dictionary
        output_path:  Where to write the translated copy
        dry_run:      If True, only log what would be done

    Returns:
        True if any substitutions were made (or dry_run), False on error
    """
    logger = logging.getLogger(__name__)

    try:
        if _HAVE_LXML:
            parser = ET.XMLParser(recover=True)
            tree = ET.parse(source_path, parser)
        else:
            tree = ET.parse(source_path)
        root = tree.getroot()
    except Exception as exc:
        logger.warning(f"Cannot parse ArchiMate {source_path}: {exc}")
        return False

    _TARGET_LOCAL_NAMES = {"name", "documentation", "label", "content", "value"}
    changed = False

    for element in root.iter():
        tag = element.tag
        if "}" in tag:
            tag = tag.split("}", 1)[1]
        if tag.lower() not in _TARGET_LOCAL_NAMES:
            continue

        current_text = (element.text or "").strip()
        if not current_text:
            continue

        translated = translations.get(current_text)
        if translated and translated != current_text:
            element.text = translated
            changed = True

    if dry_run:
        logger.info(f"[dry-run] Would write translated {source_path} -> {output_path} (changed={changed})")
        return True

    if not changed:
        logger.debug(f"No changes for {source_path}, skipping output")
        return False

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if _HAVE_LXML:
        tree.write(output_path, encoding="UTF-8", xml_declaration=True, pretty_print=True)
    else:
        tree.write(output_path, encoding="unicode", xml_declaration=False)
    logger.info(f"Written translated ArchiMate: {output_path}")
    return True


# ---------------------------------------------------------------------------
# Markdown injector
# ---------------------------------------------------------------------------

# Markdown state-machine regexes (mirrors extract_translations.py).
_MD_INJ_FRONT_MATTER_DELIM = re.compile(r"^---\s*$")
_MD_INJ_HEADING_RE = re.compile(r"^(#{1,6}\s+)(.+)$")
_MD_INJ_CODE_FENCE_RE = re.compile(r"^(`{3,}|~{3,})")
_MD_INJ_HTML_SKIP_OPEN_RE = re.compile(r"<(style|script|pre)\b", re.IGNORECASE)
_MD_INJ_HTML_CLOSE_TAG_RE = re.compile(r"</(\w+)\s*>", re.IGNORECASE)
_MD_INJ_HLINE_RE = re.compile(r"^[-*_]{3,}\s*$")
_MD_INJ_TABLE_SEP_RE = re.compile(r"^\|[-| :]+\|?\s*$")
_MD_INJ_LIST_ITEM_RE = re.compile(r"^(\s*(?:[-*+]|\d+\.)\s+)(.+)$")
_MD_INJ_BLOCKQUOTE_RE = re.compile(r"^(>+\s?)(.*)")
_MD_INJ_KRAMDOWN_ATTR_RE = re.compile(r"^\{[:%][^}]*\}\s*$")
_MD_INJ_MIN_LEN: int = 3


def inject_markdown(
    source_path: str,
    translations: Dict[str, str],
    output_path: str,
    dry_run: bool = False,
) -> bool:
    """Apply translations to a Markdown file and write the translated copy.

    Uses the same state machine as ``extract_translations.extract_markdown`` to
    identify every translatable text span, looks up the translation via the
    gettext msgid (with Liquid ``{{ }}`` expressions already collapsed to
    ``{expr}``), then restores ``{{ expr }}`` Liquid syntax in the translated
    string before writing it to *output_path*.

    Args:
        source_path: Path to the original ``.md`` file.
        translations: msgid → msgstr dictionary loaded from a .po file.
        output_path:  Where to write the translated Markdown copy.
        dry_run:      If True, only log what would be done without writing.

    Returns:
        True if any substitutions were made (or dry_run), False on error.
    """
    logger = logging.getLogger(__name__)
    try:
        with open(source_path, "r", encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError as exc:
        logger.warning(f"Cannot read {source_path}: {exc}")
        return False

    out_lines: List[str] = list(lines)
    changed = False

    in_front_matter = False
    in_code_block = False
    code_fence: Optional[str] = None
    in_html_block = False
    html_close_tag: str = ""
    # Each entry: (line_index_into_lines, stripped_text)
    paragraph_buf: List[Tuple[int, str]] = []

    def _translate(raw_text: str) -> Optional[str]:
        """Return the Liquid-restored translation for *raw_text*, or None."""
        msgid = _clean_md_for_lookup(raw_text)
        if len(msgid) < _MD_INJ_MIN_LEN:
            return None
        msgstr = translations.get(msgid)
        if msgstr and msgstr != msgid:
            return _gettext_to_liquid(msgstr)
        return None

    def _flush_paragraph() -> None:
        nonlocal changed
        if not paragraph_buf:
            return
        raw = " ".join(text for _, text in paragraph_buf)
        translated = _translate(raw)
        if translated:
            # Replace the first paragraph line with the full translated text
            # and blank out any continuation lines.  Note: the original line
            # wrapping is not preserved — the translated paragraph is emitted
            # as a single line.  Markdown renderers treat consecutive
            # non-blank lines as the same paragraph, so this is functionally
            # equivalent.
            first_idx = paragraph_buf[0][0]
            out_lines[first_idx] = translated + "\n"
            for idx, _ in paragraph_buf[1:]:
                out_lines[idx] = ""
            changed = True
        paragraph_buf.clear()

    for idx, raw_line in enumerate(lines):
        line = raw_line.rstrip("\n")
        lineno = idx + 1

        # --- YAML front matter ---
        if lineno == 1 and _MD_INJ_FRONT_MATTER_DELIM.match(line):
            in_front_matter = True
            continue
        if in_front_matter:
            if _MD_INJ_FRONT_MATTER_DELIM.match(line) and lineno > 1:
                in_front_matter = False
            continue

        # --- Fenced code blocks ---
        fence_m = _MD_INJ_CODE_FENCE_RE.match(line)
        if fence_m:
            if not in_code_block:
                _flush_paragraph()
                in_code_block = True
                code_fence = fence_m.group(1)
            elif code_fence and line.startswith(code_fence[0] * len(code_fence)):
                in_code_block = False
                code_fence = None
            continue
        if in_code_block:
            continue

        stripped = line.strip()

        # --- HTML blocks (style/script/pre — skip content) ---
        if in_html_block:
            close_m = _MD_INJ_HTML_CLOSE_TAG_RE.search(stripped)
            if close_m and close_m.group(1).lower() == html_close_tag:
                in_html_block = False
                html_close_tag = ""
            continue
        open_m = _MD_INJ_HTML_SKIP_OPEN_RE.search(stripped)
        if open_m:
            tag_name = open_m.group(1).lower()
            _flush_paragraph()
            close_m = _MD_INJ_HTML_CLOSE_TAG_RE.search(stripped)
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
        heading_m = _MD_INJ_HEADING_RE.match(line)
        if heading_m:
            _flush_paragraph()
            prefix, text = heading_m.group(1), heading_m.group(2)
            translated = _translate(text)
            if translated:
                out_lines[idx] = prefix + translated + "\n"
                changed = True
            continue

        # --- Horizontal rules / table separators ---
        if _MD_INJ_HLINE_RE.match(stripped) or _MD_INJ_TABLE_SEP_RE.match(stripped):
            _flush_paragraph()
            continue

        # --- List items ---
        list_m = _MD_INJ_LIST_ITEM_RE.match(line)
        if list_m:
            _flush_paragraph()
            prefix, text = list_m.group(1), list_m.group(2)
            translated = _translate(text.strip())
            if translated:
                out_lines[idx] = prefix + translated + "\n"
                changed = True
            continue

        # --- Block-quote lines ---
        bq_m = _MD_INJ_BLOCKQUOTE_RE.match(line)
        if bq_m:
            _flush_paragraph()
            prefix, text = bq_m.group(1), bq_m.group(2)
            translated = _translate(text)
            if translated:
                out_lines[idx] = prefix + translated + "\n"
                changed = True
            continue

        # --- Table rows: translate each cell ---
        if stripped.startswith("|") and stripped.endswith("|"):
            _flush_paragraph()
            cells = stripped.strip("|").split("|")
            new_cells: List[str] = []
            row_changed = False
            for cell in cells:
                translated = _translate(cell.strip())
                if translated:
                    # Preserve the original cell's leading/trailing whitespace
                    # so that Markdown table alignment is not disrupted.
                    leading = cell[: len(cell) - len(cell.lstrip())] or " "
                    trailing = cell[len(cell.rstrip()):] or " "
                    new_cells.append(leading + translated + trailing)
                    row_changed = True
                else:
                    new_cells.append(cell)
            if row_changed:
                out_lines[idx] = "|" + "|".join(new_cells) + "|\n"
                changed = True
            continue

        # --- Kramdown / Jekyll attribute lists (skip) ---
        if _MD_INJ_KRAMDOWN_ATTR_RE.match(stripped):
            _flush_paragraph()
            continue

        # --- Paragraph continuation ---
        paragraph_buf.append((idx, stripped))

    # Flush any remaining paragraph.
    _flush_paragraph()

    if dry_run:
        logger.info(
            f"[dry-run] Would write translated {source_path} -> {output_path}"
            f" (changed={changed})"
        )
        return True

    if not changed:
        logger.debug(f"No changes for {source_path}, skipping output")
        return False

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        fh.writelines(out_lines)
    logger.info(f"Written translated Markdown: {output_path}")
    return True


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

# Map of source directory -> (glob pattern, injector function, source extension)
_COMPONENTS = [
    ("input/images-source", "*.plantuml", inject_plantuml),
    ("input/images",        "*.svg",      inject_svg),
    ("input/archimate",     "*.archimate", inject_archimate),
    ("input/diagrams",      "*.svg",      inject_svg),
    ("input/diagrams",      "*.xml",      inject_archimate),
    ("input/pagecontent",   "*.md",       inject_markdown),
]


def _find_po_files(translations_dir: str, lang_filter: Optional[str]) -> List[Tuple[str, str]]:
    """
    Find .po files in a translations directory.

    Returns list of (language_code, po_file_path) tuples.
    """
    result: List[Tuple[str, str]] = []
    if not os.path.isdir(translations_dir):
        return result
    for po_path in glob_module.glob(os.path.join(translations_dir, "*.po")):
        lang = Path(po_path).stem  # filename without extension = language code
        if lang_filter and lang != lang_filter:
            continue
        result.append((lang, po_path))
    return result


def run_injection(ig_root: str, lang_filter: Optional[str], dry_run: bool) -> int:
    """
    For each source directory with a translations/ sub-directory that contains
    .po files, produce translated copies of all matching source files.

    Returns:
        Number of files written (or that would be written in dry_run mode)
    """
    logger = logging.getLogger(__name__)
    files_written = 0

    for src_subdir, pattern, injector_fn in _COMPONENTS:
        src_dir = os.path.join(ig_root, src_subdir)
        if not os.path.isdir(src_dir):
            continue

        translations_dir = os.path.join(src_dir, "translations")
        po_files = _find_po_files(translations_dir, lang_filter)
        if not po_files:
            logger.debug(f"No .po files found in {translations_dir}, skipping")
            continue

        source_files = glob_module.glob(os.path.join(src_dir, pattern))
        if not source_files:
            logger.debug(f"No {pattern} files found in {src_dir}")
            continue

        for lang, po_path in po_files:
            translations = parse_po_file(po_path)
            if not translations:
                continue

            for src_file in source_files:
                filename = os.path.basename(src_file)
                out_path = os.path.join(src_dir, lang, filename)

                ok = injector_fn(src_file, translations, out_path, dry_run=dry_run)
                if ok:
                    files_written += 1

    return files_written


def main() -> int:
    """Entry point."""
    parser = argparse.ArgumentParser(
        description="Inject translations from .po files into WHO SMART diagram sources",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--ig-root",
        default=".",
        help="Repository root directory (default: current directory)",
    )
    parser.add_argument(
        "--lang",
        default=None,
        help="Only process a specific language code (e.g. fr)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without writing files",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    logger = logging.getLogger(__name__)

    ig_root = os.path.abspath(args.ig_root)
    logger.info(f"Injecting translations into diagram sources under {ig_root}"
                + (" [dry-run]" if args.dry_run else ""))

    count = run_injection(ig_root, args.lang, args.dry_run)
    logger.info(f"Injection complete: {count} file(s) {'would be ' if args.dry_run else ''}written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
