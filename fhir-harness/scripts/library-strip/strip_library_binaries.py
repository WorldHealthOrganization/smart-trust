#!/usr/bin/env python3
"""
WHO SMART Guidelines — Extract ELM Binary Data from Library Resources

Postprocessing step that extracts base64-encoded ELM data from FHIR Library
resource files produced by the IG Publisher, writes the decoded content to
standalone files, and replaces the inline ``data`` with a relative ``url``
reference to the extracted file.

Library resources contain a ``content`` array whose entries carry a
``data`` field with base64-encoded payloads.  ELM payloads
(application/elm+json, application/elm+xml) are large and not needed
inline.  CQL source (text/cql) is decoded and displayed as pretty-printed,
collapsible blocks in the Library HTML pages.

For each ELM content entry the script:
  1. Decodes the base64 ``data`` payload.
  2. Writes it to a file next to the Library resource
     (e.g. ``Library-Foo.elm``).
  3. Removes the ``data`` field and adds a ``url`` field with a relative
     reference to the extracted file.

This script modifies:
  - **JSON files** (Library-*.json): extracts data, replaces with ``url``.
  - **XML files**  (Library-*.xml):  replaces ``<data>`` with ``<url>``.
  - **TTL files**  (Library-*.ttl):  replaces base64 literal with url.
  - **HTML files** (Library-*.html): updates the rendered representations.

Usage:
    python strip_library_binaries.py [output_dir]

Defaults:
    output_dir = ./output

Author: SMART Guidelines Team
"""

