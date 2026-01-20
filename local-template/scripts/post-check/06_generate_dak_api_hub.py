#!/usr/bin/env python3
"""
DAK API Documentation Hub Generator

This script post-processes the IG-generated HTML files to inject DAK API content.
It works by:
1. Detecting existing JSON schemas (ValueSet and Logical Model schemas)
2. Creating minimal OpenAPI 3.0 wrappers for each JSON schema
3. Generating schema documentation content
4. Post-processing the dak-api.html file to replace content at the placeholder div (id="dak-api-content-placeholder")
5. Creating individual schema documentation pages using dak-api.html as template

The script is designed to work with a single IG publisher run, post-processing
the generated HTML files instead of creating markdown that requires a second run.

Usage:
    python generate_dak_api_hub.py [output_dir] [openapi_dir]

Author: SMART Guidelines Team
"""

import json
import os
import sys
import logging
import re
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime


def setup_logging() -> logging.Logger:
    """Configure logging for the script."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


class QAReporter:
    """Handles QA reporting for post-processing steps and merging with FHIR IG publisher QA."""
    
    def __init__(self, phase: str = "postprocessing"):
        self.phase = phase
        self.timestamp = datetime.now().isoformat()
        self.report = {
            "phase": phase,
            "timestamp": self.timestamp,
            "status": "running",
            "summary": {},
            "details": {
                "successes": [],
                "warnings": [],
                "errors": [],
                "files_processed": [],
                "files_expected": [],
                "files_missing": []
            }
        }
        # Store existing IG publisher QA data if present
        self.ig_publisher_qa = None
    
    def load_existing_ig_qa(self, qa_file_path: str):
        """Load existing FHIR IG publisher QA file to preserve its structure."""
        try:
            if os.path.exists(qa_file_path):
                with open(qa_file_path, 'r', encoding='utf-8') as f:
                    self.ig_publisher_qa = json.load(f)
                print(f"Loaded existing IG publisher QA file: {qa_file_path}")
                return True
            else:
                print(f"No existing IG publisher QA file found at: {qa_file_path}")
                return False
        except Exception as e:
            print(f"Error loading existing IG publisher QA file: {e}")
            return False
    
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
    
    def finalize_report(self, status: str = "completed"):
        """Finalize the QA report with summary statistics and merge with IG publisher QA if available."""
        self.report["status"] = status
        self.report["summary"] = {
            "total_successes": len(self.report["details"]["successes"]),
            "total_warnings": len(self.report["details"]["warnings"]),
            "total_errors": len(self.report["details"]["errors"]),
            "files_processed_count": len(self.report["details"]["files_processed"]),
            "files_expected_count": len(self.report["details"]["files_expected"]),
            "files_missing_count": len(self.report["details"]["files_missing"]),
            "completion_timestamp": datetime.now().isoformat()
        }
        
        # If we have IG publisher QA data, merge it with our report
        if self.ig_publisher_qa:
            return self.merge_with_ig_publisher_qa()
        
        return self.report
    
    def merge_with_ig_publisher_qa(self):
        """Merge our QA report with the existing FHIR IG publisher QA structure."""
        try:
            # Create a merged report that preserves the IG publisher structure
            merged_report = dict(self.ig_publisher_qa)
            
            # Add our component reports as a new section
            if "dak_api_processing" not in merged_report:
                merged_report["dak_api_processing"] = {}
            
            # Include any stored preprocessing reports
            preprocessing_reports = {}
            if hasattr(self, '_stored_preprocessing_reports'):
                for i, report in enumerate(self._stored_preprocessing_reports):
                    component_name = report.get("component", report.get("phase", f"component_{i}"))
                    preprocessing_reports[component_name] = report
            
            # Add our preprocessing and postprocessing reports
            merged_report["dak_api_processing"] = {
                "preprocessing_reports": preprocessing_reports,
                "postprocessing": self.report,
                "summary": {
                    "total_dak_api_successes": self.report["summary"]["total_successes"],
                    "total_dak_api_warnings": self.report["summary"]["total_warnings"], 
                    "total_dak_api_errors": self.report["summary"]["total_errors"],
                    "dak_api_completion_timestamp": self.report["summary"]["completion_timestamp"]
                }
            }
            
            return merged_report
            
        except Exception as e:
            print(f"Error merging with IG publisher QA: {e}")
            # Fall back to our report only
            return self.report
    
    def merge_preprocessing_report(self, preprocessing_report: Dict):
        """Merge a preprocessing report into this post-processing report."""
        if "details" in preprocessing_report:
            # Add preprocessing entries with a prefix
            component_name = preprocessing_report.get("component", preprocessing_report.get("phase", "Unknown"))
            
            for success in preprocessing_report["details"].get("successes", []):
                self.add_success(f"[{component_name}] {success['message']}", success.get("details"))
            
            for warning in preprocessing_report["details"].get("warnings", []):
                self.add_warning(f"[{component_name}] {warning['message']}", warning.get("details"))
            
            for error in preprocessing_report["details"].get("errors", []):
                self.add_error(f"[{component_name}] {error['message']}", error.get("details"))
            
            for file_proc in preprocessing_report["details"].get("files_processed", []):
                self.add_file_processed(f"[{component_name}] {file_proc['file']}", file_proc.get("status", "unknown"), file_proc.get("details"))
            
            # Merge schemas_generated if available (for component reports)
            for schema in preprocessing_report["details"].get("schemas_generated", []):
                schema_with_component = dict(schema)
                schema_with_component["component"] = component_name
                self.add_success(f"[{component_name}] Generated schema", schema_with_component)
        
        # Store preprocessing report in the final merged structure
        if self.ig_publisher_qa and "dak_api_processing" in self.ig_publisher_qa:
            self.ig_publisher_qa["dak_api_processing"]["preprocessing"] = preprocessing_report
        else:
            # Store for later merging
            if not hasattr(self, '_stored_preprocessing_reports'):
                self._stored_preprocessing_reports = []
            self._stored_preprocessing_reports.append(preprocessing_report)
    
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


class SchemaDetector:
    """Detects and categorizes schema files in the output directory."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def find_schema_files(self, output_dir: str) -> Dict[str, List[str]]:
        """
        Find all schema files in the output directory.
        
        Returns:
            Dictionary with categories 'valueset' and 'logical_model' 
            containing lists of schema file paths
        """
        schemas = {
            'valueset': [],
            'logical_model': [],
            'other': []
        }
        
        if not os.path.exists(output_dir):
            self.logger.warning(f"Output directory does not exist: {output_dir}")
            return schemas
        
        self.logger.info(f"Scanning directory for schema files: {output_dir}")
        all_files = os.listdir(output_dir)
        schema_count = 0
        
        for file in all_files:
            if file.endswith('.schema.json'):
                schema_count += 1
                file_path = os.path.join(output_dir, file)
                self.logger.info(f"Found schema file: {file}")
                
                if file.startswith('ValueSet-'):
                    schemas['valueset'].append(file_path)
                    self.logger.info(f"  -> Categorized as ValueSet schema")
                elif file in ['ValueSets.schema.json', 'LogicalModels.schema.json']:
                    # These are enumeration schemas, categorize appropriately
                    if file == 'ValueSets.schema.json':
                        schemas['valueset'].append(file_path) 
                        self.logger.info(f"  -> Categorized as ValueSet enumeration schema")
                    else:
                        schemas['logical_model'].append(file_path)
                        self.logger.info(f"  -> Categorized as Logical Model enumeration schema")
                elif not file.startswith('ValueSet-') and not file.startswith('CodeSystem-'):
                    # Assume logical model if not ValueSet or CodeSystem
                    schemas['logical_model'].append(file_path)
                    self.logger.info(f"  -> Categorized as Logical Model schema")
                else:
                    schemas['other'].append(file_path)
                    self.logger.info(f"  -> Categorized as other schema")
        
        self.logger.info(f"Schema detection summary:")
        self.logger.info(f"  Total schema files found: {schema_count}")
        self.logger.info(f"  ValueSet schemas: {len(schemas['valueset'])}")
        self.logger.info(f"  Logical Model schemas: {len(schemas['logical_model'])}")
        self.logger.info(f"  Other schemas: {len(schemas['other'])}")
        
        if schema_count == 0:
            self.logger.warning(f"No .schema.json files found in {output_dir}")
            self.logger.info(f"Directory contents: {', '.join(all_files)}")
        
        return schemas
    
    def find_jsonld_files(self, output_dir: str) -> List[str]:
        """
        Find all JSON-LD vocabulary files in the output directory.
        
        Returns:
            List of JSON-LD file paths
        """
        jsonld_files = []
        
        if not os.path.exists(output_dir):
            self.logger.warning(f"Output directory does not exist: {output_dir}")
            return jsonld_files
        
        self.logger.info(f"Scanning directory for JSON-LD files: {output_dir}")
        all_files = os.listdir(output_dir)
        jsonld_count = 0
        
        for file in all_files:
            if file.endswith('.jsonld'):
                jsonld_count += 1
                file_path = os.path.join(output_dir, file)
                self.logger.info(f"Found JSON-LD file: {file}")
                
                if file.startswith('ValueSet-'):
                    jsonld_files.append(file_path)
                    self.logger.info(f"  -> Added ValueSet JSON-LD vocabulary")
                else:
                    self.logger.info(f"  -> Skipped non-ValueSet JSON-LD file")
        
        self.logger.info(f"JSON-LD detection summary:")
        self.logger.info(f"  Total JSON-LD files found: {jsonld_count}")
        self.logger.info(f"  ValueSet JSON-LD vocabularies: {len(jsonld_files)}")
        
        if jsonld_count == 0:
            self.logger.info(f"No .jsonld files found in {output_dir}")
        
        return jsonld_files


