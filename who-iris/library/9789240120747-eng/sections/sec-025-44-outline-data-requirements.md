---
doc_id: 9789240120747-eng
doc_title: "Digital transformation handbook for reporting substandard and falsified medical products"
section_id: sec-025-44-outline-data-requirements
section_title: "Outline data requirements"
section_number: 4.4
pages: 42-43
source_pdf: 9789240120747-eng.pdf
source_sha256: c710f7cf4a432221
toc_source: inferred
---
## 4.4 Outline data requirements

A data dictionary is a repository of information about the data elements such as description, data type and other characteristics. A data dictionary will be a useful input to designing the solution and facilitating understanding across multiple stakeholders. Data dictionaries should utilize terminology standards (e.g. International Classification of Diseases [ICD-11], SNOMED-GPS) and syntactic interoperability standards (e.g. HL7 FHIR). These standards ensure consistent and high-quality data exchange across various digital systems, regardless of the time, health topics, or different health care providers and facilities involved.

The data elements that health care professionals will collect will be defined in the data dictionary and included in the reporting application in appropriate activities of the workflow. A sample list of data elements is provided in Table 11 and can be tailored to the country’s context.

**Table 11. Data elements example**

| Activity ID and name | Data element ID | Data element name | Description and definition |
| --- | --- | --- | --- |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE1 | Region | The region within the country from where the substandard and falsified medical product is being reported. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE2 | Type of report | — |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE3 | Product ID | The product identification number. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE4 | Product description | The description of the product. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE5 | Type of product | — |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE6 | Batch number | The identification number of the batch that the substandard and falsified medical product belongs to, as printed on the product package. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE7 | Expiry date | The predetermined date, as printed on the product package, beyond which the product is not safe or effective to be used. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE8 | Substandard or falsified? | Whether the product being reported is substandard or falsified. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE9 | Product suspected to have caused adverse reaction or unexpected lack of efficacy? | Whether the substandard and falsified medical product caused any adverse reactions. |
| SFR.A1 Report substandard or falsified product | SFR.A1.DE10 | Reporting reason/description of the issue | The reason for reporting the product as substandard and falsified. |