import base64
import html
import json
import logging
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def setup_logging() -> logging.Logger:
    """Configure logging for the script."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    return logging.getLogger(__name__)


logger = setup_logging()

# Content types whose data should be extracted.
_ELM_CONTENT_TYPES = {
    "application/elm+json",
    "application/elm+xml",
}

_CQL_CONTENT_TYPE = "text/cql"

_FHIR_NS = "http://hl7.org/fhir"
_XHTML_NS = "http://www.w3.org/1999/xhtml"


def _is_elm(entry: dict) -> bool:
    """Return True if a content entry is an ELM payload."""
    return entry.get("contentType", "") in _ELM_CONTENT_TYPES


def _is_cql(entry: dict) -> bool:
    """Return True if a content entry is a CQL source payload."""
    return entry.get("contentType", "") == _CQL_CONTENT_TYPE


def _decode_cql_from_library_json(json_path: Path) -> str | None:
    """Read a Library JSON file and return the decoded CQL source, if any."""
    try:
        resource = json.loads(json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    if resource.get("resourceType") != "Library":
        return None
    for entry in resource.get("content", []):
        if not _is_cql(entry):
            continue
        data = entry.get("data")
        if data:
            try:
                return base64.b64decode(data).decode("utf-8")
            except Exception:
                return None
    return None


def _elm_filename(library_stem: str, content_type: str = "") -> str:
    """Return the extracted ELM filename for a Library resource.

    Uses a content-type–specific extension so both XML and JSON ELM
    can coexist:
        application/elm+json -> Library-Foo.elm.json
        application/elm+xml  -> Library-Foo.elm.xml
        (fallback)           -> Library-Foo.elm
    """
    if "json" in content_type:
        return library_stem + ".elm.json"
    if "xml" in content_type:
        return library_stem + ".elm.xml"
    return library_stem + ".elm"


def _elm_filenames(library_stem: str) -> list[str]:
    """Return all possible ELM filenames for a Library resource."""
    return [
        _elm_filename(library_stem, "json"),
        _elm_filename(library_stem, "xml"),
    ]


def _extract_and_replace_elm_in_dict(
    resource: dict, output_dir: Path, library_stem: str
) -> bool:
    """Extract ELM data to files and replace ``data`` with ``url``.

    Returns True if anything was changed.
    """
    contents = resource.get("content")
    if not isinstance(contents, list):
        return False
    changed = False
    for entry in contents:
        if not _is_elm(entry) or not entry.get("data"):
            continue
        ct = entry.get("contentType", "")
        elm_file = _elm_filename(library_stem, ct)
        elm_path = output_dir / elm_file
        if not elm_path.exists():
            try:
                decoded = base64.b64decode(entry["data"])
            except Exception as exc:
                logger.warning(
                    "Could not decode base64 data for %s in %s: %s",
                    ct,
                    library_stem,
                    exc,
                )
                continue
            elm_path.write_bytes(decoded)
            logger.info("Extracted %s -> %s", ct, elm_file)
        # Replace data with a relative url reference.
        del entry["data"]
        entry["url"] = elm_file
        changed = True
    return changed


def _replace_elm_data_with_url_in_dict(
    resource: dict, library_stem: str
) -> bool:
    """Replace ``data`` with ``url`` on ELM content entries (no file I/O).

    Used for embedded representations (HTML) where we don't need to
    extract again — the JSON pass already wrote the files.
    """
    contents = resource.get("content")
    if not isinstance(contents, list):
        return False
    changed = False
    for entry in contents:
        if not _is_elm(entry):
            continue
        ct = entry.get("contentType", "")
        elm_file = _elm_filename(library_stem, ct)
        if entry.get("data"):
            del entry["data"]
            entry["url"] = elm_file
            changed = True
        elif not entry.get("url"):
            entry["url"] = elm_file
            changed = True
    return changed


def _replace_elm_data_with_url_in_xml(
    root: ET.Element, library_stem: str
) -> bool:
    """Replace ``data`` with ``url`` on ELM content entries in XML.

    Returns True if anything was changed.
    """
    ns = {"f": _FHIR_NS}
    changed = False
    for content_el in root.findall("f:content", ns):
        ct_el = content_el.find("f:contentType", ns)
        if ct_el is None:
            continue
        ct_value = ct_el.get("value", "")
        if ct_value not in _ELM_CONTENT_TYPES:
            continue
        elm_file = _elm_filename(library_stem, ct_value)
        data_el = content_el.find("f:data", ns)
        if data_el is not None:
            content_el.remove(data_el)
        # Add or update the url element.
        url_el = content_el.find("f:url", ns)
        if url_el is None:
            url_el = ET.SubElement(content_el, f"{{{_FHIR_NS}}}url")
        url_el.set("value", elm_file)
        changed = True
    return changed


# ---------------------------------------------------------------------------
# JSON processing
# ---------------------------------------------------------------------------


def strip_library_json(output_dir: Path) -> int:
    """Extract ELM data from Library-*.json files and replace with url."""
    modified = 0
    for fpath in sorted(output_dir.glob("Library-*.json")):
        # Skip extracted .elm files that happen to end in .json.
        if fpath.suffixes == [".elm", ".json"]:
            continue
        try:
            raw = fpath.read_text(encoding="utf-8")
            resource = json.loads(raw)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Skipping %s: %s", fpath.name, exc)
            continue

        if resource.get("resourceType") != "Library":
            continue

        if _extract_and_replace_elm_in_dict(resource, output_dir, fpath.stem):
            fpath.write_text(
                json.dumps(resource, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            modified += 1
            logger.info("Updated %s with url references", fpath.name)

    return modified


# ---------------------------------------------------------------------------
# XML processing
# ---------------------------------------------------------------------------

# Register namespaces so ElementTree preserves them on write-back.
ET.register_namespace("", _FHIR_NS)
ET.register_namespace("xhtml", _XHTML_NS)


def strip_library_xml(output_dir: Path) -> int:
    """Replace ELM data with url references in Library-*.xml files."""
    modified = 0
    for fpath in sorted(output_dir.glob("Library-*.xml")):
        if fpath.suffixes == [".elm", ".xml"]:
            continue
        try:
            tree = ET.parse(fpath)  # noqa: S314
        except ET.ParseError as exc:
            logger.warning("Skipping %s: %s", fpath.name, exc)
            continue

        root = tree.getroot()
        if root.tag != f"{{{_FHIR_NS}}}Library":
            continue

        if _replace_elm_data_with_url_in_xml(root, fpath.stem):
            tree.write(fpath, encoding="unicode", xml_declaration=True)
            modified += 1
            logger.info("Updated %s with url references", fpath.name)

    return modified


# ---------------------------------------------------------------------------
# TTL (Turtle/RDF) processing
# ---------------------------------------------------------------------------

# No Turtle parser in the standard library.  We use a targeted regex that
# matches the IG Publisher's predictable serialisation of content entries:
#
#   fhir:contentType [ fhir:v "application/elm+json" ] ;
#   fhir:data [ fhir:v "eyJ…base64…"^^xsd:base64Binary ]
#
# We replace the fhir:data line with a fhir:url line.
_TTL_ELM_BLOCK_RE = re.compile(
    r"(fhir:contentType\s+\[\s*fhir:v\s+"
    r'"application/elm\+(json|xml)"\s*\]'
    r".*?)"
    r'fhir:data\s+\[\s*fhir:v\s+"[A-Za-z0-9+/=]+"(?:\^\^xsd:base64Binary)?\s*\]',
    re.DOTALL,
)


def _ttl_elm_replacer(match: re.Match, library_stem: str) -> str:
    """Replace fhir:data with fhir:url in a TTL ELM block."""
    prefix = match.group(1)
    fmt = match.group(2)  # "json" or "xml"
    elm_file = _elm_filename(library_stem, f"application/elm+{fmt}")
    return f'{prefix}fhir:url [ fhir:v "{elm_file}" ]'


def strip_library_ttl(output_dir: Path) -> int:
    """Replace ELM data with url references in Library-*.ttl files."""
    modified = 0
    for fpath in sorted(output_dir.glob("Library-*.ttl")):
        try:
            raw = fpath.read_text(encoding="utf-8")
        except OSError as exc:
            logger.warning("Skipping %s: %s", fpath.name, exc)
            continue

        new_raw = _TTL_ELM_BLOCK_RE.sub(
            lambda m: _ttl_elm_replacer(m, fpath.stem), raw
        )
        if new_raw != raw:
            fpath.write_text(new_raw, encoding="utf-8")
            modified += 1
            logger.info("Updated %s with url references", fpath.name)

    return modified


# ---------------------------------------------------------------------------
# HTML processing
# ---------------------------------------------------------------------------

# The IG Publisher embeds the full resource representation inside
# <pre class="json"><code>…</code></pre> and
# <pre class="xml"><code>…</code></pre> blocks.
# We locate each block, extract and unescape the text content, parse it
# with the proper parser (json / XML), update ELM references, and write
# it back.

_PRE_CODE_RE = re.compile(
    r'(<pre\s+class="(json|xml|rdf)"\s*>\s*<code[^>]*>)'
    r"(.*?)"
    r"(</code>\s*</pre>)",
    re.DOTALL,
)


def _make_html_code_block_replacer(library_stem: str):
    """Return a callback for _PRE_CODE_RE that replaces ELM data with url."""

    def _replace(match: re.Match) -> str:
        prefix = match.group(1)
        lang = match.group(2)
        encoded_body = match.group(3)
        suffix = match.group(4)

        body = html.unescape(encoded_body)

        if lang == "json":
            try:
                resource = json.loads(body)
            except (json.JSONDecodeError, ValueError):
                return match.group(0)
            if resource.get("resourceType") != "Library":
                return match.group(0)
            if not _replace_elm_data_with_url_in_dict(resource, library_stem):
                return match.group(0)
            new_body = json.dumps(resource, indent=2, ensure_ascii=False)
            return prefix + html.escape(new_body, quote=False) + suffix

        if lang == "xml":
            try:
                root = ET.fromstring(body)  # noqa: S314
            except ET.ParseError:
                return match.group(0)
            if root.tag != f"{{{_FHIR_NS}}}Library":
                return match.group(0)
            if not _replace_elm_data_with_url_in_xml(root, library_stem):
                return match.group(0)
            new_body = ET.tostring(root, encoding="unicode")
            return prefix + html.escape(new_body, quote=False) + suffix

        if lang == "rdf":
            new_body = _TTL_ELM_BLOCK_RE.sub(
                lambda m: _ttl_elm_replacer(m, library_stem), body
            )
            if new_body == body:
                return match.group(0)
            return prefix + html.escape(new_body, quote=False) + suffix

        return match.group(0)

    return _replace


def _elm_viewer_snippet(library_stem: str, output_dir: Path | None = None) -> str:
    """Return an HTML/JS snippet that loads and displays extracted .elm files.

    When *output_dir* is given, only list files that actually exist on disk.
    Otherwise list both possible formats.
    """
    candidates = _elm_filenames(library_stem)
    if output_dir is not None:
        candidates = [f for f in candidates if (output_dir / f).exists()]
    if not candidates:
        return ""

    links = "\n".join(
        f'<li><a href="{f}">{f}</a> '
        f'<button type="button" onclick="loadElm(this, \'{f}\')"'
        f'  style="cursor:pointer;padding:2px 10px;margin-left:6px">View</button>'
        f'<pre class="elm-content" style="display:none;max-height:400px;overflow:auto;'
        f'border:1px solid #ccc;padding:8px;margin-top:6px;background:#f8f8f8"><code></code></pre>'
        f"</li>"
        for f in candidates
    )

    return f"""<div class="elm-viewer" style="margin:1em 0">
