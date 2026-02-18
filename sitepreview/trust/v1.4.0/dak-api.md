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

#### ValueSets.schema.json

Enumeration of all available ValueSet schemas

##### Available Endpoints:

* [ValueSet-Actors.schema.json](schemas/ValueSet-Actors.schema.json) - JSON Schema for WHO GDHCN Actor ValueSet of actor codes Schema
* [ValueSet-PayloadTypes.schema.json](schemas/ValueSet-PayloadTypes.schema.json) - JSON Schema for WHO GDHCN Payload Types Schema
* [ValueSet-KeyUsage.schema.json](schemas/ValueSet-KeyUsage.schema.json) - JSON Schema for WHO GDHCN Key Usage ValueSet Schema
* [ValueSet-ConnectionTypes.schema.json](schemas/ValueSet-ConnectionTypes.schema.json) - JSON Schema for WHO GDHCN Connection Types Schema
* [ValueSet-KeyUsage-UAT.schema.json](schemas/ValueSet-KeyUsage-UAT.schema.json) - JSON Schema for WHO GDHCN Key Usage ValueSet - UAT Schema
* [ValueSet-Domains-UAT.schema.json](schemas/ValueSet-Domains-UAT.schema.json) - JSON Schema for WHO GDHCN Trust Domains - UAT Schema
* [ValueSet-Domains-DEV.schema.json](schemas/ValueSet-Domains-DEV.schema.json) - JSON Schema for WHO GDHCN Trust Domains - DEV Schema
* [ValueSet-Domains.schema.json](schemas/ValueSet-Domains.schema.json) - JSON Schema for WHO GDHCN Trust Domains Schema
* [ValueSet-Transactions.schema.json](schemas/ValueSet-Transactions.schema.json) - JSON Schema for WHO GDHCN Transaction Codes Schema
* [ValueSet-Participants-UAT.schema.json](schemas/ValueSet-Participants-UAT.schema.json) - JSON Schema for WHO GDHCN Trust Network Participant - UAT Schema
* [ValueSet-Participants.schema.json](schemas/ValueSet-Participants.schema.json) - JSON Schema for WHO GDHCN Trust Network Participant Schema
* [ValueSet-Participants-DEV.schema.json](schemas/ValueSet-Participants-DEV.schema.json) - JSON Schema for WHO GDHCN Trust Network Participant - DEV Schema
* [ValueSet-KeyUsage-DEV.schema.json](schemas/ValueSet-KeyUsage-DEV.schema.json) - JSON Schema for WHO GDHCN Key Usage ValueSet - DEV Schema

#### LogicalModels.schema.json

Enumeration of all available Logical Model schemas

##### Available Endpoints:

* [StructureDefinition-CWT.schema.json](schemas/StructureDefinition-CWT.schema.json) - JSON Schema for CBOR Web Token (CWT) Claim
* [StructureDefinition-COSEHeader.schema.json](schemas/StructureDefinition-COSEHeader.schema.json) - JSON Schema for COSE Headers (DRAFT)
* [StructureDefinition-CWTPayload.schema.json](schemas/StructureDefinition-CWTPayload.schema.json) - JSON Schema for CBOR Web Token (CWT) Payload (Common)
* [StructureDefinition-SchemeInformation.schema.json](schemas/StructureDefinition-SchemeInformation.schema.json) - JSON Schema for Scheme Information
* [StructureDefinition-HCert.schema.json](schemas/StructureDefinition-HCert.schema.json) - JSON Schema for Health Certificate

### ValueSet Schemas (13 available)

JSON Schema definitions for FHIR ValueSets, providing structured enumeration of allowed code values:

#### WHO GDHCN Actor ValueSet of actor codes Schema

JSON Schema for WHO GDHCN Actor ValueSet of actor codes ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Actors.md)
[📄 JSON Schema](schemas/ValueSet-Actors.schema.json)
[🏷️ Displays](schemas/ValueSet-Actors.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Actors.openapi.json)

#### WHO GDHCN Payload Types Schema

