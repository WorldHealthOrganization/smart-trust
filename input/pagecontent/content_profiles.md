



These Verfiable Digital Health Certificates may be issued or verified through Trusted Services that are enabled by Trust Network Participants of the Digital Health Trust Network.  At the current time, the following content profiles are recognized through the WHO's [Digital Documentation of COVID Certificates (DDCC)](https://worldhealthorganization.github.com/ddcc): 
* European Union's [Digital Covid Certificates (DCC)](https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en) **(required)**
* DIVOC (optional)
* International Civil Aviation Organisation (ICAO) Visible Digital Seals - Non-Constrained (VDS-NC) (optional)
* Smart Health Cards (SHC) - Immunization (optional)


### Digital Documentation of COVID-19 Certificates (DDCC)

The [Digital Documentation of COVID-19 Certificates (DDCC)](https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1) published in August 2021 and similar guidance for test results (https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates_diagnostic_test_results-2022.1) published in March 2022 serve as the reference for the associated [FHIR Implementation Guide](https://worldhealthorganization.github.io/ddcc/). This Implementation Guide (IG) acts as the computable representation of the core data elements in the published guidance, mapped to standard terminologies. These data models, in the form of FHIR logical models, and terminologies, in the form of FHIR value sets, are the basis for interoperability between the various credential formats. The IG provides FHIR Structure Maps and Concept Maps to define transformations between supported credential formats and the core data set, which allows business rules to execute against a common set of data elements.

![ddcc_vs_qr_lm](./ddcc_vs_qr_lm.png){:width="100%"}

#### Source specifications

It can be difficult to find the "source of truth" specifications for the certificate formats that are mapped to the DDCC core data sets. The [references](references.html) contains links to the best known documentation for each of the certificate formats listed above:


