"""Page-text normalisation shared by the PDF rungs — one answer, as with `_pdf_doc_id`.

## Soft hyphens (bean `3spu`)

A soft hyphen (U+00AD) is a line-break HINT, not a character of the word. PDF
text layers keep it where a word was broken across a line, so the extracted
text reads ``recommenda\\u00AD\\ntions`` and every consumer — the sections a
corpus grep runs over, the block summaries, translation extraction, the LSI
index — sees two fragments instead of one word. Measured 2026-09-29: 742 in the
WHO guideline Handbook's section files (186 of them), none in either WHO style
guide, 21 section files in other libraries.

It is removed together with the whitespace that follows it, so the two halves
join. A soft hyphen is never a real hyphen: a word that genuinely carries a
hyphen at a line break uses U+002D or U+2010, which this leaves alone.

Underscore-prefixed because a module name with a hyphen cannot be imported —
the same reason as `_pdf_doc_id.py`.
"""
from __future__ import annotations

import re

SOFT_HYPHEN = "­"
_RE_SOFT_HYPHEN = re.compile("­\\s*")


def join_soft_hyphens(text: str) -> str:
    """Remove every soft hyphen and the whitespace after it, joining the word."""
    if not text or SOFT_HYPHEN not in text:
        return text
    return _RE_SOFT_HYPHEN.sub("", text)