class OpenAPIDetector:
    """Detects existing OpenAPI/Swagger files."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def find_openapi_files(self, openapi_dir: str) -> List[str]:
        """Find OpenAPI/Swagger files in the given directory, including generated .openapi.json files."""
        openapi_files = []
        
        if not os.path.exists(openapi_dir):
            self.logger.info(f"OpenAPI directory does not exist: {openapi_dir}")
            return openapi_files
        
        self.logger.info(f"Scanning for OpenAPI files in: {openapi_dir}")
        
        for root, dirs, files in os.walk(openapi_dir):
            for file in files:
                # Include OpenAPI/Swagger files with more lenient matching for existing files
                # Exclude index.html as it's handled separately for content extraction
                if (file.endswith(('.json', '.yaml', '.yml')) and 
                    file.lower() != 'index.html' and
                    ('openapi' in file.lower() or 'swagger' in file.lower() or 
                     'api' in file.lower() or  # More lenient for existing API files
                     file.endswith('.openapi.json') or file.endswith('.openapi.yaml'))):
                    full_path = os.path.join(root, file)
                    openapi_files.append(full_path)
                    self.logger.info(f"Found OpenAPI file: {file}")
        
        self.logger.info(f"Found {len(openapi_files)} OpenAPI/Swagger files total")
        return openapi_files
    
    def find_existing_html_content(self, openapi_dir: str) -> Optional[str]:
        """Find and extract content from existing index.html in OpenAPI directory."""
        index_html_path = os.path.join(openapi_dir, "index.html")
        
        if not os.path.exists(index_html_path):
            self.logger.info(f"No existing index.html found in: {openapi_dir}")
            return None
        
        try:
            from bs4 import BeautifulSoup
            
            self.logger.info(f"Found existing OpenAPI HTML content at: {index_html_path}")
            with open(index_html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Parse the HTML using BeautifulSoup
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract the body content
            body = soup.find('body')
            if not body:
                self.logger.warning("No <body> tag found in existing index.html")
                return None
            
            # Remove script tags and other non-content elements
            for script in body.find_all(['script', 'noscript']):
                script.decompose()
            
            # Look for the main content container
            # Try common container patterns
            content_container = (
                body.find('div', class_=lambda x: x and 'container' in x.lower()) or
                body.find('div', class_=lambda x: x and 'content' in x.lower()) or
                body.find('main') or
                body.find('div', id=lambda x: x and 'content' in x.lower()) or
                body
            )
            
            if content_container:
                # Get the inner HTML content
                extracted_content = str(content_container)
                
                # If we got the whole body, remove the body tags
                if content_container == body:
                    # Remove body tag but keep its content
                    extracted_content = extracted_content.replace('<body>', '').replace('</body>', '')
                    # Clean up any attributes from body tag
                    if extracted_content.startswith('<body '):
                        end_tag = extracted_content.find('>')
                        if end_tag != -1:
                            extracted_content = extracted_content[end_tag + 1:]
                
                self.logger.info(f"Extracted {len(extracted_content)} characters of HTML content from existing index.html")
                return extracted_content.strip()
            else:
                self.logger.warning("Could not find suitable content container in existing index.html")
                return None
                
        except ImportError:
            self.logger.error("BeautifulSoup not available. Please install beautifulsoup4: pip install beautifulsoup4")
            return None
        except Exception as e:
            self.logger.error(f"Error parsing existing HTML content: {e}")
            return None



class OpenAPIWrapper:
    """Creates OpenAPI 3.0 wrappers for JSON schemas."""
    
    def __init__(self, logger: logging.Logger, canonical_base: str = "http://smart.who.int/base"):
        self.logger = logger
        self.canonical_base = canonical_base
    
    def create_wrapper_for_schema(self, schema_path: str, schema_type: str, output_dir: str) -> Optional[str]:
        """
        Create an OpenAPI 3.0 wrapper for a JSON schema.
        
        Args:
            schema_path: Path to the JSON schema file
            schema_type: Type of schema ('valueset' or 'logical_model')
            output_dir: Directory to save the OpenAPI wrapper
            
        Returns:
            Path to the generated OpenAPI wrapper file, or None if failed
        """
        try:
            # Load the schema
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            schema_filename = os.path.basename(schema_path)
            schema_name = schema_filename.replace('.schema.json', '')
            
            # Determine the endpoint path and description
            if schema_type == 'valueset':
                endpoint_path = f"/{schema_filename}"
                summary = f"JSON Schema definition for the enumeration {schema_name}"
                description = f"This endpoint serves the JSON Schema definition for the enumeration {schema_name}."
                media_type = "application/schema+json"
            else:  # logical_model
                endpoint_path = f"/{schema_filename}"
                summary = f"JSON Schema definition for the Logical Model {schema_name}"
                description = f"This endpoint serves the JSON Schema definition for the Logical Model {schema_name}."
                media_type = "application/schema+json"
            
            # Create OpenAPI wrapper
            openapi_spec = {
                "openapi": "3.0.3",
                "info": {
                    "title": f"{schema.get('title', schema_name)} API",
                    "description": schema.get('description', f"API for {schema_name} schema"),
                    "version": "1.0.0"
                },
                "paths": {
                    endpoint_path: {
                        "get": {
                            "summary": summary,
                            "description": description,
                            "responses": {
                                "200": {
                                    "description": f"The JSON Schema for {schema_name}",
                                    "content": {
                                        media_type: {
                                            "schema": {
                                                "$ref": f"./{schema_filename}"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "components": {
                    "schemas": {
                        schema_name: schema
                    }
                }
            }
            
            # Save OpenAPI wrapper
            wrapper_filename = f"{schema_name}.openapi.json"
            wrapper_path = os.path.join(output_dir, wrapper_filename)
            
            with open(wrapper_path, 'w', encoding='utf-8') as f:
                json.dump(openapi_spec, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Created OpenAPI wrapper: {wrapper_path}")
            return wrapper_path
            
        except Exception as e:
            self.logger.error(f"Error creating OpenAPI wrapper for {schema_path}: {e}")
            return None
    
    def create_enumeration_wrapper(self, enum_schema_path: str, schema_type: str, output_dir: str) -> Optional[str]:
        """
        Create an OpenAPI 3.0 wrapper for an enumeration schema.
        
        Args:
            enum_schema_path: Path to the enumeration schema file
            schema_type: Type of schema ('valueset' or 'logical_model')
            output_dir: Directory to save the OpenAPI wrapper
            
        Returns:
            Path to the generated OpenAPI wrapper file, or None if failed
        """
        try:
            # Load the enumeration schema
            with open(enum_schema_path, 'r', encoding='utf-8') as f:
                enum_schema = json.load(f)
            
            enum_filename = os.path.basename(enum_schema_path)
            
            # Determine the endpoint details
            if schema_type == 'valueset':
                endpoint_path = "/ValueSets.schema.json"
                api_title = "ValueSets Enumeration API"
                api_description = "API endpoint providing an enumeration of all available ValueSet schemas"
                summary = "Get enumeration of all ValueSet schemas"
                description = "Returns a list of all available ValueSet schemas with metadata"
            else:  # logical_model
                endpoint_path = "/LogicalModels.schema.json"
                api_title = "LogicalModels Enumeration API"
                api_description = "API endpoint providing an enumeration of all available Logical Model schemas"
                summary = "Get enumeration of all Logical Model schemas"
                description = "Returns a list of all available Logical Model schemas with metadata"
            
            # Create OpenAPI wrapper for the enumeration
            openapi_spec = {
                "openapi": "3.0.3",
                "info": {
                    "title": api_title,
                    "description": api_description,
                    "version": "1.0.0"
                },
                "paths": {
                    endpoint_path: {
                        "get": {
                            "summary": summary,
                            "description": description,
                            "responses": {
                                "200": {
                                    "description": f"Successfully retrieved {schema_type} enumeration",
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": f"#/components/schemas/EnumerationResponse"
                                            },
                                            "example": enum_schema.get('example', {})
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "components": {
                    "schemas": {
                        "EnumerationResponse": enum_schema
                    }
                }
            }
            
            # Save OpenAPI wrapper
            if schema_type == 'valueset':
                wrapper_filename = "ValueSets-enumeration.openapi.json"
            else:
                wrapper_filename = "LogicalModels-enumeration.openapi.json"
                
            wrapper_path = os.path.join(output_dir, wrapper_filename)
            
            with open(wrapper_path, 'w', encoding='utf-8') as f:
                json.dump(openapi_spec, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Created enumeration OpenAPI wrapper: {wrapper_path}")
            return wrapper_path
            
        except Exception as e:
            self.logger.error(f"Error creating enumeration OpenAPI wrapper for {enum_schema_path}: {e}")
            return None


class HTMLProcessor:
    """Post-processes HTML files to inject DAK API content."""
    
    def __init__(self, logger: logging.Logger, output_dir: str):
        self.logger = logger
        self.output_dir = output_dir
    
    def create_html_template_from_existing(self, template_html_path: str, title: str, content: str) -> str:
        """
        Create a new HTML file using an existing file as template.
        
        Args:
            template_html_path: Path to the template HTML file (e.g., dak-api.html)
            title: Title for the new page
            content: HTML content to inject at the placeholder div
            
        Returns:
            The new HTML content as a string
        """
        try:
            with open(template_html_path, 'r', encoding='utf-8') as f:
                template_html = f.read()
            
            # Update the title
            import re
            title_pattern = r'<title>([^<]*)</title>'
            match = re.search(title_pattern, template_html)
            if match:
                current_title = match.group(1)
                # Preserve any suffix from the original title
                if ' - ' in current_title:
                    suffix = ' - ' + current_title.split(' - ', 1)[1]
                else:
                    suffix = ''
                new_title = title + suffix
                template_html = re.sub(title_pattern, f'<title>{new_title}</title>', template_html)
            
            # Replace the placeholder div with actual content
            # Look for either the div placeholder or the old comment marker
            div_placeholder = '<div id="dak-api-content-placeholder">'
            comment_marker = '<!-- DAK_API_CONTENT -->'

            if div_placeholder in template_html:
                # Find the closing </div> and replace the entire placeholder div
                import re
                placeholder_pattern = r'<div id="dak-api-content-placeholder">.*?</div>'
                template_html = re.sub(placeholder_pattern, content, template_html, flags=re.DOTALL)
            elif comment_marker in template_html:
                template_html = template_html.replace(comment_marker, content)
            else:
                self.logger.warning(f"No placeholder marker found in template")
            
            return template_html
            
        except Exception as e:
            self.logger.error(f"Error creating HTML template: {e}")
            return ""
    
    def inject_content_at_comment_marker(self, html_file_path: str, content: str) -> bool:
        """
        Inject content into an HTML file at the DAK API placeholder div.

        Args:
            html_file_path: Path to the HTML file to modify
            content: HTML content to inject

        Returns:
            True if successful, False otherwise
        """
        try:
            self.logger.info(f"🔍 Starting content injection into: {html_file_path}")
            self.logger.info(f"📏 Content to inject length: {len(content)} characters")

            if not os.path.exists(html_file_path):
                self.logger.error(f"❌ HTML file does not exist: {html_file_path}")
                return False

            with open(html_file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()

            self.logger.info(f"📖 Read HTML file, original length: {len(html_content)} characters")

            # Look for the placeholder div (survives HTML conversion from markdown)
            import re
            placeholder_pattern = r'<div\s+id="dak-api-content-placeholder"[^>]*>.*?</div>'

            if not re.search(placeholder_pattern, html_content, re.DOTALL):
                # Fallback: try the old comment marker for backwards compatibility
                comment_marker = '<!-- DAK_API_CONTENT -->'
                if comment_marker in html_content:
                    self.logger.info(f"✅ Found legacy DAK_API_CONTENT comment marker")
                    new_html_content = html_content.replace(comment_marker, content)
                else:
                    self.logger.error(f"❌ DAK API placeholder div not found in {html_file_path}")
                    self.logger.info("Looking for: <div id=\"dak-api-content-placeholder\">")
                    self.logger.info("Available content sample for debugging:")
                    # Show a sample to help debug
                    sample_content = html_content[:1000] if len(html_content) > 1000 else html_content
                    self.logger.info(f"Sample content: {sample_content}")
                    return False
            else:
                self.logger.info(f"✅ Found DAK API placeholder div")
                # Replace the placeholder div with the actual content
                new_html_content = re.sub(placeholder_pattern, content, html_content, flags=re.DOTALL)
            
            self.logger.info(f"📏 Content replacement: original={len(html_content)}, new={len(new_html_content)}")
            
            # Write the modified HTML back to the file
            with open(html_file_path, 'w', encoding='utf-8') as f:
                f.write(new_html_content)
            
            size_increase = len(new_html_content) - len(html_content)
            self.logger.info(f"💾 Successfully wrote modified HTML back to {html_file_path}")
            self.logger.info(f"📏 Final HTML file size: {len(new_html_content)} characters (increased by {size_increase})")
            
            if size_increase > 100:  # If we added substantial content
                self.logger.info(f"✅ Content injection appears successful (substantial size increase)")
                return True
            else:
                self.logger.warning(f"⚠️  Content injection may have failed (minimal size increase: {size_increase})")
                return False
            
        except Exception as e:
            self.logger.error(f"❌ Error injecting content into {html_file_path}: {e}")
            import traceback
            self.logger.error(f"🔍 Traceback: {traceback.format_exc()}")
            return False
class SchemaDocumentationRenderer:
    """Generates HTML documentation content for schemas."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def get_codesystem_anchors(self, codesystem_url: str, output_dir: str) -> Dict[str, str]:
        """
        Attempt to find anchor mappings for codes in a CodeSystem HTML file.
        
        Args:
            codesystem_url: The canonical URL of the CodeSystem
            output_dir: Directory where HTML files are located
            
        Returns:
            Dictionary mapping codes to their anchor names
        """
        anchor_map = {}
        
        try:
            # Extract CodeSystem ID from URL
            if '/CodeSystem/' in codesystem_url:
                codesystem_id = codesystem_url.split('/CodeSystem/')[-1]
                html_filename = f"CodeSystem-{codesystem_id}.html"
                html_path = os.path.join(output_dir, html_filename)
                
                if os.path.exists(html_path):
                    with open(html_path, 'r', encoding='utf-8') as f:
                        html_content = f.read()
                    
                    # Look for anchor patterns in code definition tables
                    # Pattern 1: id="CodeSystem-ID-code" (simple case)
                    # Pattern 2: id="ID-code" (common IG Publisher pattern)
                    # Pattern 3: code-specific patterns based on the actual HTML structure
                    import re
                    
                    # Try different anchor patterns that might be used by IG Publisher
                    patterns = [
                        rf'id="({codesystem_id}-[^"]+)"',  # CodeSystem-ID-code
                        rf'id="([^"]*-[0-9.]+[^"]*)"',     # Any ID with numeric codes
                        rf'<tr[^>]*id="([^"]*{codesystem_id}[^"]*)"',  # Table rows with CodeSystem ID
                        rf'<a[^>]*name="([^"]*)"[^>]*>.*?{re.escape(codesystem_id)}'  # Named anchors
                    ]
                    
                    for pattern in patterns:
                        matches = re.findall(pattern, html_content, re.IGNORECASE)
                        for match in matches:
                            # Extract potential code from the match
                            if codesystem_id in match:
                                # Split by the codesystem ID and take the part after it
                                parts = match.split(codesystem_id, 1)
                                if len(parts) > 1 and parts[1]:
                                    code_part = parts[1].lstrip('-_.')
                                    if code_part:
                                        anchor_map[code_part] = match
                            else:
                                # For patterns that don't include the codesystem ID
                                # Try to extract numeric codes
                                code_match = re.search(r'[0-9]+(?:\.[0-9]+)*', match)
                                if code_match:
                                    code = code_match.group()
                                    anchor_map[code] = match
                    
                    # If we still don't have anchors, try a more generic approach
                    if not anchor_map:
                        # Look for any table cells or elements that might contain codes
                        td_pattern = r'<td[^>]*>([0-9]+(?:\.[0-9]+)*)</td>'
                        code_matches = re.findall(td_pattern, html_content)
                        for code in code_matches:
                            # Create a best-guess anchor
                            anchor_map[code] = f"{codesystem_id}-{code}"
                
                self.logger.info(f"Found {len(anchor_map)} anchor mappings for CodeSystem {codesystem_id}")
                if anchor_map:
                    # Log a few examples for debugging
                    sample_mappings = list(anchor_map.items())[:3]
                    self.logger.info(f"Sample mappings: {sample_mappings}")
                    
        except Exception as e:
            self.logger.warning(f"Could not load CodeSystem anchors for {codesystem_url}: {e}")
        
        return anchor_map
    
    def generate_schema_documentation_html(self, schema_path: str, schema_type: str, output_dir: str) -> str:
        """
        Generate HTML documentation content for a schema.
        
        Args:
            schema_path: Path to the schema file
            schema_type: Type of schema ('valueset' or 'logical_model')
            output_dir: Output directory for reference files
            
        Returns:
            HTML content as a string
        """
        try:
            schema_filename = os.path.basename(schema_path)
            spec_name = schema_filename.replace('.schema.json', '')
            
            # Load the schema
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema_data = json.load(f)
            
            title = schema_data.get('title', f"{spec_name} Schema Documentation")
            
            # Generate HTML content
            html_content = f"""
<div class="schema-documentation">
    <h2>{title}</h2>
    
    <div class="schema-info">
        <p><strong>Schema File:</strong> {schema_filename}</p>
        <p><strong>Description:</strong> {schema_data.get('description', 'No description available')}</p>
        <p><strong>Type:</strong> {schema_data.get('type', 'unknown')}</p>
    </div>
"""
            
            # Add schema ID as link if available
            schema_id = schema_data.get('$id', '')
            if schema_id:
                # Determine the correct FHIR page link based on schema type
                if schema_filename == 'ValueSets.schema.json':
                    fhir_url = "artifacts.html#terminology-value-sets"
                elif schema_filename == 'LogicalModels.schema.json':
                    fhir_url = "artifacts.html#structures-logical-models"
                else:
                    # Individual schemas link to their specific HTML files
                    fhir_url = schema_filename.replace('.schema.json', '.html')
                
                html_content += f"""
    <div class="schema-links">
        <p><strong>Schema ID:</strong> <a href="{schema_id}">{schema_id}</a></p>
    </div>
"""
            
            # Handle enum values for ValueSets
            if 'enum' in schema_data:
                # Sort enum values alphabetically and truncate after 40 entries
                enum_values = sorted(schema_data['enum'])
                displayed_values = enum_values[:40]
                truncated = len(enum_values) > 40
                
                # Check if we can link to CodeSystem definitions
                codesystem_anchors = {}
                if schema_type == 'valueset' and schema_id:
                    # Try to load system mapping to find CodeSystem
                    try:
                        if '/' in schema_id:
                            base_url = '/'.join(schema_id.split('/')[:-1])
                            system_filename = f"{spec_name}.system.json"
                            system_path = os.path.join(output_dir, system_filename)
                            
                            if os.path.exists(system_path):
                                with open(system_path, 'r', encoding='utf-8') as f:
                                    system_data = json.load(f)
                                
                                # Get system URIs for codes
                                fhir_systems = system_data.get('fhir:systems', {})
                                if fhir_systems:
                                    # Check if any system is from the same IG
                                    for code, system_uri in fhir_systems.items():
                                        if system_uri and base_url in system_uri:
                                            # This is a local CodeSystem, try to get anchors
                                            codesystem_anchors = self.get_codesystem_anchors(system_uri, output_dir)
                                            break
                    except Exception as e:
                        self.logger.warning(f"Could not load system mappings for {spec_name}: {e}")
                
                html_content += """
    <div class="allowed-values">
        <h3>Allowed Values</h3>
        <div class="enum-values">
"""
                for enum_value in displayed_values:
                    if enum_value in codesystem_anchors:
                        # Create link to CodeSystem anchor
                        anchor = codesystem_anchors[enum_value]
                        codesystem_id = anchor.split('-')[0]
                        link_url = f"CodeSystem-{codesystem_id}.html#{anchor}"
                        html_content += f'            <span class="enum-value"><a href="{link_url}" title="View definition in CodeSystem">{enum_value}</a></span>\n'
                    else:
                        html_content += f'            <span class="enum-value">{enum_value}</span>\n'
                
                if truncated:
                    remaining_count = len(enum_values) - 40
                    html_content += f'            <div class="enum-truncated">... and {remaining_count} more values</div>\n'
                
                html_content += """        </div>
    </div>
"""
            
            # Handle object properties for Logical Models
            if 'properties' in schema_data:
                html_content += """
    <div class="schema-properties">
        <h3>Properties</h3>
        <ul>
"""
                for prop_name, prop_def in schema_data['properties'].items():
                    prop_type = prop_def.get('type', 'unknown')
                    html_content += f'            <li><strong>{prop_name}</strong> ({prop_type}): {prop_def.get("description", "No description")}</li>\n'
                
                html_content += """        </ul>
"""
                
                # Show required fields
                required = schema_data.get('required', [])
                if required:
                    html_content += f"""
        <p><strong>Required fields:</strong> {', '.join(required)}</p>
"""
                
                html_content += """    </div>
"""
            
            # Show full schema as collapsible JSON
            schema_json_str = json.dumps(schema_data, indent=2)
            html_content += f"""
    <div class="schema-json">
        <details>
            <summary>Full Schema (JSON)</summary>
            <pre><code class="language-json">{schema_json_str}</code></pre>
        </details>
    </div>
</div>

<style>
/* Schema documentation styling that integrates with IG theme */
.schema-documentation {{
    margin: 1rem 0;
}}

.schema-info, .schema-links, .allowed-values, .schema-properties, .schema-json {{
    margin: 1.5rem 0;
}}

.enum-values {{
    background-color: #e7f3ff;
    border: 1px solid #b8daff;
    border-radius: 4px;
    padding: 1rem;
    margin: 1rem 0;
}}

.enum-value {{
    display: inline-block;
    background-color: #00477d;
    color: white;
    padding: 0.2rem 0.5rem;
    border-radius: 3px;
    margin: 0.2rem;
    font-size: 0.9rem;
    text-decoration: none;
}}

.enum-value a {{
    color: white;
    text-decoration: none;
}}

.enum-value:hover, .enum-value a:hover {{
    background-color: #0070A1;
    color: white;
    text-decoration: none;
}}

.enum-truncated {{
    margin-top: 0.5rem;
    font-style: italic;
    color: #6c757d;
}}

details {{
    margin: 1rem 0;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 0;
}}

details summary {{
    background: #f8f9fa;
    padding: 0.75rem;
    cursor: pointer;
    border-bottom: 1px solid #dee2e6;
    font-weight: 500;
}}

details[open] summary {{
    border-bottom: 1px solid #dee2e6;
}}

details pre {{
    margin: 1rem;
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
}}
</style>

<hr>

<p><em>This documentation is automatically generated from the schema definition.</em></p>
"""
            
            return html_content
            
        except Exception as e:
            self.logger.error(f"Error generating schema documentation for {schema_path}: {e}")
            return ""
    
    def _find_injection_point(self, html_content: str, schema_type: str) -> Optional[int]:
        """
        Find the appropriate injection point in FHIR IG generated HTML content.
        
        For StructureDefinition pages: after "Formal Views of Profile Content"
        For ValueSet pages: after "Expansion" section (last IG publisher content)
        
        Args:
            html_content: The HTML content to search
            schema_type: Type of schema ('valueset', 'logical_model', etc.)
            
        Returns:
            Index position for injection, or None if not found
        """
        try:
            # For logical models (StructureDefinition pages), look for "Formal Views" section
            if schema_type == 'logical_model':
                # Look for the end of the "Formal Views of Profile Content" section
                formal_views_patterns = [
                    r'<h3[^>]*>Formal Views of Profile Content</h3>.*?</div>\s*</div>',
                    r'<h2[^>]*>Formal Views of Profile Content</h2>.*?</div>\s*</div>',
                    r'<h3[^>]*>Formal Views</h3>.*?</div>\s*</div>',
                    r'<h2[^>]*>Formal Views</h2>.*?</div>\s*</div>'
                ]
                
                for pattern in formal_views_patterns:
                    import re
                    match = re.search(pattern, html_content, re.DOTALL | re.IGNORECASE)
                    if match:
                        self.logger.info(f"Found 'Formal Views' section for injection point")
                        return match.end()
            
            # For ValueSet pages, look for "Expansion" section
            elif schema_type == 'valueset':
                # Look for the end of the "Expansion" section
                expansion_patterns = [
                    r'<h3[^>]*>Expansion</h3>.*?</div>\s*</div>',
                    r'<h2[^>]*>Expansion</h2>.*?</div>\s*</div>',
                    r'<h4[^>]*>Expansion</h4>.*?</div>\s*</div>'
                ]
                
                for pattern in expansion_patterns:
                    import re
                    match = re.search(pattern, html_content, re.DOTALL | re.IGNORECASE)
                    if match:
                        self.logger.info(f"Found 'Expansion' section for injection point")
                        return match.end()
            
            # Fallback: look for common FHIR IG content structures
            fallback_patterns = [
                # Look for the end of main content div
                r'<div[^>]*class="[^"]*col-12[^"]*"[^>]*>.*?</div>\s*(?=<div[^>]*class="[^"]*col-12[^"]*"|$)',
                # Look for navigation or footer sections to inject before
                r'(?=<div[^>]*class="[^"]*nav[^"]*")',
                r'(?=<footer)',
                # Generic fallback
                r'</main>',
                r'</body>'
            ]
            
            for pattern in fallback_patterns:
                import re
                match = re.search(pattern, html_content, re.DOTALL | re.IGNORECASE)
                if match:
                    self.logger.info(f"Using fallback injection point")
                    return match.start() if pattern.startswith('(?=') else match.end()
            
            self.logger.warning("No suitable injection point found")
            return None
            
        except Exception as e:
            self.logger.error(f"Error finding injection point: {e}")
            return None
    
    def inject_into_html(self, openapi_path: str, output_dir: str, title: str = None, schema_type: str = None) -> Optional[str]:
        """
        Inject OpenAPI content into an existing HTML file that was generated by the IG publisher.
        
        This replaces the old generate_redoc_html approach by working with already-generated HTML files.
        
        Args:
            openapi_path: Path to the OpenAPI spec file
            output_dir: Directory containing the generated HTML files
            title: Optional title for the page
            schema_type: Optional schema type ('valueset' or 'logical_model')
            
        Returns:
            Path to the updated HTML file, or None if failed
        """
        try:
            openapi_filename = os.path.basename(openapi_path)
            spec_name = openapi_filename.replace('.openapi.json', '').replace('.openapi.yaml', '').replace('.yaml', '').replace('.yml', '').replace('.json', '')
            
            # Determine schema type if not provided
            if schema_type is None:
                if spec_name.startswith('ValueSet-'):
                    schema_type = 'valueset'
                elif spec_name.startswith('LogicalModel-') or spec_name.startswith('StructureDefinition-'):
                    schema_type = 'logical_model'
                else:
                    schema_type = 'unknown'
            
            if title is None:
                title = f"{spec_name} API Documentation"
            
            # Load the OpenAPI spec
            with open(openapi_path, 'r', encoding='utf-8') as f:
                spec_data = json.load(f)
            
            # Find the corresponding HTML file in the output directory
            html_filename = f"{spec_name}.html"
            html_path = os.path.join(output_dir, html_filename)
            
            if not os.path.exists(html_path):
                self.logger.warning(f"HTML file not found: {html_path}. IG publisher may not have processed the placeholder.")
                return None
            
            # Read the existing HTML file
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Check for the placeholder marker
            placeholder_marker = f'<!-- DAK_API_PLACEHOLDER: {spec_name} -->'
            if placeholder_marker not in html_content:
                self.logger.warning(f"Placeholder marker not found in {html_path}. Searching for appropriate FHIR IG content section.")
                # Find the appropriate injection point based on content type
                injection_point = self._find_injection_point(html_content, schema_type)
                if injection_point is None:
                    self.logger.error(f"No suitable injection point found in {html_path}")
                    return None
            else:
                injection_point = html_content.find(placeholder_marker)
            
            # Generate the documentation content (HTML instead of markdown)
            doc_content = self._generate_html_content(spec_data, openapi_filename, schema_type)
            
            # Inject the content
            if placeholder_marker in html_content:
                # Replace the placeholder with actual content
                updated_html = html_content.replace(placeholder_marker, doc_content)
            else:
                # Insert at the injection point
                updated_html = html_content[:injection_point] + doc_content + html_content[injection_point:]
            
            # Write the updated HTML file
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(updated_html)
            
            self.logger.info(f"Injected OpenAPI content into HTML file: {html_path}")
            return html_filename
            
        except Exception as e:
            self.logger.error(f"Error injecting content into HTML for {openapi_path}: {e}")
            return None

    def _generate_html_content(self, spec_data: dict, openapi_filename: str, schema_type: str) -> str:
        """
        Generate HTML content for OpenAPI documentation.
        
        Args:
            spec_data: Parsed OpenAPI specification
            openapi_filename: Name of the OpenAPI file
            schema_type: Type of schema ('valueset', 'logical_model', etc.)
            
        Returns:
            HTML content string
        """
        html_content = f"""
<!-- OpenAPI Documentation Content -->
<div class="dak-api-content">
"""
        
        # Add API info
        info = spec_data.get('info', {})
        html_content += f"""
<div class="api-info">
<h2>API Information</h2>
<div class="card">
<div class="card-body">
<h5 class="card-title">{info.get('title', 'API')}</h5>
<p class="card-text">{info.get('description', 'No description available')}</p>
<p><strong>Version:</strong> {info.get('version', 'Unknown')}</p>
</div>
</div>
</div>
"""
        
        # Add endpoints
        paths = spec_data.get('paths', {})
        if paths:
            html_content += """
<div class="api-endpoints">
<h2>Endpoints</h2>
"""
            
            for path, methods in paths.items():
                for method, operation in methods.items():
                    html_content += f"""
<div class="endpoint-card">
<h3><span class="badge badge-{method.lower()}">{method.upper()}</span> {path}</h3>
<h4>{operation.get('summary', 'No summary')}</h4>
<p>{operation.get('description', 'No description available')}</p>
</div>
"""
            
            html_content += """
</div>
"""
        
        # Add schema information
        components = spec_data.get('components', {})
        schemas = components.get('schemas', {})
        if schemas:
            html_content += """
<div class="api-schemas">
<h2>Schema Definition</h2>
"""
            
            for schema_name, schema_def in schemas.items():
                schema_id = schema_def.get('$id', '')
                
                html_content += f"""
<div class="schema-card">
<h3>{schema_name}</h3>
<p><strong>Description:</strong> {schema_def.get('description', 'No description')}</p>
<p><strong>Type:</strong> {schema_def.get('type', 'unknown')}</p>
"""
                
                # Add schema ID as link if available
                if schema_id:
                    # Convert schema ID to corresponding FHIR page (use relative URL)
                    if '/' in schema_id:
                        filename = schema_id.split('/')[-1]
                    else:
                        filename = schema_id
                    
                    # Determine the correct FHIR page link based on schema type
                    if filename == 'ValueSets.schema.json':
                        fhir_url = "artifacts.html#terminology-value-sets"
                    elif filename == 'LogicalModels.schema.json':
                        fhir_url = "artifacts.html#structures-logical-models"
                    else:
                        # Individual schemas link to their specific HTML files
                        fhir_url = filename.replace('.schema.json', '.html')
                    
                    html_content += f"""
<p><strong>Schema ID:</strong> <a href="{schema_id}" target="_blank">{schema_id}</a></p>
"""
                
                # Handle enum values for ValueSets
                if schema_type == 'valueset' and 'enum' in schema_def:
                    enum_values = schema_def['enum']
                    if enum_values:
                        display_limit = 50
                        
                        html_content += """
<div class="enum-values">
<h4>Available Values</h4>
<div class="enum-container">
"""
                        
                        for i, value in enumerate(enum_values[:display_limit]):
                            html_content += f'<span class="enum-value">{value}</span>'
                        
                        if len(enum_values) > display_limit:
                            remaining = len(enum_values) - display_limit
                            html_content += f'<div class="enum-truncated">... and {remaining} more values</div>'
                        
                        html_content += """
</div>
</div>
"""
                
                # Handle object properties for Logical Models
                if 'properties' in schema_def:
                    html_content += """
<h4>Properties</h4>
<ul class="properties-list">
"""
                    for prop_name, prop_def in schema_def['properties'].items():
                        prop_type = prop_def.get('type', 'unknown')
                        html_content += f"""<li><strong>{prop_name}</strong> ({prop_type}): {prop_def.get('description', 'No description')}</li>"""
                    
                    html_content += """
</ul>
"""
                    
                    # Show required fields
                    required = schema_def.get('required', [])
                    if required:
                        html_content += f"""
<p><strong>Required fields:</strong> {', '.join(required)}</p>
"""
                
                # Show full schema as collapsible JSON
                import json
                schema_json_str = json.dumps(schema_def, indent=2)
                html_content += f"""
<details class="schema-details">
<summary>Full Schema (JSON)</summary>
<pre><code class="language-json">{schema_json_str}</code></pre>
</details>
"""
                
                html_content += """
</div>
"""
            
            html_content += """
</div>
"""
        
        # Add styling that integrates with IG theme
        html_content += """
</div>

<style>
/* DAK API documentation styling that integrates with IG theme */
.dak-api-content {
  margin: 1rem 0;
}

.api-info .card, .schema-card, .endpoint-card {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 1rem;
  margin: 1rem 0;
}

.schema-card h3, .endpoint-card h3 {
  color: #00477d;
  margin-top: 0;
}

.badge-get { background-color: #28a745; }
.badge-post { background-color: #007bff; }
.badge-put { background-color: #ffc107; color: #212529; }
.badge-delete { background-color: #dc3545; }
.badge-patch { background-color: #6f42c1; }

.enum-values {
  background-color: #e7f3ff;
  border: 1px solid #b8daff;
  border-radius: 4px;
  padding: 1rem;
  margin: 1rem 0;
}

.enum-value {
  display: inline-block;
  background-color: #00477d;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  margin: 0.2rem;
  font-size: 0.9rem;
  text-decoration: none;
}

.enum-value:hover {
  background-color: #0070A1;
}

.enum-truncated {
  margin-top: 0.5rem;
  font-style: italic;
  color: #6c757d;
}

.schema-details {
  margin: 1rem 0;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.schema-details summary {
  background: #f8f9fa;
  padding: 0.75rem;
  cursor: pointer;
  border-bottom: 1px solid #dee2e6;
  font-weight: 500;
}

.schema-details[open] summary {
  border-bottom: 1px solid #dee2e6;
}

.schema-details pre {
  margin: 1rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 1rem;
  overflow-x: auto;
}

.properties-list {
  margin-left: 1rem;
}

.properties-list li {
  margin: 0.5rem 0;
}
</style>

<p><em>This documentation is automatically generated from the OpenAPI specification.</em></p>
"""
        
        return html_content