JSON Schema for WHO GDHCN Payload Types ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-PayloadTypes.md)
[📄 JSON Schema](schemas/ValueSet-PayloadTypes.schema.json)
[🏷️ Displays](schemas/ValueSet-PayloadTypes.displays.json)
[🔗 OpenAPI](schemas/ValueSet-PayloadTypes.openapi.json)

#### WHO GDHCN Key Usage ValueSet Schema

JSON Schema for WHO GDHCN Key Usage ValueSet ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-KeyUsage.md)
[📄 JSON Schema](schemas/ValueSet-KeyUsage.schema.json)
[🏷️ Displays](schemas/ValueSet-KeyUsage.displays.json)
[🔗 OpenAPI](schemas/ValueSet-KeyUsage.openapi.json)

#### WHO GDHCN Connection Types Schema

JSON Schema for WHO GDHCN Connection Types ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-ConnectionTypes.md)
[📄 JSON Schema](schemas/ValueSet-ConnectionTypes.schema.json)
[🏷️ Displays](schemas/ValueSet-ConnectionTypes.displays.json)
[🔗 OpenAPI](schemas/ValueSet-ConnectionTypes.openapi.json)

#### WHO GDHCN Key Usage ValueSet - UAT Schema

JSON Schema for WHO GDHCN Key Usage ValueSet - UAT ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-KeyUsage-UAT.md)
[📄 JSON Schema](schemas/ValueSet-KeyUsage-UAT.schema.json)
[🏷️ Displays](schemas/ValueSet-KeyUsage-UAT.displays.json)
[🔗 OpenAPI](schemas/ValueSet-KeyUsage-UAT.openapi.json)

#### WHO GDHCN Trust Domains - UAT Schema

JSON Schema for WHO GDHCN Trust Domains - UAT ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Domains-UAT.md)
[📄 JSON Schema](schemas/ValueSet-Domains-UAT.schema.json)
[🏷️ Displays](schemas/ValueSet-Domains-UAT.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Domains-UAT.openapi.json)

#### WHO GDHCN Trust Domains - DEV Schema

JSON Schema for WHO GDHCN Trust Domains - DEV ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Domains-DEV.md)
[📄 JSON Schema](schemas/ValueSet-Domains-DEV.schema.json)
[🏷️ Displays](schemas/ValueSet-Domains-DEV.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Domains-DEV.openapi.json)

#### WHO GDHCN Trust Domains Schema

JSON Schema for WHO GDHCN Trust Domains ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Domains.md)
[📄 JSON Schema](schemas/ValueSet-Domains.schema.json)
[🏷️ Displays](schemas/ValueSet-Domains.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Domains.openapi.json)

#### WHO GDHCN Transaction Codes Schema

JSON Schema for WHO GDHCN Transaction Codes ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Transactions.md)
[📄 JSON Schema](schemas/ValueSet-Transactions.schema.json)
[🏷️ Displays](schemas/ValueSet-Transactions.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Transactions.openapi.json)

#### WHO GDHCN Trust Network Participant - UAT Schema

JSON Schema for WHO GDHCN Trust Network Participant - UAT ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Participants-UAT.md)
[📄 JSON Schema](schemas/ValueSet-Participants-UAT.schema.json)
[🏷️ Displays](schemas/ValueSet-Participants-UAT.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Participants-UAT.openapi.json)

#### WHO GDHCN Trust Network Participant Schema

JSON Schema for WHO GDHCN Trust Network Participant ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Participants.md)
[📄 JSON Schema](schemas/ValueSet-Participants.schema.json)
[🏷️ Displays](schemas/ValueSet-Participants.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Participants.openapi.json)

#### WHO GDHCN Trust Network Participant - DEV Schema

JSON Schema for WHO GDHCN Trust Network Participant - DEV ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-Participants-DEV.md)
[📄 JSON Schema](schemas/ValueSet-Participants-DEV.schema.json)
[🏷️ Displays](schemas/ValueSet-Participants-DEV.displays.json)
[🔗 OpenAPI](schemas/ValueSet-Participants-DEV.openapi.json)

