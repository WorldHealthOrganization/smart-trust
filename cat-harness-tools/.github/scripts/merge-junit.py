#!/usr/bin/env python3
"""Join `bun test --shard=i/n --reporter=junit` reports into one report.

Usage: merge-junit.py <out.xml> <part.xml>...

pr-tests.yml runs a side's tests in parts (issue #1263); the judges read one
report per side. Every part's suites go under one <testsuites> root whose
`tests`, `failures`, `errors` and `skipped` are the parts' sums. A part that
is missing or unreadable is an error, never an empty part: a side with a part
lost could not be judged.
"""
import sys
import xml.etree.ElementTree as ET


def main(out, parts):
    if not parts:
        sys.exit("merge-junit: no parts given")
    root = ET.Element("testsuites", name="bun test")
    sums = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for path in parts:
        try:
            part = ET.parse(path).getroot()
        except (OSError, ET.ParseError) as e:
            sys.exit(f"merge-junit: {path}: {e}")
        suites = [part] if part.tag == "testsuite" else list(part)
        for k in sums:
            sums[k] += int(part.get(k, 0) or 0)
        root.extend(suites)
    for k, v in sums.items():
        root.set(k, str(v))
    ET.ElementTree(root).write(out, encoding="utf-8", xml_declaration=True)
    print(f"merge-junit: {len(parts)} parts, {sums['tests']} tests, {sums['failures']} failures -> {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