class DAKApiHubGenerator:
    """Generates the unified DAK API documentation hub."""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    def create_enumeration_schema(self, schema_type: str, schema_files: List[str], output_dir: str) -> Optional[str]:
        """
        Create an enumeration schema file that lists all schemas of a given type.
        
        Args:
            schema_type: Type of schema ('valueset' or 'logical_model')  
            schema_files: List of schema file paths
            output_dir: Directory to save the enumeration schema
            
        Returns:
            Path to the generated enumeration schema file, or None if failed
        """
        try:
            # Create enumeration data by reading each schema file
            schemas_list = []
            
            for schema_path in schema_files:
                try:
                    with open(schema_path, 'r', encoding='utf-8') as f:
                        schema = json.load(f)
                    
                    schema_filename = os.path.basename(schema_path)
                    schema_entry = {
                        "filename": schema_filename,
                        "id": schema.get('$id', ''),
                        "title": schema.get('title', schema_filename),
                        "description": schema.get('description', ''),
                        "url": f"./{schema_filename}"
                    }
                    
                    # Add type-specific metadata
                    if schema_type == 'valueset':
                        if 'fhir:valueSet' in schema:
                            schema_entry['valueSetUrl'] = schema['fhir:valueSet']
                        if 'enum' in schema:
                            schema_entry['codeCount'] = len(schema['enum'])
                    elif schema_type == 'logical_model':
                        if 'fhir:logicalModel' in schema:
                            schema_entry['logicalModelUrl'] = schema['fhir:logicalModel']
                        if 'properties' in schema:
                            schema_entry['propertyCount'] = len(schema['properties'])
                    
                    schemas_list.append(schema_entry)
                    
                except Exception as e:
                    self.logger.warning(f"Error reading schema {schema_path}: {e}")
                    continue
            
            # Create the enumeration schema
            if schema_type == 'valueset':
                enum_filename = "ValueSets.schema.json"
                enum_title = "ValueSet Enumeration Schema"
                enum_description = "JSON Schema defining the structure of the ValueSet enumeration endpoint response"
            else:  # logical_model
                enum_filename = "LogicalModels.schema.json"
                enum_title = "Logical Model Enumeration Schema"  
                enum_description = "JSON Schema defining the structure of the Logical Model enumeration endpoint response"
            
            enumeration_schema = {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": f"#/{enum_filename}",
                "title": enum_title,
                "description": enum_description,
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "const": schema_type,
                        "description": f"The type of schemas enumerated ({schema_type})"
                    },
                    "count": {
                        "type": "integer",
                        "description": "Total number of schemas available"
                    },
                    "schemas": {
                        "type": "array",
                        "description": "Array of available schemas",
                        "items": {
                            "type": "object",
                            "properties": {
                                "filename": {
                                    "type": "string",
                                    "description": "Schema filename"
                                },
                                "id": {
                                    "type": "string",
                                    "description": "Schema $id"
                                },
                                "title": {
                                    "type": "string", 
                                    "description": "Schema title"
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Schema description"
                                },
                                "url": {
                                    "type": "string",
                                    "description": "Relative URL to the schema file"
                                }
                            },
                            "required": ["filename", "title", "url"]
                        }
                    }
                },
                "required": ["type", "count", "schemas"],
                "example": {
                    "type": schema_type,
                    "count": len(schemas_list),
                    "schemas": schemas_list
                }
            }
            
            # Add type-specific properties to schema items
            if schema_type == 'valueset':
                enumeration_schema["properties"]["schemas"]["items"]["properties"]["valueSetUrl"] = {
                    "type": "string",
                    "description": "FHIR canonical URL of the ValueSet"
                }
                enumeration_schema["properties"]["schemas"]["items"]["properties"]["codeCount"] = {
                    "type": "integer", 
                    "description": "Number of codes in the ValueSet"
                }
            elif schema_type == 'logical_model':
                enumeration_schema["properties"]["schemas"]["items"]["properties"]["logicalModelUrl"] = {
                    "type": "string",
                    "description": "FHIR canonical URL of the Logical Model"
                }
                enumeration_schema["properties"]["schemas"]["items"]["properties"]["propertyCount"] = {
                    "type": "integer",
                    "description": "Number of properties in the Logical Model"  
                }
            
            # Save enumeration schema
            enum_path = os.path.join(output_dir, enum_filename)
            with open(enum_path, 'w', encoding='utf-8') as f:
                json.dump(enumeration_schema, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Created enumeration schema: {enum_path}")
            return enum_path
            
        except Exception as e:
            self.logger.error(f"Error creating enumeration schema for {schema_type}: {e}")
            return None
    
    def generate_hub_html_content(self, schema_docs: Dict[str, List[Dict]], openapi_docs: List[Dict], enumeration_docs: List[Dict] = None, jsonld_docs: List[Dict] = None, existing_openapi_html_content: Optional[str] = None) -> str:
        """
        Generate HTML content for the DAK API hub page.
        
        Args:
            schema_docs: Dictionary with schema documentation info
            openapi_docs: List of OpenAPI documentation info
            enumeration_docs: List of enumeration endpoint documentation info
            jsonld_docs: List of JSON-LD vocabulary documentation info
            existing_openapi_html_content: Existing HTML content from input/images/openapi/index.html
            
        Returns:
            HTML content as a string
        """
        if enumeration_docs is None:
            enumeration_docs = []
        if jsonld_docs is None:
            jsonld_docs = []
        
        # Start building the HTML content
        # Note: No h2 heading here - the page title comes from the markdown file (dak-api.md)
        # and the intro text is also in the markdown, so we just add the dynamic content
        html_content = """
<div class="dak-api-hub">
"""
        
        # Add API Enumeration Endpoints section
        if enumeration_docs:
            html_content += """
    <h3>API Enumeration Endpoints</h3>
    
    <p>These endpoints provide lists of all available schemas and vocabularies of each type:</p>
    
    <div class="enumeration-endpoints">
"""
            # Add schema enumeration endpoints with proper endpoint listings
            for enum_doc in enumeration_docs:
                if enum_doc['type'] == 'enumeration-valueset':
                    # List ValueSet schemas in this enumeration
                    valueset_list = ""
                    for schema_doc in schema_docs['valueset']:
                        schema_name = schema_doc['schema_file'].replace('.schema.json', '')
                        valueset_list += f"""
                    <li><a href="{schema_doc['schema_file']}">{schema_name}.schema.json</a> - JSON Schema for {schema_doc['title']}</li>"""
                        # Add JSON-LD if available
                        if schema_doc.get('jsonld_file'):
                            jsonld_name = schema_doc['jsonld_file'].replace('.jsonld', '')
                            valueset_list += f"""
                    <li><a href="{schema_doc['jsonld_file']}">{jsonld_name}.jsonld</a> - JSON-LD vocabulary for {schema_doc['title']}</li>"""
                    
                    html_content += f"""
        <div class="endpoint-card">
            <h4><a href="{enum_doc['html_file']}">{enum_doc['title']}</a></h4>
            <p>{enum_doc['description']}</p>
            <div class="endpoint-list">
                <h5>Available Endpoints:</h5>
                <ul>{valueset_list}
                </ul>
            </div>
        </div>
"""
                elif enum_doc['type'] == 'enumeration-logicalmodel':
                    # List LogicalModel schemas in this enumeration
                    logicalmodel_list = ""
                    for schema_doc in schema_docs['logical_model']:
                        schema_name = schema_doc['schema_file'].replace('.schema.json', '')
                        logicalmodel_list += f"""
                    <li><a href="{schema_doc['schema_file']}">{schema_name}.schema.json</a> - JSON Schema for {schema_doc['title']}</li>"""
                    
                    html_content += f"""
        <div class="endpoint-card">
            <h4><a href="{enum_doc['html_file']}">{enum_doc['title']}</a></h4>
            <p>{enum_doc['description']}</p>
            <div class="endpoint-list">
                <h5>Available Endpoints:</h5>
                <ul>{logicalmodel_list}
                </ul>
            </div>
        </div>
"""
            
            html_content += """
    </div>
"""
        
        # Add ValueSet Schemas section
        if schema_docs['valueset']:
            html_content += f"""
    <h3>ValueSet Schemas ({len(schema_docs['valueset'])} available)</h3>
    
    <p>JSON Schema definitions for FHIR ValueSets, providing structured enumeration of allowed code values:</p>
    
    <div class="schema-grid">
"""
            for schema_doc in schema_docs['valueset']:
                html_content += f"""
        <div class="schema-card">
            <h4><a href="{schema_doc['html_file']}">{schema_doc['title']}</a></h4>
            <p>{schema_doc['description']}</p>
            <div class="schema-links">
                <a href="{schema_doc['html_file']}" class="schema-link fhir-link" title="FHIR Resource Definition">🩺 FHIR</a>
                <a href="{schema_doc.get('schema_file', '')}" class="schema-link" title="JSON Schema Definition">📄 JSON Schema</a>"""
                
                # Add displays file link if it exists
                if schema_doc.get('displays_file'):
                    html_content += f"""
                <a href="{schema_doc['displays_file']}" class="schema-link" title="Display Names">🏷️ Displays</a>"""
                
                # Add JSON-LD file link if it exists
                if schema_doc.get('jsonld_file'):
                    html_content += f"""
                <a href="{schema_doc['jsonld_file']}" class="schema-link" title="JSON-LD Vocabulary">🗂️ JSON-LD</a>"""
                
                # Add OpenAPI wrapper link if it exists
                if schema_doc.get('openapi_file'):
                    html_content += f"""
                <a href="{schema_doc['openapi_file']}" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI</a>"""
                
                html_content += """
            </div>
        </div>
"""
            html_content += """
    </div>
"""
        
        # Add Logical Model Schemas section
        if schema_docs['logical_model']:
            html_content += f"""
    <h3>Logical Model Schemas ({len(schema_docs['logical_model'])} available)</h3>
    
    <p>JSON Schema definitions for FHIR Logical Models, defining structured data elements and their relationships:</p>
    
    <div class="schema-grid">
"""
            for schema_doc in schema_docs['logical_model']:
                html_content += f"""
        <div class="schema-card">
            <h4><a href="{schema_doc['html_file']}">{schema_doc['title']}</a></h4>
            <p>{schema_doc['description']}</p>
            <div class="schema-links">
                <a href="{schema_doc['html_file']}" class="schema-link fhir-link" title="FHIR Resource Definition">🩺 FHIR</a>
                <a href="{schema_doc.get('schema_file', '')}" class="schema-link" title="JSON Schema Definition">📄 JSON Schema</a>"""
                
                # Add displays file link if it exists
                if schema_doc.get('displays_file'):
                    html_content += f"""
                <a href="{schema_doc['displays_file']}" class="schema-link" title="Display Names">🏷️ Displays</a>"""
                
                # Add OpenAPI wrapper link if it exists
                if schema_doc.get('openapi_file'):
                    html_content += f"""
                <a href="{schema_doc['openapi_file']}" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI</a>"""
                
                html_content += """
            </div>
        </div>
"""
            html_content += """
    </div>
"""
        
        
        # Add OpenAPI Documentation section (comprehensive listing)
        if openapi_docs or schema_docs['valueset'] or schema_docs['logical_model']:
            html_content += f"""
    <h3>OpenAPI Documentation</h3>
    
    <p>Complete API specification documentation for all available endpoints:</p>
    
    <div class="schema-grid">
"""
            
            # Add ValueSet schema endpoints as cards
            for schema_doc in schema_docs['valueset']:
                schema_name = schema_doc['schema_file'].replace('.schema.json', '')
                
                html_content += f"""
        <div class="schema-card">
            <h4>{schema_name} Endpoints</h4>
            <p>API endpoints for {schema_doc['title']}</p>
            <div class="schema-links">
                <a href="{schema_doc['schema_file']}" class="schema-link" title="JSON Schema Definition">📄 JSON Schema</a>"""
                
                # Add JSON-LD endpoint if available
                if schema_doc.get('jsonld_file'):
                    html_content += f"""
                <a href="{schema_doc['jsonld_file']}" class="schema-link" title="JSON-LD Vocabulary">🗂️ JSON-LD</a>"""
                
                # Add OpenAPI specification if available
                if schema_doc.get('openapi_file'):
                    html_content += f"""
                <a href="{schema_doc['openapi_file']}" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI</a>"""
                
                html_content += """
            </div>
        </div>
"""
            
            # Add LogicalModel schema endpoints as cards
            for schema_doc in schema_docs['logical_model']:
                schema_name = schema_doc['schema_file'].replace('.schema.json', '')
                
                html_content += f"""
        <div class="schema-card">
            <h4>{schema_name} Endpoints</h4>
            <p>API endpoints for {schema_doc['title']}</p>
            <div class="schema-links">
                <a href="{schema_doc['schema_file']}" class="schema-link" title="JSON Schema Definition">📄 JSON Schema</a>"""
                
                # Add OpenAPI specification if available
                if schema_doc.get('openapi_file'):
                    html_content += f"""
                <a href="{schema_doc['openapi_file']}" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI</a>"""
                
                html_content += """
            </div>
        </div>
"""
            
            # Add enumeration endpoints as cards
            for enum_doc in enumeration_docs:
                if enum_doc['type'] == 'enumeration-valueset':
                    html_content += f"""
        <div class="schema-card">
            <h4>ValueSets Enumeration Endpoint</h4>
            <p>Complete list of all available ValueSet schemas</p>
            <div class="schema-links">
                <a href="ValueSets.schema.json" class="schema-link" title="JSON Schema Definition">📄 JSON Schema</a>
                <a href="ValueSets-enumeration.openapi.json" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI</a>
            </div>
        </div>
"""
                elif enum_doc['type'] == 'enumeration-logicalmodel':
                    html_content += f"""
        <div class="schema-card">
            <h4>LogicalModels Enumeration Endpoint</h4>
            <p>Complete list of all available Logical Model schemas</p>
            <div class="schema-links">
                <a href="LogicalModels.schema.json" class="schema-link" title="JSON Schema Definition">📄 JSON Schema</a>
                <a href="LogicalModels-enumeration.openapi.json" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI</a>
            </div>
        </div>
"""
            
            # Add OpenAPI documentation pages as cards
            if openapi_docs:
                for api_doc in openapi_docs:
                    # Create documentation cards for all OpenAPI files, including those with HTML docs
                    html_content += f"""
        <div class="schema-card">
            <h4>{api_doc['title']}</h4>
            <p>{api_doc['description']}</p>
            <div class="schema-links">"""
                    
                    # Add link to generated HTML documentation if available
                    if api_doc.get('html_file'):
                        html_content += f"""
                <a href="{api_doc['html_file']}" class="schema-link" title="API Documentation">📖 Documentation</a>"""
                    
                    # Always add link to raw OpenAPI specification
                    html_content += f"""
                <a href="{api_doc['file_path']}" class="schema-link" title="OpenAPI Specification">🔗 OpenAPI Spec</a>"""
                    
                    html_content += """
            </div>
        </div>
"""
            
            html_content += """
    </div>
"""
        
        # Add existing OpenAPI content if present
        if existing_openapi_html_content:
            html_content += """
    <h3>Existing API Documentation</h3>
    
    <div class="existing-openapi-content">
"""
            # Add the extracted content from existing index.html
            html_content += existing_openapi_html_content
            html_content += """
    </div>
"""
        
        # Add usage information
        html_content += """
    <h3>Using the DAK API</h3>
    
    <div class="usage-info">
        <h4>Schema Validation</h4>
        <p>Each JSON Schema can be used to validate data structures in your applications. 
        The schemas follow the JSON Schema Draft 2020-12 specification and include:</p>
        <ul>
            <li>Type definitions and constraints</li>
            <li>Property descriptions and examples</li>
            <li>Required field specifications</li>
            <li>Enumeration values with links to definitions</li>
        </ul>
        
        <h4>JSON-LD Semantic Integration</h4>
        <p>The JSON-LD vocabularies provide semantic web integration for ValueSet enumerations. Each vocabulary includes:</p>
        <ul>
            <li>Enumeration class definitions with schema.org compatibility</li>
            <li>Individual code instances with canonical IRIs</li>
            <li>Property definitions with range constraints</li>
            <li>FHIR metadata integration (system URIs, ValueSet references)</li>
        </ul>
        
        <h4>Integration with FHIR</h4>
        <p>All schemas are derived from the FHIR definitions in this implementation guide. 
        Each schema page includes links to the corresponding FHIR resource definitions for complete context.</p>
        
        <h4>API Endpoints</h4>
        <p>The enumeration endpoints provide machine-readable lists of all available schemas, 
        making it easy to discover and integrate with the available data structures programmatically.</p>
    </div>
</div>

<style>
/* DAK API Hub styling that integrates with IG theme */
.dak-api-hub {
    margin: 1rem 0;
}

.enumeration-endpoints, .schema-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
}

.endpoint-card, .schema-card {
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 1rem;
    background: #f8f9fa;
    transition: box-shadow 0.2s ease;
}

.endpoint-card:hover, .schema-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.endpoint-card h4, .schema-card h4 {
    margin: 0 0 0.5rem 0;
    color: #00477d;
}

.endpoint-card h4 a, .schema-card h4 a {
    color: #00477d;
    text-decoration: none;
}

.endpoint-card h4 a:hover, .schema-card h4 a:hover {
    color: #0070A1;
    text-decoration: underline;
}

.endpoint-card p, .schema-card p {
    margin: 0 0 0.5rem 0;
    color: #6c757d;
    font-size: 0.9rem;
}

.endpoint-list {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #dee2e6;
}

.endpoint-list h5 {
    margin: 0 0 0.5rem 0;
    color: #00477d;
    font-size: 0.9rem;
    font-weight: 600;
}

.endpoint-list ul {
    margin: 0;
    padding-left: 1.2rem;
    list-style-type: disc;
}

.endpoint-list li {
    margin: 0.25rem 0;
    font-size: 0.85rem;
    line-height: 1.4;
}

.endpoint-list a {
    color: #17a2b8;
    text-decoration: none;
    font-family: monospace;
    font-weight: 500;
}

.endpoint-list a:hover {
    color: #138496;
    text-decoration: underline;
}

.schema-links {
    margin: 0.75rem 0 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.schema-link {
    display: inline-block;
    background-color: #17a2b8;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 500;
    transition: background-color 0.2s ease;
}

.schema-link:hover {
    background-color: #138496;
    color: white;
    text-decoration: none;
}

.schema-link.fhir-link {
    background-color: #28a745;
}

.schema-link.fhir-link:hover {
    background-color: #218838;
}

.usage-info {
    background: #e7f3ff;
    border: 1px solid #b8daff;
    border-radius: 4px;
    padding: 1.5rem;
    margin: 1.5rem 0;
}

.usage-info h4 {
    color: #00477d;
    margin-top: 1rem;
}

.usage-info h4:first-child {
    margin-top: 0;
}

.usage-info ul {
    margin: 0.5rem 0;
}

.usage-info li {
    margin: 0.25rem 0;
}

/* JSON-LD specific styling */
.jsonld-list {
    margin: 0.75rem 0 0 0;
    padding: 0.75rem;
    background: #fff;
    border: 1px solid #e1ecf4;
    border-radius: 4px;
}

.jsonld-item {
    display: flex;
    flex-direction: column;
    margin: 0.5rem 0;
    padding: 0.5rem;
    border-left: 3px solid #17a2b8;
    background: #f8f9fa;
}

.jsonld-item:last-child {
    margin-bottom: 0;
}

.jsonld-link {
    font-weight: 600;
    color: #17a2b8;
    text-decoration: none;
    margin-bottom: 0.25rem;
}

.jsonld-link:hover {
    color: #138496;
    text-decoration: underline;
}

.jsonld-description {
    font-size: 0.85rem;
    color: #6c757d;
    font-style: italic;
}
</style>

<hr>

<p><em>This documentation hub is automatically generated from the available schema and API definitions.</em></p>
"""
        
        return html_content
    
    def post_process_dak_api_html(self, output_dir: str, schema_docs: Dict[str, List[Dict]], openapi_docs: List[Dict], enumeration_docs: List[Dict] = None, jsonld_docs: List[Dict] = None, existing_openapi_html_content: Optional[str] = None, html_target_dir: str = None) -> bool:
        """
        Post-process the dak-api.html file to inject DAK API content.

        Args:
            output_dir: Directory containing the generated schema files
            html_target_dir: Directory containing the HTML files to modify (defaults to output_dir)
            schema_docs: Dictionary with schema documentation info
            openapi_docs: List of OpenAPI documentation info
            enumeration_docs: List of enumeration endpoint documentation info
            jsonld_docs: List of JSON-LD vocabulary documentation info
            existing_openapi_html_content: Existing HTML content from input/images/openapi/index.html
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.logger.info("Starting DAK API hub post-processing...")

            # Use html_target_dir if provided, otherwise fall back to output_dir
            target_dir = html_target_dir if html_target_dir else output_dir
            self.logger.info(f"HTML target directory: {target_dir}")

            if enumeration_docs is None:
                enumeration_docs = []
            if jsonld_docs is None:
                jsonld_docs = []

            self.logger.info(f"Content to include in hub:")
            self.logger.info(f"  ValueSet schemas: {len(schema_docs['valueset'])}")
            self.logger.info(f"  Logical Model schemas: {len(schema_docs['logical_model'])}")
            self.logger.info(f"  Enumeration endpoints: {len(enumeration_docs)}")
            self.logger.info(f"  JSON-LD vocabularies: {len(jsonld_docs)}")
            self.logger.info(f"  OpenAPI docs: {len(openapi_docs)}")

            # For post-check phase, always look for dak-api.html in target_dir (output/)
            # Jekyll has already run, so we inject into the final HTML
            dak_api_html_path = os.path.join(target_dir, "dak-api.html")

            if os.path.exists(dak_api_html_path):
                self.logger.info(f"Found dak-api.html - injecting into final HTML")
                target_file_path = dak_api_html_path
                is_markdown = False
            else:
                self.logger.error(f"dak-api.html not found in {target_dir}")
                return False

            self.logger.info(f"Found DAK API template at: {target_file_path}")

            # Generate the HTML content for the hub
            self.logger.info("Generating hub HTML content...")
            hub_content = self.generate_hub_html_content(schema_docs, openapi_docs, enumeration_docs, jsonld_docs, existing_openapi_html_content)
            self.logger.info(f"Generated hub content length: {len(hub_content)} characters")

            if len(hub_content) < 100:
                self.logger.warning("Generated hub content seems very short, this might indicate an issue")
                self.logger.info(f"Hub content preview: {hub_content[:200]}...")

            # Create HTML processor to inject content
            self.logger.info("Creating HTML processor for content injection...")
            html_processor = HTMLProcessor(self.logger, target_dir)

            # Inject content into dak-api file (either .md or .html)
            self.logger.info(f"Injecting content into {os.path.basename(target_file_path)}...")
            success = html_processor.inject_content_at_comment_marker(target_file_path, hub_content)

            if success:
                self.logger.info(f"✅ Successfully post-processed DAK API hub: {target_file_path}")
                # Verify the final file
                final_size = os.path.getsize(target_file_path)
                self.logger.info(f"Final {os.path.basename(target_file_path)} file size: {final_size} bytes")
            else:
                self.logger.error(f"❌ Failed to inject content into {os.path.basename(target_file_path)}")
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error post-processing DAK API hub: {e}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return False


def main():
    """Main entry point for the script."""
    logger = setup_logging()

    # Parse command line arguments
    # When run from template: first arg is ig_root directory
    # When run standalone: first arg is output_dir, second is openapi_dir
    if len(sys.argv) == 1:
        # No arguments: default paths
        ig_root = Path(".")
        output_dir = str(ig_root / "output")
        openapi_dir = str(ig_root / "input" / "images" / "openapi")
    elif len(sys.argv) == 2:
        # Single argument: treat as ig_root (template execution mode)
        ig_root = Path(sys.argv[1])
        output_dir = str(ig_root / "output")
        openapi_dir = str(ig_root / "input" / "images" / "openapi")
    else:
        # Two arguments: standalone mode
        output_dir = sys.argv[1]
        openapi_dir = sys.argv[2]
        ig_root = Path(output_dir).parent

    # For post-check phase, always target output directory
    # Jekyll has already run, so we need to modify the final HTML in output/
    # (temp/pages still exists but modifying it has no effect at this point)
    html_target_dir = output_dir
    logger.info(f"Post-check phase: targeting output directory for HTML injection")

    logger.info(f"Output directory (schemas): {output_dir}")
    logger.info(f"HTML target directory: {html_target_dir}")
    logger.info(f"OpenAPI directory: {openapi_dir}")
    
    # Initialize QA reporter for post-processing
    qa_reporter = QAReporter("postprocessing")
    qa_reporter.add_success("Starting generate_dak_api_hub.py post-processing")
    qa_reporter.add_success(f"Configured directories - Output: {output_dir}, OpenAPI: {openapi_dir}")
    
    # Load existing FHIR IG publisher QA file if it exists
    qa_output_path = os.path.join(output_dir, "qa.json")
    if qa_reporter.load_existing_ig_qa(qa_output_path):
        qa_reporter.add_success("Loaded existing FHIR IG publisher QA file for merging")
    else:
        qa_reporter.add_warning("No existing FHIR IG publisher QA file found - will create new one")
    
    # Check for and merge preprocessing QA report from protected location first
    preprocessing_qa_path = "input/temp/qa_preprocessing.json"
    if os.path.exists(preprocessing_qa_path):
        try:
            with open(preprocessing_qa_path, 'r', encoding='utf-8') as f:
                preprocessing_report = json.load(f)
            qa_reporter.merge_preprocessing_report(preprocessing_report)
            qa_reporter.add_success("Merged preprocessing QA report from input/temp/")
            logger.info("Successfully merged preprocessing QA report from input/temp/")
        except Exception as e:
            qa_reporter.add_warning(f"Failed to merge preprocessing QA report from input/temp/: {e}")
            logger.warning(f"Failed to merge preprocessing QA report from input/temp/: {e}")
    else:
        # Fallback to /tmp location
        temp_qa_path = "/tmp/qa_preprocessing.json"
        if os.path.exists(temp_qa_path):
            try:
                with open(temp_qa_path, 'r', encoding='utf-8') as f:
                    preprocessing_report = json.load(f)
                qa_reporter.merge_preprocessing_report(preprocessing_report)
                qa_reporter.add_success("Merged preprocessing QA report from /tmp/")
                logger.info("Successfully merged preprocessing QA report from /tmp/")
            except Exception as e:
                qa_reporter.add_warning(f"Failed to merge preprocessing QA report from /tmp/: {e}")
                logger.warning(f"Failed to merge preprocessing QA report from /tmp/: {e}")
        else:
            qa_reporter.add_warning("No preprocessing QA report found in either input/temp/ or /tmp/")
            logger.warning("No preprocessing QA report found in either input/temp/ or /tmp/")
    
    # Check for and merge component QA reports from both locations
    component_qa_files = [
        ("input/temp/qa_valueset_schemas.json", "/tmp/qa_valueset_schemas.json", "ValueSet schema generation"),
        ("input/temp/qa_logical_model_schemas.json", "/tmp/qa_logical_model_schemas.json", "Logical Model schema generation"), 
        ("input/temp/qa_jsonld_vocabularies.json", "/tmp/qa_jsonld_vocabularies.json", "JSON-LD vocabulary generation")
    ]
    
    for protected_path, temp_path, component_name in component_qa_files:
        # Try protected location first
        qa_file_path = protected_path if os.path.exists(protected_path) else temp_path
        
        if os.path.exists(qa_file_path):
            try:
                with open(qa_file_path, 'r', encoding='utf-8') as f:
                    component_report = json.load(f)
                qa_reporter.merge_preprocessing_report(component_report)
                qa_reporter.add_success(f"Merged {component_name} QA report from {qa_file_path}")
                logger.info(f"Successfully merged {component_name} QA report from {qa_file_path}")
            except Exception as e:
                qa_reporter.add_warning(f"Failed to merge {component_name} QA report: {e}")
                logger.warning(f"Failed to merge {component_name} QA report: {e}")
        else:
            qa_reporter.add_warning(f"No {component_name} QA report found")
            logger.info(f"No {component_name} QA report found at {protected_path} or {temp_path}")
    
    # Check if output directory exists and has content
    qa_reporter.add_file_expected(output_dir)
    if os.path.exists(output_dir):
        logger.info(f"Output directory exists with {len(os.listdir(output_dir))} items")
        qa_reporter.add_success(f"Output directory exists with {len(os.listdir(output_dir))} items")
        # Log a few sample files to help debugging
        all_files = os.listdir(output_dir)
        sample_files = all_files[:10]  # Show first 10 files
        logger.info(f"Sample files in output directory: {sample_files}")
        qa_reporter.add_success("Output directory contents sampled", {"sample_files": sample_files})
    else:
        logger.error(f"Output directory does not exist: {output_dir}")
        qa_reporter.add_error(f"Output directory does not exist: {output_dir}")
        
        # Save QA report even on failure
        qa_report = qa_reporter.finalize_report("failed")
        qa_output_path = os.path.join("output", "qa.json")  # Fallback location
        try:
            os.makedirs(os.path.dirname(qa_output_path), exist_ok=True)
            qa_reporter.save_to_file(qa_output_path)
        except:
            pass  # Don't fail if we can't save QA report
        
        sys.exit(1)
    
    # Initialize components
    logger.info("Initializing DAK API components...")
    qa_reporter.add_success("Initializing DAK API components")
    
    try:
        schema_detector = SchemaDetector(logger)
        openapi_detector = OpenAPIDetector(logger)
        openapi_wrapper = OpenAPIWrapper(logger)
        schema_doc_renderer = SchemaDocumentationRenderer(logger)
        hub_generator = DAKApiHubGenerator(logger)
        html_processor = HTMLProcessor(logger, output_dir)
        logger.info("Components initialized successfully")
        qa_reporter.add_success("All components initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        qa_reporter.add_error(f"Failed to initialize components: {e}")
        
        # Save QA report even on failure
        qa_report = qa_reporter.finalize_report("failed")
        qa_output_path = os.path.join(output_dir, "qa.json")
        qa_reporter.save_to_file(qa_output_path)
        sys.exit(1)
    
    # Find schema files
    logger.info("=== SCHEMA FILE DETECTION PHASE ===")
    qa_reporter.add_success("Starting schema file detection phase")
    
    try:
        schemas = schema_detector.find_schema_files(output_dir)
        logger.info(f"Schema detection completed - ValueSet: {len(schemas['valueset'])}, LogicalModel: {len(schemas['logical_model'])}, Other: {len(schemas['other'])}")
        qa_reporter.add_success("Schema detection completed", {
            "valueset_schemas": len(schemas['valueset']),
            "logical_model_schemas": len(schemas['logical_model']),
            "other_schemas": len(schemas['other'])
        })
        
        # Record found schema files
        for schema_path in schemas['valueset']:
            qa_reporter.add_file_processed(schema_path, "valueset_schema_detected")
        for schema_path in schemas['logical_model']:
            qa_reporter.add_file_processed(schema_path, "logical_model_schema_detected")
        for schema_path in schemas['other']:
            qa_reporter.add_file_processed(schema_path, "other_schema_detected")
            
    except Exception as e:
        logger.error(f"Schema detection failed: {e}")
        qa_reporter.add_error(f"Schema detection failed: {e}")
        schemas = {'valueset': [], 'logical_model': [], 'other': []}
    
    # Find JSON-LD vocabulary files
    logger.info("=== JSON-LD FILE DETECTION PHASE ===")
    jsonld_files = schema_detector.find_jsonld_files(output_dir)
    logger.info(f"JSON-LD detection completed - found {len(jsonld_files)} files")
    
    # Find existing OpenAPI files
    logger.info("=== OPENAPI FILE DETECTION PHASE ===")
    openapi_files = openapi_detector.find_openapi_files(openapi_dir)
    logger.info(f"OpenAPI detection completed - found {len(openapi_files)} files in source directory")
    
    # Also check for OpenAPI files in output directory (copied by IG publisher)
    output_openapi_dir = os.path.join(output_dir, "images", "openapi")
    output_openapi_files = openapi_detector.find_openapi_files(output_openapi_dir)
    logger.info(f"Found {len(output_openapi_files)} existing OpenAPI files in output directory")
    
    # Extract existing HTML content from OpenAPI documentation
    logger.info("=== EXISTING OPENAPI HTML CONTENT DETECTION ===")
    existing_openapi_html_content = openapi_detector.find_existing_html_content(openapi_dir)
    if existing_openapi_html_content:
        logger.info("Found existing OpenAPI HTML content that will be incorporated into DAK API hub")
    else:
        # Also try the output directory location
        existing_openapi_html_content = openapi_detector.find_existing_html_content(output_openapi_dir)
        if existing_openapi_html_content:
            logger.info("Found existing OpenAPI HTML content in output directory that will be incorporated into DAK API hub")
        else:
            logger.info("No existing OpenAPI HTML content found")
    
    # Generate schema documentation
    logger.info("=== SCHEMA DOCUMENTATION GENERATION PHASE ===")
    schema_docs = {
        'valueset': [],
        'logical_model': []
    }
    
    # Check if dak-api.html exists in output directory (required for content injection)
    # For post-check phase, Jekyll has already run so we look for the final HTML
    dak_api_html_path = os.path.join(html_target_dir, "dak-api.html")

    logger.info(f"Current working directory: {os.getcwd()}")
    logger.info(f"HTML target directory: {html_target_dir}")
    logger.info(f"Checking for dak-api.html at: {dak_api_html_path}")

    if os.path.exists(dak_api_html_path):
        logger.info(f"✅ Found dak-api.html in output directory")
    else:
        # Log directory contents for debugging
        if os.path.exists(html_target_dir):
            all_files = os.listdir(html_target_dir)
            html_files = [f for f in all_files if f.endswith('.html')]
            logger.info(f"Total files in HTML target directory: {len(all_files)}")
            logger.info(f"HTML files: {len(html_files)} found")
            logger.info(f"Files containing 'dak': {[f for f in all_files if 'dak' in f.lower()]}")
        logger.error(f"❌ Cannot find dak-api.html in output directory")
        logger.error("Make sure the IG publisher ran first and created dak-api.html from the dak-api.md placeholder.")
        logger.error("Exiting with error code 1")
        sys.exit(1)

    template_file = dak_api_html_path
    template_size = os.path.getsize(template_file)
    logger.info(f"Template file: {template_file}")
    logger.info(f"Template file size: {template_size} bytes")

    # Check if the file has the placeholder div for injection
    try:
        with open(template_file, 'r', encoding='utf-8') as f:
            template_content = f.read()
        if 'id="dak-api-content-placeholder"' in template_content:
            logger.info("✅ Found DAK API placeholder div for content injection")
        elif '<!-- DAK_API_CONTENT -->' in template_content:
            logger.info("✅ Found legacy DAK_API_CONTENT comment marker for content injection")
        else:
            logger.warning("⚠️ No DAK API placeholder found - content injection may fail")
            logger.warning("Looking for: <div id=\"dak-api-content-placeholder\"> or <!-- DAK_API_CONTENT -->")
            sample_content = template_content[:500] if len(template_content) > 500 else template_content
            logger.info(f"Sample content: {sample_content}")
    except Exception as e:
        logger.error(f"Error reading template file for validation: {e}")
    
    # Process ValueSet schemas (collect metadata and generate OpenAPI wrappers)
    logger.info(f"Processing {len(schemas['valueset'])} ValueSet schemas...")
    for i, schema_path in enumerate(schemas['valueset'], 1):
        logger.info(f"Processing ValueSet schema {i}/{len(schemas['valueset'])}: {schema_path}")
        try:
            # Load schema to get metadata
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            schema_filename = os.path.basename(schema_path)
            schema_name = schema_filename.replace('.schema.json', '')
            logger.info(f"  Schema name: {schema_name}")
            logger.info(f"  Schema title: {schema.get('title', 'No title')}")
            
            # Generate OpenAPI wrapper for this ValueSet schema
            openapi_wrapper_path = openapi_wrapper.create_wrapper_for_schema(schema_path, 'valueset', output_dir)
            if openapi_wrapper_path:
                logger.info(f"  ✅ Created OpenAPI wrapper: {openapi_wrapper_path}")
            else:
                logger.warning(f"  ⚠️ Failed to create OpenAPI wrapper for {schema_name}")
            
            # Collect metadata for the hub documentation
            title = schema.get('title', f"{schema_name} Schema Documentation")
            
            # Individual schemas should link to their IG-generated HTML files
            html_filename = f"{schema_name}.html"
            
            # Collect additional file references
            schema_filename = os.path.basename(schema_path)
            displays_filename = f"{schema_name}.displays.json"
            openapi_filename = f"{schema_name}.openapi.json"
            jsonld_filename = f"{schema_name}.jsonld"
            
            # Check if additional files exist
            displays_path = os.path.join(output_dir, displays_filename)
            openapi_path = os.path.join(output_dir, openapi_filename)
            jsonld_path = os.path.join(output_dir, jsonld_filename)
            
            schema_doc_entry = {
                'title': title,
                'description': schema.get('description', 'ValueSet schema documentation'),
                'html_file': html_filename,
                'schema_file': schema_filename
            }
            
            # Add displays file if it exists
            if os.path.exists(displays_path):
                schema_doc_entry['displays_file'] = displays_filename
                logger.info(f"  Found displays file: {displays_filename}")
            
            # Add OpenAPI file if it exists
            if os.path.exists(openapi_path):
                schema_doc_entry['openapi_file'] = openapi_filename
                logger.info(f"  Found OpenAPI file: {openapi_filename}")
                
            # Add JSON-LD file if it exists  
            if os.path.exists(jsonld_path):
                schema_doc_entry['jsonld_file'] = jsonld_filename
                logger.info(f"  Found JSON-LD file: {jsonld_filename}")
            
            schema_docs['valueset'].append(schema_doc_entry)
            
            logger.info(f"  ✅ Added ValueSet schema to hub documentation: {schema_name}")
                
        except Exception as e:
            logger.error(f"  ❌ Error processing ValueSet schema {schema_path}: {e}")
            import traceback
            logger.error(f"  Traceback: {traceback.format_exc()}")
    
    # Process Logical Model schemas (collect metadata and generate OpenAPI wrappers)
    logger.info(f"Processing {len(schemas['logical_model'])} Logical Model schemas...")
    for i, schema_path in enumerate(schemas['logical_model'], 1):
        logger.info(f"Processing Logical Model schema {i}/{len(schemas['logical_model'])}: {schema_path}")
        try:
            # Load schema to get metadata
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            schema_filename = os.path.basename(schema_path)
            schema_name = schema_filename.replace('.schema.json', '')
            logger.info(f"  Schema name: {schema_name}")
            logger.info(f"  Schema title: {schema.get('title', 'No title')}")
            
            # Generate OpenAPI wrapper for this Logical Model schema
            openapi_wrapper_path = openapi_wrapper.create_wrapper_for_schema(schema_path, 'logical_model', output_dir)
            if openapi_wrapper_path:
                logger.info(f"  ✅ Created OpenAPI wrapper: {openapi_wrapper_path}")
            else:
                logger.warning(f"  ⚠️ Failed to create OpenAPI wrapper for {schema_name}")
            
            # Collect metadata for the hub documentation
            title = schema.get('title', f"{schema_name} Schema Documentation")
            
            # Individual schemas should link to their IG-generated HTML files
            html_filename = f"{schema_name}.html"
            
            # Collect additional file references
            schema_filename = os.path.basename(schema_path)
            displays_filename = f"{schema_name}.displays.json"
            openapi_filename = f"{schema_name}.openapi.json"
            
            # Check if additional files exist
            displays_path = os.path.join(output_dir, displays_filename)
            openapi_path = os.path.join(output_dir, openapi_filename)
            
            schema_doc_entry = {
                'title': title,
                'description': schema.get('description', 'Logical Model schema documentation'),
                'html_file': html_filename,
                'schema_file': schema_filename
            }
            
            # Add displays file if it exists
            if os.path.exists(displays_path):
                schema_doc_entry['displays_file'] = displays_filename
                logger.info(f"  Found displays file: {displays_filename}")
            
            # Add OpenAPI file if it exists
            if os.path.exists(openapi_path):
                schema_doc_entry['openapi_file'] = openapi_filename
                logger.info(f"  Found OpenAPI file: {openapi_filename}")
            
            schema_docs['logical_model'].append(schema_doc_entry)
            
            logger.info(f"  ✅ Added Logical Model schema to hub documentation: {schema_name}")
                
        except Exception as e:
            logger.error(f"  ❌ Error processing Logical Model schema {schema_path}: {e}")
            import traceback
            logger.error(f"  Traceback: {traceback.format_exc()}")
    
    # Initialize OpenAPI docs list (will be populated after generation)
    openapi_docs = []
    
    # Create enumeration endpoints for ValueSets and LogicalModels
    logger.info("=== ENUMERATION ENDPOINT CREATION PHASE ===")
    enumeration_docs = []
    
    # Create ValueSets enumeration endpoint if we have ValueSet schemas
    if schemas['valueset']:
        logger.info(f"Creating ValueSets enumeration endpoint for {len(schemas['valueset'])} schemas...")
        valueset_enum_path = hub_generator.create_enumeration_schema('valueset', schemas['valueset'], output_dir)
        if valueset_enum_path:
            logger.info(f"Created ValueSets enumeration schema: {valueset_enum_path}")
            
            # Create OpenAPI wrapper for the enumeration endpoint
            enum_openapi_path = openapi_wrapper.create_enumeration_wrapper(valueset_enum_path, 'valueset', output_dir)
            if enum_openapi_path:
                logger.info(f"✅ Created ValueSets enumeration OpenAPI wrapper: {enum_openapi_path}")
            else:
                logger.warning("⚠️ Failed to create ValueSets enumeration OpenAPI wrapper")
            
            # Add to enumeration docs (IG publisher should create the HTML)
            enumeration_docs.append({
                'title': 'ValueSets.schema.json',
                'description': 'Enumeration of all available ValueSet schemas',
                'html_file': 'ValueSets-enumeration.html',  # This should be created by IG publisher
                'type': 'enumeration-valueset'
            })
            logger.info(f"✅ Added ValueSets enumeration to hub documentation")
        else:
            logger.error("❌ Failed to create ValueSets enumeration schema")
    else:
        logger.info("No ValueSet schemas found, skipping ValueSets enumeration endpoint")
    
    # Create LogicalModels enumeration endpoint if we have LogicalModel schemas  
    if schemas['logical_model']:
        logger.info(f"Creating LogicalModels enumeration endpoint for {len(schemas['logical_model'])} schemas...")
        logicalmodel_enum_path = hub_generator.create_enumeration_schema('logical_model', schemas['logical_model'], output_dir)
        if logicalmodel_enum_path:
            logger.info(f"Created LogicalModels enumeration schema: {logicalmodel_enum_path}")
            
            # Create OpenAPI wrapper for the enumeration endpoint
            enum_openapi_path = openapi_wrapper.create_enumeration_wrapper(logicalmodel_enum_path, 'logical_model', output_dir)
            if enum_openapi_path:
                logger.info(f"✅ Created LogicalModels enumeration OpenAPI wrapper: {enum_openapi_path}")
            else:
                logger.warning("⚠️ Failed to create LogicalModels enumeration OpenAPI wrapper")
            
            # Add to enumeration docs (IG publisher should create the HTML)
            enumeration_docs.append({
                'title': 'LogicalModels.schema.json',
                'description': 'Enumeration of all available Logical Model schemas',
                'html_file': 'LogicalModels-enumeration.html',  # This should be created by IG publisher
                'type': 'enumeration-logicalmodel'
            })
            logger.info(f"✅ Added LogicalModels enumeration to hub documentation")
        else:
            logger.error("❌ Failed to create LogicalModels enumeration schema")
    else:
        logger.info("No Logical Model schemas found, skipping LogicalModels enumeration endpoint")
    
    # Process JSON-LD vocabulary files
    logger.info("=== JSON-LD VOCABULARY PROCESSING PHASE ===")
    jsonld_docs = []
    logger.info(f"Processing {len(jsonld_files)} JSON-LD vocabulary files...")
    for i, jsonld_path in enumerate(jsonld_files, 1):
        logger.info(f"Processing JSON-LD vocabulary {i}/{len(jsonld_files)}: {jsonld_path}")
        try:
            # Load JSON-LD vocabulary to get metadata
            with open(jsonld_path, 'r', encoding='utf-8') as f:
                jsonld_vocab = json.load(f)
            
            jsonld_filename = os.path.basename(jsonld_path)
            logger.info(f"  Filename: {jsonld_filename}")
            
            # Extract title and description from the enumeration class in the @graph
            title = jsonld_filename
            description = "JSON-LD vocabulary for ValueSet enumeration"
            
            if '@graph' in jsonld_vocab and isinstance(jsonld_vocab['@graph'], list):
                logger.info(f"  Found @graph with {len(jsonld_vocab['@graph'])} items")
                for item in jsonld_vocab['@graph']:
                    if isinstance(item, dict) and item.get('type') == 'schema:Enumeration':
                        logger.info(f"  Found enumeration class: {item.get('id', 'no ID')}")
                        if 'name' in item:
                            title = f"{item['name']} JSON-LD Vocabulary"
                            logger.info(f"  Updated title to: {title}")
                        if 'comment' in item:
                            description = item['comment']
                            logger.info(f"  Updated description to: {description}")
                        break
            
            jsonld_docs.append({
                'title': title,
                'description': description,
                'filename': jsonld_filename
            })
            
            logger.info(f"  ✅ Added JSON-LD vocabulary to documentation: {jsonld_filename}")
            
        except Exception as e:
            logger.error(f"  ❌ Error processing JSON-LD vocabulary {jsonld_path}: {e}")
            import traceback
            logger.error(f"  Traceback: {traceback.format_exc()}")
    
    # Process all OpenAPI files (existing + generated) for OpenAPI documentation section
    logger.info("=== OPENAPI DOCUMENTATION COLLECTION PHASE ===")
    
    # Re-scan for all OpenAPI files now that generated wrappers exist
    generated_openapi_files = openapi_detector.find_openapi_files(output_dir)
    logger.info(f"Found {len(generated_openapi_files)} generated OpenAPI files in output directory")
    
    # Combine and deduplicate OpenAPI files by filename
    all_openapi_files = []
    seen_filenames = set()
    
    # Add generated files first (they take priority)
    for file_path in generated_openapi_files:
        filename = os.path.basename(file_path)
        if filename not in seen_filenames:
            all_openapi_files.append(file_path)
            seen_filenames.add(filename)
    
    # Add existing files from source directory if not already seen
    if openapi_files:
        for file_path in openapi_files:
            filename = os.path.basename(file_path)
            if filename not in seen_filenames:
                all_openapi_files.append(file_path)
                seen_filenames.add(filename)
        logger.info(f"Added {len([f for f in openapi_files if os.path.basename(f) not in seen_filenames])} new existing OpenAPI files from source")
    
    # Add existing files from output directory (copied by IG publisher) if not already seen
    if output_openapi_files:
        for file_path in output_openapi_files:
            filename = os.path.basename(file_path)
            if filename not in seen_filenames:
                all_openapi_files.append(file_path)
                seen_filenames.add(filename)
        logger.info(f"Added {len([f for f in output_openapi_files if os.path.basename(f) not in seen_filenames])} existing OpenAPI files from output")
    
    logger.info(f"Total unique OpenAPI files: {len(all_openapi_files)}")
    
    # Process all unique OpenAPI files for documentation
    for openapi_path in all_openapi_files:
        try:
            openapi_filename = os.path.basename(openapi_path)
            logger.info(f"Processing OpenAPI file: {openapi_filename}")
            
            # Determine the correct relative path based on file location
            if "images/openapi" in openapi_path:
                relative_path = f"images/openapi/{openapi_filename}"
            else:
                relative_path = openapi_filename
            
            # Create cleaner title from filename
            clean_name = openapi_filename.replace('.openapi.json', '').replace('.openapi.yaml', '').replace('.yaml', '').replace('.json', '')
            
            # Generate individual OpenAPI documentation by injecting into existing HTML
            logger.info(f"  Injecting OpenAPI documentation content for: {clean_name}")
            openapi_html_filename = schema_doc_renderer.inject_into_html(openapi_path, output_dir, f"{clean_name} API Documentation")
            if openapi_html_filename:
                logger.info(f"  ✅ Generated OpenAPI documentation: {openapi_html_filename}")
            else:
                logger.warning(f"  ⚠️ Failed to generate OpenAPI documentation for {clean_name}")
            
            openapi_docs.append({
                'title': f"{clean_name} API",
                'description': f"OpenAPI specification for {clean_name}",
                'file_path': relative_path,  # Direct link to JSON/YAML file
                'filename': openapi_filename,
                'html_file': openapi_html_filename if openapi_html_filename else None
            })
            
            logger.info(f"  ✅ Added to OpenAPI documentation: {clean_name}")
            
        except Exception as e:
            logger.error(f"  ❌ Error processing OpenAPI file {openapi_path}: {e}")
    
    logger.info(f"OpenAPI documentation collection completed - {len(openapi_docs)} unique files documented")
    
    # Log summary before hub generation
    logger.info("=== DOCUMENTATION SUMMARY ===")
    logger.info(f"ValueSet schema docs: {len(schema_docs['valueset'])}")
    logger.info(f"Logical Model schema docs: {len(schema_docs['logical_model'])}")
    logger.info(f"Enumeration endpoints: {len(enumeration_docs)}")
    logger.info(f"JSON-LD vocabularies: {len(jsonld_docs)}")
    logger.info(f"OpenAPI docs: {len(openapi_docs)}")
    
    qa_reporter.add_success("Documentation summary completed", {
        "valueset_schema_docs": len(schema_docs['valueset']),
        "logical_model_schema_docs": len(schema_docs['logical_model']),
        "enumeration_endpoints": len(enumeration_docs),
        "jsonld_vocabularies": len(jsonld_docs),
        "openapi_docs": len(openapi_docs)
    })
    
    total_content_items = len(schema_docs['valueset']) + len(schema_docs['logical_model']) + len(enumeration_docs) + len(jsonld_docs) + len(openapi_docs)
    if total_content_items == 0:
        logger.warning("⚠️ No content items found to document! The DAK API hub will be empty.")
        qa_reporter.add_warning("No content items found to document! The DAK API hub will be empty.")
    else:
        logger.info(f"Total content items to include in hub: {total_content_items}")
        qa_reporter.add_success(f"Total content items to include in hub: {total_content_items}")
    
    # Post-process the DAK API hub
    logger.info("=== DAK API HUB POST-PROCESSING PHASE ===")
    qa_reporter.add_success("Starting DAK API hub post-processing phase")
    
    try:
        success = hub_generator.post_process_dak_api_html(output_dir, schema_docs, openapi_docs, enumeration_docs, jsonld_docs, existing_openapi_html_content, html_target_dir)
        
        if success:
            total_docs = len(schema_docs['valueset']) + len(schema_docs['logical_model']) + len(openapi_docs) + len(enumeration_docs) + len(jsonld_docs)
            logger.info(f"🎉 Successfully post-processed DAK API hub with {total_docs} documentation pages")
            logger.info("=== FINAL SUMMARY ===")
            logger.info(f"✅ ValueSet schema pages: {len(schema_docs['valueset'])}")
            logger.info(f"✅ Logical Model schema pages: {len(schema_docs['logical_model'])}")
            logger.info(f"✅ Enumeration endpoint pages: {len(enumeration_docs)}")
            logger.info(f"✅ JSON-LD vocabulary references: {len(jsonld_docs)}")
            logger.info(f"✅ OpenAPI documentation pages: {len(openapi_docs)}")
            logger.info(f"✅ Total documentation pages: {total_docs}")
            
            qa_reporter.add_success("DAK API hub post-processing completed successfully", {
                "total_documentation_pages": total_docs,
                "valueset_pages": len(schema_docs['valueset']),
                "logical_model_pages": len(schema_docs['logical_model']),
                "enumeration_pages": len(enumeration_docs),
                "jsonld_references": len(jsonld_docs),
                "openapi_pages": len(openapi_docs)
            })
        else:
            logger.error("❌ Failed to post-process DAK API hub")
            qa_reporter.add_error("Failed to post-process DAK API hub - check detailed logs for specific errors")
            
    except Exception as e:
        logger.error(f"❌ Exception during DAK API hub post-processing: {e}")
        qa_reporter.add_error(f"Exception during DAK API hub post-processing: {e}")
        success = False
    
    # Always generate and save QA report, regardless of success/failure
    qa_status = "completed" if success else "completed_with_errors"
    qa_report = qa_reporter.finalize_report(qa_status)
    
    # Save final merged QA report to output directory
    # This will either merge with existing IG publisher QA or create a new comprehensive report
    qa_output_path = os.path.join(output_dir, "qa.json")
    if qa_reporter.save_to_file(qa_output_path):
        logger.info(f"Final merged QA report saved to {qa_output_path}")
        qa_reporter.add_success(f"Final merged QA report saved to {qa_output_path}")
        
        # Log details about the merged report structure
        if qa_reporter.ig_publisher_qa:
            logger.info("QA report successfully merged with existing FHIR IG publisher QA file")
        else:
            logger.info("QA report created as new comprehensive DAK API QA file")
    else:
        logger.warning(f"Failed to save QA report to {qa_output_path}")
        
        # Try to save to backup location if main save fails
        backup_qa_path = os.path.join(output_dir, "dak-api-qa.json")
        if qa_reporter.save_to_file(backup_qa_path):
            logger.info(f"QA report saved to backup location: {backup_qa_path}")
        else:
            logger.error("Failed to save QA report to any location")
    
    # Log final QA summary (using qa_reporter.report which has the most up-to-date summary)
    logger.info("=== QA REPORT SUMMARY ===")
    logger.info(f"Total successes: {len(qa_reporter.report['details']['successes'])}")
    logger.info(f"Total warnings: {len(qa_reporter.report['details']['warnings'])}")
    logger.info(f"Total errors: {len(qa_reporter.report['details']['errors'])}")
    logger.info(f"Files processed: {len(qa_reporter.report['details']['files_processed'])}")
    logger.info(f"Files expected: {len(qa_reporter.report['details']['files_expected'])}")
    logger.info(f"Files missing: {len(qa_reporter.report['details']['files_missing'])}")
    
    # Exit with success code (0) regardless of errors - QA report contains all details
    # This prevents the workflow from failing while still providing comprehensive error reporting
    if success:
        logger.info("✅ DAK API documentation generation completed successfully")
    else:
        logger.warning("⚠️ DAK API documentation generation completed with errors - see QA report for details")

    # DEBUG: Pause for inspection if DEBUG_PAUSE environment variable is set
    # To enable:  set DEBUG_PAUSE=1  (Windows) or export DEBUG_PAUSE=1 (Linux/Mac)
    # To disable: set DEBUG_PAUSE=   (Windows) or unset DEBUG_PAUSE (Linux/Mac)
    if os.environ.get('DEBUG_PAUSE'):
        logger.info("=" * 60)
        logger.info("DEBUG_PAUSE is set - pausing for file inspection")
        logger.info(f"Output directory: {output_dir}")
        logger.info(f"Working directory: {os.getcwd()}")
        logger.info("=" * 60)
        input("Press ENTER to continue (or Ctrl+C to abort)...")
        logger.info("Continuing after pause...")

    logger.info("Exiting with success code 0 - check qa.json for detailed status")
    sys.exit(0)


if __name__ == "__main__":
    main()