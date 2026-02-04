# Artifact Index - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* **Artifact Index**

## Artifact Index

This page provides a list of the FHIR artifacts defined as part of this implementation guide.

### Structures: Logical Models 

These define data models that represent the domain covered by this implementation guide in more business-friendly terms than the underlying FHIR resources.

| | |
| :--- | :--- |
| [DVC Icvp with Selective Disclosure](StructureDefinition-ICVPSD.md) | DVC Icvp with Selective Disclosure |
| [ICVP](StructureDefinition-ICVP.md) | Data elements for the Model International Certificate of Vaccination or Prophylaxis. |
| [ICVP (single)](StructureDefinition-ICVPEvent.md) | ICVP for a single vaccincation event |
| [ICVP - Vaccine Details](StructureDefinition-ICVPVaccineDetails.md) | Vaccine Data elements for the International Certificate of Vaccination or Prophylaxis |
| [ICVP HCERT Payload](StructureDefinition-ICVPMin.md) | Mininmial DVC payload for use within an HCERT Payload using the ICVP Product Catalogue |
| [ICVP HCERT Payload](StructureDefinition-ICVPMinVaccineDetails.md) | Mininmial vaccine detail in DVC payload for use within an HCERT Payload using the ICVP Product Catalogue |
| [ICVP Vaccine Details with Selective Disclosure](StructureDefinition-ICVPVaccineDetailsSD.md) | ICVP Vaccine Details with Selective Disclosure |
| [pICVP](StructureDefinition-pICVP.md) | Data elements for the Paper Model International Certificate of Vaccination or Prophylaxis. |
| [pICVP - Vaccine Details](StructureDefinition-pICVPVaccineDetails.md) | Vaccine Data elements for the Paper Model International Certificate of Vaccination or Prophylaxis. |

### Structures: Questionnaires 

These define forms used by systems conforming to this implementation guide to capture or expose data to end users.

| | |
| :--- | :--- |
| [ICVP Model Questionnaire](Questionnaire-ICVP.md) | Questionnaire for DVC Logical Model with the WHO ICVP |

### Structures: Resource Profiles 

These define constraints on FHIR resources for systems conforming to this implementation guide.

| | |
| :--- | :--- |
| [DVC - WHO ICVP Immunization for IPS](StructureDefinition-Immunization-uv-ips-ICVP.md) | This profile represents an IPS Immunization record that can be mapped onto a Digital Vaccine Certificates using the WHO PreQual Database |
| [DVC Certificate - IPS Bundle from WHO ICVP](StructureDefinition-Bundle-uv-ips-ICVP.md) | Profile of the IPS Bundle for representing digital vaccination certificates from WHO ICVP |
| [DVC Certificate - IPS Composition for WHO ICVP](StructureDefinition-Composition-uv-ips-ICVP.md) | Profile of the IPS Composition for representing digital vaccination certificates with WHO PreQual Database for ICVP |
| [ICVP Immunization](StructureDefinition-ICVPImmunization.md) | This profile represents Immunization record for Digital Vaccine Certificates for use in the International Certificate of Vaccination or Prophylaxis (ICVP). Such vaccine should be listed in the ICVP Product CatalogueThe ICVP product catalogue consists of vaccines listed in the list of Prequalified Vaccines and the Emergency Use Listing.* https://extranet.who.int/prequal/vaccines/prequalified-vaccines
* https://www.who.int/teams/regulation-prequalification/eul
In FHIR R6, this could also be a reference to an InventoryItem |

### Terminology: Value Sets 

These define sets of codes used by systems conforming to this implementation guide.

| | |
| :--- | :--- |
| [Disease Targeted](ValueSet-DiseaseTargeted.md) | Value set for all diseases |
| [ICVP - Vaccine Codes](ValueSet-ICVPVaccineCodes.md) | This value set includes codes from ICVP |
| [ICVP Disease Targeted](ValueSet-ICVPDiseaseTargeted.md) | Value set for yellow fever and polio only |
| [Vaccine Types for use in the ICVP](ValueSet-ICVPVaccineType.md) | WHO PreQualificaiton Vaccine Type for use in the ICVP |
| [VaccineManufacturer](ValueSet-VaccineManufacturer.md) | VaccineManufacturer value set |
| [WHO ICVP Vaccine Product Ids](ValueSet-ICVPProductIds.md) | WHO ICVP Vaccine Product Ids |
| [preQualVaccines](ValueSet-preQualVaccines.md) | preQualVaccines value set |

### Terminology: Code Systems 

These define new code systems used by systems conforming to this implementation guide.

| | |
| :--- | :--- |
| [Prequalified Vaccines - Manufacturer names](CodeSystem-VaccineManufacturer.md) | List of WHO Prequalified Vaccines - Manufacturer names |

### Terminology: Structure Maps 

These define transformations to convert between data structures used by systems conforming to this implementation guide.

| |
| :--- |
| [ICVPClaimtoICVPLM](StructureMap-ICVPClaimtoICVPLM.md) |
| [ICVPClaimtoIPS](StructureMap-ICVPClaimtoIPS.md) |
| [ICVPLMToIPS](StructureMap-ICVPLMToIPS.md) |
| [ICVPLMtoICVPClaim](StructureMap-ICVPLMtoICVPClaim.md) |
| [ICVPQRtoICVPClaim](StructureMap-ICVPQRtoICVPClaim.md) |
| [ICVPQRtoICVPLM](StructureMap-ICVPQRtoICVPLM.md) |
| [PreQualDBtoProductLM](StructureMap-PreQualDBtoProductLM.md) |

### Terminology: Concept Maps 

These define transformations to convert between codes by systems conforming with this implementation guide.

| | |
| :--- | :--- |
| [ConceptMap from ICVP Product IDs to Vaccine Types](ConceptMap-ICVPProductIdToVaccineType.md) | Mapping from ICVP Product IDs to Vaccine Types |
| [ConceptMap from Vaccine Trade Item to Manufacturer](ConceptMap-VaccineTradeItemtoManufacturer.md) | Mapping from Vaccine Trade Item to Manufacturer |
| [Discloure Statement maapings](ConceptMap-DisclosureStatements.md) | Mapping from Disclosure Statements to itself to show relatiohships |

### Example: Example Instances 

These are example instances that show what data produced and consumed by systems conforming with this implementation guide might look like.

| | |
| :--- | :--- |
| [DVC Model Questionnaire](Questionnaire-pPreQual.md) | Questionnaire for DVC Logical Model with the WHO PreQual DB and paper attachment |
| [ICVPQRExample](QuestionnaireResponse-ICVPQRExample.md) |  |
| [IVCP123455](Binary-IVCP123455.md) | Example ICVP |
| [IVCP123455SD](Binary-IVCP123455SD.md) | Example ICVP with Selective Disclosure |

