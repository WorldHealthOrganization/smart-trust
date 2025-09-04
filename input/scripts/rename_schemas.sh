#!/bin/bash

# Script to rename logical model schema files to match FHIR canonical naming convention
# Changes from [name].schema.json to StructureDefinition-[name].schema.json

echo "Renaming logical model schema files..."

# Directory where the built IG output is located
OUTPUT_DIR="${1:-output}"

if [ ! -d "$OUTPUT_DIR" ]; then
    echo "Output directory $OUTPUT_DIR not found. Skipping schema renaming."
    exit 0
fi

# List of logical model IDs that need to be renamed
LOGICAL_MODELS=("HCert" "SchemeInformation" "CWT" "COSEHeader" "CWTPayload")

for model in "${LOGICAL_MODELS[@]}"; do
    OLD_FILE="$OUTPUT_DIR/${model}.schema.json"
    NEW_FILE="$OUTPUT_DIR/StructureDefinition-${model}.schema.json"
    
    if [ -f "$OLD_FILE" ]; then
        if [ -f "$NEW_FILE" ]; then
            echo "Target file $NEW_FILE already exists, removing old file $OLD_FILE"
            rm "$OLD_FILE"
        else
            echo "Renaming $OLD_FILE to $NEW_FILE"
            mv "$OLD_FILE" "$NEW_FILE"
        fi
    else
        echo "Schema file $OLD_FILE not found, skipping..."
    fi
done

echo "Schema renaming completed."