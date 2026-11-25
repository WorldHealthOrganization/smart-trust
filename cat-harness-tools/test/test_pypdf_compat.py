"""The pypdf import must survive a `cryptography` that panics on import.

Regression test for the failure mode described in scripts/_pypdf_compat.py:
pyo3's PanicException derives from BaseException, so `except ImportError` --
and even `except Exception` -- lets it through.
"""
import os
import subprocess
import sys

SCRIPTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")

# Simulates the broken native extension: a meta-path finder that raises a
# BaseException (not an Exception) the moment `cryptography` is imported,
# exactly as the pyo3 panic does.
PROBE = r'''
import sys
class Panic(BaseException):        # pyo3_runtime.PanicException is BaseException
    pass
class Detonate:
    def find_spec(self, name, path=None, target=None):
        if name == "cryptography" or name.startswith("cryptography."):
            raise Panic("Python API call failed")
        return None
sys.meta_path.insert(0, Detonate())
for m in [m for m in sys.modules if m.split(".")[0] in ("pypdf", "cryptography")]:
    del sys.modules[m]
sys.path.insert(0, {scripts!r})
from _pypdf_compat import import_pypdf
R = import_pypdf("PdfReader")
print("RECOVERED", R.__name__)
'''


def test_survives_cryptography_panic():
    out = subprocess.run([sys.executable, "-c", PROBE.format(scripts=SCRIPTS)],
                         capture_output=True, text=True, timeout=120)
    assert out.returncode == 0, f"guard did not recover:\n{out.stderr[-1500:]}"
    assert "RECOVERED PdfReader" in out.stdout, out.stdout


def test_naive_guard_would_have_failed():
    """The control: `except ImportError` does NOT catch it. If this ever starts
    passing, the panic is no longer BaseException-derived and the guard in
    _pypdf_compat can be simplified."""
    naive = PROBE.replace(
        "from _pypdf_compat import import_pypdf\nR = import_pypdf(\"PdfReader\")",
        "try:\n    from pypdf import PdfReader as R\nexcept ImportError:\n    print('caught as ImportError'); raise SystemExit(3)")
    out = subprocess.run([sys.executable, "-c", naive.format(scripts=SCRIPTS)],
                         capture_output=True, text=True, timeout=120)
    assert out.returncode != 0 and "caught as ImportError" not in out.stdout, (
        "naive guard unexpectedly handled the panic; see docstring")


if __name__ == "__main__":
    test_survives_cryptography_panic(); print("PASS survives panic")
    test_naive_guard_would_have_failed(); print("PASS control: naive guard fails")
