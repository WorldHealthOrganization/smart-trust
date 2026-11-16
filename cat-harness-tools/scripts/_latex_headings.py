"""The table of contents a paper's own LaTeX source states.

An arXiv entry whose source was fetched (`arxiv-source.py`, into
`<entry>/source/`) carries its author's `\\section`, `\\subsection` and
`\\subsubsection` commands. Where the PDF has no outline, that list is a better
spine than headings guessed from font sizes: it is what the author wrote, in
order, at its real depth. `_pdf_headings.latex_headings` finds each one on its
PDF page.

This module only READS the source. It numbers headings the way LaTeX's
`article` class does (1, 1.1, 1.1.1; letters after `\\appendix`; nothing for a
starred heading), which is what the PDF prints beside the title, and gives the
title as plain text: commands dropped, their arguments kept, mathematics kept
between dollars.
"""

from __future__ import annotations

import importlib.util
import os
import re
import sys
from typing import NamedTuple

_HERE = os.path.dirname(os.path.abspath(__file__))


def _overlay():
    """`latex-math-overlay.py`, for the source readers it already has."""
    name = "latex_math_overlay"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, os.path.join(_HERE, "latex-math-overlay.py"))
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod  # its dataclasses look themselves up here
    spec.loader.exec_module(mod)
    return mod


class TexHeading(NamedTuple):
    level: int            # 1 section, 2 subsection, 3 subsubsection
    number: str | None    # as LaTeX prints it; None for a starred heading
    title: str            # plain text


_HEAD = re.compile(r"\\((?:sub){0,2})section(\*?)\s*(?:\[[^\]]*\])?\s*\{|\\appendix\b")
_CUT = re.compile(r"\\(?:bibliography\{|begin\{thebibliography\}|end\{document\})")
# Commands whose argument is not part of the visible title.
_DROP_ARG = re.compile(r"\\(?:label|footnote|thanks|cite[a-z]*|ref|eqref|index|hspace|vspace)\*?\s*(?:\[[^\]]*\])?\s*\{")


def _strip_args(text: str, pattern: re.Pattern[str]) -> str:
    ov = _overlay()
    out, i = [], 0
    for m in pattern.finditer(text):
        if m.start() < i:
            continue
        out.append(text[i:m.start()])
        _, i = ov.balanced(text, m.end())
    out.append(text[i:])
    return "".join(out)


_DEF = re.compile(r"\\(?:(?:re)?newcommand\*?\s*\{?\\([A-Za-z]+)\}?|def\s*\\([A-Za-z]+))\s*\{")


def simple_macros(preamble: str) -> dict[str, str]:
    """The author's argument-free macros (`\\newcommand{\\CN}{\\mathcal N}`),
    so a title's mathematics renders without the paper's preamble."""
    ov = _overlay()
    out: dict[str, str] = {}
    for m in _DEF.finditer(preamble):
        body, _ = ov.balanced(preamble, m.end())
        if "#" not in body and len(body) < 80:
            out[m.group(1) or m.group(2)] = body
    return out


def expand(tex: str, macros: dict[str, str], depth: int = 3) -> str:
    for _ in range(depth):
        new = re.sub(r"\\([A-Za-z]+)(?![A-Za-z])",
                     lambda m: macros.get(m.group(1), m.group(0)), tex)
        if new == tex:
            break
        tex = new
    return tex


def plain_title(tex: str, macros: dict[str, str] | None = None) -> str:
    """The title as a reader sees it, with mathematics left in dollars."""
    t = expand(tex, macros or {})
    t = _strip_args(t, _DROP_ARG)
    t = re.sub(r"\\\\|\\newline\b|~", " ", t)
    # Outside mathematics a command's braces only group; drop the command name.
    parts = re.split(r"(\$[^$]*\$)", t)
    for k in range(0, len(parts), 2):
        parts[k] = re.sub(r"\\[A-Za-z]+\*?\s*", "", parts[k]).replace("{", "").replace("}", "")
        parts[k] = re.sub(r"\\(.)", r"\1", parts[k])
    for k in range(1, len(parts), 2):          # "${D^2}$" -> "$D^2$"
        inner = parts[k][1:-1].strip()
        while inner.startswith("{") and ov_balanced_whole(inner):
            inner = inner[1:-1].strip()
        parts[k] = f"${inner}$"
    return re.sub(r"\s+", " ", "".join(parts)).strip()


def ov_balanced_whole(t: str) -> bool:
    """Is `t` one brace group, `{...}`, and nothing after it?"""
    _, end = _overlay().balanced(t, 1)
    return end == len(t)


def _letter(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def headings_from_tex(full: str) -> list[TexHeading]:
    """Every sectioning command of the document body, numbered as printed."""
    ov = _overlay()
    preamble, _, doc = full.partition("\\begin{document}")
    doc = doc or full
    macros = simple_macros(preamble)
    cut = _CUT.search(doc)
    if cut:
        doc = doc[:cut.start()]
    out: list[TexHeading] = []
    counters = [0, 0, 0]
    appendix = False
    for m in _HEAD.finditer(doc):
        if m.group(0).startswith("\\appendix"):
            appendix, counters = True, [0, 0, 0]
            continue
        title, _ = ov.balanced(doc, m.end())
        level = 1 + len(m.group(1)) // 3
        number = None
        if not m.group(2):
            counters[level - 1] += 1
            for k in range(level, 3):
                counters[k] = 0
            top = _letter(counters[0]) if appendix else str(counters[0])
            number = ".".join([top] + [str(c) for c in counters[1:level]])
        text = plain_title(title, macros)
        if text:
            out.append(TexHeading(level, number, text))
    return out


def source_headings(source: str) -> tuple[list[TexHeading], str | None]:
    """`(headings, reason)` for a source directory or tarball; the reason says
    why the list is empty when it is."""
    ov = _overlay()
    if not os.path.exists(source):
        return [], f"no LaTeX source at {source}"
    files = ov.read_source(source)
    main = ov.main_tex(files)
    if main is None:
        return [], f"source holds {len(files)} .tex file(s), none with \\documentclass and \\begin{{document}}"
    heads = headings_from_tex(ov.inline_inputs(main, files))
    return heads, (None if heads else f"{main} has no \\section")
