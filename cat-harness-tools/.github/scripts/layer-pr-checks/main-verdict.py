#!/usr/bin/env python3
"""Main's own verdict, from the answer a push to main computed (post-merge QA).

Usage: main-verdict.py <answer-dir> [<declared.json>]

<answer-dir> holds `gates.json` (run-gates.py's report, the shards joined) and
`junit.xml` (`bun test --reporter=junit`): main's side as a push to the
caller's main ran it, or as it was kept for exactly these inputs. Nothing is
compared and nothing is run here: a PR is judged against main by
compare-gates.py and compare-test-failures.py; this says whether main ITSELF
is green, for `layer-main-qa.yml` (owner, 2026-10-30, "Both").

A gate is red when it ran and exited anything but 0 or 78 (78 is "not
applicable in this root", `scripts/lib/not-applicable.ts`); 2, "could not
determine", is red too: main's gate set did not determine. A gate that was
skipped, or that the CI cone did not run, is not red. A test is red when its
testcase has a <failure> or <error>.

A layer judges only the gates it declares (owner, 2026-10-31, "Layers declare
their gates"). <declared.json> is the caller's `.github/main-qa-gates.json`,
`{"judged": ["<pattern>", ...]}`, with `fnmatch` patterns over gate names
(`folio-assistant-sci:*`, `graph:folio-assistant-sci:*`). A layer's root runs
the gates of every layer below it too, and many of those cannot apply there;
an undeclared gate cannot make main red. It is still reported: red ones as
"not judged", passing ones as "passing but not declared", so the list only
grows (the ratchet). A declared pattern that matches no gate is reported too.
No file, or no argument: every gate is judged, as before. A file that cannot
be read is `unknown`.

Writes `verdict=green|red|unknown` and `failures=<one-line JSON>` to
$GITHUB_OUTPUT, and a Markdown summary to $GITHUB_STEP_SUMMARY, when set.
Missing or unreadable reports are `unknown`, never green. Exits 0.
"""
import fnmatch
import json
import os
import sys
import xml.etree.ElementTree as ET

CAP = 100  # names listed per kind; the counts are always whole


def ran_gates(path):
    """Every gate that ran, as (name, exit), sorted; skipped and unchanged ones are left out."""
    gates = json.load(open(path))
    out = []
    for name in sorted(gates):
        e = gates[name]
        if not isinstance(e, dict) or "skipped" in e or e.get("unchanged"):
            continue
        out.append((name, e.get("exit")))
    return out


def red_gates(path):
    return [{"name": n, "exit": c} for n, c in ran_gates(path) if c not in (0, 78)]


def read_declared(path):
    """The layer's judged patterns, or None when it declares none (every gate is judged)."""
    if not path or not os.path.isfile(path):
        return None
    doc = json.load(open(path))
    pats = doc.get("judged") if isinstance(doc, dict) else None
    if not isinstance(pats, list) or not pats or not all(isinstance(p, str) and p for p in pats):
        raise ValueError(f"{path}: `judged` must be a non-empty list of gate-name patterns")
    return pats


def judge(ran, patterns):
    """Split the gates that ran by the layer's patterns: what is judged red, and the ratchet's lists."""
    def declared(name):
        return patterns is None or any(fnmatch.fnmatchcase(name, p) for p in patterns)

    red = [{"name": n, "exit": c} for n, c in ran if c not in (0, 78) and declared(n)]
    not_judged = [{"name": n, "exit": c} for n, c in ran if c not in (0, 78) and not declared(n)]
    passing_undeclared = [n for n, c in ran if c == 0 and not declared(n)]
    unmatched = [p for p in (patterns or []) if not any(fnmatch.fnmatchcase(n, p) for n, _ in ran)]
    return red, not_judged, passing_undeclared, unmatched


def red_tests(path):
    root = ET.parse(path).getroot()
    out = []

    def walk(node, trail):
        for child in node:
            if child.tag == "testsuite":
                walk(child, trail + [child.get("name", "")])
            elif child.tag == "testcase" and (child.find("failure") is not None or child.find("error") is not None):
                out.append(" > ".join(trail + [child.get("name", "")]))

    walk(root, [])
    return sorted(out)


def main():
    d = sys.argv[1]
    try:
        patterns = read_declared(sys.argv[2] if len(sys.argv) > 2 else None)
        gates, not_judged, passing_undeclared, unmatched = judge(ran_gates(os.path.join(d, "gates.json")), patterns)
        tests = red_tests(os.path.join(d, "junit.xml"))
    except (OSError, ValueError, ET.ParseError) as err:
        verdict, failures = "unknown", {"error": f"main's answer could not be read: {err}"}
        lines = [f"### Main's own verdict: unknown", "", failures["error"]]
    else:
        verdict = "red" if gates or tests else "green"
        failures = {
            "gates": gates[:CAP], "gate_count": len(gates),
            "tests": tests[:CAP], "test_count": len(tests),
        }
        if patterns is not None:
            failures.update({"declared": True, "not_judged_count": len(not_judged),
                             "passing_undeclared_count": len(passing_undeclared)})
        lines = [f"### Main's own verdict: {verdict}", "",
                 f"{len(gates)} gate(s) and {len(tests)} test(s) failing on main."]
        lines += [f"- gate `{g['name']}` (exit {g['exit']})" for g in gates[:CAP]]
        lines += [f"- test `{t}`" for t in tests[:CAP]]
        if patterns is None:
            lines += ["", "Every gate is judged: this layer declares none in `.github/main-qa-gates.json`."]
        else:
            lines += ["", f"Judged: the gates matching {', '.join(f'`{p}`' for p in patterns)}."]
            if not_judged:
                lines += ["", f"#### Not judged: red, but not declared ({len(not_judged)})", ""]
                lines += [f"- `{g['name']}` (exit {g['exit']})" for g in not_judged[:CAP]]
            if passing_undeclared:
                lines += ["", f"#### Passing but not declared ({len(passing_undeclared)}): add them to `judged`", ""]
                lines += [f"- `{n}`" for n in passing_undeclared[:CAP]]
            if unmatched:
                lines += ["", "#### Declared patterns that matched no gate that ran", ""]
                lines += [f"- `{p}`" for p in unmatched]
    report = "\n".join(lines)
    print(report)
    for var, text in (("GITHUB_STEP_SUMMARY", report + "\n"),
                      ("GITHUB_OUTPUT", f"verdict={verdict}\nfailures={json.dumps(failures, separators=(',', ':'))}\n")):
        if os.environ.get(var):
            with open(os.environ[var], "a", encoding="utf-8") as f:
                f.write(text)


if __name__ == "__main__":
    main()
