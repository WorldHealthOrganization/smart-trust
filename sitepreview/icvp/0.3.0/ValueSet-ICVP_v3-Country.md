# ValueSet - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Indices**](indices.md)
* [**Artifact Index**](artifacts.md)
* [**ICVP Model Questionnaire**](Questionnaire-ICVP.md)
* **ValueSet**

## ValueSet: ValueSet 

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/icvp/Questionnaire/ICVP#v3-Country | *Version*:0.3.0 |
| Active as of 2014-03-26 | *Computable Name*:Country |
| *Other Identifiers:*OID:2.16.840.1.113883.1.11.171 | |
| **Copyright/Legal**: This material derives from the HL7 Terminology THO. THO is copyright ©1989+ Health Level Seven International and is made available under the CC0 designation. For more licensing information see: https://terminology.hl7.org/license.html | |

 
Countries of the world. ISO 3166, part 1, alpha-3 set. 

 **References** 

* [Questionnaire[http://smart.who.int/icvp/Questionnaire/pPreQual|0.3.0]](Questionnaire-pPreQual.md)
* [DVC Model Questionnaire](http://smart.who.int/trust-phw/v0.1.0/Questionnaire-PreQual.html)

### Logical Definition (CLD)

Language: en

* Include codes from[`urn:iso:std:iso:3166`](http://terminology.hl7.org/6.5.0/CodeSystem-ISO3166Part1.html)version Not Stated (use latest from terminology server) where code matches (by regex) [A-Z]{3}

 

### Expansion

Expansion from tx.fhir.org based on codesystem ISO 3166-1 Codes for the representation of names of countries and their subdivisions — Part 1: Country code version 2018

This value set contains 249 concepts

-------

 Explanation of the columns that may appear on this page: 

| | |
| :--- | :--- |
| Level | A few code lists that FHIR defines are hierarchical - each code is assigned a level. In this scheme, some codes are under other codes, and imply that the code they are under also applies |
| System | The source of the definition of the code (when the value set draws in codes defined elsewhere) |
| Code | The code (used as the code in the resource instance) |
| Display | The display (used in the*display*element of a[Coding](http://hl7.org/fhir/R4/datatypes.html#Coding)). If there is no display, implementers should not simply display the code, but map the concept into their application |
| Definition | An explanation of the meaning of the concept |
| Comments | Additional notes about how to use the code |

