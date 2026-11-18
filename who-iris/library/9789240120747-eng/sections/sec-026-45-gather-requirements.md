---
doc_id: 9789240120747-eng
doc_title: "Digital transformation handbook for reporting substandard and falsified medical products"
section_id: sec-026-45-gather-requirements
section_title: "Gather requirements"
section_number: 4.5
pages: 42-47
source_pdf: 9789240120747-eng.pdf
source_sha256: c710f7cf4a432221
toc_source: inferred
---
## 4.5 Gather requirements

Functional and non-functional requirements outline what the reporting application needs to do and how it should perform. These requirements guide developers and stakeholders in designing, developing and deploying the application. They define the application's purpose, features, functionality and behaviour.

Illustrative functional and non-functional requirements are provided in Tables 12 and 13 as a starting point. This can be adapted and expanded to meet the needs of the country and the specific context.

**Table 12. Sample list of functional requirements**

| Requirement ID | Activity description | As a … | I want … | So that ... |
| --- | --- | --- | --- | --- |
| SFR.FXNREQ.001 | Reporting substandard and falsified medical product | Health care professional | The system to identify the region from where the report is being submitted, based on my profile. | The region is systematically recognized without requiring manual data entry or selection. |
| SFR.FXNREQ.002 | Reporting substandard and falsified medical product | Health care professional | To be able to select the type of report from a predefined list. | I can select the appropriate option without having to type every time. |
| — | Reporting substandard and falsified medical product | Health care professional | To be able to search a product. | I can select the correct brand of product (from the right manufacturer). |
| — | Reporting substandard and falsified medical product | Health care professional | The system to assign applicable type to the selected product. | I will not have to manually enter or select the type of product. |
| — | Reporting substandard and falsified medical product | Health care professional | To be able to capture the product’s batch number and expiry date. | The details of the product are associated with the report being submitted. |
| — | Reporting substandard and falsified medical product | Health care professional | To be able to indicate whether the product is identified as substandard or if it is falsified. | The NMRA can take appropriate steps. |
| — | Reporting substandard and falsified medical product | Health care professional | To be able to indicate whether the product caused adverse effects or unexpected lack of efficacy. | The NMRA can take appropriate steps. |

**Table 13. Sample list of non-functional requirements**

