# ValueSet Schema Generator

This Python script generates JSON schemas with enum values for FHIR ValueSet resources from the WHO Trust expansions.json file.

## Purpose

The script takes the expansions.json file from https://smart.who.int/trust/expansions.json and for each entry that has a resource with resourceType "ValueSet", it creates a JSON schema that enumerates the possible values using JSON Schema's enum feature.

## Usage

### Basic Usage

```bash
# Generate schemas from the remote URL (default)
python3 input/scripts/generate_valueset_schemas.py

# Generate schemas from a local file
python3 input/scripts/generate_valueset_schemas.py --input /path/to/expansions.json

# Specify custom output directory
python3 input/scripts/generate_valueset_schemas.py --output /path/to/output/dir

# Enable verbose output
python3 input/scripts/generate_valueset_schemas.py --verbose
```

### Command Line Options

- `--url URL`: URL to fetch expansions.json from (default: https://smart.who.int/trust/expansions.json)
- `--input FILE`: Local expansions.json file to use instead of fetching from URL  
- `--output DIR`: Output directory for schema files (default: output/schemas)
- `--verbose, -v`: Enable verbose output
- `--help, -h`: Show help message

## Output

The script generates JSON schema files in the specified output directory. Each ValueSet resource becomes a separate `.schema.json` file.

### Schema Structure

Each generated schema follows this structure:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://smart.who.int/trust/schemas/{valueset-id}.json",
  "title": "ValueSet Title",
  "description": "ValueSet Description", 
  "type": "string",
  "enum": [
    "code1",
    "code2",
    "code3"
  ],
  "metadata": {
    "valueSet": {
      "id": "valueset-id",
      "url": "http://example.com/ValueSet/example",
      "version": "1.0.0",
      "status": "active"
    },
    "codes": [
      {
        "code": "code1",
        "display": "Code 1 Display",
        "system": "http://example.com/CodeSystem/example"
      }
    ]
  }
}
```

## Requirements

- Python 3.6+
- urllib3 library

## Error Handling

The script handles various error conditions gracefully:

- Network connectivity issues
- Invalid JSON format
- Missing or malformed ValueSet resources
- File system permissions issues

## Examples

### Example 1: Generate schemas from remote URL

```bash
python3 input/scripts/generate_valueset_schemas.py --output schemas --verbose
```

### Example 2: Generate schemas from local file

```bash
python3 input/scripts/generate_valueset_schemas.py --input expansions.json --output schemas
```

## Integration

This script can be integrated into build processes or CI/CD pipelines to automatically generate up-to-date JSON schemas when ValueSets are modified.