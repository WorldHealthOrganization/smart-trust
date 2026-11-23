"""Is one page's text layer really text? One answer, shared by the router and the rungs.

Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A): "force OCR when a page's text
layer fails a quality check". The block-summary drafts of 2026-11-11 read every
derived block of the IRIS pilot and found text layers that carry plenty of
letters and still are not the document's text. Each check below was measured on
one of those PDFs; none is a guess.

- **Letters in a script the language does not use.** WER 75(02) (10665/231031)
  maps its French accents through the wrong code page: "LÆOMS approuve la
  dΘclaration faite le 7ájuilletá1999". 229 Θ, 129 Æ and 41 α in five pages of
  French and English. Greek letters in a Latin-script document are counted.
- **Arabic-script letters outside the language's alphabet.** The Persian
  edition of the cervical-screening guideline (10665/94830, `_per.pdf`) maps its
  font to the wrong Arabic code points: "زؾتٹضاٮ ٗٳ٭ ټبی". Its letters are
  Arabic-block letters, so the wrong-script check of `ingest-document.ts` passes
  it; but a third of them are letters neither Arabic nor Persian writes.
- **Letters spaced apart.** A text layer that places each glyph alone
  ("l e t t r e") reads as one-letter words.
- **Arabic letters placed apart.** 10665/192500 sets each Arabic letter as its
  own word ("ال ج د و ل"); the Latin stray-letter check leaves Arabic out.
- **Words doubled.** Fake bold drawn by printing each word twice or more
  (10665/67211, 10665/67212: "words repeated up to 5 times").

Pure functions over strings: no PDF library is imported, so the router's probe,
`pdf-structure.py` and `pdf-ocr.py` ask the same question the same way.
Underscore-prefixed because a module with a hyphen cannot be imported (same
reason as `_pdf_doc_id.py`).
"""
from __future__ import annotations

import re

# Below this many non-space characters a page is judged by other rules (it is
# blank, a divider or a photo credit), not as a broken text layer.
MIN_PAGE_CHARS = 200
# Share of letters among non-space characters that are neither digits nor the
# punctuation of tables (see TABLE_PUNCTUATION). The mojibake pages measured
# run 4-15% (10665/232378, 10665/117378's Arabic abstract).
MIN_LETTER_RATIO = 0.50
# Words that mix Greek and Latin letters ("dΘclaration", "lÆΘlimination") on a
# page whose languages are all written in Latin script. A Greek alpha in a
# formula stands alone; a Greek letter inside a French word is a code page.
MAX_GREEK_LATIN_WORDS = 5
# Arabic-script letters that are not in the alphabet of the page's language.
MAX_FOREIGN_ARABIC = 0.10
# One-letter words that no UN or Portuguese language writes as a word, among the
# words of a page (Latin, Cyrillic). "D'u ne m anière générale, à m esu re" in
# 10665/83270: the text layer breaks words where the font's kerning does.
MAX_STRAY_LETTERS = 0.02
SINGLE_LETTER_WORDS = set("aàáeéiíoóuúyAÀEÉIOUYвиксуояaВИКСУОЯА")
# One-letter words among a page's Arabic-script words. A43/10's Arabic edition
# (10665/192500) places each letter apart ("ال ج د و ل" for "الجدول"): 66-79%
# of its words are one letter; the Arabic text layers that read well measure
# 0-3% (10665/44118, 10665/379160).
MIN_ARABIC_WORDS = 40
MAX_ARABIC_SINGLE_LETTERS = 0.30
# Words equal to the word before them.
MAX_DOUBLED_WORDS = 0.20

TABLE_PUNCTUATION = set(".,;:()[]%-–—/$€£·•…'’\"*+=<>|_")
LATIN_LANGS = {"en", "fr", "es", "pt", "de", "it", "nl", "tr", "id", "vi", "sw"}
# The Arabic block letters each language writes (U+0621-U+064A is the Arabic
# alphabet with hamza forms; Persian adds peh, tcheh, jeh, keheh, gaf, farsi yeh
# and heh with yeh). Harakat (U+064B-U+065F) are marks, not letters, and are not
# counted by str.isalpha() as foreign: they are excluded below.
_ARABIC_CORE = {chr(c) for c in range(0x0621, 0x064B)}
ARABIC_ALPHABET = {
    "ar": _ARABIC_CORE | {"ٱ", "ی", "ک"},
    "fa": _ARABIC_CORE | {"پ", "چ", "ژ", "ک", "گ", "ی", "ۀ", "ٱ"},
}


def lang_codes(langs) -> list[str]:
    """`en_US`, `EN`, `fr-CA` -> `en`, `fr`. Pure."""
    out: list[str] = []
    for l in langs or []:
        c = str(l).strip().lower().replace("-", "_").split("_")[0]
        c = {"per": "fa", "fas": "fa", "ara": "ar", "fre": "fr", "fra": "fr", "eng": "en",
             "spa": "es", "por": "pt", "rus": "ru", "chi": "zh", "zho": "zh"}.get(c, c)
        if c and c not in out:
            out.append(c)
    return out