| Requirement ID | Category | Non-functional requirement |
| --- | --- | --- |
| SFR.NFXNREQ.001 | Security – confidentiality | Provide password-protected access for authorized users. |
| SFR.NFXNREQ.002 | Security – confidentiality | Provide a means to ensure confidentiality and privacy of personal health information. |
| — | Security – confidentiality | Provide the ability for allowed users to view confidential data. |
| — | Security – confidentiality | Provide end-to-end encryption of data. |
| — | Security – confidentiality | Data at rest must be encrypted by the IT solution. Industry best practice cryptographic algorithms must be enforced by the IT solution. |
| — | Security – confidentiality | Provide encrypted communication between components. |
| — | Security – confidentiality | For sensitive data, secure data destruction processes must be in place. There must be evidence of secure data destruction. |
| — | Security – confidentiality | Provide secure data transmission methods to prevent others from seeing data sent from one computer to another by using data encryption and private networks across public networks. |
| — | Security – confidentiality | Data must be encrypted on all removable media used by the IT solution. (i.e. USB memory stick, external hard drives). |
| — | Security – confidentiality | A solution should have all levels of technical support for security controls. |
| — | Security – authentication | Notify the user to change their password the first time they log in. |
| — | Security – authentication | Adhere to complex password requirements. |
| — | Security – authentication | Lock a user out after a specified number of wrong password attempts. |
| — | Security – authentication | Notify a user if their account is locked due to wrong password attempts. |
| — | Security – authentication | Provide role-based access to the system: users of the system get access on a need-to-know and need-to-use basis. |
| — | Security – authentication | Multi-factor authentication must be enforced. |
| — | Security – authentication | When authentication is required, all systems or applications should integrate with the single sign on authentication scheme (SAML; OpenID Connect) of the NMRA. |
| — | Security – audit trail and logs | Log system logins and logouts (successful/unsuccessful). |
| — | Security – audit trail and logs | Record all authentication violations, recorded by IP address, date, time and user credentials. |
| — | Security – audit trail and logs | Log all activities performed by the user, including action category, IP address, date, time and user credentials. |
| — | Security – audit trail and logs | Log access to data summaries, reports, analysis and visualization features. |
| — | Security – audit trail and logs | Log exchange of data with other systems. |
| — | Security – audit trail and logs | Log all data and system errors. |
| — | Security – audit trail and logs | Audit history/trail/logs for all records should not be editable. |
| — | Security – user management | Allow user with permission to create a new user and temporary password. |
| — | Security – user management | Provide role-based access. |
| — | Security – user management | Allow roles to be associated with specific geographical areas or health care facilities. |
| — | Security – user management | Allow cascading user management and assignment of roles. |
| — | Security – user management | Allow user to change their own password. |
| — | Security – user management | Allow admin user to request password reset. |
| — | Security – user management | Notify the user to regularly change their password. |
| — | Security – user management | Allow each user to be assigned to one or more roles. |
| — | Security – user management | Support definitions of unlimited roles and assigned levels of access, viewing, entry, editing and auditing. |
| — | Security – general | Perform periodic vulnerability scans and penetration testing when required. |
| — | Security – general | The hosting provider should produce evidence that security controls are in place (i.e. network and web application firewalls; proxy; etc.) including evidence of recent security audits and security penetration tests. |
| — | Security – general | All vendors have to mitigate security risk assessment outputs provided by NMRA as part of the price of the delivery. |
| — | Security – general | There must be a governance mechanism to ensure confidential and sensitive data (to be determined through a separate confidentiality undertaking) is sufficiently protected in accordance with the highest standards, and in compliance with all applicable laws, ordinances, rules and regulations (including the United Nations Principles on Personal Data Protection and Privacy). |
| — | Security – general | Provide a facility to set and maintain authorization access for data entry, validation, update, inquiry and report outputs. |
| — | System requirements – general | Provide a unique version number for each revision. |
| — | System requirements – general | Enable earlier versions of a record to be recoverable. |
| — | System requirements – general | Enable deployment in an environment subject to power loss. |
| — | System requirements – general | Work in an environment that is subject to loss of connectivity. |
| — | System requirements – general | Generate IDs that are unique across different installations or sites. |
| — | System requirements – general | Report version number when saving data to the database. |
| — | System requirements – general | Be designed to be flexible enough to accommodate necessary changes in the future. |
| — | System requirements – general | Allow for offline and online functionality. |
| — | System requirements – general | Show the number of records that are not yet synchronized. |
| — | System requirements – general | Have the ability to easily back up information. |
| — | System requirements – general | Warn user if no valid backup for more than a predefined number of days. |
| — | System requirements – general | Must have the ability to store images and other unstructured data. |
| — | System requirements – general | Use standardized master data to identify health products and facilities. |
| — | System requirements – general | The solution should be designed and certified according to ISO 27000 family. |
| — | System requirements – general | All application software code must be created with exclusive intellectual property rights to NMRA. |
| — | System requirements – general | The developer of software solution must ensure the legality of third-party software components usage. Open source and other similar type of software licences are preferred with no or minimum costs for usage. |
| — | System requirements – general | System must support the transformation of report data into charts or graphs or any other standard visual representations. |
| — | System requirements – general | System must support the creation and export of reports to MS Word, MS Excel, Email or PDF or any other universal standard. |
| — | System requirements – general | System must support the import of data and reports in pdf, xls, rtf, txt, doc, csv formats. |
| — | System requirements – general | Documentation – detail design documentation, administrators’ documentation; support to create user guide documentation must be provided as a part of the price for the project. |
| — | System requirements – general | Vendor to provide evidence of all internal testing including security testing results with corrective actions defined. |
| — | System requirements – general | Training – administrators’ and users’ training must be provided as a part of the price for the project. |
| — | System requirements – general | Support service contract must be ensured together with project realization contract. |
| — | System requirements – scalability | Scalable to accommodate new demands. |
| — | System requirements – scalability | Be able to accommodate at least [x number of] health care facilities. |
| — | System requirements – scalability | Be able to accommodate at least [x number of] concurrent users. |
| — | System requirements – scalability | Be able to accommodate more than [x number of] concurrent users. |
| — | System requirements – usability | Be user-friendly for people with low computer literacy. |
| — | System requirements – usability | Provide informative error messages and tool tips. |
| — | System requirements – usability | Alert the user when navigating away from the form without saving. |
| — | System requirements – usability | Support real-time data entry validation and feedback to prevent data entry errors from being recorded. |
| — | System requirements – usability | Simplify data recording through predefined dropdown or searchable lists, radio buttons and check boxes. |
| — | System requirements – usability | Support multiple languages – English, French, Spanish, Chinese, Russian, Arabic. |
| — | System requirements – usability | Use industry-standard user interface practices and apply them in a consistent manner throughout the system. |
| — | System requirements – usability | Easy to learn and intuitive to enable users to navigate between pages. |
| — | System requirements – usability | Provide guidance to users to better support clinical guidelines and best clinical practices. |
| — | System requirements – usability | Be reliable and robust (minimize the number of system crashes). |
| — | System requirements – usability | Adjust display to fit small screens (such as mobile phones). |
| — | System requirements – usability | Enable use via a web interface and mobile applications for use on various technology devices such as computers, laptops, tablets and mobiles – responsive design must be applied. |
| — | System requirements – usability | Allow for localization such as branding with national regulatory authority and/or national/regional organization logos. |
| — | System requirements – usability | Provide ability to store information such as name and batch number from images. |
| — | System requirements – usability | Provide ability to scan data carriers such as barcodes to identify and store the encoded information. |
| — | System requirements – usability | Automatically save data periodically to prevent loss from power outages or distractions. |
| — | System requirements – usability | Portal should take no more than X seconds to load the First Contentful Paint and return search results no more than X seconds for users on desktop computers and mobile devices. The portal should be able to adapt to low bandwidth settings by deprioritizing delivery of non-crucial elements. |
| — | System requirements – configuration | Configure the system centrally. |
| — | System requirements – configuration | Configure business rules in line with guidelines and standard operating procedures (using the decision logic and contextual query language + Fast Healthcare Interoperability Resources [FHIR]). |
| — | System requirements – configuration | Configure error messages. |
| — | System requirements – configuration | Configure workflows and business rules to accommodate differences between facilities. |
| — | System requirements – configuration | Architecture for development, UAT and production environments must be distinct from each other. |
| — | System requirements – interoperability | Communicate with external systems through mediators. |
| — | System requirements – interoperability | Provide secure access to data through application programming interfaces to interface with other SMART guideline reference app solutions, incumbent solutions (e.g. registration systems) and reporting tools. |
| — | System requirements – interoperability | The reference application must have an FHIR back end/FHIR native and leverage the workstream 3 content (CQL + FHIR resources). |
| — | System requirements – interoperability | Be interoperable with external systems through mediators. |
| — | System requirements – interoperability | Exchange data with other approved systems. |
| — | System requirements – interoperability | Accept data from multiple input methods including paper and geocoding (global positioning system). |
| — | System requirements – hardware and connectivity | Allow for data exchange and efficient synchronization across multiple facilities and points of service when the internet is available, even when it is intermittent and slow. |
| — | Requirements for delivery | Vendors to have a technical change and configuration management process in place that is compliant with the Information Technology Infrastructure Library framework. |
| — | Requirements for delivery | Vendors to have secure software development processes in place (e.g. Open Web Application Security Project Secure Coding Practices). |
| — | Requirements for delivery | Vendor to ensure disaster recovery/business continuity processes in place. This should include backups applications and/or services, replicas and automated failover processes. A disaster recovery plan and periodic testing is obligatory. |
| — | Requirements for delivery | Project final acceptance and last payment milestone to be provided after the go-live following by stabilisation period accepted on agreed UAT results. |

### End of chapter checklist

After finishing the steps outlined in this chapter, there should be a comprehensive current state analysis of the key stakeholders including:

- [ ] User personas
- [ ] Business process and workflow details
- [ ] Data dictionaries with required data elements
- [ ] Functional and non-functional requirements for the reporting application
- [ ] Barriers to reporting
