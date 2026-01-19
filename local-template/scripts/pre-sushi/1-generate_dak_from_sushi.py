#!/usr/bin/env python3
"""
Generate dak.json from sushi-config.yaml

This script processes an existing FHIR Implementation Guide sushi-config.yaml file
and generates a corresponding dak.json file that serves as the primary DAK indicator.
It uses only the Python standard library and YAML parsing to avoid dependency on SUSHI.

Usage:
    python generate_dak_from_sushi.py [path_to_sushi_config] [output_path]
    
If no paths are provided, it looks for sushi-config.yaml in the current directory
and outputs dak.json to the current directory.
"""

import json
import os
import sys
import yaml
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional


def load_sushi_config(config_path: Path) -> Dict[str, Any]:
    """Load and parse the sushi-config.yaml file."""
    try:
        with open(config_path, 'r', encoding='utf-8') as file:
            return yaml.safe_load(file)
    except FileNotFoundError:
        print(f"Error: sushi-config.yaml not found at {config_path}")
        sys.exit(1)
    except yaml.YAMLError as e:
        print(f"Error parsing YAML file: {e}")
        sys.exit(1)


def convert_publisher(sushi_publisher: Any) -> Dict[str, str]:
    """Convert publisher information from sushi config to DAK format."""
    if isinstance(sushi_publisher, dict):
        return {
            "name": sushi_publisher.get("name", ""),
            "url": sushi_publisher.get("url", ""),
            **({"email": sushi_publisher["email"]} if sushi_publisher.get("email") else {})
        }
    elif isinstance(sushi_publisher, str):
        return {"name": sushi_publisher}
    else:
        return {"name": ""}


def generate_publication_url(repo_name: str, canonical_url: str) -> str:
    """Generate publication URL based on repository ownership and name."""
    # Check if this is a WorldHealthOrganization repository
    if os.getenv('GITHUB_REPOSITORY', '').startswith('WorldHealthOrganization/'):
        # Extract stub by removing 'smart-' prefix if present
        stub = repo_name
        if stub.startswith('smart-'):
            stub = stub[6:]  # Remove 'smart-' prefix
        return f"https://smart.who.int/{stub}"
    else:
        # For non-WHO repositories, use canonical URL or default pattern
        if canonical_url:
            return canonical_url
        # Fallback to GitHub Pages pattern
        github_repo = os.getenv('GITHUB_REPOSITORY', '')
        if github_repo:
            return f"https://{github_repo.split('/')[0]}.github.io/{github_repo.split('/')[1]}"
        return canonical_url or ""


def generate_preview_url(repo_name: str) -> str:
    """Generate preview URL for current CI build."""
    github_repo = os.getenv('GITHUB_REPOSITORY', '')
    if github_repo:
        profile, repo = github_repo.split('/')
        return f"https://{profile}.github.io/{repo}"
    # Fallback for local development
    return f"https://worldhealthorganization.github.io/{repo_name}"


def is_release_branch() -> bool:
    """Check if current branch is a release branch (prefixed with 'release-')."""
    branch_name = os.getenv('GITHUB_REF_NAME', os.getenv('BRANCH_NAME', ''))
    return branch_name.startswith('release-')


def generate_dak_json(sushi_config: Dict[str, Any]) -> Dict[str, Any]:
    """Generate dak.json structure from sushi-config.yaml."""
    
    # Extract repository information
    repo_id = sushi_config.get("id", "")
    repo_name = repo_id.split('.')[-1] if '.' in repo_id else repo_id
    canonical_url = sushi_config.get("canonical", "")
    
    # Generate URLs based on branch type and repository ownership
    if is_release_branch():
        # For release branches, use publication URL for canonical references
        publication_url = generate_publication_url(repo_name, canonical_url)
        preview_url = generate_preview_url(repo_name)
        # Use publication URL as canonical URL for release branches
        effective_canonical = publication_url
    else:
        # For non-release branches, use preview URL
        publication_url = generate_publication_url(repo_name, canonical_url)
        preview_url = generate_preview_url(repo_name)
        # Use preview URL as canonical URL for development branches
        effective_canonical = preview_url
    
    # Core DAK identity (mapped from sushi config)
    dak = {
        "resourceType": "DAK",
        "resourceDefinition": "http://smart.who.int/base/StructureDefinition/DAK",
        "id": repo_id,
        "name": sushi_config.get("name", ""),
        "title": sushi_config.get("title", ""),
        "description": sushi_config.get("description", ""),
        "version": sushi_config.get("version", "0.1.0"),
        "status": sushi_config.get("status", "draft"),
        "publicationUrl": publication_url,
        "previewUrl": preview_url,
        "canonicalUrl": effective_canonical,
        "license": sushi_config.get("license", "CC0-1.0"),
        "copyrightYear": sushi_config.get("copyrightYear", str(datetime.now().year)),
        "publisher": convert_publisher(sushi_config.get("publisher", {}))
    }
    
    return dak


def check_smart_base_dependency(sushi_config: Dict[str, Any]) -> bool:
    """Check if this repository should generate DAK configuration."""
    
    # Check if this is the smart-base repository
    repo_id = sushi_config.get('id', '')
    is_smart_base_repo = repo_id == 'smart.who.int.base'
    
    if is_smart_base_repo:
        print(f"This is the smart-base repository (id: {repo_id})")
        return True
    
    # Check if smart-base is listed as a dependency
    dependencies = sushi_config.get('dependencies', {})
    
    # Check for various possible smart-base dependency names
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
    
    print("This is not the smart-base repository and smart-base is not listed as a dependency. Skipping DAK generation.")
    return False


def main():
    """Main function to process command line arguments and generate dak.json."""

    # Parse command line arguments
    # First argument is the IG root directory (from template execution)
    if len(sys.argv) > 1:
        ig_root = Path(sys.argv[1])
    else:
        ig_root = Path(".")

    # Resolve paths relative to IG root
    sushi_path = ig_root / "sushi-config.yaml"
    output_path = ig_root / "dak.json"

    print(f"IG root directory: {ig_root.absolute()}")

    # Check if sushi config exists
    if not sushi_path.exists():
        print(f"Error: {sushi_path} does not exist")
        sys.exit(1)
    
    # Check if dak.json already exists
    if output_path.exists():
        print(f"DAK configuration already exists at {output_path}, skipping generation")
        return
    
    print(f"Reading sushi configuration from: {sushi_path}")
    
    # Load and check dependencies
    sushi_config = load_sushi_config(sushi_path)
    
    # Check if we should generate DAK configuration
    if not check_smart_base_dependency(sushi_config):
        return
    
    # Generate DAK configuration
    dak_config = generate_dak_json(sushi_config)
    
    # Write output
    try:
        with open(output_path, 'w', encoding='utf-8') as file:
            json.dump(dak_config, file, indent=2, ensure_ascii=False)
        print(f"Successfully generated DAK configuration: {output_path}")
        print(f"DAK ID: {dak_config['id']}")
        print(f"DAK Title: {dak_config['title']}")
        print(f"Publication URL: {dak_config['publicationUrl']}")
        print(f"Preview URL: {dak_config['previewUrl']}")
        print(f"Canonical URL: {dak_config['canonicalUrl']}")
        print(f"Is Release Branch: {is_release_branch()}")
    except IOError as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()