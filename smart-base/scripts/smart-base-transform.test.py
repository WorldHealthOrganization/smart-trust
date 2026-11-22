#!/usr/bin/env python3
"""smart-base-transform must degrade honestly and must not lose outputs.

Two behaviours are load-bearing.

**Absent toolchain reads as absent.** The runner loads WHO's XSLT from a
smart-base checkout rather than vendoring it, so in most sessions the checkout
is simply not there. A run that finds nothing must say so and exit non-zero — a
missing toolchain reported as a clean run is the false pass the integration
contract exists to prevent.

**Collisions are counted.** `bpmn2fhirfsh.xsl` emits a multi-file envelope, and
measured on `smart-dak-immz` its 8 business processes emit 313 files at only
201 distinct paths: shared actors and two near-duplicate copies of one process
name the same outputs. Writing them silently would report 313 successes and
leave 201 files.

Self-contained: no smart-base, no lxml, no network. The transform itself is
exercised against real WHO content by hand; this pins the wrapper.
"""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # the smart-base layer
SCRIPT = HERE / "smart-base-transform.py"

failures = []


def check(label, cond, detail=""):
    if cond:
        print(f"  ok   {label}")
    else:
        print(f"  FAIL {label} {detail}")
        failures.append(label)


def run(args, env_extra=None):
    env = dict(os.environ)
    env.pop("SMART_BASE_HOME", None)
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True, text=True, env=env, cwd=str(ROOT),
    )


print("smart-base-transform")

# --- honest degradation ------------------------------------------------
r = run(["--check"], {"SMART_BASE_HOME": "/definitely/not/here"})
check("--check reports UNAVAILABLE for a missing checkout", "UNAVAILABLE" in r.stdout, r.stdout[:120])
check("--check exits non-zero when unavailable", r.returncode != 0, f"rc={r.returncode}")
check("--check names SMART_BASE_HOME so the fix is obvious", "SMART_BASE_HOME" in r.stdout)

with tempfile.TemporaryDirectory() as td:
    src = Path(td) / "x.bpmn"
    src.write_text("<definitions/>\n")
    r = run(["bpmn2fsh", str(src)], {"SMART_BASE_HOME": "/definitely/not/here"})
    check("a transform without a checkout fails loudly", r.returncode == 3, f"rc={r.returncode}")
    check("...and says why", "unavailable" in r.stderr.lower(), r.stderr[:120])
    check("...and does not claim success", "0 failure" not in r.stdout)

# --- argument handling -------------------------------------------------
r = run([])
check("no arguments prints usage rather than doing something", r.returncode == 2, f"rc={r.returncode}")

r = run(["nosuchtransform", "x"])
check("an unknown transform is rejected by argparse", r.returncode != 0)

# --- the declared transforms -------------------------------------------
sys.path.insert(0, str(HERE))
import importlib.util

spec = importlib.util.spec_from_file_location("sbt", SCRIPT)
sbt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sbt)

check("bpmn2fsh maps to WHO's stylesheet", sbt.TRANSFORMS["bpmn2fsh"][0].endswith("includes/bpmn2fhirfsh.xsl"))
check("dmn2html maps to WHO's stylesheet", sbt.TRANSFORMS["dmn2html"][0].endswith("includes/dmn2html.xslt"))
check("each transform declares the suffix it consumes",
      all(v[1].startswith(".") for v in sbt.TRANSFORMS.values()))
check("paths are relative to the checkout, never absolute",
      all(not v[0].startswith("/") for v in sbt.TRANSFORMS.values()))

# The default must not silently resolve to something inside this repo — the
# point of the capability is that the toolchain lives elsewhere.
check("default home is outside the platform", not str(sbt.DEFAULT_HOME).startswith(str(ROOT)))

os.environ.pop("SMART_BASE_HOME", None)
check("home falls back to the documented default", str(sbt.smart_base_home()) == sbt.DEFAULT_HOME)
os.environ["SMART_BASE_HOME"] = "/tmp/elsewhere"
check("home honours SMART_BASE_HOME", str(sbt.smart_base_home()) == "/tmp/elsewhere")
os.environ.pop("SMART_BASE_HOME", None)

available, reasons = sbt.capability_report()
check("capability_report explains every unavailability", available or len(reasons) > 0)

print(f"\n{'FAILED: ' + ', '.join(failures) if failures else 'all checks passed'}")
sys.exit(1 if failures else 0)
