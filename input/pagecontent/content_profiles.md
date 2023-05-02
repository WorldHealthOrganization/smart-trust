



These Verfiable Digital Health Certificates may be issued or verified through Trusted Services that are enabled by Trust Network Participants of the Digital Health Trust Network.  At the current time, the following content profiles are recognized through the WHO's [Digital Documentation of COVID Certificates (DDCC)](https://worldhealthorganization.github.com/ddcc): 
* European Union's [Digital Covid Certificates (DCC)](https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en) **(required)**
* DIVOC (optional)
* International Civil Aviation Organisation (ICAO) Visible Digital Seals - Non-Constrained (VDS-NC) (optional)
* Smart Health Cards (SHC) - Immunization (optional)


### Digital Documentation of COVID-19 Certificates (DDCC)

The [Digital Documentation of COVID-19 Certificates (DDCC)](https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1) published in August 2021 and similar guidance for test results (https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates_diagnostic_test_results-2022.1) published in March 2022 serve as the reference for the associated [FHIR Implementation Guide](https://worldhealthorganization.github.io/ddcc/). This Implementation Guide (IG) acts as the computable representation of the core data elements in the published guidance, mapped to standard terminologies. These data models, in the form of FHIR logical models, and terminologies, in the form of FHIR value sets, are the basis for interoperability between the various credential formats. The IG provides FHIR Structure Maps and Concept Maps to define transformations between supported credential formats and the core data set, which allows business rules to execute against a common set of data elements.

![ddcc_vs_qr_lm](./ddcc_vs_qr_lm.png){:width="100%"}

#### Source specifications

It can be difficult to find the "source of truth" specifications for the certificate formats that are mapped to the DDCC core data sets. The following are links to the best known documentation for each of the certificate formats listed above:

- **EU DCC**
    - [Technical specifications for EU Digital COVID Certificates - Volumes 1-5](https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en).
    - [Volume 1: Formats and trust management](https://health.ec.europa.eu/system/files/2022-02/digital-covid-certificates_v1_en.pdf) references "Implementing Decision (EU) 2021/1073, Annex I".
    - [Implementing Decision (EU) 2021/1073, Annex I can be found here](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=uriserv%3AOJ.L_.2021.230.01.0032.01.ENG), along with other relevant Annexes.
- **DIVOC**
    - Elements are defined by JSON-LD. As of 2023-02-12, we were told by the DIVOC team that the most current JSON-LD context for [vaccines is here](https://github.com/egovernments/DIVOC/blob/icmr/vaccination-context/vaccination-context.js) and for [test results is here](https://github.com/egovernments/DIVOC/blob/icmr/test-certificate-context/test-certificate-context.js).
        - Note that the URIs for the DIVOC-specific JSON-LD contexts embedded in the certificates do not resolve.
    - [DIVOC's documentation is here](https://divoc.digit.org), but this does not include element-level descriptions (e.g., terminology bindings at a per-element level).
        - Terminology bindings at the element level must be inferred from [more general documentation](https://divoc.digit.org/platform/divocs-verifiable-certificate-features/what-information-goes-into-a-qr-code).
        - The `v2` JSON-LD context introduces the `evidence.icd11Code` element for vaccines, but there is no documentation on which codes this element is bound to or whether this is used in production.
        - There is no other computable representation of vaccine type/product.
    - As of 2023-02-12, the public documentation does not include any information on test result certificates. The information we have was provided privately by the DIVOC team.
- **[ICAO](https://www.icao.int/vdsnc-spec)**
- **SMART Health Cards**
    - [General SMART Health Card specification](https://spec.smarthealth.cards/)
    - [COVID-19 vaccine and testing-specific specification](http://build.fhir.org/ig/HL7/fhir-shc-vaccination-ig)

