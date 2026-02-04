# Adapting Guidelines for Country use - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Home**](index.md)
* **Adapting Guidelines for Country use**

## Adapting Guidelines for Country use

The following page provides a reference to resources that can guide countries in adapting the guidelines for country use.

To implement WHO recommendations in country settings, governments must interpret and then adapt the content in line with local policies, procedures, and digital tools.

This implementation guide provides the generic content required in digital systems, independently of a specific software application and with the intention that countries can adapt it to meet local needs.

WHO guidelines articulate and endorse rigorously tested recommendations for health interventions to be adopted within country programs. When applied correctly and consistently, guideline recommendations save lives. To ensure that countries can effectively benefit from digital health investments, the SMART Guidelines approach is intended to facilitate the accurate reflection of WHO’s clinical, public health and data use guidelines in the digital systems that countries are adopting.

For more on layers of knowledge representation and how they are used in WHO’s SMART Guidelines approach, see [WHO’s SMART Guidelines](https://www.who.int/teams/digital-health-and-innovation/smart-guidelines) and this [Lancet article](https://www.thelancet.com/journals/landig/article/PIIS2589-7500(21)00038-8/fulltext).

The standards-based technical artifacts in this implementation guide are at the third layer of knowledge representation (L3: Machine-readable recommendations). It provides code necessary for software developers to incorporate standardised logic from WHO guidelines into digital systems, testable for conformance to standards including fidelity to recommendations. A standards-based technical implementation guide builds on operational (L2) by mapping L2 content to value sets and Health Level Seven International Fast Healthcare Interoperability Resources (FHIR) standards. Alongside data standards from L2, this allows for semantic and syntactic interoperability at scale. The logic derived from guidelines, which might include clinical decision support and calculations for performance indicators, which may be encoded into Clinical Quality Language (CQL). This ensures that key indicators can be consistently extracted to support patient care, as well as case surveillance and programme monitoring. The machine-readable representations in this implementation guide are intended for adaptation into countries’ digital health service delivery and reporting systems. Digital solutions comprising L3 machine-readable recommendations may then be testable for conformance to interoperability standards.

The fourth layer (L4: Executable—reference applications and services) focuses on software applications and services within a digital ecosystem. It is intended to include executable reference software that accurately represents the intentions, operational, and functional requirements of the WHO recommendations; addresses user and health system needs; and comprises machine-readable data and calculations within interoperability standards, as documented in the L1–L3 layers. As a fully functional application, it is intended to serve as a generic starting point, ready to be localised to the specific operational context of the users, population, and health system within which it is deployed. Additional products at this layer include terminology services to support consistent data representation for interoperability; reusable software libraries including software development kits; application programming interfaces; and function as a service to support updates to FHIR content and capabilities across subscribed digital systems.

