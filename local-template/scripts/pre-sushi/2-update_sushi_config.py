#!/usr/bin/env python3
"""
Pre-sushi: Update sushi-config.yaml with DAK API page and menu entries.

This script runs BEFORE sushi compilation to ensure the DAK API page
is registered in sushi-config.yaml so sushi includes it in the build.

The resource scanning and placeholder generation happens in post-sushi
after fsh-generated/ is created.

Usage:
    python 2-update_sushi_config.py [ig_root_dir]
"""

import yaml
import sys
import os
import json
from pathlib import Path


def create_dak_api_md_if_needed(ig_root: Path) -> bool:
    """Create dak-api.md file with proper content if it doesn't exist."""
    dak_api_path = ig_root / 'input' / 'pagecontent' / 'dak-api.md'

    # Check if the file already exists with proper content
    if dak_api_path.exists():
        try:
            content = dak_api_path.read_text(encoding='utf-8')
            # Check for either the old comment marker or the new div placeholder
            if 'id="dak-api-content-placeholder"' in content or '<!-- DAK_API_CONTENT -->' in content:
                print(f"dak-api.md already exists with proper content")
                return True
            else:
                print(f"dak-api.md exists but missing placeholder, updating...")
        except Exception as e:
            print(f"Error reading existing dak-api.md: {e}")
    else:
        print(f"dak-api.md does not exist, creating...")

    # Create the directories if they don't exist
    try:
        dak_api_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"Failed to create directory structure: {e}")
        return False

    # Create the dak-api.md content with a div placeholder that survives HTML conversion
    dak_api_content = """

This page provides access to Data Access Kit (DAK) API documentation and schemas.

{: .no_toc .text-delta }

1. TOC
{:toc}

<div id="dak-api-content-placeholder">
<!-- DAK API content will be injected here by post-processing -->
</div>
"""

    try:
        dak_api_path.write_text(dak_api_content, encoding='utf-8')
        print(f"Successfully created dak-api.md with placeholder div")
        return True
    except Exception as e:
        print(f"Error creating dak-api.md: {e}")
        return False


def page_exists_in_config(pages: dict, page_name: str) -> bool:
    """Recursively check if a page exists anywhere in the pages structure."""
    if pages is None:
        return False

    for key, value in pages.items():
        if key == page_name:
            return True
        # Check nested pages (value is a dict with nested structure)
        if isinstance(value, dict):
            if page_exists_in_config(value, page_name):
                return True
    return False


def check_smart_base_dependency(config: dict) -> bool:
    """Check if this repository should have DAK API configured."""

    # Check if this is the smart-base repository
    repo_id = config.get('id', '')
    if repo_id == 'smart.who.int.base':
        print(f"This is the smart-base repository (id: {repo_id})")
        return True

    # Check if smart-base is listed as a dependency
    dependencies = config.get('dependencies', {})
    smart_base_patterns = [
        'smart-base',
        'smart.who.int.base',
        'who.smart.base',
        'smart.base'
    ]

    for dep_name in dependencies.keys():
        for pattern in smart_base_patterns:
            if pattern in dep_name.lower():
                print(f"Found smart-base dependency: {dep_name}")
                return True

    return False


def update_sushi_config(ig_root: Path) -> bool:
    """Update sushi-config.yaml with DAK API page and menu entries."""
    sushi_config_path = ig_root / 'sushi-config.yaml'
    config_updated = False

    try:
        with open(sushi_config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        print(f"Successfully loaded {sushi_config_path}")

        # Check if this repo should have DAK API
        if not check_smart_base_dependency(config):
            print("This is not the smart-base repository and smart-base is not listed as a dependency.")
            print("Skipping DAK API configuration.")
            return False

        # Create dak-api.md if needed
        if not create_dak_api_md_if_needed(ig_root):
            print("Failed to create dak-api.md, but continuing with sushi-config processing...")

        # Ensure pages section exists
        if 'pages' not in config:
            config['pages'] = {}

        # Check if dak-api.md is registered anywhere in pages (supports nested structure)
        if not page_exists_in_config(config.get('pages'), 'dak-api.md'):
            # Add at root level of pages
            config['pages']['dak-api.md'] = {'title': 'DAK API Documentation Hub'}
            config_updated = True
            print("Added dak-api.md to pages section")
        else:
            print("dak-api.md already exists in pages section")

        # Ensure menu section exists
        if 'menu' not in config:
            config['menu'] = {}

        # Check if DAK API link already exists anywhere in the menu
        def menu_item_exists(menu: dict, target_url: str) -> bool:
            """Check if a menu item with the given URL exists anywhere in the menu."""
            if menu is None:
                return False
            for key, value in menu.items():
                if value == target_url:
                    return True
                if isinstance(value, dict):
                    if menu_item_exists(value, target_url):
                        return True
            return False

        if not menu_item_exists(config.get('menu'), 'dak-api.html'):
            # Ensure Indices subsection exists under menu
            if 'Indices' not in config['menu']:
                config['menu']['Indices'] = {}

            # Add DAK API to Indices
            config['menu']['Indices']['DAK API'] = 'dak-api.html'
            config_updated = True
            print("Added DAK API to menu Indices section")
        else:
            print("DAK API already exists in menu")

        # Write back the updated config if changes were made
        if config_updated:
            with open(sushi_config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            print("sushi-config.yaml updated successfully")
            return True
        else:
            print("sushi-config.yaml already contains required DAK API entries")
            return False

    except FileNotFoundError:
        print(f"Error: {sushi_config_path} not found")
        return False
    except Exception as e:
        print(f"Error updating sushi-config.yaml: {e}")
        return False


def main():
    """Main entry point."""
    # First argument is the IG root directory (from template execution)
    if len(sys.argv) > 1:
        ig_root = Path(sys.argv[1])
    else:
        ig_root = Path(".")

    print(f"IG root directory: {ig_root.absolute()}")

    # Update sushi config
    update_sushi_config(ig_root)

    # Always exit successfully - this is a non-critical step
    sys.exit(0)


if __name__ == "__main__":
    main()