<h4>ELM Content</h4>
<p>ELM binary data has been extracted to separate files:</p>
<ul>
{links}
</ul>
</div>
<script>
function loadElm(btn, url) {{
  var pre = btn.nextElementSibling;
  if (pre.style.display !== 'none') {{
    pre.style.display = 'none';
    btn.textContent = 'View';
    return;
  }}
  var code = pre.querySelector('code');
  if (code.textContent) {{
    pre.style.display = '';
    btn.textContent = 'Hide';
    return;
  }}
  btn.textContent = 'Loading\u2026';
  fetch(url)
    .then(function(r) {{ return r.text(); }})
    .then(function(text) {{
      var trimmed = text.trimStart();
      if (trimmed.charAt(0) === '{{' || trimmed.charAt(0) === '[') {{
        try {{ text = JSON.stringify(JSON.parse(text), null, 2); }} catch(e) {{}}
      }} else if (trimmed.charAt(0) === '<') {{
        try {{
          var doc = new DOMParser().parseFromString(text, 'application/xml');
          if (!doc.querySelector('parsererror')) {{
            var s = new XMLSerializer().serializeToString(doc);
            var indent = 0;
            text = s.replace(/>\s*</g, '><')
              .replace(/<([^!?/][^>]*[^/])>|<([^!?/][^>]*)\/>|<\/([^>]+)>|<([^!?/][^>]*)>/g,
              function(m, open, selfClose, close, openEmpty) {{
                var r;
                if (close) {{ indent--; r = '  '.repeat(Math.max(indent,0)) + m; }}
                else if (selfClose) {{ r = '  '.repeat(indent) + m; }}
                else {{ r = '  '.repeat(indent) + m; indent++; }}
                return r;
              }}).split(/(?<=>)(?=\s*<)/).join('\\n');
          }}
        }} catch(e) {{}}
      }}
      code.textContent = text;
      pre.style.display = '';
      btn.textContent = 'Hide';
    }})
    .catch(function(err) {{
      code.textContent = 'Failed to load: ' + err;
      pre.style.display = '';
      btn.textContent = 'View';
    }});
}}
</script>"""


def _cql_viewer_snippet(cql_source: str) -> str:
    """Return an HTML snippet that displays CQL source in a collapsible block.

    The CQL is rendered as a ``<pre><code>`` block wrapped in a toggle so
    users can show/hide it.
    """
    if not cql_source:
        return ""

    escaped = html.escape(cql_source, quote=False)
    return f"""<div class="cql-viewer" style="margin:1em 0">