def _is_arabic_letter(c: str) -> bool:
    o = ord(c)
    return c.isalpha() and (0x0600 <= o <= 0x06FF or 0x0750 <= o <= 0x077F)


def page_problem(text: str, langs=()) -> str | None:
    """Why this page's text layer is not the page's text, or None. Pure.

    `langs` are the document's languages (ISO 639, as `dc.language.iso` writes
    them). The script checks run only when they are known.
    """
    nonspace = [c for c in text if not c.isspace()]
    if len(nonspace) < MIN_PAGE_CHARS:
        return None
    letters = [c for c in nonspace if c.isalpha()]
    # Digits and the punctuation of tables and contents pages (dot leaders) are
    # not evidence of a broken font: 10665/342236's contributor table and
    # 10665/44118's contents page are mostly digits and dots.
    other = [c for c in nonspace if not c.isalpha() and not c.isdigit() and c not in TABLE_PUNCTUATION]
    if len(letters) + len(other) >= MIN_PAGE_CHARS and len(letters) < MIN_LETTER_RATIO * (len(letters) + len(other)):
        return f"{len(letters)} letters among {len(letters) + len(other)} non-space characters other than digits: mojibake"
    codes = lang_codes(langs)
    if codes and all(c in LATIN_LANGS for c in codes):
        mixed = [w for w in re.findall(r"[^\W\d_]+", text)
                 if any(0x0370 <= ord(c) <= 0x03FF for c in w) and any(ord(c) < 0x250 for c in w)]
        if len(mixed) > MAX_GREEK_LATIN_WORDS:
            return (f"{len(mixed)} words mix Greek and Latin letters (\"{mixed[0]}\") in a {', '.join(codes)} text: "
                    "accents mapped through the wrong code page")
    arabic_langs = [c for c in codes if c in ARABIC_ALPHABET]
    if arabic_langs and len(arabic_langs) == len([c for c in codes if c not in LATIN_LANGS]):
        alphabet = set().union(*(ARABIC_ALPHABET[c] for c in arabic_langs))
        arabic = [c for c in letters if _is_arabic_letter(c)]
        if len(arabic) >= 100:
            foreign = sum(1 for c in arabic if c not in alphabet)
            if foreign > MAX_FOREIGN_ARABIC * len(arabic):
                return (f"{foreign} of {len(arabic)} Arabic-script letters are not in the "
                        f"{'/'.join(arabic_langs)} alphabet: the font maps glyphs to the wrong code points")
    arabic_words = [w for w in re.findall(r"\S+", text) if all(_is_arabic_letter(c) for c in w)]
    if len(arabic_words) >= MIN_ARABIC_WORDS:
        alone = sum(1 for w in arabic_words if len(w) == 1)
        if alone > MAX_ARABIC_SINGLE_LETTERS * len(arabic_words):
            return (f"{alone} of {len(arabic_words)} Arabic-script words are one letter: "
                    "the text layer places each letter apart")
    words = re.findall(r"[^\W\d_]+", text)
    spaced = [w for w in re.findall(r"\S+", text) if not any(_is_arabic_letter(c) or 0x3400 <= ord(c) <= 0x9FFF for c in w)]
    if len(spaced) >= 100:
        # A lone lower-case letter between two lower-case words: "au g m ente".
        # Initials ("A. Ahmed") are capitals, list marks ("a)") carry punctuation.
        stray = sum(1 for a, w, b in zip(spaced, spaced[1:], spaced[2:])
                    if len(w) == 1 and w.isalpha() and w.islower() and w not in SINGLE_LETTER_WORDS
                    and (ord(w) < 0x250 or 0x400 <= ord(w) <= 0x4FF)
                    and a[-1:].isalpha() and a[-1:].islower() and b[:1].isalpha() and b[:1].islower())
        if stray >= 10 and stray > MAX_STRAY_LETTERS * len(spaced):
            return f"{stray} of {len(spaced)} words are a stray single letter: the text layer splits words"
    if len(words) >= 50:
        doubled = sum(1 for a, b in zip(words, words[1:]) if a == b and len(a) > 1)
        if doubled > MAX_DOUBLED_WORDS * len(words):
            return f"{doubled} of {len(words)} words repeat the word before: overprinted (fake bold) text"
    return None


def failing_pages(pages, langs=()) -> list[tuple[int, str]]:
    """`(1-based page, reason)` for each page whose text layer fails. Pure."""
    out = []
    for i, t in enumerate(pages, 1):
        why = page_problem(t or "", langs)
        if why:
            out.append((i, why))
    return out
