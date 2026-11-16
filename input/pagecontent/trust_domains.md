###  Trust Domains
A Trust Domain consists of:
*	Defined use cases and business processes related to the utilization of Verifiable Digital Health Certificates; These Verifiable Digital Health Certificates may be issued or verified through Trusted Services that are enabled by Trust Network Participants of the Digital Health Trust Network.
*	the open, interoperable technical specifications that identify or define the applicable Trusted Services and Verifiable Digital Health Certificates; and
*	a set of policy and regulatory standards describing expected behavior of GDHCN Participants in relation to operation of the Trusted Services and utilization of Verifiable Digital Health Certificates (e.g. data minimization, privacy, scope of use).


  <p>The codes for the GDHCN Trust Domains are contained in the <a href="ValueSet-Domains.html">GDHCN Trust Domain Value Set</a>.
  </p>

#### Trust Domain model

The [GDHCN Administrative and Operational Framework](GDHCN_Administrative_and_Operational_Framework.pdf) is the legal source for Trust Domains. The [Trust Domain](StructureDefinition-TrustDomain.html) logical model follows its three-part definition: use cases (modelled by DAK components), technical specifications, and policy and regulatory standards. A Trust Domain also names its **terms of use**, which is a ValueSet of the policies a participant may say it acts under.

A participant names those policies in a Verifiable Credential with one [termsOfUse entry](StructureDefinition-TrustDomainPolicy.html) per policy. For example, a VHL Receiver does this under the Verifiable Credential Option of IHE ITI VHL.

The model allows each part to be empty, but an empty part is a QA error. So is a terms-of-use ValueSet that no BPMN business process uses.

| Trust Domain | Defined in | Terms of use |
|---|---|---|
| [DDCC](Binary-TrustDomain-DDCC.html) | Framework, Annex I | [DDCC terms of use](ValueSet-DDCCTermsOfUse.html) |
| [IPS-PILGRIMAGE](Binary-TrustDomain-IPS-PILGRIMAGE.html) | No Framework annex yet; drafted from the [IPS Pilgrimage IG](http://smart.who.int/ips-pilgrimage) | [IPS.HAJJ.CONSENT](http://smart.who.int/ips-pilgrimage/ValueSet-IPS.HAJJ.CONSENT.html) |




#### Digital Documentation of COVID-19 Certificates (DDCC)

The [Digital Documentation of COVID-19 Certificates (DDCC)](https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1) published in August 2021 and similar guidance for test results (https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates_diagnostic_test_results-2022.1) published in March 2022 serve as the reference for the associated [FHIR Implementation Guide](https://smart.who.int/ddcc/). This Implementation Guide (IG) acts as the computable representation of the core data elements in the published guidance, mapped to standard terminologies. These data models, in the form of FHIR logical models, and terminologies, in the form of FHIR value sets, are the basis for interoperability between the various credential formats. The IG provides FHIR Structure Maps and Concept Maps to define transformations between supported credential formats and the core data set, which allows business rules to execute against a common set of data elements.


<div style="display:block">
  ![DDCC QR Codes and Logical Models](./ddcc_vs_qr_lm.png){:width="850em"}
</div>


<br />


At the current time, the following content profiles are recognized through the WHO's [Digital Documentation of COVID Certificates (DDCC)](https://worldhealthorganization.github.com/ddcc): 
* European Union's [Digital Covid Certificates (DCC)](https://health.ec.europa.eu/publications/technical-specifications-eu-digital-covid-certificates-volumes-1-5_en) **(required)**
* DIVOC (optional)
* International Civil Aviation Organisation (ICAO) Visible Digital Seals - Non-Constrained (VDS-NC) (optional)
* Smart Health Cards (SHC) - Immunization (optional)

##### Source specifications

It can be difficult to find the "source of truth" specifications for the certificate formats that are mapped to the DDCC core data sets. The best known documentation for each of the certificate formats listed above is in the [bibliography](en/folio-assistant-core/bibliography/):

* EU DCC: [[ehn-trust-framework-2021]](en/folio-assistant-core/bibliography/smart-trust-catalogue/ehn-trust-framework-2021/), [[ehn-dcc-techspec-vol1-2021]](en/folio-assistant-core/bibliography/smart-trust-catalogue/ehn-dcc-techspec-vol1-2021/), [[etsi-en-319-102-1-2016]](en/folio-assistant-core/bibliography/smart-trust-catalogue/etsi-en-319-102-1-2016/), [[ec-dcc-techspec-vol1-5]](en/folio-assistant-core/bibliography/smart-trust-catalogue/ec-dcc-techspec-vol1-5/), [[ec-dcc-vol1-2022]](en/folio-assistant-core/bibliography/smart-trust-catalogue/ec-dcc-vol1-2022/), [[eu-implementing-decision-2021-1073]](en/folio-assistant-core/bibliography/smart-trust-catalogue/eu-implementing-decision-2021-1073/)
* DIVOC:
  * Elements are defined by JSON-LD. As of 2023-02-12, the most current [JSON-LD context for vaccines](en/folio-assistant-core/bibliography/smart-trust-catalogue/divoc-vaccination-context/) and for [test results](en/folio-assistant-core/bibliography/smart-trust-catalogue/divoc-test-certificate-context/) is here . Note that the URIs for the DIVOC-specific JSON-LD contexts embedded in the certificates do not resolve.
  * DIVOC's [documentation](en/folio-assistant-core/bibliography/smart-trust-catalogue/divoc-documentation/) is here  but this does not include element-level descriptions (e.g., terminology bindings at a per-element level).
  * Terminology bindings at the element level must be inferred from more [general documentation](en/folio-assistant-core/bibliography/smart-trust-catalogue/divoc-qr-code-contents/).  The `v2` JSON-LD context introduces the `evidence.icd11Code` element for vaccines, but there is no documentation on which codes this element is bound to or whether this is used in production. There is no other computable representation of vaccine type/product.
* ICAO: [[icao-vds-nc]](en/folio-assistant-core/bibliography/smart-trust-catalogue/icao-vds-nc/)
* SMART Health Cards: [[smart-health-cards-spec]](en/folio-assistant-core/bibliography/smart-trust-catalogue/smart-health-cards-spec/), [[hl7-shc-vaccination-ig]](en/folio-assistant-core/bibliography/smart-trust-catalogue/hl7-shc-vaccination-ig/)


#### PH4H 

The [Pan-American Highway for Digital Health (PH4H)](https://worldhealthorganization.github.io/smart-ph4h) implementation guide describes the usage of the GDHCN for the Americas region.

#### IPS Pilgrimage (IPS-Pilgrimage)

The  [IPS Pilgrimage](http://smart.who.int/ips-pilgrimage) implementation guide includes a machine-readable representation of WHO guidelines for verifiable IPS during pilgrimage. It explicitly encodes computer-interoperable logic, including data models, terminologies, and logic expressions, in a computable language to support implementation of IPS during pilgrimage usage scenario. 
