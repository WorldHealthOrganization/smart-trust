---
doc_id: 9789240120747-eng
doc_title: "Digital transformation handbook for reporting substandard and falsified medical products"
section_id: sec-020-32-link-to-the-enterprise-architecture
section_title: "Link to the enterprise architecture"
section_number: 3.2
pages: 33-34
source_pdf: 9789240120747-eng.pdf
source_sha256: c710f7cf4a432221
toc_source: inferred
---
## 3.2 Link to the enterprise architecture

The DIIG provides an enterprise architecture framework for digital health interventions (Fig. 3).

> “A digital health enterprise architecture, if available in the country, outlines current and planned business processes, data, systems and technologies and provides an overview of the standards, information exchange and interoperability profiles that can be optimized across the enterprise. A clearly established enterprise architecture describing how different processes, data, systems and technologies function together is crucial for guiding interoperability to support data exchange between digital health applications, as well as collective functioning goals. An enterprise architecture blueprint lays the foundation for scaling up and sustaining digital health applications that are standardized and interoperable and that will facilitate access to higher quality, more complete information, in turn resulting in better decisions and more improved health outcomes across multiple areas.” (3)

A digital health enterprise architecture should be developed in alignment with the DIIG framework if one has not already been developed. If a digital health enterprise architecture is already in place, it should be aligned with the DIIG framework. As shown in Fig. 3, the substandard and falsified reporting application will fall under the point of service applications category.

Linking to the digital health enterprise architecture will guide how other digital health applications interoperate with the substandard and falsified reporting application. The architecture will demonstrate how the substandard and falsified reporting application interacts with other components, such as registry services, to uniformly identify facilities, clients and products during reporting. This architecture will provide critical insights for the following key technology considerations.

**Open standards and interoperability.** Identify and implement validated open standards to ensure effective data exchange and interoperability of systems. Open standards will future proof the digital health implementations and promote interoperability. The enterprise architecture will help establish a standardized data exchange framework that allows for the seamless flow of information between the reporting application and the different systems and stakeholders. This will facilitate more efficient reporting and monitoring of substandard and falsified medical products.

*Resources (see page 50)*

- The TOGAF® standard, tenth edition
- FHIR® – Fast Healthcare Interoperability Resources

**Cybersecurity and data protection.** Prioritize cybersecurity and data protection in the design and implementation of the digital solution. Develop and enforce comprehensive cybersecurity policies and procedures to safeguard sensitive data. Implement robust encryption methods, access controls and regular security audits to mitigate potential risks. Ensure compliance with relevant data protection regulations and standards to maintain the privacy and security of patient information.

*Resources (see page 50)*

- Cybersecurity and privacy maturity assessment and strengthening for digital health information systems
- Addressing future cybersecurity threats in digital health: report of the technical consultation, Geneva, Switzerland, 12-14 December 2023

**Fig. 3. DIIG digital health enterprise architecture framework**

| Enterprise layer | Component | Description and examples |
| --- | --- | --- |
| **Point of Service (POS) Applications** | Applications with interventions for Health Programme / Use Case (A, B, C, D) | • **Reused POS application:** Applications that are reused within more than one use case or programme area<br>• **Unique POS application:** Applications that are uniquely used for only one use case or health programme area<br>• **Legend:** Investment for new software; Funded software under development; Investment for strengthening software; Software for decommissioning; Funded fully functional software; Investment for scaling functional software |
| **Interoperability Layer** | Enabling Components | Provides software capabilities to support managed data exchange and interoperability between applications and services across the digital health enterprise |
| **Digital Health Platform — Shared Services** | Business Domain Services | Provides software capabilities, or “services”, specific to health care that may be leveraged by other applications across the digital health enterprise (e.g. Logistics Mgmt info system, Shared Health Record, Health Mgmt info system) |
| **Digital Health Platform — Shared Services** | Registry Services & Terminology Services | Provides software capabilities, or “services”, that are canonical/master “lists,” which are enforced by specified governance mechanisms (e.g. Health Worker Registry, Client Registry, Product Registry, Facility Registry, Terminology Services) |
| **Data Services & Data Sources** | Institution-Based HIS & Data Sources | Digital and non-digital datasets sourced from processes that systematically record information within health institutions and facilities (e.g. Service Availability and Readiness Assessment [SARA]) |
| **Data Services & Data Sources** | Population-Based HIS & Data Sources | Digital and non-digital datasets sourced from processes that systematically record information about members of a population (e.g. Census, Demographic and Health Surveys [DHS]) |
| **Data Services & Data Sources** | Analytics, Dashboards, Aids, Repositories | Data tools that are used to facilitate decision-making (e.g. GIS) |
| **External Systems** | Non-health digital systems | Non-health digital applications, services, interoperability enabling components, and data sources with capabilities that may be leveraged by the digital health enterprise (e.g. national unique identification system, national procurement systems, national weather service data sources, etc.) |

*Source: Digital implementation investment guide (DIIG) (WHO; 2020) (3).*

### End of chapter checklist

After finishing the steps outlined in this chapter, there should be a comprehensive current state analysis of the key stakeholders including:

- [ ] Digital investment roadmap for the substandard and falsified reporting solution
- [ ] Digital health enterprise architecture that includes the substandard and falsified reporting application
