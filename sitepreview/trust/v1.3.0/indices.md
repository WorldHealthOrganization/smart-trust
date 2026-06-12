# Indices - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* **Indices**

## Indices

## Indices

This deployment guide consists of the following indexed material:

* [Artifact Index](artifacts.md)
* [References](references.md)
* [Mappings](maps.md)
* [Changes](changes.md)
* [Downloads](downloads.md)
* [License](license.md)

### Trust Network Specifications

#### EU DCC

* [Interoperability of health certificates – Trust Framework – v. 1.0 – 12.03.2021 – eHealth Network](https://ec.europa.eu/health/sites/health/files/ehealth/docs/trust-framework_interoperability_certificates_en.pdf) - last accessed 27.04.2021
* [Technical Specifications for Digital COVID Certificates Volume 1 V1.0.5 - eHealth Network](https://ec.europa.eu/health/sites/health/files/ehealth/docs/digital-green-certificates_v1_en.pdf) - last accessed 27.04.2021
* [ETSI EN 319 102-1: Electronic Signatures and Infrastructures (ESI); Procedures for Creation and Validation of AdES Digital Signatures; Part 1: Creation and Validation – version 1.1.1, 2016](https://www.etsi.org/deliver/etsi_en/319100_319199/31910201/01.01.01_60/en_31910201v010101p.pdf) – last accessed 23.04.2021
* [Technical specifications for EU Digital COVID Certificates - Volumes 1-5](https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en) 
* [Volume 1: Formats and trust management available at references "Implementing Decision (EU) 2021/1073, Annex I"](https://health.ec.europa.eu/system/files/2022-02/digital-covid-certificates_v1_en.pdf)
* [Implementing Decision (EU) 2021/1073, Annex I can be found at , along with other relevant Annexes.](https://eur-lex.europa.eu/legal-content/EN/TXT/uri=uriserv%3AOJ.L_.2021.230.01.0032.01.ENG))

#### DIVOC

* Elements are defined by JSON-LD. As of 2023-02-12, the most current [JSON-LD context for vaccines](https://github.com/egovernments/DIVOC/blob/icmr/vaccination-context/vaccination-context.js) and for [test results](https://github.com/egovernments/DIVOC/blob/icmr/test-certificate-context/test-certificate-context.js) is here . Note that the URIs for the DIVOC-specific JSON-LD contexts embedded in the certificates do not resolve.
*  DIVOC's [documentation](https://divoc.digit.org) is here but this does not include element-level descriptions (e.g., terminology bindings at a per-element level).
*  Terminology bindings at the element level must be inferred from more [general documentation](https://divoc.digit.org/platform/divocs-verifiable-certificate-features/what-information-goes-into-a-qr-code). The `v2` JSON-LD context introduces the `evidence.icd11Code` element for vaccines, but there is no documentation on which codes this element is bound to or whether this is used in production. There is no other computable representation of vaccine type/product.

#### ICAO

*  ICAO [VDS NC](https://www.icao.int/vdsnc-spec)

#### SMART Health Cards

* General SMART Health Card [specification](https://spec.smarthealth.cards) 
* COVID-19 [vaccine and testing-specific specification](http://build.fhir.org/ig/HL7/fhir-shc-vaccination-ig) 

#### WHO SMART Guideline Development

* WHO [SMART Guidelines](https://www.who.int/teams/digital-health-and-innovation/smart-guidelines) overviews the SMART Guidelines approach
* WHO [Handbook for guideline development](https://www.who.int/publications/i/item/9789241548960) provides an overview of the WHO guideline development and publication process

### StructureMaps

### License

Creative Commons Attribution 3.0 IGO (CC-BY-3.0-IGO)

#### Summary

This is a human-readable summary of the [Creative Commons Attribution 3.0 IGO (CC-BY-3.0-IGO) License](https://creativecommons.org/licenses/by/3.0/igo/). This summary is not a substitute for the full license text.

Under this license, you are free to:

* Share: Copy and redistribute the material in any medium or format.
* Adapt: Remix, transform, and build upon the material for any purpose, even commercially.

Under the following conditions:

* Attribution: You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
* No Additional Restrictions: You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.
* International Government Organizations (IGOs): This license is specifically designed for works created by International Government Organizations.

#### License Text

This work is licensed under the [Creative Commons Attribution 3.0 IGO (CC-BY-3.0-IGO) License](https://creativecommons.org/licenses/by/3.0/igo/).

To view a copy of this license, visit [https://creativecommons.org/licenses/by/3.0/igo/](https://creativecommons.org/licenses/by/3.0/igo/) or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.