<h4>CQL Source
<button type="button" class="cql-toggle" onclick="toggleCql(this)"
  style="cursor:pointer;padding:2px 10px;margin-left:10px;font-size:0.8em">Hide</button>
</h4>
<pre class="cql-content" style="max-height:400px;overflow:auto;\
border:1px solid #ccc;padding:8px;background:#f8f8f8"><code>{escaped}</code></pre>
</div>
<script>
function toggleCql(btn) {{
  var pre = btn.closest('.cql-viewer').querySelector('pre.cql-content');
  if (pre.style.display === 'none') {{
    pre.style.display = '';
    btn.textContent = 'Hide';
  }} else {{
    pre.style.display = 'none';
    btn.textContent = 'Show';
  }}
}}
</script>"""


# Regex to find the first <pre class="json"> block — we inject the viewer
# right before it so it appears alongside the resource representations.
_FIRST_PRE_JSON_RE = re.compile(
    r'<pre\s+class="json"\s*>', re.IGNORECASE
)

# Match ELM "Encoded data" entries in the IG Publisher's narrative section.
# The narrative renders content entries as:
#   <th><b>Content: </b> application/elm+xml</th></tr>
#   <tr><td><pre><code>Encoded data (98412 characters)</code></pre></td></tr>
_NARRATIVE_ELM_DATA_RE = re.compile(
    r"(application/elm\+(json|xml)"    # ELM content type (group 2 = format)
    r".*?)"                            # anything between (e.g. closing tags)
    r"<pre><code>\s*Encoded data \(\d+ characters?\)\s*</code></pre>",
    re.DOTALL | re.IGNORECASE,
)

# Match CQL "Encoded data" entries in the IG Publisher's narrative section.
_NARRATIVE_CQL_DATA_RE = re.compile(
    r"(text/cql"                       # CQL content type
    r".*?)"                            # anything between (e.g. closing tags)
    r"<pre><code>\s*Encoded data \(\d+ characters?\)\s*</code></pre>",
    re.DOTALL | re.IGNORECASE,
)


def _library_stem_from_html(fpath: Path) -> str:
    """Derive the base Library stem from an HTML filename.

    E.g. Library-Foo.html       -> Library-Foo
         Library-Foo.json.html  -> Library-Foo
         Library-Foo.xml.html   -> Library-Foo
    """
    stem = fpath.stem  # Library-Foo or Library-Foo.json
    for suffix in (".json", ".xml", ".ttl"):
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def strip_library_html(output_dir: Path) -> int:
    """Update ELM references and add CQL viewer in Library-*.html files."""
    modified = 0
    for fpath in sorted(output_dir.glob("Library-*.html")):
        try:
            raw = fpath.read_text(encoding="utf-8")
        except OSError as exc:
            logger.warning("Skipping %s: %s", fpath.name, exc)
            continue

        # Derive the library stem from the HTML filename.
        # Library-Foo.json.html -> Library-Foo (not Library-Foo.json)
        library_stem = _library_stem_from_html(fpath)

        new_raw = raw

        # --- Pass 1: Update <pre class="json|xml|rdf"> code blocks. ---
        replacer = _make_html_code_block_replacer(library_stem)
        new_raw = _PRE_CODE_RE.sub(replacer, new_raw)

        # --- Pass 2: Update ELM entries in the narrative section. ---
        # The IG Publisher's narrative shows "Encoded data (N characters)"
        # for binary content.  Replace with a download link.
        def _narrative_elm_replacer(m: re.Match) -> str:
            prefix = m.group(1)
            fmt = m.group(2)  # "json" or "xml"
            elm_file = _elm_filename(library_stem, f"application/elm+{fmt}")
            return (
                prefix
                + f'<a href="{elm_file}">'
                + f"Download ({elm_file})</a>"
            )

        new_raw = _NARRATIVE_ELM_DATA_RE.sub(_narrative_elm_replacer, new_raw)

        # --- Pass 3: Replace CQL "Encoded data" with pretty-printed source. ---
        cql_source = _decode_cql_from_library_json(
            output_dir / (library_stem + ".json")
        )
        if cql_source:
            escaped_cql = html.escape(cql_source, quote=False)

            def _narrative_cql_replacer(m: re.Match) -> str:
                prefix = m.group(1)
                return (
                    prefix
                    + f'<pre style="max-height:400px;overflow:auto;border:1px solid #ccc;'
                    f'padding:8px;background:#f8f8f8"><code>{escaped_cql}</code></pre>'
                )

            new_raw = _NARRATIVE_CQL_DATA_RE.sub(_narrative_cql_replacer, new_raw)

        # Inject the CQL viewer widget if not already present.
        if cql_source and "cql-viewer" not in new_raw:
            cql_snippet = _cql_viewer_snippet(cql_source)
            m = _FIRST_PRE_JSON_RE.search(new_raw)
            if m:
                new_raw = (
                    new_raw[: m.start()] + cql_snippet + "\n" + new_raw[m.start() :]
                )
            else:
                for marker in ("</div><!-- no hierarchical", "</body>"):
                    idx = new_raw.find(marker)
                    if idx != -1:
                        new_raw = (
                            new_raw[:idx] + cql_snippet + "\n" + new_raw[idx:]
                        )
                        break

        # Inject the ELM viewer widget if not already present.
        if "elm-viewer" not in new_raw:
            snippet = _elm_viewer_snippet(library_stem, output_dir)
            if snippet:
                m = _FIRST_PRE_JSON_RE.search(new_raw)
                if m:
                    new_raw = (
                        new_raw[: m.start()] + snippet + "\n" + new_raw[m.start() :]
                    )
                else:
                    for marker in ("</div><!-- no hierarchical", "</body>"):
                        idx = new_raw.find(marker)
                        if idx != -1:
                            new_raw = (
                                new_raw[:idx] + snippet + "\n" + new_raw[idx:]
                            )
                            break

        if new_raw != raw:
            fpath.write_text(new_raw, encoding="utf-8")
            modified += 1
            logger.info(
                "Updated %s with url references, CQL and ELM viewers",
                fpath.name,
            )

    return modified


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    output_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "output")
    if not output_dir.is_dir():
        logger.error("Output directory does not exist: %s", output_dir)
        sys.exit(1)

    logger.info(
        "Extracting ELM binary data from Library resources in %s", output_dir
    )
    # JSON pass runs first — it extracts the actual .elm files.
    json_count = strip_library_json(output_dir)
    # Remaining passes just update references (files already extracted).
    xml_count = strip_library_xml(output_dir)
    ttl_count = strip_library_ttl(output_dir)
    html_count = strip_library_html(output_dir)
    logger.info(
        "Done — %d JSON, %d XML, %d TTL, %d HTML file(s) modified",
        json_count,
        xml_count,
        ttl_count,
        html_count,
    )


if __name__ == "__main__":
    main()
