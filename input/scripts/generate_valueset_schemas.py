#!/usr/bin/env python3
"""
Generate JSON schemas for ValueSet resources from WHO Trust expansions.json

This script fetches the expansions.json from https://smart.who.int/trust/expansions.json
and generates JSON schema files with enum values for each ValueSet resource found.
"""

import json
import sys
import os
import argparse
import urllib3
from urllib.parse import urlparse
from pathlib import Path


DEFAULT_EXPANSIONS_URL = "https://smart.who.int/trust/expansions.json"
DEFAULT_OUTPUT_DIR = "output/schemas"


def load_remote_json(url):
    """Load JSON data from a remote URL."""
    try:
        http = urllib3.PoolManager()
        response = http.request('GET', url)
        if response.status == 200:
            return json.loads(response.data.decode('utf-8'))
        else:
            raise Exception(f"HTTP {response.status}: Failed to fetch {url}")
    except Exception as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return None


def load_local_json(filepath):
    """Load JSON data from a local file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}", file=sys.stderr)
        return None


def extract_valueset_codes(expansion):
    """Extract codes from a ValueSet expansion."""
    codes = []
    if 'expansion' in expansion and 'contains' in expansion['expansion']:
        for item in expansion['expansion']['contains']:
            if 'code' in item:
                code_obj = {
                    'code': item['code']
                }
                if 'display' in item:
                    code_obj['display'] = item['display']
                if 'system' in item:
                    code_obj['system'] = item['system']
                codes.append(code_obj)
    return codes


def generate_json_schema(valueset_id, valueset_resource, codes):
    """Generate a JSON schema with enum values for a ValueSet."""
    
    # Extract just the code values for the enum
    enum_values = [code['code'] for code in codes]
    
    # Create the base schema
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": f"https://smart.who.int/trust/schemas/{valueset_id}.json",
        "title": valueset_resource.get('title', valueset_resource.get('name', valueset_id)),
        "description": valueset_resource.get('description', f"JSON Schema for {valueset_id} ValueSet"),
        "type": "string"
    }
    
    # Add enum if we have codes
    if enum_values:
        schema["enum"] = sorted(enum_values)
    
    # Add metadata about the codes
    if codes:
        schema["metadata"] = {
            "valueSet": {
                "id": valueset_id,
                "url": valueset_resource.get('url', ''),
                "version": valueset_resource.get('version', ''),
                "status": valueset_resource.get('status', '')
            },
            "codes": codes
        }
    
    return schema


def sanitize_filename(name):
    """Sanitize a string to be used as a filename."""
    # Replace problematic characters
    sanitized = name.replace('/', '_').replace('\\', '_').replace(':', '_')
    sanitized = sanitized.replace('|', '_').replace('?', '_').replace('*', '_')
    sanitized = sanitized.replace('<', '_').replace('>', '_').replace('"', '_')
    return sanitized


def process_expansions(expansions_data, output_dir):
    """Process expansions data and generate schema files."""
    if not expansions_data:
        print("No expansions data to process", file=sys.stderr)
        return False
    
    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    processed_count = 0
    
    # Handle different possible structures of expansions.json
    entries = []
    if isinstance(expansions_data, list):
        entries = expansions_data
    elif isinstance(expansions_data, dict):
        if 'entry' in expansions_data:
            entries = expansions_data['entry']
        elif 'expansions' in expansions_data:
            entries = expansions_data['expansions']
        else:
            # Try to process as a single expansion
            entries = [expansions_data]
    
    for entry in entries:
        resource = None
        
        # Handle Bundle entry format
        if 'resource' in entry:
            resource = entry['resource']
        else:
            resource = entry
        
        # Check if this is a ValueSet resource
        if resource.get('resourceType') == 'ValueSet':
            valueset_id = resource.get('id', resource.get('name', 'unknown'))
            
            print(f"Processing ValueSet: {valueset_id}")
            
            # Extract codes from the expansion
            codes = extract_valueset_codes(resource)
            
            if codes:
                # Generate schema
                schema = generate_json_schema(valueset_id, resource, codes)
                
                # Save schema file
                filename = f"{sanitize_filename(valueset_id)}.schema.json"
                filepath = Path(output_dir) / filename
                
                try:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(schema, f, indent=2, ensure_ascii=False)
                    
                    print(f"  Generated schema: {filepath}")
                    print(f"  Enum values: {len(codes)} codes")
                    processed_count += 1
                    
                except Exception as e:
                    print(f"  Error writing schema file {filepath}: {e}", file=sys.stderr)
            else:
                print(f"  No codes found in expansion for {valueset_id}")
    
    print(f"\nProcessed {processed_count} ValueSet schemas")
    return processed_count > 0


def main():
    parser = argparse.ArgumentParser(
        description="Generate JSON schemas for ValueSet resources from WHO Trust expansions.json"
    )
    parser.add_argument(
        '--url', 
        default=DEFAULT_EXPANSIONS_URL,
        help=f"URL to fetch expansions.json from (default: {DEFAULT_EXPANSIONS_URL})"
    )
    parser.add_argument(
        '--input', 
        help="Local expansions.json file to use instead of fetching from URL"
    )
    parser.add_argument(
        '--output', 
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for schema files (default: {DEFAULT_OUTPUT_DIR})"
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        print(f"Output directory: {args.output}")
    
    # Load expansions data
    expansions_data = None
    
    if args.input:
        if args.verbose:
            print(f"Loading expansions from local file: {args.input}")
        expansions_data = load_local_json(args.input)
    else:
        if args.verbose:
            print(f"Fetching expansions from: {args.url}")
        expansions_data = load_remote_json(args.url)
    
    if not expansions_data:
        print("Failed to load expansions data", file=sys.stderr)
        return 1
    
    # Process the expansions and generate schemas
    success = process_expansions(expansions_data, args.output)
    
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())