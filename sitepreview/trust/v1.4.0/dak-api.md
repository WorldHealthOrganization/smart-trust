# DAK API Documentation Hub - WHO SMART Trust v1.4.0

* [**Table of Contents**](toc.md)
* **DAK API Documentation Hub**

## DAK API Documentation Hub

# DAK API Documentation Hub

This page provides access to Data Access Kit (DAK) API documentation and schemas.

## Table of Contents

1. [DAK API Documentation Hub](#dak-api-documentation-hub)

### API Enumeration Endpoints

These endpoints provide lists of all available schemas and vocabularies of each type:

#### LogicalModels.schema.json

Enumeration of all available Logical Model schemas

##### Available Endpoints:

* [StructureDefinition-CWT.schema.json](schemas/StructureDefinition-CWT.schema.json) - JSON Schema for CBOR Web Token (CWT) Claim
* [StructureDefinition-COSEHeader.schema.json](schemas/StructureDefinition-COSEHeader.schema.json) - JSON Schema for COSE Headers (DRAFT)
* [StructureDefinition-CWTPayload.schema.json](schemas/StructureDefinition-CWTPayload.schema.json) - JSON Schema for CBOR Web Token (CWT) Payload (Common)
* [StructureDefinition-SchemeInformation.schema.json](schemas/StructureDefinition-SchemeInformation.schema.json) - JSON Schema for Scheme Information
* [StructureDefinition-HCert.schema.json](schemas/StructureDefinition-HCert.schema.json) - JSON Schema for Health Certificate

### Logical Model Schemas (5 available)

JSON Schema definitions for FHIR Logical Models, defining structured data elements and their relationships:

#### CBOR Web Token (CWT) Claim

Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml

[🩺 FHIR](StructureDefinition-CWT.md)
[📄 JSON Schema](schemas/StructureDefinition-CWT.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-CWT.openapi.json)

#### COSE Headers (DRAFT)

Data elements for COSE Headers https://www.iana.org/assignments/cose/cose.xhtml#header-parameters

[🩺 FHIR](StructureDefinition-COSEHeader.md)
[📄 JSON Schema](schemas/StructureDefinition-COSEHeader.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-COSEHeader.openapi.json)

#### CBOR Web Token (CWT) Payload (Common)

Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml 

[🩺 FHIR](StructureDefinition-CWTPayload.md)
[📄 JSON Schema](schemas/StructureDefinition-CWTPayload.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-CWTPayload.openapi.json)

#### Scheme Information

Logical Model for Information on the trusted list and its issuing scheme

[🩺 FHIR](StructureDefinition-SchemeInformation.md)
[📄 JSON Schema](schemas/StructureDefinition-SchemeInformation.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-SchemeInformation.openapi.json)

#### Health Certificate

Logical Model for the HCERT

[🩺 FHIR](StructureDefinition-HCert.md)
[📄 JSON Schema](schemas/StructureDefinition-HCert.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-HCert.openapi.json)

### OpenAPI Documentation

Complete API specification documentation for all available endpoints:

#### StructureDefinition-CWT Endpoints

API endpoints for CBOR Web Token (CWT) Claim

[📄 JSON Schema](schemas/StructureDefinition-CWT.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-CWT.openapi.json)

#### StructureDefinition-COSEHeader Endpoints

API endpoints for COSE Headers (DRAFT)

[📄 JSON Schema](schemas/StructureDefinition-COSEHeader.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-COSEHeader.openapi.json)

#### StructureDefinition-CWTPayload Endpoints

API endpoints for CBOR Web Token (CWT) Payload (Common)

[📄 JSON Schema](schemas/StructureDefinition-CWTPayload.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-CWTPayload.openapi.json)

#### StructureDefinition-SchemeInformation Endpoints

API endpoints for Scheme Information

[📄 JSON Schema](schemas/StructureDefinition-SchemeInformation.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-SchemeInformation.openapi.json)

#### StructureDefinition-HCert Endpoints

API endpoints for Health Certificate

[📄 JSON Schema](schemas/StructureDefinition-HCert.schema.json)
[🔗 OpenAPI](schemas/StructureDefinition-HCert.openapi.json)

#### LogicalModels Enumeration Endpoint

Complete list of all available Logical Model schemas

[📄 JSON Schema](LogicalModels.schema.json)
[🔗 OpenAPI](LogicalModels-enumeration.openapi.json)

#### StructureDefinition-CWT API

OpenAPI specification for StructureDefinition-CWT

[📖 Documentation](StructureDefinition-CWT.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-CWT.openapi.json)

#### StructureDefinition-COSEHeader API

OpenAPI specification for StructureDefinition-COSEHeader

[📖 Documentation](StructureDefinition-COSEHeader.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-COSEHeader.openapi.json)

#### StructureDefinition-HCert API

OpenAPI specification for StructureDefinition-HCert

[📖 Documentation](StructureDefinition-HCert.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-HCert.openapi.json)

#### StructureDefinition-SchemeInformation API

OpenAPI specification for StructureDefinition-SchemeInformation

[📖 Documentation](StructureDefinition-SchemeInformation.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-SchemeInformation.openapi.json)

#### StructureDefinition-CWTPayload API

OpenAPI specification for StructureDefinition-CWTPayload

[📖 Documentation](StructureDefinition-CWTPayload.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-CWTPayload.openapi.json)

#### openapi API

OpenAPI specification for openapi

[🔗 OpenAPI Spec](openapi.json)

### Using the DAK API

#### Schema Validation

Each JSON Schema can be used to validate data structures in your applications.

* Type definitions and constraints
* Property descriptions and examples
* Required field specifications
* Enumeration values with links to definitions

#### JSON-LD Semantic Integration

The JSON-LD vocabularies provide semantic web integration for ValueSet enumerations.

#### Integration with FHIR

All schemas are derived from the FHIR definitions in this implementation guide.

#### API Endpoints

The enumeration endpoints provide machine-readable lists of all available schemas.

-------

