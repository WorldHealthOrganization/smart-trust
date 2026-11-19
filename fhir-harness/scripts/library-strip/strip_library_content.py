#!/usr/bin/env python3
"""
Strip inline content from FHIR Library resources.

The FHIR IG Publisher embeds CQL source and compiled ELM as base64-encoded
``data`` elements inside each Library resource's ``content`` array.  Because
the IG Publisher *also* writes standalone files for this content (e.g.
``Library-Foo.cql`` and ``Library-Foo.elm.xml``), the inline copies are
redundant and inflate the published artefacts.

This post-processing script replaces inline ``data`` with a ``url`` reference
to the corresponding file that already exists in the output directory:

    contentType             url target
    ───────────────────     ──────────────────────────
    text/cql                Library-<name>.cql
    application/elm+xml     Library-<name>.elm.xml
    application/elm+json    Library-<name>.elm.json

If the referenced file does not exist in the output directory the content
entry is left unchanged (data is preserved).

Both the XML (``.xml``) and JSON (``.json``) representations of each Library
are processed.

Usage:
    python strip_library_content.py [output_dir]

    output_dir  defaults to ``./output``

Author: SMART Guidelines Team
"""

import json
import logging
import os
import stat
import sys
import xml.etree.ElementTree as ET
from typing import Optional

FHIR_NS = "http://hl7.org/fhir"
ET.register_namespace("", FHIR_NS)

# Map contentType → file extension for the standalone content file.
_CONTENT_TYPE_EXT = {
    "text/cql": ".cql",
    "application/elm+xml": ".elm.xml",
    "application/elm+json": ".elm.json",
}


def setup_logging() -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    return logging.getLogger(__name__)


logger = setup_logging()


def _ensure_writable(path: str) -> bool:
    """Make *path* writable if it is not already.

    Uses ``os.access`` to check effective write permission for the
    current user and adds user/group/other write bits as needed so that
    the file can be overwritten regardless of ownership.

    Returns True if the file is writable, False otherwise.
    """
    if os.access(path, os.W_OK):
        return True
    try:
        st = os.stat(path)
        os.chmod(path, st.st_mode | stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH)
        return True
    except OSError as exc:
        logger.warning("Could not make %s writable: %s", path, exc)
        return False


# ------------------------------------------------------------------
# XML processing
# ------------------------------------------------------------------

def _process_library_xml(xml_path: str, output_dir: str) -> bool:
    """Replace inline data with url references in a Library XML file.

    Returns True if the file was modified.
    """
    try:
        tree = ET.parse(xml_path)
    except ET.ParseError as exc:
        logger.warning("Could not parse %s: %s", xml_path, exc)
        return False

    root = tree.getroot()

    # Verify this is a Library resource.
    if root.tag != f"{{{FHIR_NS}}}Library":
        return False

    basename = os.path.splitext(os.path.basename(xml_path))[0]  # e.g. Library-Foo

    modified = False
    for content_el in root.findall(f"{{{FHIR_NS}}}content"):
        ct_el = content_el.find(f"{{{FHIR_NS}}}contentType")
        if ct_el is None:
            continue
        ct_value = ct_el.get("value", "")
        ext = _CONTENT_TYPE_EXT.get(ct_value)
        if ext is None:
            continue

        data_el = content_el.find(f"{{{FHIR_NS}}}data")
        if data_el is None:
            # No inline data to strip.
            continue

        target_filename = basename + ext
        target_path = os.path.join(output_dir, target_filename)
        if not os.path.exists(target_path):
            logger.debug(
                "%s: keeping inline %s — %s not found",
                os.path.basename(xml_path), ct_value, target_filename,
            )
            continue

        # Remove inline data, add url reference.
        content_el.remove(data_el)
        url_el = content_el.find(f"{{{FHIR_NS}}}url")
        if url_el is None:
            url_el = ET.SubElement(content_el, f"{{{FHIR_NS}}}url")
        url_el.set("value", target_filename)
        modified = True
        logger.info(
            "%s: %s → url %s",
            os.path.basename(xml_path), ct_value, target_filename,
        )

    if modified:
        if not _ensure_writable(xml_path):
            logger.error("Skipping %s: file is not writable", xml_path)
            return False
        tree.write(xml_path, xml_declaration=True, encoding="UTF-8")

    return modified


# ------------------------------------------------------------------
# JSON processing
# ------------------------------------------------------------------

def _process_library_json(json_path: str, output_dir: str) -> bool:
    """Replace inline data with url references in a Library JSON file.

    Returns True if the file was modified.
    """
    try:
        with open(json_path, "r", encoding="utf-8") as fh:
            resource = json.load(fh)
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Could not read %s: %s", json_path, exc)
        return False

    if resource.get("resourceType") != "Library":
        return False

    basename = os.path.splitext(os.path.basename(json_path))[0]  # e.g. Library-Foo

    modified = False
    for entry in resource.get("content", []):
        ct_value = entry.get("contentType", "")
        ext = _CONTENT_TYPE_EXT.get(ct_value)
        if ext is None:
            continue

        if "data" not in entry:
            continue

        target_filename = basename + ext
        target_path = os.path.join(output_dir, target_filename)
        if not os.path.exists(target_path):
            logger.debug(
                "%s: keeping inline %s — %s not found",
                os.path.basename(json_path), ct_value, target_filename,
            )
            continue

        del entry["data"]
        entry["url"] = target_filename
        modified = True
        logger.info(
            "%s: %s → url %s",
            os.path.basename(json_path), ct_value, target_filename,
        )

    if modified:
        if not _ensure_writable(json_path):
            logger.error("Skipping %s: file is not writable", json_path)
            return False
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump(resource, fh, indent=2, ensure_ascii=False)
            fh.write("\n")

    return modified


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

def strip_library_content(output_dir: str) -> int:
    """Process all Library resources in *output_dir*.

    Returns the number of files modified.
    """
    if not os.path.isdir(output_dir):
        logger.error("Output directory does not exist: %s", output_dir)
        return 0

    modified = 0
    for filename in sorted(os.listdir(output_dir)):
        if not filename.startswith("Library-"):
            continue

        filepath = os.path.join(output_dir, filename)
        if filename.endswith(".xml") and not filename.endswith(".elm.xml"):
            if _process_library_xml(filepath, output_dir):
                modified += 1
        elif filename.endswith(".json") and not filename.endswith(".elm.json"):
            if _process_library_json(filepath, output_dir):
                modified += 1

    logger.info(
        "strip_library_content: %d Library file(s) modified in %s",
        modified, output_dir,
    )
    return modified


def main() -> int:
    output_dir = sys.argv[1] if len(sys.argv) > 1 else "./output"
    strip_library_content(output_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
