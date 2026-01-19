#!/usr/bin/env python3
"""
FHIR ValueSet JSON Schema Generator

This script processes the expansions.json file output by the FHIR IG publisher
and generates JSON schemas for each ValueSet that enumerate all valid codes
using the JSON Schema enum constraint.

The script is intended to be run after the IG publisher finishes processing
to create schemas that can be used for validation of data against the
expanded ValueSets.

Usage:
    python generate_valueset_schemas.py [expansions_json_path] [output_dir]

Author: SMART Guidelines Team
"""

import json
import os
import sys
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path
from datetime import datetime


def transform_codesystem_url(system_url: str) -> str:
    """
    Transform FHIR CodeSystem URL from slash format to hyphen format for JSON-LD.
    
    Args:
        system_url: Original system URL (e.g., "http://smart.who.int/base/CodeSystem/SGPersonaTypes")
        
    Returns:
        Transformed URL (e.g., "http://smart.who.int/base/CodeSystem-SGPersonaTypes")
    """
    if not system_url:
        return system_url
    
    # Transform /CodeSystem/ to /CodeSystem-
    if '/CodeSystem/' in system_url:
        # Split at /CodeSystem/ and rejoin with /CodeSystem-
        parts = system_url.split('/CodeSystem/')
        if len(parts) == 2:
            return f"{parts[0]}/CodeSystem-{parts[1]}"
    
    return system_url


