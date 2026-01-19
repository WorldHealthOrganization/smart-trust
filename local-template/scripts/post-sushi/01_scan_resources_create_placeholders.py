#!/usr/bin/env python3
"""
Post-sushi: Scan for FHIR resources and create placeholder markdown files.

This script runs AFTER sushi compilation to scan the fsh-generated/resources/
directory for ValueSets and Logical Models, then creates placeholder markdown
files that the IG Publisher will process.

Usage:
    python 01_scan_resources_create_placeholders.py [ig_root_dir]
"""

import sys
import os
import json
import glob
from pathlib import Path


def check_dak_enabled(ig_root: Path) -> bool:
    """Check if DAK processing should be enabled for this repository."""
    # Check for dak.json file
    dak_json_path = ig_root / "dak.json"
    if dak_json_path.exists():
        try:
            with open(dak_json_path, 'r', encoding='utf-8') as f:
                json.load(f)
            print("Found dak.json - DAK processing enabled")
            return True
        except Exception as e:
            print(f"Found dak.json but couldn't parse it: {e}")

    # Check if smart.who.int.base is a dependency (simple text search)
    sushi_config_path = ig_root / "sushi-config.yaml"
    if sushi_config_path.exists():
        try:
            content = sushi_config_path.read_text(encoding='utf-8')
            if 'smart.who.int.base' in content:
                print("Found smart.who.int.base dependency - DAK processing enabled")
                return True
        except Exception as e:
            print(f"Could not check sushi-config.yaml: {e}")

    print("DAK processing not enabled (no dak.json or smart.who.int.base dependency)")
    return False


def scan_for_resources(ig_root: Path) -> tuple:
    """
    Scan for ValueSet and Logical Model resources from fsh-generated and input/resources.

    Returns:
        Tuple of (valuesets_list, logical_models_list)
    """
    valuesets = []
    logical_models = []

    # Directories to scan for FHIR resources
    scan_dirs = [
        ig_root / 'fsh-generated' / 'resources',
        ig_root / 'input' / 'resources'
    ]

    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            print(f"Directory not found (skipping): {scan_dir}")
            continue

        print(f"Scanning {scan_dir} for FHIR resources...")
        fhir_files = list(scan_dir.glob('*.json'))
        print(f"  Found {len(fhir_files)} JSON files")

        for fhir_file in fhir_files:
            try:
                with open(fhir_file, 'r', encoding='utf-8') as f:
                    resource = json.load(f)

                resource_type = resource.get('resourceType', '')
                resource_id = resource.get('id', '')

                if resource_type == 'ValueSet' and resource_id:
                    # Check if already found (avoid duplicates)
                    if not any(vs['id'] == resource_id for vs in valuesets):
                        valuesets.append({
                            'id': resource_id,
                            'name': resource.get('name', resource_id),
                            'title': resource.get('title', resource_id),
                            'description': resource.get('description', ''),
                            'source_file': str(fhir_file)
                        })
                        print(f"    Found ValueSet: {resource_id}")

                elif resource_type == 'StructureDefinition' and resource_id:
                    kind = resource.get('kind', '')
                    if kind == 'logical':
                        # Check if already found (avoid duplicates)
                        if not any(lm['id'] == resource_id for lm in logical_models):
                            logical_models.append({
                                'id': resource_id,
                                'name': resource.get('name', resource_id),
                                'title': resource.get('title', resource_id),
                                'description': resource.get('description', ''),
                                'source_file': str(fhir_file)
                            })
                            print(f"    Found Logical Model: {resource_id}")

            except Exception as e:
                print(f"    Warning: Error reading {fhir_file}: {e}")

    return valuesets, logical_models


def create_placeholder_files(ig_root: Path, valuesets: list, logical_models: list) -> int:
    """
    Create placeholder markdown files for ValueSets and Logical Models.

    Returns:
        Number of files created
    """
    pagecontent_dir = ig_root / 'input' / 'pagecontent'
    pagecontent_dir.mkdir(parents=True, exist_ok=True)

    created_count = 0

    # Create placeholder files for ValueSets
    for valueset in valuesets:
        md_filename = f"ValueSet-{valueset['id']}.md"
        md_path = pagecontent_dir / md_filename

        should_create = True
        if md_path.exists():
            try:
                existing_content = md_path.read_text(encoding='utf-8').strip()
                # Only recreate if it's empty or contains our placeholder marker
                if existing_content and '<!-- DAK_API_PLACEHOLDER -->' not in existing_content:
                    should_create = False
                    print(f"  Skipping {md_filename} - already exists with custom content")
            except Exception as e:
                print(f"  Warning: Error checking existing file {md_path}: {e}")

        if should_create:
            description = valueset.get('description', 'ValueSet documentation will be generated during post-processing.')
            placeholder_content = f"""# {valueset['title']}

<!-- DAK_API_PLACEHOLDER: ValueSet-{valueset['id']} -->

{description}

---

*This content will be automatically updated during the DAK API documentation generation process.*
"""
            try:
                md_path.write_text(placeholder_content, encoding='utf-8')
                print(f"  Created placeholder: {md_filename}")
                created_count += 1
            except Exception as e:
                print(f"  Error creating {md_filename}: {e}")

    # Create placeholder files for Logical Models
    for logical_model in logical_models:
        md_filename = f"StructureDefinition-{logical_model['id']}.md"
        md_path = pagecontent_dir / md_filename

        should_create = True
        if md_path.exists():
            try:
                existing_content = md_path.read_text(encoding='utf-8').strip()
                # Only recreate if it's empty or contains our placeholder marker
                if existing_content and '<!-- DAK_API_PLACEHOLDER -->' not in existing_content:
                    should_create = False
                    print(f"  Skipping {md_filename} - already exists with custom content")
            except Exception as e:
                print(f"  Warning: Error checking existing file {md_path}: {e}")

        if should_create:
            description = logical_model.get('description', 'Logical Model documentation will be generated during post-processing.')
            placeholder_content = f"""# {logical_model['title']}

<!-- DAK_API_PLACEHOLDER: StructureDefinition-{logical_model['id']} -->

{description}

---

*This content will be automatically updated during the DAK API documentation generation process.*
"""
            try:
                md_path.write_text(placeholder_content, encoding='utf-8')
                print(f"  Created placeholder: {md_filename}")
                created_count += 1
            except Exception as e:
                print(f"  Error creating {md_filename}: {e}")

    return created_count


def main():
    """Main entry point."""
    # First argument is the IG root directory (from template execution)
    if len(sys.argv) > 1:
        ig_root = Path(sys.argv[1])
    else:
        ig_root = Path(".")

    print(f"Post-sushi resource scanning")
    print(f"IG root directory: {ig_root.absolute()}")

    # Check if DAK processing is enabled
    if not check_dak_enabled(ig_root):
        print("DAK processing not enabled, skipping resource scanning")
        sys.exit(0)

    # Scan for resources
    print("\nScanning for FHIR resources...")
    valuesets, logical_models = scan_for_resources(ig_root)

    print(f"\nFound {len(valuesets)} ValueSets")
    print(f"Found {len(logical_models)} Logical Models")

    # Create placeholder files
    if valuesets or logical_models:
        print("\nCreating placeholder markdown files...")
        created = create_placeholder_files(ig_root, valuesets, logical_models)
        print(f"\nCreated {created} placeholder files")
    else:
        print("\nNo ValueSets or Logical Models found, skipping placeholder creation")

    sys.exit(0)


if __name__ == "__main__":
    main()