#### WHO GDHCN Key Usage ValueSet - DEV Schema

JSON Schema for WHO GDHCN Key Usage ValueSet - DEV ValueSet codes. Generated from FHIR expansions using IRI format.

[🩺 FHIR](ValueSet-KeyUsage-DEV.md)
[📄 JSON Schema](schemas/ValueSet-KeyUsage-DEV.schema.json)
[🏷️ Displays](schemas/ValueSet-KeyUsage-DEV.displays.json)
[🔗 OpenAPI](schemas/ValueSet-KeyUsage-DEV.openapi.json)

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

#### ValueSet-Actors Endpoints

API endpoints for WHO GDHCN Actor ValueSet of actor codes Schema

[📄 JSON Schema](schemas/ValueSet-Actors.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Actors.openapi.json)

#### ValueSet-PayloadTypes Endpoints

API endpoints for WHO GDHCN Payload Types Schema

[📄 JSON Schema](schemas/ValueSet-PayloadTypes.schema.json)
[🔗 OpenAPI](schemas/ValueSet-PayloadTypes.openapi.json)

#### ValueSet-KeyUsage Endpoints

API endpoints for WHO GDHCN Key Usage ValueSet Schema

[📄 JSON Schema](schemas/ValueSet-KeyUsage.schema.json)
[🔗 OpenAPI](schemas/ValueSet-KeyUsage.openapi.json)

#### ValueSet-ConnectionTypes Endpoints

API endpoints for WHO GDHCN Connection Types Schema

[📄 JSON Schema](schemas/ValueSet-ConnectionTypes.schema.json)
[🔗 OpenAPI](schemas/ValueSet-ConnectionTypes.openapi.json)

#### ValueSet-KeyUsage-UAT Endpoints

API endpoints for WHO GDHCN Key Usage ValueSet - UAT Schema

[📄 JSON Schema](schemas/ValueSet-KeyUsage-UAT.schema.json)
[🔗 OpenAPI](schemas/ValueSet-KeyUsage-UAT.openapi.json)

#### ValueSet-Domains-UAT Endpoints

API endpoints for WHO GDHCN Trust Domains - UAT Schema

[📄 JSON Schema](schemas/ValueSet-Domains-UAT.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Domains-UAT.openapi.json)

#### ValueSet-Domains-DEV Endpoints

API endpoints for WHO GDHCN Trust Domains - DEV Schema

[📄 JSON Schema](schemas/ValueSet-Domains-DEV.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Domains-DEV.openapi.json)

#### ValueSet-Domains Endpoints

API endpoints for WHO GDHCN Trust Domains Schema

[📄 JSON Schema](schemas/ValueSet-Domains.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Domains.openapi.json)

#### ValueSet-Transactions Endpoints

API endpoints for WHO GDHCN Transaction Codes Schema

[📄 JSON Schema](schemas/ValueSet-Transactions.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Transactions.openapi.json)

#### ValueSet-Participants-UAT Endpoints

API endpoints for WHO GDHCN Trust Network Participant - UAT Schema

[📄 JSON Schema](schemas/ValueSet-Participants-UAT.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Participants-UAT.openapi.json)

#### ValueSet-Participants Endpoints

API endpoints for WHO GDHCN Trust Network Participant Schema

[📄 JSON Schema](schemas/ValueSet-Participants.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Participants.openapi.json)

#### ValueSet-Participants-DEV Endpoints

API endpoints for WHO GDHCN Trust Network Participant - DEV Schema

[📄 JSON Schema](schemas/ValueSet-Participants-DEV.schema.json)
[🔗 OpenAPI](schemas/ValueSet-Participants-DEV.openapi.json)

#### ValueSet-KeyUsage-DEV Endpoints

API endpoints for WHO GDHCN Key Usage ValueSet - DEV Schema

[📄 JSON Schema](schemas/ValueSet-KeyUsage-DEV.schema.json)
[🔗 OpenAPI](schemas/ValueSet-KeyUsage-DEV.openapi.json)

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

