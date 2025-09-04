# Schema File Renaming

This directory contains scripts to rename logical model JSON schema files to match FHIR canonical naming conventions.

## Purpose

The FHIR IG Publisher generates JSON schemas for logical models with names like `HCert.schema.json`. However, to better align with FHIR canonical naming conventions, these should be named `StructureDefinition-HCert.schema.json`.

## Scripts

- `rename_schemas.sh` - Unix/Linux/Mac script
- `rename_schemas.bat` - Windows script

## Logical Models

The following logical models are processed:
- HCert
- SchemeInformation  
- CWT
- COSEHeader
- CWTPayload

## Integration

These scripts are automatically called by the build process:
- `_genonce.sh` calls the Unix script
- `_genonce.bat` calls the Windows script

## Manual Usage

To run manually:
```bash
# Unix/Linux/Mac
./input/scripts/rename_schemas.sh [output_directory]

# Windows  
input\scripts\rename_schemas.bat [output_directory]
```

If no output directory is specified, `output` is used as the default.