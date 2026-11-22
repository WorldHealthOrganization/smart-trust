"""Import pypdf robustly, including when `cryptography` is installed but broken.

pypdf's import chain reaches `cryptography` to provide its encrypted-PDF
support. In a container where `cryptography` is installed but its Rust
extension cannot load, that import raises **`pyo3_runtime.PanicException`**,
which derives from `BaseException` rather than `Exception`. So the usual

    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("... pip install pypdf")

does not catch it — and neither would `except Exception`. The caller sees a
Rust backtrace and a non-zero exit, with nothing pointing at the real cause:

    ModuleNotFoundError: No module named '_cffi_backend'
    thread '<unnamed>' panicked at pyo3-0.20.2/src/err/mod.rs:788:5
    pyo3_runtime.PanicException: Python API call failed

pypdf needs `cryptography` **only** for encrypted PDFs, and falls back to its
own no-crypto provider when the module is simply absent. So on that failure we
make it absent for this process and retry the import once. Reading unencrypted
PDFs — which is all the structure/extract/OCR/split scripts do — is unaffected;
an encrypted PDF then fails with pypdf's own clear `DependencyError` instead of
a panic.

History: added 2026-08-25 after the panic was hit in a qou session, misread as
permanent, and worked around with a duplicate ingester on the qou side rather
than fixed here. The duplicate was the wrong shape — `pdf-structure.py` is the
owner of `pdf-structure/v1` and there should be exactly one producer of it.

`pdfplumber` reaches the same `cryptography` import through `pdfminer.six`, and
for the same reason: encrypted-PDF support it does not need to read an
unencrypted file. So `import_pdfplumber` shares this machinery rather than
duplicating it, and the module keeps its pypdf-flavoured name — renaming it
would touch four importers and a test to say nothing new. What it actually owns
is the cryptography workaround, not pypdf.

Usage:

    from _pypdf_compat import import_pypdf, import_pdfplumber
    PdfReader, PdfWriter = import_pypdf("PdfReader", "PdfWriter")
    pdfplumber = import_pdfplumber()          # None when absent
"""

from __future__ import annotations

import sys

_MISSING = "needs pypdf — pip install pypdf"


class _BlockCryptography:
    """Meta-path finder that makes `cryptography` unimportable this process."""

    def find_spec(self, name, path=None, target=None):  # noqa: D102
        if name == "cryptography" or name.startswith("cryptography."):
            raise ImportError(
                "cryptography disabled by _pypdf_compat: its native extension "
                "failed to load. pypdf only needs it for encrypted PDFs."
            )
        return None


def _purge(prefixes: tuple[str, ...]) -> None:
    for mod in [m for m in sys.modules if m.split(".")[0] in prefixes]:
        del sys.modules[mod]


def import_pypdf(*names: str):
    """Return the named pypdf attributes, retrying without `cryptography`.

    Exits with a one-line message if pypdf itself is absent. Any other import
    failure is retried once with `cryptography` blocked; if that also fails the
    original error is re-raised, because at that point it is not this problem.
    """
    try:
        import pypdf
    except ImportError:
        sys.exit(f"{_prog()}: {_MISSING}")
    except BaseException:
        # Not an ImportError -- most likely the cryptography panic described
        # above. Drop the half-imported modules and retry without it.
        _purge(("pypdf", "cryptography"))
        sys.meta_path.insert(0, _BlockCryptography())
        try:
            import pypdf  # noqa: F811
        except ImportError:
            sys.exit(f"{_prog()}: {_MISSING}")
    return tuple(getattr(pypdf, n) for n in names) if len(names) > 1 else getattr(pypdf, names[0])


def import_pdfplumber():
    """Return the `pdfplumber` module, or `None` when it is not usable.

    Deliberately **not** `sys.exit` on absence, unlike `import_pypdf`. pypdf is
    the floor for `pdf-structure.py` — without it there is no artefact at all.
    pdfplumber is an *optional rung*: `pdf-tables.py` still has to write an
    artefact saying it looked and could not, because `tables: []` from a missing
    library must not read the same as `tables: []` from a document with no
    tables (`rag-document-ingestion.md` §5: absent tool => n/a, never a false
    pass). Returning `None` lets the caller say which of the two happened.

    The `BaseException` retry is the same cryptography workaround documented at
    the top of this module; pdfplumber reaches it through `pdfminer.six`.
    """
    try:
        import pdfplumber
        return pdfplumber
    except ImportError:
        return None
    except BaseException:
        _purge(("pdfplumber", "pdfminer", "cryptography"))
        sys.meta_path.insert(0, _BlockCryptography())
        try:
            import pdfplumber  # noqa: F811
            return pdfplumber
        except BaseException:
            return None


def _prog() -> str:
    import os
    return os.path.basename(sys.argv[0]) or "pdf-tool"
