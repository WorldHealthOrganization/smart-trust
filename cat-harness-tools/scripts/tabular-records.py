#!/usr/bin/env python3
"""The delimited-text sniff the ingest ladder routes on — and a retired writer.

## What is left here

`is_tabular_text`: does a file's CONTENT parse as a consistent table? A CSV has
no magic bytes, so `ingest-document.ts` asks this question to route one, never
the file's extension.

## What was retired, and why (bean `urat`, owner default 2026-10-21)

This file used to write `library/<slug>/tabular.jsonld`
(`folio-tabular-records/v1`) for CSV and xlsx (bean `p67i`). Those sources are
now read as CSVW (`folio-tabular-csvw/v1`) by core's extractors through the
`tabular-csvw` pipeline slot (`tabular-csvw.ts`), and ingest stopped calling
this for them in tools#474. It was still called for ODS, where it wrote nothing
and exited 1 ("not a CSV or spreadsheet"), so v1 had no working writer left.

Retiring the writer, and not the schema, is option 1 of the bean's 5c-ii
decision: a folio's committed v1 `csv`/`xlsx` records still validate, and
nothing new is written as v1 except fixed-width, which
folio-assistant-sci's `codata-ingest.ts` writes. Run as a command, this now
refuses and names the rung that reads the file.
"""

from __future__ import annotations

import csv
import sys


def is_tabular_text(path: str, min_columns: int = 2, sample_rows: int = 20) -> str | None:
    """The delimiter, if this file's CONTENT parses as a consistent table.

    A CSV has no magic bytes — there is nothing in the leading bytes of
    `country,year,cases` that says CSV — so routing one cannot be a sniff and
    must not become an extension guess. This asks the only question that is
    actually about the content: do the first rows split into the SAME number of
    fields, more than one, on some delimiter?

    Returns None for prose, for a single-column file, and for anything ragged.
    A one-column "table" is indistinguishable from a list of lines, and
    claiming it as tabular would file a text file as a dataset.
    """
    try:
        with open(path, newline="", encoding="utf-8") as fh:
            rows = []
            for i, line in enumerate(fh):
                if i >= sample_rows:
                    break
                rows.append(line.rstrip("\n"))
    except (OSError, UnicodeDecodeError):
        # Not decodable as UTF-8 text, so not a CSV. A binary file is refused
        # here rather than mangled into replacement characters.
        return None
    rows = [r for r in rows if r.strip()]
    if len(rows) < 2:
        return None
    for delim in (",", "\t", ";", "|"):
        widths = {len(next(csv.reader([r], delimiter=delim))) for r in rows}
        if len(widths) == 1 and next(iter(widths)) >= min_columns:
            return delim
    return None


RETIRED = (
    "tabular-records.py no longer writes folio-tabular-records/v1 (bean urat): "
    "CSV and xlsx are read as CSVW by `bun run cat-harness-tools/scripts/tabular-csvw.ts -o <library> <file>`, "
    "which `ingest-document.ts` runs for them. Committed v1 records still validate."
)


def main() -> int:
    print(RETIRED, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
