#!/bin/bash

# Example script showing how to generate ValueSet schemas
# This script demonstrates the usage of generate_valueset_schemas.py

echo "WHO Trust ValueSet Schema Generator Example"
echo "==========================================="
echo

# Set the output directory
OUTPUT_DIR="output/schemas"

echo "1. Generating schemas from remote URL (if accessible):"
echo "   python3 input/scripts/generate_valueset_schemas.py --output $OUTPUT_DIR --verbose"
echo

# Try to generate from remote URL (will likely fail in restricted environments)
if python3 input/scripts/generate_valueset_schemas.py --output "$OUTPUT_DIR" --verbose; then
    echo "✓ Successfully generated schemas from remote URL"
else
    echo "✗ Failed to fetch from remote URL (this is expected in restricted environments)"
    echo
    echo "2. Alternative: Generate from local file (for testing/development):"
    echo "   You can create a local expansions.json file and use:"
    echo "   python3 input/scripts/generate_valueset_schemas.py --input /path/to/expansions.json --output $OUTPUT_DIR"
fi

echo
echo "3. Generated schemas should be in: $OUTPUT_DIR"
if [ -d "$OUTPUT_DIR" ]; then
    echo "   Files found:"
    ls -la "$OUTPUT_DIR"/*.schema.json 2>/dev/null || echo "   No schema files found yet"
else
    echo "   Directory does not exist yet"
fi

echo
echo "4. Each schema file contains:"
echo "   - JSON Schema with enum values for the ValueSet codes"
echo "   - Metadata about the original ValueSet resource"
echo "   - Full code information including display names"
echo
echo "Example usage of generated schema for validation:"
echo '   {"code": "SCA"}  # Valid against who-trust-key-usage.schema.json'
echo '   {"code": "INVALID"}  # Invalid - not in enum'