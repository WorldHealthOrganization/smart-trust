#!/usr/bin/env python3
"""
extract_script_strings.py — Extract translatable strings from Python scripts
in input/scripts/ and produce a .pot file at
input/scripts/translations/scripts.pot.

Uses Python's ast module to scan *.py files for _(), gettext(), and ngettext()
call patterns and produces a standard Gettext .pot template file.

Usage:
    python extract_script_strings.py [--scripts-dir input/scripts] [--output input/scripts/translations/scripts.pot]

Exit codes:
    0  .pot file generated successfully
    1  Error

Author: WHO SMART Guidelines Team
"""

import argparse
import ast
import datetime
import logging
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# AST-based string extraction
# ---------------------------------------------------------------------------

# Function names that mark translatable strings
_GETTEXT_FUNCTIONS: Set[str] = {"_", "gettext", "ngettext"}


def _extract_from_file(py_path: Path) -> List[Tuple[str, int, str]]:
    """
    Extract translatable strings from a Python file using AST parsing.

    Returns list of (file_path_str, line_number, msgid).
    """
    try:
        source = py_path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("Cannot read %s: %s", py_path, exc)
        return []

    try:
        tree = ast.parse(source, filename=str(py_path))
    except SyntaxError as exc:
        logger.warning("Syntax error in %s: %s", py_path, exc)
        return []

    entries: List[Tuple[str, int, str]] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue

        # Check for function calls: _("..."), gettext("..."), ngettext("...")
        func_name = None
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        if func_name not in _GETTEXT_FUNCTIONS:
            continue

        if not node.args:
            continue

        # Extract the first string argument (msgid)
        first_arg = node.args[0]
        if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, str):
            entries.append((str(py_path), node.lineno, first_arg.value))
        elif isinstance(first_arg, ast.JoinedStr):
            # f-strings are not extractable — warn
            logger.warning(
                "%s:%d: f-string in %s() is not translatable",
                py_path, node.lineno, func_name,
            )

    return entries


# Regex patterns for lines that vary only by timestamp in .pot files.
_POT_CREATION_DATE_RE = re.compile(r'^"POT-Creation-Date:.*\\n"\s*$')
_GENERATED_COMMENT_RE = re.compile(r'^# Generated: ')


def _reproducible_timestamp() -> datetime.datetime:
    """Return a deterministic UTC timestamp for .pot file headers.

    Checks ``SOURCE_DATE_EPOCH`` first, then the git author date of HEAD,
    so that the same commit always produces the same .pot timestamp.
    Falls back to ``datetime.now(UTC)`` when neither is available.
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

    Removes ``POT-Creation-Date`` header values and ``# Generated:``
    comment lines so that two ``.pot`` files can be compared ignoring
    metadata that changes on every regeneration.
    """
    lines = content.splitlines(True)
    return "".join(
        line for line in lines
        if not _POT_CREATION_DATE_RE.match(line)
        and not _GENERATED_COMMENT_RE.match(line)
    )


def _escape_po_string(s: str) -> str:
    """Escape a string for use in a .po/.pot file."""
    return (
        s.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\t", "\\t")
    )


# ---------------------------------------------------------------------------
# POT file generation
# ---------------------------------------------------------------------------

def generate_pot(
    scripts_dir: Path,
    output_path: Path,
) -> int:
    """
    Scan scripts_dir for *.py files, extract translatable strings, and
    write a .pot file to output_path.

    Returns 0 on success, 1 on error.
    """
    py_files = sorted(scripts_dir.glob("*.py"))
    if not py_files:
        logger.info("No Python files found in %s", scripts_dir)

    # Collect all entries: (file, line, msgid)
    all_entries: List[Tuple[str, int, str]] = []
    for py_file in py_files:
        entries = _extract_from_file(py_file)
        all_entries.extend(entries)

    logger.info("Found %d translatable string(s) in %d file(s)",
                len(all_entries), len(py_files))

    # Deduplicate by msgid, collecting all references
    msgid_refs: Dict[str, List[Tuple[str, int]]] = {}
    for file_path, lineno, msgid in all_entries:
        if msgid not in msgid_refs:
            msgid_refs[msgid] = []
        msgid_refs[msgid].append((file_path, lineno))

    # Generate .pot content
    now = _reproducible_timestamp()
    timestamp = now.strftime("%Y-%m-%d %H:%M+0000")

    lines: List[str] = []
    # POT header
    lines.append('# Translation template for WHO SMART Guidelines Python scripts.')
    lines.append(f'# Generated: {timestamp}')
    lines.append('#')
    lines.append('msgid ""')
    lines.append('msgstr ""')
    lines.append(f'"POT-Creation-Date: {timestamp}\\n"')
    lines.append('"MIME-Version: 1.0\\n"')
    lines.append('"Content-Type: text/plain; charset=UTF-8\\n"')
    lines.append('"Content-Transfer-Encoding: 8bit\\n"')
    lines.append('')

    # Entries
    for msgid in sorted(msgid_refs.keys()):
        refs = msgid_refs[msgid]
        for file_path, lineno in refs:
            # Make path relative to scripts_dir parent for readability
            try:
                rel = Path(file_path).relative_to(scripts_dir.parent)
            except ValueError:
                rel = Path(file_path)
            lines.append(f'#: {rel}:{lineno}')
        escaped = _escape_po_string(msgid)
        lines.append(f'msgid "{escaped}"')
        lines.append('msgstr ""')
        lines.append('')

    new_content = "\n".join(lines) + "\n"

    # Skip writing when the only differences are timestamp metadata
    # (POT-Creation-Date / # Generated) to avoid noisy commits.
    if output_path.is_file():
        try:
            old_content = output_path.read_text(encoding="utf-8")
            if _normalize_pot_content(old_content) == _normalize_pot_content(new_content):
                logger.info(
                    "Skipped %s: only timestamp changed (%d msgids unchanged)",
                    output_path, len(msgid_refs),
                )
                return 0
        except OSError:
            pass  # fall through to write

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(new_content, encoding="utf-8")
    logger.info("✓ Written %s (%d entries)", output_path, len(msgid_refs))

    return 0


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
        prog="extract_script_strings.py",
        description="Extract translatable strings from Python scripts into a .pot file",
    )
    parser.add_argument(
        "--scripts-dir", default="input/scripts",
        help="Directory containing Python scripts (default: input/scripts)",
    )
    parser.add_argument(
        "--output", default="input/scripts/translations/scripts.pot",
        help="Output .pot file path (default: input/scripts/translations/scripts.pot)",
    )
    args = parser.parse_args(argv)

    scripts_dir = Path(args.scripts_dir).resolve()
    output_path = Path(args.output).resolve()

    if not scripts_dir.is_dir():
        logger.error("Scripts directory not found: %s", scripts_dir)
        return 1

    return generate_pot(scripts_dir, output_path)


if __name__ == "__main__":
    sys.exit(main())
