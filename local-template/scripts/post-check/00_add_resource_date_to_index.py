#!/usr/bin/env python3
"""
Post-Check Script: Add StructureDefinition dates from structuredefinitions.json to index page

This script reads temp/pages/_data/structuredefinitions.json, extracts all
StructureDefinition names and dates, and adds them to the output/index.html page.

This runs after Jekyll builds the final output.

Usage:
    python 00_add_resource_date_to_index.py [ig_root_path]
"""

import sys
import json
import re
from pathlib import Path


def get_structuredefinitions(ig_root: Path) -> list:
    """Read all StructureDefinitions from structuredefinitions.json."""

    sd_json_path = ig_root / "temp" / "pages" / "_data" / "structuredefinitions.json"

    if not sd_json_path.exists():
        print(f"Warning: structuredefinitions.json not found at {sd_json_path}")
        return []

    print(f"Reading structuredefinitions.json from: {sd_json_path}")

    with open(sd_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # The structure is: {"ResourceName": {"name": "...", "date": "...", ...}, ...}
    resources = []
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, dict):
                name = value.get('name', key)
                date = value.get('date', 'N/A')
                resources.append({'name': name, 'date': date})

    print(f"Found {len(resources)} StructureDefinitions")
    return resources


def add_dates_to_index(ig_root: Path) -> None:
    """Add StructureDefinition dates to the output/index.html."""

    # Get all StructureDefinitions
    resources = get_structuredefinitions(ig_root)

    if not resources:
        print("No StructureDefinitions found, skipping...")
        return

    # Read the output/index.html
    index_path = ig_root / "output" / "index.html"

    if not index_path.exists():
        print(f"Warning: index.html not found at {index_path}")
        return

    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Create the table HTML
    marker = "<!-- RESOURCE_DATES -->"
    rows = '\n'.join([f'<tr><td>{r["name"]}</td><td>{r["date"]}</td></tr>' for r in resources])
    date_html = f'''{marker}
<h3>StructureDefinition Dates (Injected by post-check script)</h3>
<table class="grid">
<thead><tr><th>Name</th><th>Date</th></tr></thead>
<tbody>
{rows}
</tbody>
</table>
{marker}'''

    # Check if section already exists
    if marker in content:
        print("Resource dates section already exists, updating...")
        pattern = f"{marker}.*?{marker}"
        content = re.sub(pattern, date_html, content, flags=re.DOTALL)
    else:
        # Insert after <p>IG</p> or before the first <h2>
        if '<p>IG</p>' in content:
            content = content.replace('<p>IG</p>', f'<p>IG</p>\n\n{date_html}')
            print("Added Resource dates section after <p>IG</p>")
        elif '<h2' in content:
            h2_match = re.search(r'<h2', content)
            if h2_match:
                pos = h2_match.start()
                content = content[:pos] + date_html + '\n\n' + content[pos:]
                print("Added Resource dates section before first <h2>")
        else:
            print("Could not find suitable insertion point in index.html")
            return

    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Successfully added {len(resources)} StructureDefinition dates to output/index.html")


def main():
    """Main entry point."""
    if len(sys.argv) > 1:
        ig_root = Path(sys.argv[1])
    else:
        ig_root = Path(".")

    print(f"Post-Check: Adding StructureDefinition dates to index page")
    print(f"IG root directory: {ig_root.absolute()}")

    add_dates_to_index(ig_root)


if __name__ == "__main__":
    main()
