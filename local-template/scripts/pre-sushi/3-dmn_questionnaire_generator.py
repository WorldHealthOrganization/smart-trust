#!/usr/bin/env python3
"""
DMN to FHIR Questionnaire Generator

This module generates FHIR Questionnaire FSH files from DMN (Decision Model and Notation) files.
For each DMN file, it extracts input columns and their possible values to create questionnaires
with dropdown options.

Author: SMART Guidelines Team
"""

import glob
import logging
import re
from pathlib import Path
from typing import Dict, List, Set, Optional

import lxml.etree as ET


class DMNQuestionnaireGenerator:
    """Generator for FHIR Questionnaire FSH files from DMN files."""

    def __init__(self, logger: Optional[logging.Logger] = None):
        """Initialize the generator."""
        self.logger = logger or logging.getLogger(__name__)
        # Register DMN namespace for XML parsing
        ET.register_namespace('dmn', "https://www.omg.org/spec/DMN/20240513/MODEL/")
        self.dmn_namespace = {"dmn": "https://www.omg.org/spec/DMN/20240513/MODEL/"}

    def parse_dmn_file(self, dmn_path: Path) -> Optional[Dict]:
        """
        Parse a DMN file and extract input definitions and their possible values.
        
        Args:
            dmn_path: Path to the DMN file
            
        Returns:
            Dictionary containing parsed DMN data or None if parsing failed
        """
        try:
            self.logger.info(f"Parsing DMN file: {dmn_path}")
            
            with open(dmn_path, "rb") as f:
                dmn_doc = ET.parse(f)
            
            root = dmn_doc.getroot()
            
            # Get decision ID and label
            decision = root.find(".//dmn:decision", self.dmn_namespace)
            if decision is None:
                self.logger.warning(f"No decision element found in {dmn_path}")
                return None
            
            decision_id = decision.get("id")
            decision_label = decision.get("label", decision_id)
            
            # Get business rule question
            question_elem = decision.find(".//dmn:question", self.dmn_namespace)
            business_rule = question_elem.text if question_elem is not None else decision_label
            
            # Get inputs
            inputs = root.findall(".//dmn:input", self.dmn_namespace)
            input_definitions = []
            
            for i, input_elem in enumerate(inputs):
                input_id = input_elem.get("id", f"input_{i}")
                input_label = input_elem.get("label", f"Input {i+1}")
                
                # Extract input expression text for additional context
                input_expr = input_elem.find(".//dmn:text", self.dmn_namespace)
                input_expr_text = input_expr.text if input_expr is not None else ""
                
                input_definitions.append({
                    "id": input_id,
                    "label": input_label,
                    "expression": input_expr_text,
                    "position": i
                })
            
            # Get all input entry values for each input position
            rules = root.findall(".//dmn:rule", self.dmn_namespace)
            input_values = [set() for _ in range(len(input_definitions))]
            
            for rule in rules:
                input_entries = rule.findall(".//dmn:inputEntry", self.dmn_namespace)
                for i, entry in enumerate(input_entries):
                    if i < len(input_values):
                        text_elem = entry.find(".//dmn:text", self.dmn_namespace)
                        if text_elem is not None and text_elem.text:
                            # Skip empty values and dashes
                            value = text_elem.text.strip()
                            if value and value != "–" and value != "-":
                                input_values[i].add(value)
            
            # Convert sets to sorted lists
            for i in range(len(input_values)):
                input_values[i] = sorted(list(input_values[i]))
            
            return {
                "decision_id": decision_id,
                "decision_label": decision_label,
                "business_rule": business_rule,
                "inputs": input_definitions,
                "input_values": input_values
            }
            
        except Exception as e:
            self.logger.error(f"Failed to parse DMN file {dmn_path}: {e}")
            return None

    def generate_questionnaire_fsh(self, dmn_data: Dict) -> str:
        """
        Generate FHIR Questionnaire FSH content from parsed DMN data.
        
        Args:
            dmn_data: Parsed DMN data dictionary
            
        Returns:
            FSH content string
        """
        decision_id = dmn_data["decision_id"]
        business_rule = dmn_data["business_rule"]
        inputs = dmn_data["inputs"]
        input_values = dmn_data["input_values"]
        
        # Generate questionnaire header using base Questionnaire resource
        # This avoids the SGQuestionnaire profile requirements that need actor references
        fsh_content = f"""Instance: {decision_id}Questionnaire
InstanceOf: Questionnaire
Title: "Questionnaire for {business_rule}"
Description: "Auto-generated questionnaire for decision table {decision_id}"
Usage: #definition

* name = "{decision_id}Questionnaire"
* title = "{business_rule}"
* version = "1.0.0"
* status = #draft
* experimental = true
* publisher = "World Health Organization (WHO)"
* description = "This questionnaire supports the decision logic for: {business_rule}"

"""
        
        # Generate question items
        for i, input_def in enumerate(inputs):
            input_label = input_def["label"]
            input_id = input_def["id"]
            values = input_values[i] if i < len(input_values) else []
            
            # Clean up the input ID for linkId
            clean_id = re.sub(r'[^a-zA-Z0-9._-]', '_', input_id)
            
            fsh_content += f"""* item[+]
  * linkId = "{clean_id}"
  * text = "{input_label}"
  * type = #choice
  * required = false
"""
            
            # Add answer options if we have values
            if values:
                for j, value in enumerate(values):
                    # Escape quotes in the value
                    escaped_value = value.replace('"', '\\"')
                    fsh_content += f"""  * answerOption[{j}].valueString = "{escaped_value}"
"""
            else:
                # If no specific values found, add a generic text input
                fsh_content = fsh_content.replace("type = #choice", "type = #string")
                fsh_content = fsh_content.replace("  * answerOption[0].valueString = \"", "")
            
            fsh_content += "\n"
        
        return fsh_content

    def generate_questionnaires_from_dmn_files(self, dmn_dir: Path, output_dir: Path) -> bool:
        """
        Generate questionnaire FSH files for all DMN files in the specified directory.
        
        Args:
            dmn_dir: Directory containing DMN files
            output_dir: Directory to save FSH questionnaire files
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not dmn_dir.exists():
                self.logger.warning(f"DMN directory not found: {dmn_dir}")
                return True  # Not an error if no DMN files exist
            
            dmn_files = list(dmn_dir.glob("*.dmn"))
            if not dmn_files:
                self.logger.info(f"No DMN files found in {dmn_dir}")
                return True
            
            self.logger.info(f"Found {len(dmn_files)} DMN files to process")
            
            # Ensure output directory exists
            output_dir.mkdir(parents=True, exist_ok=True)
            
            success_count = 0
            for dmn_file in dmn_files:
                dmn_data = self.parse_dmn_file(dmn_file)
                if dmn_data:
                    fsh_content = self.generate_questionnaire_fsh(dmn_data)
                    
                    # Save FSH file
                    output_file = output_dir / f"{dmn_data['decision_id']}Questionnaire.fsh"
                    with open(output_file, "w", encoding="utf-8") as f:
                        f.write(fsh_content)
                    
                    self.logger.info(f"Generated questionnaire FSH: {output_file}")
                    success_count += 1
                else:
                    self.logger.warning(f"Failed to process DMN file: {dmn_file}")
            
            self.logger.info(f"Successfully generated {success_count} questionnaire FSH files")
            return success_count > 0 or len(dmn_files) == 0
            
        except Exception as e:
            self.logger.error(f"Failed to generate questionnaires: {e}")
            return False


def main():
    """Main function for standalone execution."""
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    logger = logging.getLogger(__name__)

    # Check if first argument is an IG root path (from template execution)
    # If it doesn't start with '--', treat it as the IG root
    ig_root = Path(".")
    remaining_args = sys.argv[1:]

    if len(sys.argv) > 1 and not sys.argv[1].startswith('--'):
        ig_root = Path(sys.argv[1])
        remaining_args = sys.argv[2:]
        logger.info(f"IG root directory: {ig_root.absolute()}")

    parser = argparse.ArgumentParser(
        description="Generate FHIR Questionnaire FSH files from DMN files"
    )
    parser.add_argument(
        "--dmn-dir",
        type=Path,
        default=None,
        help="Directory containing DMN files (default: <ig_root>/input/dmn)"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory to save questionnaire FSH files (default: <ig_root>/input/fsh/questionnaires)"
    )

    args = parser.parse_args(remaining_args)

    # Resolve paths relative to IG root
    dmn_dir = args.dmn_dir if args.dmn_dir else (ig_root / "input" / "dmn")
    output_dir = args.output_dir if args.output_dir else (ig_root / "input" / "fsh" / "questionnaires")

    logger.info(f"DMN directory: {dmn_dir}")
    logger.info(f"Output directory: {output_dir}")

    generator = DMNQuestionnaireGenerator(logger)
    success = generator.generate_questionnaires_from_dmn_files(dmn_dir, output_dir)

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()