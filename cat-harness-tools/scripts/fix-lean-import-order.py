#!/usr/bin/env python3
"""
Fix Lean 4.24+ import-ordering: move `import` statements above `/-! ... -/` doc blocks.

Lean 4.24 requires all `import` statements before any other content.
This script finds files where a `/-! ... -/` module docstring precedes
the imports and swaps them.

Usage:
  python3 scripts/fix-lean-import-order.py [--dry-run]
  python3 scripts/fix-lean-import-order.py              # apply fixes
  python3 scripts/fix-lean-import-order.py --dry-run     # preview only
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY_RUN = "--dry-run" in sys.argv


def fix_file(path: str) -> bool:
    with open(path, "r") as f:
        content = f.read()

    # Pattern: file starts with /-! ... -/ then has import lines after
    m = re.match(r"^(\s*/\-![\s\S]*?\-/\s*\n)((\s*import\s+\S+\s*\n)+)", content)
    if not m:
        return False

    doc_block = m.group(1)
    import_block = m.group(2)
    rest = content[m.end():]

    new_content = import_block + "\n" + doc_block + rest

    if not DRY_RUN:
        with open(path, "w") as f:
            f.write(new_content)

    return True


def main():
    fixed = 0
    skipped = 0

    for root, dirs, files in os.walk(os.path.join(REPO_ROOT, "content")):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".lake", "build", "lake-packages", "lean")]
        for fname in sorted(files):
            if not fname.endswith(".lean"):
                continue
            path = os.path.join(root, fname)
            # Only fix files that have a .ts sibling (content blocks)
            ts_path = path.replace(".lean", ".ts")
            if not os.path.exists(ts_path):
                continue

            if fix_file(path):
                rel = os.path.relpath(path, REPO_ROOT)
                if DRY_RUN:
                    print(f"  WOULD FIX: {rel}")
                else:
                    print(f"  FIXED: {rel}")
                fixed += 1
            else:
                skipped += 1

    mode = "DRY RUN" if DRY_RUN else "APPLIED"
    print(f"\n{mode}: {fixed} files fixed, {skipped} already correct")


if __name__ == "__main__":
    main()
