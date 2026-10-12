# Trust Domains - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Data Models and Exchange**](data_exchange.md)
* **Trust Domains**

## Trust Domains

### Trust Domains

A Trust Domain consists of:

* Defined use cases and business processes related to the utilization of Verifiable Digital Health Certificates; These Verifiable Digital Health Certificates may be issued or verified through Trusted Services that are enabled by Trust Network Participants of the Digital Health Trust Network.
* the open, interoperable technical specifications that identify or define the applicable Trusted Services and Verifiable Digital Health Certificates; and
* a set of policy and regulatory standards describing expected behavior of GDHCN Participants in relation to operation of the Trusted Services and utilization of Verifiable Digital Health Certificates (e.g. data minimization, privacy, scope of use).

The codes for the GDHCN Trust Domains are contained in the [GDHCN Trust Domain Value Set](ValueSet-Domains.md). 

#### Digital Documentation of COVID-19 Certificates (DDCC)

The [Digital Documentation of COVID-19 Certificates (DDCC)](https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1) published in August 2021 and similar guidance for test results (https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates_diagnostic_test_results-2022.1) published in March 2022 serve as the reference for the associated [FHIR Implementation Guide](https://smart.who.int/ddcc/). This Implementation Guide (IG) acts as the computable representation of the core data elements in the published guidance, mapped to standard terminologies. These data models, in the form of FHIR logical models, and terminologies, in the form of FHIR value sets, are the basis for interoperability between the various credential formats. The IG provides FHIR Structure Maps and Concept Maps to define transformations between supported credential formats and the core data set, which allows business rules to execute against a common set of data elements.

![DDCC QR Codes and Logical Models](./ddcc_vs_qr_lm.png){:width="850em"}

At the current time, the following content profiles are recognized through the WHO's [Digital Documentation of COVID Certificates (DDCC)](https://worldhealthorganization.github.com/ddcc):

* European Union's [Digital Covid Certificates (DCC)](https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en) **(required)**
* DIVOC (optional)
* International Civil Aviation Organisation (ICAO) Visible Digital Seals - Non-Constrained (VDS-NC) (optional)
* Smart Health Cards (SHC) - Immunization (optional)

##### Source specifications

It can be difficult to find the "source of truth" specifications for the certificate formats that are mapped to the DDCC core data sets. The [references](references.md) contains links to the best known documentation for each of the certificate formats listed above.

#### PH4H

The [Pan-American Highway for Digital Health (PH4H)](http://worldhealthorganization.github.iont/smart-ph4h) implementation guide describes the usage of the GDHCN for the Americas region.

#### IPS Pilgrimage (IPS-Pilgrimage)

The [IPS Pilgrimage](http://smart.who.int/ips-pilgrimage) implementation guide includes a machine-readable representation of WHO guidelines for verifiable IPS during pilgrimage. It explicitly encodes computer-interoperable logic, including data models, terminologies, and logic expressions, in a computable language to support implementation of IPS during pilgrimage usage scenario.