def setup_logging() -> logging.Logger:
    """Configure logging for the script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


class QAReporter:
    """Handles QA reporting for ValueSet schema generation."""
    
    def __init__(self, component: str = "valueset_schemas"):
        self.component = component
        self.timestamp = datetime.now().isoformat()
        self.report = {
            "component": component,
            "timestamp": self.timestamp,
            "status": "running",
            "summary": {},
            "details": {
                "successes": [],
                "warnings": [],
                "errors": [],
                "files_processed": [],
                "files_expected": [],
                "files_missing": [],
                "schemas_generated": []
            }
        }
    
    def add_success(self, message: str, details: Optional[Dict] = None):
        """Add a success entry to the QA report."""
        entry = {"message": message, "timestamp": datetime.now().isoformat()}
        if details:
            entry["details"] = details
        self.report["details"]["successes"].append(entry)
    
    def add_warning(self, message: str, details: Optional[Dict] = None):
        """Add a warning entry to the QA report."""
        entry = {"message": message, "timestamp": datetime.now().isoformat()}
        if details:
            entry["details"] = details
        self.report["details"]["warnings"].append(entry)
    
    def add_error(self, message: str, details: Optional[Dict] = None):
        """Add an error entry to the QA report."""
        entry = {"message": message, "timestamp": datetime.now().isoformat()}
        if details:
            entry["details"] = details
        self.report["details"]["errors"].append(entry)
    
    def add_file_processed(self, file_path: str, status: str = "success", details: Optional[Dict] = None):
        """Record a file that was processed."""
        entry = {
            "file": file_path,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        if details:
            entry["details"] = details
        self.report["details"]["files_processed"].append(entry)
    
    def add_file_expected(self, file_path: str, found: bool = False):
        """Record a file that was expected."""
        self.report["details"]["files_expected"].append(file_path)
        if not found:
            self.report["details"]["files_missing"].append(file_path)
    
    def add_schema_generated(self, schema_info: Dict):
        """Record a schema that was generated."""
        schema_info["timestamp"] = datetime.now().isoformat()
        self.report["details"]["schemas_generated"].append(schema_info)
    
    def finalize_report(self, status: str = "completed"):
        """Finalize the QA report with summary statistics."""
        self.report["status"] = status
        self.report["summary"] = {
            "total_successes": len(self.report["details"]["successes"]),
            "total_warnings": len(self.report["details"]["warnings"]),
            "total_errors": len(self.report["details"]["errors"]),
            "files_processed_count": len(self.report["details"]["files_processed"]),
            "files_expected_count": len(self.report["details"]["files_expected"]),
            "files_missing_count": len(self.report["details"]["files_missing"]),
            "schemas_generated_count": len(self.report["details"]["schemas_generated"]),
            "completion_timestamp": datetime.now().isoformat()
        }
        return self.report
    
    def save_to_file(self, output_path: str):
        """Save QA report to a JSON file."""
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(self.report, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving QA report to {output_path}: {e}")
            return False


def load_expansions_json(file_path: str) -> Optional[Dict[str, Any]]:
    """
    Load and parse the expansions.json file.
    
    Args:
        file_path: Path to the expansions.json file
        
    Returns:
        Parsed JSON data or None if failed to load
    """
    logger = logging.getLogger(__name__)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info(f"Successfully loaded expansions.json from {file_path}")
        return data
    
    except FileNotFoundError:
        logger.error(f"Expansions file not found: {file_path}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in expansions file: {e}")
        return None
    except Exception as e:
        logger.error(f"Error loading expansions file: {e}")
        return None


def extract_valueset_id_from_entry(entry: Dict[str, Any]) -> str:
    """
    Extract the ValueSet ID from a Bundle entry and its resource.
    
    Args:
        entry: Bundle entry containing a ValueSet resource
        
    Returns:
        ValueSet ID or 'unknown' if cannot be determined
    """
    valueset_resource = entry.get('resource', {})
    
    # Try different sources for the ID in order of preference
    
    # 1. Direct 'id' field in resource
    if 'id' in valueset_resource and valueset_resource['id'] != 'unknown':
        return valueset_resource['id']
    
    # 2. Extract from resource 'url' field (canonical URL)
    if 'url' in valueset_resource:
        url = valueset_resource['url']
        # Extract the last part of the URL after the last '/'
        if '/' in url:
            return url.split('/')[-1]
    
    # 3. Extract from Bundle entry 'fullUrl' field
    if 'fullUrl' in entry:
        full_url = entry['fullUrl']
        # Extract the last part of the URL after the last '/'
        if '/' in full_url:
            return full_url.split('/')[-1]
    
    # 4. Use 'name' field if available
    if 'name' in valueset_resource and valueset_resource['name']:
        return valueset_resource['name']
    
    # 5. Extract from title if it's in a recognizable format
    if 'title' in valueset_resource:
        title = valueset_resource['title']
        # If title contains common patterns, try to extract ID
        # This is a fallback for cases where title might contain the logical name
        words = title.replace(' ', '').replace('-', '').replace('_', '')
        if words and not words.lower().startswith('unknown'):
            return words
    
    return 'unknown'


def extract_valueset_id(valueset_resource: Dict[str, Any]) -> str:
    """
    Extract the ValueSet ID from various possible sources.
    (Legacy function - kept for backwards compatibility)
    
    Args:
        valueset_resource: FHIR ValueSet resource
        
    Returns:
        ValueSet ID or 'unknown' if cannot be determined
    """
    # Try different sources for the ID in order of preference
    
    # 1. Direct 'id' field
    if 'id' in valueset_resource and valueset_resource['id'] != 'unknown':
        return valueset_resource['id']
    
    # 2. Extract from 'url' field (canonical URL)
    if 'url' in valueset_resource:
        url = valueset_resource['url']
        # Extract the last part of the URL after the last '/'
        if '/' in url:
            return url.split('/')[-1]
    
    # 3. Use 'name' field if available
    if 'name' in valueset_resource and valueset_resource['name']:
        return valueset_resource['name']
    
    # 4. Extract from title if it's in a recognizable format
    if 'title' in valueset_resource:
        title = valueset_resource['title']
        # If title contains common patterns, try to extract ID
        # This is a fallback for cases where title might contain the logical name
        words = title.replace(' ', '').replace('-', '').replace('_', '')
        if words and not words.lower().startswith('unknown'):
            return words
    
    return 'unknown'


def extract_valueset_codes(valueset_resource: Dict[str, Any], valueset_id: str = None) -> List[str]:
    """
    Extract codes from a ValueSet resource's expansion.
    
    Args:
        valueset_resource: FHIR ValueSet resource with expansion
        valueset_id: Optional ValueSet ID for logging (if not provided, will be extracted)
        
    Returns:
        List of codes from the expansion
    """
    logger = logging.getLogger(__name__)
    codes = []
    
    if valueset_id is None:
        valueset_id = extract_valueset_id(valueset_resource)
    
    # Check if resource has expansion
    if 'expansion' not in valueset_resource:
        logger.warning(f"ValueSet {valueset_id} has no expansion")
        return codes
    
    expansion = valueset_resource['expansion']
    
    # Check if expansion has contains
    if 'contains' not in expansion:
        logger.warning(f"ValueSet {valueset_id} expansion has no contains")
        return codes
    
    # Extract codes from contains array
    for item in expansion['contains']:
        if 'code' in item:
            codes.append(item['code'])
    
    logger.info(f"Extracted {len(codes)} codes from ValueSet {valueset_id}")
    return codes


def extract_valueset_codes_with_display(valueset_resource: Dict[str, Any], valueset_id: str = None) -> List[Dict[str, str]]:
    """
    Extract codes with their display values and system URIs from a ValueSet resource's expansion.
    
    Args:
        valueset_resource: FHIR ValueSet resource with expansion
        valueset_id: Optional ValueSet ID for logging (if not provided, will be extracted)
        
    Returns:
        List of dictionaries containing 'code', 'display', and 'system' keys
    """
    logger = logging.getLogger(__name__)
    codes_with_display = []
    
    if valueset_id is None:
        valueset_id = extract_valueset_id(valueset_resource)
    
    # Check if resource has expansion
    if 'expansion' not in valueset_resource:
        logger.warning(f"ValueSet {valueset_id} has no expansion")
        return codes_with_display
    
    expansion = valueset_resource['expansion']
    
    # Check if expansion has contains
    if 'contains' not in expansion:
        logger.warning(f"ValueSet {valueset_id} expansion has no contains")
        return codes_with_display
    
    # Extract codes, displays, and systems from contains array
    for item in expansion['contains']:
        if 'code' in item:
            code_entry = {'code': item['code']}
            if 'display' in item and item['display'].strip():
                code_entry['display'] = item['display']
            else:
                # Fallback to code if no display is available or display is empty
                code_entry['display'] = item['code']
            
            # Include system URI if available
            if 'system' in item:
                code_entry['system'] = item['system']
            
            codes_with_display.append(code_entry)
    
    logger.info(f"Extracted {len(codes_with_display)} codes with displays and systems from ValueSet {valueset_id}")
    return codes_with_display


def generate_json_schema(valueset_resource: Dict[str, Any], codes_with_display: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Generate a JSON schema for a ValueSet using enum constraints with IRI-formatted values that match JSON-LD format.
    
    Args:
        valueset_resource: FHIR ValueSet resource
        codes_with_display: List of dictionaries with 'code', 'display', and optionally 'system' keys
        
    Returns:
        JSON schema dictionary
    """
    valueset_id = extract_valueset_id(valueset_resource)
    valueset_title = valueset_resource.get('title', valueset_resource.get('name', 'Unknown ValueSet'))
    valueset_url = valueset_resource.get('url', '')
    
    # Construct schema $id based on ValueSet canonical URL pattern
    if valueset_url:
        # Extract base URL from canonical URL
        # e.g., https://smart.who.int/base/ValueSet/DecisionTableActions -> https://smart.who.int/base
        if '/ValueSet/' in valueset_url:
            base_url = valueset_url.split('/ValueSet/')[0]
            schema_id = f"{base_url}/ValueSet-{valueset_id}.schema.json"
        else:
            # Fallback if URL doesn't follow expected pattern
            schema_id = f"{valueset_url}-{valueset_id}.schema.json"
    else:
        schema_id = f"#ValueSet-{valueset_id}-schema"
    
    # Use absolute URLs for file references
    if valueset_url and '/ValueSet/' in valueset_url:
        base_url = valueset_url.split('/ValueSet/')[0]
        display_reference = f"{base_url}/ValueSet-{valueset_id}.displays.json"
    else:
        display_reference = f"ValueSet-{valueset_id}.displays.json"
    
    # Generate IRI-formatted enum values that match JSON-LD format
    enum_values = []
    for item in codes_with_display:
        code = item['code']
        system = item.get('system', '')
        
        # Generate canonical IRI for the code using same logic as JSON-LD
        enum_iri = generate_canonical_iri(code, valueset_url, system)
        enum_values.append(enum_iri)
    
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": schema_id,
        "title": f"{valueset_title} Schema",
        "description": f"JSON Schema for {valueset_title} ValueSet codes. Generated from FHIR expansions using IRI format.",
        "type": "string",
        "enum": enum_values
    }
    
    # Add narrative that reflects the IRI format (system URIs are embedded, no separate system file needed)
    narrative_text = f"This schema validates IRI-formatted codes for the {valueset_title} ValueSet. "
    narrative_text += f"Each enum value includes the system URI in the format {{systemuri}}#{{code}} to match JSON-LD enumeration IRIs. "
    narrative_text += f"Display values are available at {display_reference}. "
    narrative_text += f"For a complete listing of all ValueSets, see artifacts.html#terminology-value-sets."
    schema["narrative"] = narrative_text
    
    # References to display file (no system file needed since system URIs are embedded in enum values)
    schema["fhir:displays"] = display_reference
    
    # Add metadata if available
    if valueset_url:
        schema["fhir:valueSet"] = valueset_url
    
    if 'version' in valueset_resource:
        schema["fhir:version"] = valueset_resource['version']
    
    if 'expansion' in valueset_resource and 'timestamp' in valueset_resource['expansion']:
        schema["fhir:expansionTimestamp"] = valueset_resource['expansion']['timestamp']
    
    return schema


def generate_display_file(valueset_resource: Dict[str, Any], codes_with_display: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Generate a display file for a ValueSet containing only display values for translation support.
    
    Args:
        valueset_resource: FHIR ValueSet resource
        codes_with_display: List of dictionaries with 'code', 'display', and optionally 'system' keys
        
    Returns:
        Display file dictionary
    """
    valueset_id = extract_valueset_id(valueset_resource)
    valueset_title = valueset_resource.get('title', valueset_resource.get('name', 'Unknown ValueSet'))
    valueset_url = valueset_resource.get('url', '')
    
    # Construct display file $id based on ValueSet canonical URL pattern
    if valueset_url:
        if '/ValueSet/' in valueset_url:
            base_url = valueset_url.split('/ValueSet/')[0]
            display_id = f"{base_url}/ValueSet-{valueset_id}.displays.json"
        else:
            display_id = f"{valueset_url}-{valueset_id}.displays.json"
    else:
        display_id = f"#ValueSet-{valueset_id}-displays"
    
    # Extract displays with multilingual structure support using IRI format to match schema enum values
    displays = {}
    
    for item in codes_with_display:
        code = item['code']
        display = item['display']
        system = item.get('system', '')
        
        # Generate canonical IRI for the code using same logic as JSON schema enum values
        code_iri = generate_canonical_iri(code, valueset_url, system)
        
        # Structure displays to support multiple languages
        # For now, use 'en' as the default language since FHIR expansions typically contain English text
        # This structure allows for easy addition of other languages later
        displays[code_iri] = {
            "en": display
        }
    
    display_file = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": display_id,
        "title": f"{valueset_title} Display Values",
        "description": f"Display values for {valueset_title} ValueSet codes. Generated from FHIR expansions.",
        "type": "object",
        "properties": {
            "fhir:displays": {
                "type": "object",
                "description": "Multilingual display values for ValueSet codes using IRI format to match JSON schema enum values",
                "patternProperties": {
                    "^https?://.*": {
                        "type": "object",
                        "description": "Display values for a specific IRI-formatted code by language",
                        "properties": {
                            "en": {
                                "type": "string",
                                "description": "English display value"
                            }
                        },
                        "patternProperties": {
                            "^[a-z]{2}(-[A-Z]{2})?$": {
                                "type": "string",
                                "description": "Display value in the specified language (ISO 639-1 code)"
                            }
                        },
                        "additionalProperties": False
                    }
                },
                "additionalProperties": False
            }
        },
        "required": ["fhir:displays"],
        "additionalProperties": True,
        "fhir:displays": displays
    }
    
    # Add metadata if available
    if valueset_url:
        display_file["fhir:valueSet"] = valueset_url
    
    if 'version' in valueset_resource:
        display_file["fhir:version"] = valueset_resource['version']
    
    if 'expansion' in valueset_resource and 'timestamp' in valueset_resource['expansion']:
        display_file["fhir:expansionTimestamp"] = valueset_resource['expansion']['timestamp']
    
    return display_file


def generate_system_file(valueset_resource: Dict[str, Any], codes_with_display: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Generate a system file for a ValueSet containing code to system URI mappings.
    
    Args:
        valueset_resource: FHIR ValueSet resource
        codes_with_display: List of dictionaries with 'code', 'display', and optionally 'system' keys
        
    Returns:
        System file dictionary
    """
    valueset_id = extract_valueset_id(valueset_resource)
    valueset_title = valueset_resource.get('title', valueset_resource.get('name', 'Unknown ValueSet'))
    valueset_url = valueset_resource.get('url', '')
    
    # Construct system file $id based on ValueSet canonical URL pattern
    if valueset_url:
        if '/ValueSet/' in valueset_url:
            base_url = valueset_url.split('/ValueSet/')[0]
            system_id = f"{base_url}/ValueSet-{valueset_id}.system.json"
        else:
            system_id = f"{valueset_url}-{valueset_id}.system.json"
    else:
        system_id = f"#ValueSet-{valueset_id}-system"
    
    # Extract system URIs mapping
    systems = {}
    
    for item in codes_with_display:
        code = item['code']
        system = item.get('system', '')
        
        if system:
            systems[code] = system
    
    system_file = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": system_id,
        "title": f"{valueset_title} System URIs",
        "description": f"System URI mappings for {valueset_title} ValueSet codes. Generated from FHIR expansions.",
        "type": "object",
        "properties": {
            "fhir:systems": {
                "type": "object",
                "description": "Mapping of ValueSet codes to their corresponding system URIs",
                "patternProperties": {
                    "^[a-zA-Z0-9._-]+$": {
                        "type": "string",
                        "format": "uri",
                        "description": "System URI for the corresponding code"
                    }
                },
                "additionalProperties": False
            }
        },
        "required": ["fhir:systems"],
        "additionalProperties": True,
        "fhir:systems": systems
    }
    
    # Add metadata if available
    if valueset_url:
        system_file["fhir:valueSet"] = valueset_url
    
    if 'version' in valueset_resource:
        system_file["fhir:version"] = valueset_resource['version']
    
    if 'expansion' in valueset_resource and 'timestamp' in valueset_resource['expansion']:
        system_file["fhir:expansionTimestamp"] = valueset_resource['expansion']['timestamp']
    
    return system_file