#### ValueSets Enumeration Endpoint

Complete list of all available ValueSet schemas

[📄 JSON Schema](ValueSets.schema.json)
[🔗 OpenAPI](ValueSets-enumeration.openapi.json)

#### LogicalModels Enumeration Endpoint

Complete list of all available Logical Model schemas

[📄 JSON Schema](LogicalModels.schema.json)
[🔗 OpenAPI](LogicalModels-enumeration.openapi.json)

#### ValueSet-PayloadTypes API

OpenAPI specification for ValueSet-PayloadTypes

[📖 Documentation](ValueSet-PayloadTypes.md)
[🔗 OpenAPI Spec](schemas/ValueSet-PayloadTypes.openapi.json)

#### ValueSet-Participants API

OpenAPI specification for ValueSet-Participants

[📖 Documentation](ValueSet-Participants.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Participants.openapi.json)

#### StructureDefinition-CWT API

OpenAPI specification for StructureDefinition-CWT

[📖 Documentation](StructureDefinition-CWT.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-CWT.openapi.json)

#### ValueSet-Domains-DEV API

OpenAPI specification for ValueSet-Domains-DEV

[📖 Documentation](ValueSet-Domains-DEV.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Domains-DEV.openapi.json)

#### ValueSet-Domains-UAT API

OpenAPI specification for ValueSet-Domains-UAT

[📖 Documentation](ValueSet-Domains-UAT.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Domains-UAT.openapi.json)

#### ValueSet-Participants-DEV API

OpenAPI specification for ValueSet-Participants-DEV

[📖 Documentation](ValueSet-Participants-DEV.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Participants-DEV.openapi.json)

#### StructureDefinition-COSEHeader API

OpenAPI specification for StructureDefinition-COSEHeader

[📖 Documentation](StructureDefinition-COSEHeader.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-COSEHeader.openapi.json)

#### ValueSet-Participants-UAT API

OpenAPI specification for ValueSet-Participants-UAT

[📖 Documentation](ValueSet-Participants-UAT.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Participants-UAT.openapi.json)

#### ValueSet-Transactions API

OpenAPI specification for ValueSet-Transactions

[📖 Documentation](ValueSet-Transactions.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Transactions.openapi.json)

#### ValueSet-Domains API

OpenAPI specification for ValueSet-Domains

[📖 Documentation](ValueSet-Domains.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Domains.openapi.json)

#### ValueSet-KeyUsage-DEV API

OpenAPI specification for ValueSet-KeyUsage-DEV

[📖 Documentation](ValueSet-KeyUsage-DEV.md)
[🔗 OpenAPI Spec](schemas/ValueSet-KeyUsage-DEV.openapi.json)

#### ValueSet-KeyUsage API

OpenAPI specification for ValueSet-KeyUsage

[📖 Documentation](ValueSet-KeyUsage.md)
[🔗 OpenAPI Spec](schemas/ValueSet-KeyUsage.openapi.json)

#### ValueSet-Actors API

OpenAPI specification for ValueSet-Actors

[📖 Documentation](ValueSet-Actors.md)
[🔗 OpenAPI Spec](schemas/ValueSet-Actors.openapi.json)

#### ValueSet-KeyUsage-UAT API

OpenAPI specification for ValueSet-KeyUsage-UAT

[📖 Documentation](ValueSet-KeyUsage-UAT.md)
[🔗 OpenAPI Spec](schemas/ValueSet-KeyUsage-UAT.openapi.json)

#### StructureDefinition-HCert API

OpenAPI specification for StructureDefinition-HCert

[📖 Documentation](StructureDefinition-HCert.md)
[🔗 OpenAPI Spec](schemas/StructureDefinition-HCert.openapi.json)

#### ValueSet-ConnectionTypes API

OpenAPI specification for ValueSet-ConnectionTypes

[📖 Documentation](ValueSet-ConnectionTypes.md)
[🔗 OpenAPI Spec](schemas/ValueSet-ConnectionTypes.openapi.json)

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

