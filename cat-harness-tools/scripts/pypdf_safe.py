#!/usr/bin/env python3
"""
pypdf_safe — import `pypdf` without being killed by a broken `cryptography`.

## The failure this prevents

`pypdf` imports `cryptography` optionally, for AES-encrypted PDFs, and guards
it with `except ImportError`. On a system where `cryptography`'s Rust bindings
are broken — debian's 41.0.7 against a mismatched pyo3 is the case observed in
this project's containers — importing it does not raise `ImportError`. It
raises pyo3's `PanicException`, which derives from **`BaseException`**, not
`Exception`:

    File ".../cryptography/exceptions.py", line 9, in <module>
        from cryptography.hazmat.bindings._rust import exceptions
    pyo3_runtime.PanicException: Python API call failed

So `pypdf`'s guard does not catch it, and `import pypdf` takes the whole
process down. Every consumer inherits the failure, and the traceback points at
`cryptography` rather than at the PDF tool the user actually ran, which is why
this went undiagnosed long enough to be worth a module.

`scripts/pdf-extract.py` solves the same problem by *recovery* — every rung of
its extraction ladder catches `BaseException` and falls through to the next,
ending at a zero-dependency content-stream reader. That is the right design
there, because its job is to return text from a hostile file by any means.
This module is the *prevention* half, for the scripts whose job is structure
rather than salvage and which therefore need `pypdf` specifically.

## Why it probes instead of always stubbing

Blanket-stubbing `cryptography` would silently disable AES support on healthy
systems, turning "this PDF is encrypted" into a mystery. So the module tries
the real import first, catching `BaseException`, and installs stubs only when
that fails. On a working system nothing changes; on a broken one, `pypdf`
takes its no-crypto branch and encrypted PDFs — of which this corpus has none
— report as unreadable rather than aborting the run.

After a panic the failed package can be left half-initialised in
`sys.modules`, so the entries are purged before the stubs go in.

## Use

Import this instead of `pypdf`, and do it before anything else imports pypdf::

    from pypdf_safe import PdfReader          # or PdfWriter

`scripts/` is `sys.path[0]` when a script there is run directly, so the plain
module name resolves without path juggling.

`CRYPTOGRAPHY_STUBBED` records which branch was taken, for diagnostics.
"""

from __future__ import annotations

import os
import sys
import types

__all__ = ["PdfReader", "PdfWriter", "CRYPTOGRAPHY_STUBBED"]

# Submodules pypdf reaches for. Parents are listed too: a stub must exist for
# every level, or Python falls through to the real (panicking) package.
_CRYPTO_MODULES = (
    "cryptography",
    "cryptography.exceptions",
    "cryptography.hazmat",
    "cryptography.hazmat.backends",
    "cryptography.hazmat.bindings",
    "cryptography.hazmat.primitives",
    "cryptography.hazmat.primitives.ciphers",
    "cryptography.hazmat.primitives.ciphers.algorithms",
    "cryptography.hazmat.primitives.ciphers.modes",
    "cryptography.hazmat.primitives.padding",
)


def _cryptography_is_healthy() -> bool:
    """True if `cryptography` imports without exploding.

    Catches `BaseException` deliberately: pyo3's `PanicException` is not an
    `Exception`, which is the entire reason this module exists.

    The probe's stderr is silenced at the **file-descriptor** level, not with
    `contextlib.redirect_stderr`, because the noise comes from Rust's panic
    hook writing to fd 2 directly and never passes through `sys.stderr`. It is
    ordinary output for an expected, handled condition, and leaving it in
    place would reproduce the original problem in miniature: a run that
    succeeded would still print `thread '<unnamed>' panicked` and read as a
    failure. Only the probe is muted; everything the calling script writes is
    untouched.
    """
    saved = None
    devnull = None
    try:
        devnull = os.open(os.devnull, os.O_WRONLY)
        saved = os.dup(2)
        sys.stderr.flush()
        os.dup2(devnull, 2)
    except OSError:  # pragma: no cover -- no fd 2 to speak of; just probe loudly
        saved = None

    try:
        import cryptography.exceptions  # noqa: F401
        import cryptography.hazmat.primitives.ciphers  # noqa: F401
    except BaseException:  # noqa: BLE001 -- see docstring
        return False
    else:
        return True
    finally:
        if saved is not None:
            os.dup2(saved, 2)
            os.close(saved)
        if devnull is not None:
            os.close(devnull)


def _install_stubs() -> None:
    """Replace `cryptography` with empty packages.

    An attribute lookup into an empty module raises `ImportError`, which is
    what `pypdf`'s own guard expects, so it takes the no-crypto branch.
    """
    # A panicking import can leave partially built parents behind; drop them
    # so the stubs are what later imports find.
    for name in [m for m in sys.modules if m == "cryptography" or m.startswith("cryptography.")]:
        del sys.modules[name]

    for name in _CRYPTO_MODULES:
        module = types.ModuleType(name)
        # `__path__` marks it a package, so `import a.b.c` resolves here
        # instead of falling through to the real distribution on disk.
        module.__path__ = []  # type: ignore[attr-defined]
        sys.modules[name] = module


def _prepare() -> bool:
    if "pypdf" in sys.modules:
        # Someone imported it already and survived; leave well alone.
        return False
    if _cryptography_is_healthy():
        return False
    _install_stubs()
    return True


CRYPTOGRAPHY_STUBBED = _prepare()

try:
    from pypdf import PdfReader, PdfWriter
except ImportError as exc:  # pragma: no cover -- genuinely absent
    raise SystemExit(
        f"pypdf_safe: needs pypdf — pip install pypdf ({exc})"
    ) from exc
except BaseException as exc:  # noqa: BLE001 -- pragma: no cover
    # Stubs installed and it still panicked: something else is broken, and
    # saying so beats a bare traceback from inside a dependency.
    raise SystemExit(
        "pypdf_safe: pypdf failed to import even with `cryptography` stubbed "
        f"({type(exc).__name__}: {exc}). Try `pip install --force-reinstall "
        "pypdf`, or use scripts/pdf-extract.py, whose last rung needs no "
        "third-party library."
    ) from exc