def generate_canonical_iri(code: str, valueset_url: str, system_uri: str = None) -> str:
    """
    Generate a canonical IRI for a code using a deterministic pattern.
    
    Args:
        code: The code value
        valueset_url: The ValueSet canonical URL
        system_uri: Optional system URI for the code
        
    Returns:
        Canonical IRI for the code
    """
    # If we have a system URI, use it as the base
    if system_uri:
        # Ensure system URI ends with # or / for fragment/path appending
        if not system_uri.endswith(('#', '/')):
            return f"{system_uri}#{code}"
        else:
            return f"{system_uri}{code}"
    
    # Fall back to using ValueSet URL as base
    if valueset_url:
        # Use the base URL from the ValueSet canonical URL
        if '/ValueSet/' in valueset_url:
            base_url = valueset_url.split('/ValueSet/')[0]
            valueset_id = valueset_url.split('/ValueSet/')[-1]
            return f"{base_url}/ValueSet-{valueset_id}.jsonld#{code}"
        else:
            # Fallback pattern
            return f"{valueset_url}#{code}"
    
    # Final fallback
    return f"http://example.com/codes#{code}"


def generate_jsonld_vocabulary(valueset_resource: Dict[str, Any], codes_with_display: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Generate a JSON-LD vocabulary for a ValueSet that defines an Enumeration class,
    declares each code as a member of that Enumeration, and creates a property
    whose allowed range is that Enumeration.
    
    Args:
        valueset_resource: FHIR ValueSet resource
        codes_with_display: List of dictionaries with 'code', 'display', and optionally 'system' keys
        
    Returns:
        JSON-LD vocabulary dictionary
    """
    valueset_id = extract_valueset_id(valueset_resource)
    valueset_title = valueset_resource.get('title', valueset_resource.get('name', 'Unknown ValueSet'))
    valueset_description = valueset_resource.get('description', f"Allowed values for the {valueset_title} enumeration.")
    valueset_url = valueset_resource.get('url', '')
    valueset_version = valueset_resource.get('version', '')
    valueset_date = None
    valueset_publisher = valueset_resource.get('publisher', 'World Health Organization')
    
    # Extract date from expansion timestamp if available
    if 'expansion' in valueset_resource and 'timestamp' in valueset_resource['expansion']:
        valueset_date = valueset_resource['expansion']['timestamp']
    elif 'date' in valueset_resource:
        valueset_date = valueset_resource['date']
    
    # Determine JSON-LD file URL and vocabulary base IRI
    if valueset_url:
        if '/ValueSet/' in valueset_url:
            base_url = valueset_url.split('/ValueSet/')[0]
            # JSON-LD file URL follows the pattern: base_url/ValueSet-{id}.jsonld
            jsonld_file_url = f"{base_url}/ValueSet-{valueset_id}.jsonld"
        else:
            # Fallback for non-standard URLs
            jsonld_file_url = f"{valueset_url}/ValueSet-{valueset_id}.jsonld"
    else:
        jsonld_file_url = f"https://smart.who.int/base/ValueSet-{valueset_id}.jsonld"
    
    # Create enumeration class IRI - use the JSON-LD file URL as the base
    enumeration_class_iri = jsonld_file_url
    # Property IRI - use proper base URI structure
    property_iri = f"https://smart.who.int/base/vocab#{valueset_id.lower()}"
    
    # JSON-LD context - all terms properly defined without @vocab
    context = {
        "@version": 1.1,
        "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
        "schema": "https://schema.org/",
        "fhir": "http://hl7.org/fhir/",
        "prov": "http://www.w3.org/ns/prov#",
        "xsd": "http://www.w3.org/2001/XMLSchema#",
        "id": "@id",
        "type": "@type",
        "name": "rdfs:label",
        "comment": "rdfs:comment",
        "version": "schema:version",
        "date": "schema:dateCreated",
        "publisher": "schema:publisher",
        "generatedAt": {
            "@id": "prov:generatedAtTime",
            "@type": "xsd:dateTime"
        },
        "fhir:code": "http://hl7.org/fhir/code",
        "fhir:system": "http://hl7.org/fhir/system",
        "fhir:valueSet": "http://hl7.org/fhir/valueSet",
        # Define concise terms for common types
        "Enumeration": "schema:Enumeration",
        "Property": "rdf:Property", 
        "Entity": "prov:Entity"
    }
    
    # Start building the @graph - only codes, no enumeration class
    graph = []
    
    # Only include code instances, no enumeration class definition
    for item in codes_with_display:
        code = item['code']
        display = item['display']
        system = item.get('system', '')
        
        # Generate IRI for the code using ValueSet.jsonld pattern
        if system:
            # Extract base URL to construct ValueSet-based IRI
            if valueset_url and '/ValueSet/' in valueset_url:
                base_url = valueset_url.split('/ValueSet/')[0]
                code_iri = f"{base_url}/ValueSet-{valueset_id}.jsonld#{code}"
            else:
                # Fallback if valueset_url doesn't follow expected pattern
                code_iri = f"https://smart.who.int/base/ValueSet-{valueset_id}.jsonld#{code}"
        else:
            # Fallback if no system available
            code_iri = f"https://smart.who.int/base/ValueSet-{valueset_id}.jsonld#{code}"
        
        code_instance = {
            "id": code_iri,
            "name": display,
            "fhir:code": code
        }
        
        # Add system information if available
        if system:
            code_instance["fhir:CodeSystem"] = transform_codesystem_url(system)
        
        graph.append(code_instance)
    
    # Create the complete JSON-LD document with named graph
    jsonld_vocab = {
        "@context": context,
        "@id": jsonld_file_url,
        "@type": "http://www.w3.org/ns/prov#Entity",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "@graph": graph
    }
    
    return jsonld_vocab


def save_schema(schema: Dict[str, Any], output_dir: str, valueset_id: str) -> Optional[str]:
    """
    Save a JSON schema to a file.
    
    Args:
        schema: JSON schema dictionary
        output_dir: Directory to save schema files
        valueset_id: ValueSet ID for filename
        
    Returns:
        Filepath if saved successfully, None otherwise
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Create filename with ValueSet- prefix
        filename = f"ValueSet-{valueset_id}.schema.json"
        filepath = os.path.join(output_dir, filename)
        
        # Save schema
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(schema, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved schema for ValueSet {valueset_id} to {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error saving schema for ValueSet {valueset_id}: {e}")
        return None


def save_display_file(display_file: Dict[str, Any], output_dir: str, valueset_id: str) -> Optional[str]:
    """
    Save a display file to a file.
    
    Args:
        display_file: Display file dictionary
        output_dir: Directory to save display files
        valueset_id: ValueSet ID for filename
        
    Returns:
        Filepath if saved successfully, None otherwise
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Create filename with ValueSet- prefix
        filename = f"ValueSet-{valueset_id}.displays.json"
        filepath = os.path.join(output_dir, filename)
        
        # Save display file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(display_file, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved display file for ValueSet {valueset_id} to {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error saving display file for ValueSet {valueset_id}: {e}")
        return None


def save_system_file(system_file: Dict[str, Any], output_dir: str, valueset_id: str) -> Optional[str]:
    """
    Save a system file to a file.
    
    Args:
        system_file: System file dictionary
        output_dir: Directory to save system files
        valueset_id: ValueSet ID for filename
        
    Returns:
        Filepath if saved successfully, None otherwise
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Create filename with ValueSet- prefix
        filename = f"ValueSet-{valueset_id}.system.json"
        filepath = os.path.join(output_dir, filename)
        
        # Save system file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(system_file, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved system file for ValueSet {valueset_id} to {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error saving system file for ValueSet {valueset_id}: {e}")
        return None


def save_jsonld_vocabulary(jsonld_vocab: Dict[str, Any], output_dir: str, valueset_id: str) -> Optional[str]:
    """
    Save a JSON-LD vocabulary file.
    
    Args:
        jsonld_vocab: JSON-LD vocabulary dictionary
        output_dir: Directory to save JSON-LD files
        valueset_id: ValueSet ID for filename
        
    Returns:
        Filepath if saved successfully, None otherwise
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Create filename with ValueSet- prefix and .jsonld extension
        filename = f"ValueSet-{valueset_id}.jsonld"
        filepath = os.path.join(output_dir, filename)
        
        # Save JSON-LD vocabulary
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(jsonld_vocab, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved JSON-LD vocabulary for ValueSet {valueset_id} to {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error saving JSON-LD vocabulary for ValueSet {valueset_id}: {e}")
        return None


def generate_index_html(schema_files: List[str], output_dir: str) -> bool:
    """
    Generate an index.html file listing all generated schemas.
    
    Args:
        schema_files: List of schema file paths
        output_dir: Directory where schemas are saved
        
    Returns:
        True if index generated successfully, False otherwise
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        index_path = os.path.join(output_dir, "index.html")
        
        # Generate HTML content
        html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FHIR ValueSet JSON Schemas</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        ul { list-style-type: none; padding: 0; }
        li { margin: 10px 0; }
        a { text-decoration: none; color: #0066cc; }
        a:hover { text-decoration: underline; }
        .schema-link { display: block; padding: 8px; background: #f5f5f5; border-radius: 4px; }
        .generated-info { color: #666; font-size: 0.9em; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>FHIR ValueSet JSON Schemas</h1>
    <p>This page contains links to all generated JSON schemas for FHIR ValueSets.</p>
    
    <ul>
"""
        
        # Add links for each schema file
        for file_path in sorted(schema_files):
            filename = os.path.basename(file_path)
            # Schema files are now in the same directory as index.html
            valueset_name = filename.replace('.schema.json', '')
            
            html_content += f'        <li><a href="{filename}" class="schema-link">{valueset_name}.schema.json</a></li>\n'
        
        html_content += """    </ul>
    
    <div class="generated-info">
        <p><em>Generated automatically by the FHIR ValueSet JSON Schema Generator</em></p>
    </div>
</body>
</html>"""
        
        # Save index file
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        logger.info(f"Generated index.html with {len(schema_files)} schema links at {index_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error generating index.html: {e}")
        return False


def process_expansions(expansions_data: Dict[str, Any], output_dir: str) -> int:
    """
    Process the expansions data and generate schemas for all ValueSets.
    
    Args:
        expansions_data: Parsed expansions.json data
        output_dir: Directory to save schema files
        
    Returns:
        Number of schemas successfully generated
    """
    logger = logging.getLogger(__name__)
    
    # Check if it's a Bundle
    if expansions_data.get('resourceType') != 'Bundle':
        logger.error("Expansions data is not a FHIR Bundle")
        return 0
    
    # Check if Bundle has entries
    if 'entry' not in expansions_data:
        logger.warning("Bundle has no entries")
        return 0
    
    schemas_generated = 0
    schema_files = []
    
    # Process each entry
    for entry in expansions_data['entry']:
        if 'resource' not in entry:
            logger.warning("Bundle entry has no resource")
            continue
            
        resource = entry['resource']
        
        # Check if it's a ValueSet
        if resource.get('resourceType') != 'ValueSet':
            logger.debug(f"Skipping non-ValueSet resource: {resource.get('resourceType')}")
            continue
        
        valueset_id = extract_valueset_id_from_entry(entry)
        logger.info(f"Processing ValueSet: {valueset_id}")
        
        # Extract codes with displays from expansion
        codes_with_display = extract_valueset_codes_with_display(resource, valueset_id)
        
        if not codes_with_display:
            logger.warning(f"No codes found for ValueSet {valueset_id}, skipping schema generation")
            continue
        
        # Generate schema
        schema = generate_json_schema(resource, codes_with_display)
        
        # Generate display file
        display_file = generate_display_file(resource, codes_with_display)
        
        # System file no longer needed - system URIs are embedded in schema enum values
        # to match JSON-LD IRI format as requested
        # system_file = generate_system_file(resource, codes_with_display)
        
        # Generate JSON-LD vocabulary (skipped - now handled by separate script)
        # jsonld_vocab = generate_jsonld_vocabulary(resource, codes_with_display)
        
        # Save schema
        schema_path = save_schema(schema, output_dir, valueset_id)
        if schema_path:
            schema_files.append(schema_path)
        
        # Save display file
        display_path = save_display_file(display_file, output_dir, valueset_id)
        
        # System file no longer generated - system URIs are embedded in schema enum values
        # system_path = save_system_file(system_file, output_dir, valueset_id)
        
        # Save JSON-LD vocabulary (skipped - now handled by separate script)
        # jsonld_path = save_jsonld_vocabulary(jsonld_vocab, output_dir, valueset_id)
        
        # Count as successful if schema and display files are saved
        if schema_path and display_path:
            schemas_generated += 1
    

    
    logger.info(f"Generated {schemas_generated} ValueSet schemas")
    return schemas_generated


def main():
    """Main entry point for the script."""
    logger = setup_logging()
    logger.info("Starting 03_generate_valueset_schemas.py")

    qa_reporter = QAReporter("valueset_schemas")
    qa_reporter.add_success("Starting ValueSet schema generation")

    # Parse command line arguments
    # When run from template: first arg is ig_root directory
    # When run standalone: first arg is expansions_path, second is output_dir
    if len(sys.argv) < 2:
        # Default paths (current directory)
        ig_root = Path(".")
        expansions_path = ig_root / "output" / "expansions.json"
        output_dir = ig_root / "output"
    elif len(sys.argv) == 2:
        # Single argument: treat as ig_root (template execution mode)
        ig_root = Path(sys.argv[1])
        expansions_path = ig_root / "output" / "expansions.json"
        output_dir = ig_root / "output"
    else:
        # Two arguments: treat as expansions_path and output_dir (standalone mode)
        expansions_path = Path(sys.argv[1])
        output_dir = Path(sys.argv[2])

    # Convert to strings for compatibility with existing code
    expansions_path = str(expansions_path)
    output_dir = str(output_dir)

    logger.info(f"Processing expansions from: {expansions_path}")
    logger.info(f"Output directory: {output_dir}")
    logger.info(f"DEBUG: sys.argv = {sys.argv}")
    logger.info(f"DEBUG: Current working directory = {os.getcwd()}")
    logger.info(f"DEBUG: expansions_path exists = {os.path.exists(expansions_path)}")
    logger.info(f"DEBUG: output_dir exists = {os.path.exists(output_dir)}")
    if os.path.exists(output_dir):
        output_files = os.listdir(output_dir)
        logger.info(f"DEBUG: output_dir has {len(output_files)} files")
        json_files = [f for f in output_files if f.endswith('.json')]
        logger.info(f"DEBUG: JSON files in output: {json_files[:10]}...")  # First 10
    qa_reporter.add_success(f"Configured paths - Expansions: {expansions_path}, Output: {output_dir}")
    
    # Load expansions.json
    qa_reporter.add_file_expected(expansions_path)
    expansions_data = load_expansions_json(expansions_path)
    if not expansions_data:
        logger.error("Failed to load expansions data")
        logger.error(f"DEBUG: File exists check again: {os.path.exists(expansions_path)}")
        if os.path.exists(expansions_path):
            with open(expansions_path, 'r') as f:
                content = f.read()
            logger.error(f"DEBUG: File size: {len(content)} bytes")
            logger.error(f"DEBUG: First 200 chars: {content[:200]}")
        qa_reporter.add_error(f"Failed to load expansions data from {expansions_path}")
        qa_reporter.add_file_processed(expansions_path, "failed_to_load")
    else:
        logger.info(f"DEBUG: expansions_data resourceType = {expansions_data.get('resourceType')}")
        logger.info(f"DEBUG: expansions_data has 'entry' = {'entry' in expansions_data}")
        if 'entry' in expansions_data:
            logger.info(f"DEBUG: Number of entries = {len(expansions_data['entry'])}")
            # Count ValueSets
            valueset_count = sum(1 for e in expansions_data['entry'] if e.get('resource', {}).get('resourceType') == 'ValueSet')
            logger.info(f"DEBUG: Number of ValueSet entries = {valueset_count}")
        qa_reporter.add_success(f"Successfully loaded expansions data from {expansions_path}")
        qa_reporter.add_file_processed(expansions_path, "loaded")
    
    # Process expansions and generate schemas (continue even if expansions_data is None)
    try:
        if expansions_data:
            schemas_count = process_expansions(expansions_data, output_dir)
        else:
            schemas_count = 0
            qa_reporter.add_warning("No expansions data available - no schemas will be generated")
        
        if schemas_count > 0:
            logger.info(f"Successfully generated {schemas_count} ValueSet schemas in {output_dir}")
            qa_reporter.add_success(f"Successfully generated {schemas_count} ValueSet schemas")
        else:
            logger.info("No ValueSet schemas were generated (no ValueSets found in expansions)")
            qa_reporter.add_warning("No ValueSet schemas were generated - no ValueSets found in expansions")
    except Exception as e:
        logger.error(f"Error during schema generation: {e}")
        qa_reporter.add_error(f"Error during schema generation: {e}")
        schemas_count = 0
    
    # Finalize QA report
    qa_status = "completed" if schemas_count > 0 else "completed_with_warnings"
    if len(qa_reporter.report["details"]["errors"]) > 0:
        qa_status = "completed_with_errors"
    
    qa_report = qa_reporter.finalize_report(qa_status)
    
    # Save QA report as a component report that can be merged by the main script
    # Save to protected location to avoid IG publisher overwriting
    protected_qa_path = "input/temp/qa_valueset_schemas.json"
    if qa_reporter.save_to_file(protected_qa_path):
        logger.info(f"ValueSet schema generation QA report saved to {protected_qa_path}")
    else:
        logger.warning("Failed to save ValueSet schema generation QA report to protected location")
    
    # Also save to /tmp for backward compatibility
    temp_qa_path = "/tmp/qa_valueset_schemas.json"
    qa_reporter.save_to_file(temp_qa_path)
    
    # Log QA summary
    logger.info("=== VALUESET SCHEMA GENERATION QA SUMMARY ===")
    logger.info(f"Successes: {qa_report['summary']['total_successes']}")
    logger.info(f"Warnings: {qa_report['summary']['total_warnings']}")
    logger.info(f"Errors: {qa_report['summary']['total_errors']}")
    logger.info(f"Schemas generated: {qa_report['summary']['schemas_generated_count']}")
    
    # Always exit with success code - errors are captured in QA report
    if qa_report['summary']['total_errors'] == 0:
        logger.info("✅ ValueSet schema generation completed successfully")
    else:
        logger.warning("⚠️ ValueSet schema generation completed with errors - see QA report for details")

    # DEBUG: Add orange ribbon to dak-api.html to confirm script execution
    dak_api_path = os.path.join(output_dir, "dak-api.html")
    logger.info(f"DEBUG: Attempting to add orange ribbon to {dak_api_path}")
    if os.path.exists(dak_api_path):
        try:
            with open(dak_api_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Gather debug info for ribbon
            expansions_exists = os.path.exists(expansions_path)
            expansions_size = os.path.getsize(expansions_path) if expansions_exists else 0
            cwd = os.getcwd()

            orange_ribbon = '''
<div style="background-color: #FFA500; color: black; padding: 15px; margin: 10px 0; border: 3px solid #FF8C00; font-weight: bold;">
    🟠 ORANGE RIBBON: 03_generate_valueset_schemas.py executed!<br>
    <b>Generated:</b> {schemas_count} ValueSet schemas<br>
    <b>expansions.json found:</b> {expansions_exists}<br>
    <b>expansions.json path:</b> {expansions_path}<br>
    <b>expansions.json size:</b> {expansions_size} bytes<br>
    <b>Working directory:</b> {cwd}<br>
    <b>ig_root arg:</b> {ig_root}
</div>
'''.format(
                schemas_count=schemas_count,
                expansions_exists=expansions_exists,
                expansions_path=expansions_path,
                expansions_size=expansions_size,
                cwd=cwd,
                ig_root=str(ig_root)
            )

            # Try to inject after <body> tag
            if '<body' in content:
                # Find end of body tag
                body_end = content.find('>', content.find('<body'))
                if body_end != -1:
                    content = content[:body_end+1] + orange_ribbon + content[body_end+1:]
                    with open(dak_api_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    logger.info("DEBUG: Successfully added orange ribbon to dak-api.html")
                else:
                    logger.warning("DEBUG: Could not find body tag end in dak-api.html")
            else:
                logger.warning("DEBUG: No body tag found in dak-api.html")
        except Exception as e:
            logger.error(f"DEBUG: Failed to add orange ribbon: {e}")
    else:
        logger.warning(f"DEBUG: dak-api.html not found at {dak_api_path}")

    logger.info("Exiting with success code 0 - check QA report for detailed status")
    sys.exit(0)


if __name__ == "__main__":
    main()