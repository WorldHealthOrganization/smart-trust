library WHOConcepts version '0.0.2'
// Code Systems
codesystem "ICD-10": 'http://hl7.org/fhir/sid/icd-10'
codesystem "SNOMED-CT": 'http://snomed.info/sct'
codesystem "LOINC": 'http://loinc.org'
codesystem "RxNorm": 'http://www.nlm.nih.gov/research/umls/rxnorm'
codesystem "CIEL": 'https://cielterminology.org'
codesystem "ICD-11": 'http://id.who.int/icd/release/11/mms'
codesystem "ICHI": 'https://mitel.dimi.uniud.it/ichi/#http://id.who.int/ichi'
codesystem "ICF": 'http://hl7.org/fhir/sid/icf-nl'

// ValuSets
valueset "Pregnancy Status Pregnant": 'http://fhir.org/guides/who/core/ValueSet/pregnancystatus-values'
valueset "Adverse Events": 'http://hl7.org/fhir/ValueSet/adverse-event-type'

code "Pregnancy status": '82810-3' from "LOINC" display 'Pregnancy status'
code "Pregnant": 'LA15173-0' from "LOINC" display 'Pregnant'
code "Not pregnant": 'LA26683-5' from "LOINC" display 'Not pregnant'
code "Unknown": 'LA4489-6' from "LOINC" display 'Unknown'
