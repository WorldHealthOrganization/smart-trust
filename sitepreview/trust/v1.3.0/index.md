# Home - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* **Home**

## Home

| | |
| :--- | :--- |
| *Official URL*:http://smart.who.int/trust/ImplementationGuide/smart.who.int.trust | *Version*:1.3.0 |
| Active as of 2025-10-27 | *Computable Name*:Trust |

### Summary

 This guide describes the specifications and on-boarding procedures for WHO's Global Digital Health Certification Network (GDHCN). The GDHCN is a mechanism to support verification of health documents and certifications that are exchanged between participants of the GDHCN. These health certifications may include COVID-19 certificates, routine immunization cards, and home-based records consistent with International Patient Summary standards. This mechanism provides means of harmonizing global health protocol standards and establishing a system for recognition of digital certificates for continuity of care and at point of entry. The GDHCN is designed to leverage existing investments by jurisdictions that were made under the COVID-19 response and provide the digital health infrastructure needed for resiliency in future epidemic and pandemic responses. 

 The GDHCN is a digital reflection of the trust WHO already has with Member States. The GDHCN is a digital trust network is based on proven [concepts](concepts.md) which are used to describe the specifications and mechanisms for establishing trust, which allow eligible participants to establish new [trust domains](concepts.md#trust-domain) for exchange of verifiable digital health records. Eligible participants of the trust network may apply to join by following an [on-boarding process](concepts_onboarding.md). The GDHCN is operated under the [GDHCN Administrative and Operational Framework](GDHCN_Administrative_and_Operational_Framework.pdf). 

**Trust Network**

#### Background & Purpose

 In response to COVID-19, Governments and organizations across the world have developed and adopted standards and technologies to create, present, and verify digital vaccination and test credentials. However, a global technical framework to enable convenient use and interoperability of these credentials between systems – while also allowing domestic autonomy over their use – does not exist yet and is critically needed. 

 The WHO Global Digital Health Certification Network is a collection of components that are used to verify interoperable digital health documents or certificates. This system of comprised of three main features: 

* A collection of well defined digital health documents that are issued and verified by members of the GDHCN 
* A Public Key Infrastructure (PKI) that is used for the publishing and distribution of public keys used for verification of digital signatures of the digital health documents. 
* A Knowledge Library used to maintain metadata including terminology codings, product codes and business rules that are used to provide semantic interoperability of these digital health documents

In addition to verifying and validating COVID-19 certificates, a global digital health trust network such as the GDHCN can:

* Establish trust of digitally signed clinical algorithms published by WHO through the SMART Guidelines work.
* Allow for a global product catalogue of trusted medical products and devices.
* Ensure information about a patient can be accessed and trusted regardless of one is in the world.
* Support health systems resiliency to address future outbreaks in a world.
* Empower individuals to manage their own health and well-being.

The interoperable exchange of health information in a trusted environment is a complex task with an increasingly large number of stakeholders (e.g. public health agencies, accredited labs, border control organizations, institutions authorized to verify) that need to ensure that data is transferred safely and securely, that the health content is interoperable, and that information is understandable and actionable. This guide details how to utilize a global technical framework to allow interoperability of health credentials between systems, while preserving domestic autonomy over their use. 

Achieving global interoperability of health certificates does not require that all jurisdictions use the same standard. Interoperability can also be achieved when there are pre-arranged mechanisms in place so that certificates issued by one jurisdiction are accepted in another. A number of services and technical artifacts have been developed to address particular criteria for establishing interoperability and a system of trust including:

* Data models, transformations and vocabulary definitions that allow exchange of health data between various standards formats, preserving a jurisdiction's autonomy regarding domestic processes while allowing re-issuance and mutual recognition of credentials between jurisdictions
* Standard specifications for exchanging public keys between various networks for verifying digital signatures on health credentials
* A global trust registry and federated public key infrastructure solution that provides technical interoperability and technical governance between regional trust networks
* Workflows for creating, sharing and executing business rules that evaluate public health policies against health data for cross-border or port of entry requirements
* Open source tools and technical guidance to reduce the burden of implementing the technical infrastructure to participate in the federated trust network, including open source trust network infrastructure for jurisdictions to implement their own regional trust networks

#### Audience

This guide describes expected workflows for potential actors in a trust ecosystem, namely:

* Issuers that provide verifiable health credentials to individuals,
* Verifiers that consume verifiable health credentials provided by individuals, and
* Trust Networks that establish trust relationships and policies between issuers and verifiers.

The audience for this guide includes decision makers, analysts and technical assets at potential individual issuers, existing trust networks or potential verifiers who may participate in the federated trust network. Stakeholders include Member States, regional networks, and standards development organizations.

#### Participants

**Trust Network Participants**

#### Available Trust Domains

The codes for the GDHCN Trust Domains are contained in the [GDHCN Trust Domain Value Set](ValueSet-Domains.md) and are described in more detail [here](trust_domains.md). 

#### Ethical Considerations and Data Protection Principles

As with any digital solution, there are ethical considerations, such as potential impacts on equity and on equitable access, and data protection principles that need to inform the design of the technical specifications, as well as provide guidance on how resulting solutions can be ethically implemented. The following [page](ethical_principles.md) discusses some key ethical considerations and data protection principles that Member States are encouraged to – and, where they have legal obligations, must – include in their respective deployments of digital solutions. These ethical considerations and data protection principles have also informed the design criteria for WHO’s SMART Guidelines and for the utilization of the WHO’s Global Digital Health Certification Network. 

#### Feedback

 Feedback specific to this Implementation Guide can provided through: 

* Frequently asked questions can be viewed [here](faq.md)
* Clicking on one of the Feedbacks link to the right of any section header
* Sending an email to [gdhcn-support@who.int](mailto:gdhcn-support@who.int?subject = IG Feedback)
* Creating an issue on GitHub [trust repository](https://github.com/WorldHealthOrganization/trust)

#### Community

Sign up on [chat.fhir.org](https://chat.fhir.org/) community and follow the stream who-smart-guidelines for questions, queries and chats related to WHO SMART Guidelines

[chat.fhir.org](https://chat.fhir.org/)

WHO also hosts weekly calls on authoring and implementing WHO SMART Guidelines where participation is welcome. Please send an email at [gdhcn-support@who.int](mailto:gdhcn-support@who.int?subject = SMART Trust FHIR IG) in order to get invited.

[gdhcn-support@who.int](mailto:gdhcn-support@who.int?subject = SMART Trust FHIR IG)

#### Disclaimer

 The specification herewith documented is for the WHO Gloa demo working specification, and may not be used for any implementation purposes. This draft is provided without warranty of completeness or consistency, and the official publication supersedes this draft. No liability can be inferred from the use or misuse of this specification, or its consequences. 



## Resource Content

```json
{
  "resourceType" : "ImplementationGuide",
  "id" : "smart.who.int.trust",
  "meta" : {
    "profile" : [
      "http://smart.who.int/base/StructureDefinition/SGImplementationGuide"
    ]
  },
  "url" : "http://smart.who.int/trust/ImplementationGuide/smart.who.int.trust",
  "version" : "1.3.0",
  "name" : "Trust",
  "title" : "WHO SMART Trust",
  "status" : "active",
  "experimental" : false,
  "date" : "2025-10-27T08:33:32+00:00",
  "publisher" : "WHO",
  "contact" : [
    {
      "name" : "WHO",
      "telecom" : [
        {
          "system" : "url",
          "value" : "http://who.int"
        }
      ]
    }
  ],
  "description" : "SMART Trust Implementation Guide",
  "jurisdiction" : [
    {
      "coding" : [
        {
          "system" : "http://unstats.un.org/unsd/methods/m49/m49.htm",
          "code" : "001"
        }
      ]
    }
  ],
  "packageId" : "smart.who.int.trust",
  "license" : "CC-BY-SA-3.0-IGO",
  "fhirVersion" : ["4.0.1"],
  "dependsOn" : [
    {
      "id" : "hl7tx",
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/tools/StructureDefinition/implementationguide-dependency-comment",
          "valueMarkdown" : "Automatically added as a dependency - all IGs depend on HL7 Terminology"
        }
      ],
      "uri" : "http://terminology.hl7.org/ImplementationGuide/hl7.terminology",
      "packageId" : "hl7.terminology.r4",
      "version" : "6.5.0"
    },
    {
      "id" : "hl7_fhir_uv_extensions_r5",
      "uri" : "http://hl7.org/fhir/extensions/ImplementationGuide/hl7.fhir.uv.extensions",
      "packageId" : "hl7.fhir.uv.extensions.r5",
      "version" : "5.2.0"
    },
    {
      "id" : "smart_who_int_base",
      "uri" : "http://smart.who.int/base/ImplementationGuide/smart.who.int.base",
      "packageId" : "smart.who.int.base",
      "version" : "0.2.0"
    },
    {
      "id" : "smart_who_int_trust_phw",
      "uri" : "http://smart.who.int/trust-phw/ImplementationGuide/smart.who.int.trust-phw",
      "packageId" : "smart.who.int.trust-phw",
      "version" : "0.1.0"
    },
    {
      "id" : "who_ddcc",
      "uri" : "http://smart.who.int/ddcc/ImplementationGuide/who.ddcc",
      "packageId" : "who.ddcc",
      "version" : "1.0.1"
    },
    {
      "id" : "IHE_ITI_mCSD",
      "uri" : "https://profiles.ihe.net/ITI/mCSD/ImplementationGuide/ihe.iti.mcsd",
      "packageId" : "ihe.iti.mcsd",
      "version" : "3.8.0"
    }
  ],
  "definition" : {
    "extension" : [
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "copyrightyear"
          },
          {
            "url" : "value",
            "valueString" : "2023+"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "releaselabel"
          },
          {
            "url" : "value",
            "valueString" : "release"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "show-inherited-invariants"
          },
          {
            "url" : "value",
            "valueString" : "false"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "usage-stats-opt-out"
          },
          {
            "url" : "value",
            "valueString" : "false"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "logging"
          },
          {
            "url" : "value",
            "valueString" : "progress"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "shownav"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "active-tables"
          },
          {
            "url" : "value",
            "valueString" : "false"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-contact"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-jurisdiction"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-publisher"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-version"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "produce-jekyll-data"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "autoload-resources"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-liquid"
          },
          {
            "url" : "value",
            "valueString" : "template/liquid"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-liquid"
          },
          {
            "url" : "value",
            "valueString" : "input/liquid"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-qa"
          },
          {
            "url" : "value",
            "valueString" : "temp/qa"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-temp"
          },
          {
            "url" : "value",
            "valueString" : "temp/pages"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-output"
          },
          {
            "url" : "value",
            "valueString" : "output"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-suppressed-warnings"
          },
          {
            "url" : "value",
            "valueString" : "input/ignoreWarnings.txt"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "path-history"
          },
          {
            "url" : "value",
            "valueString" : "http://smart.who.int/trust/history.html"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "template-html"
          },
          {
            "url" : "value",
            "valueString" : "template-page.html"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "template-md"
          },
          {
            "url" : "value",
            "valueString" : "template-page-md.html"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-context"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-copyright"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-license"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "apply-wg"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "fmm-definition"
          },
          {
            "url" : "value",
            "valueString" : "http://hl7.org/fhir/versions.html#maturity"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "propagate-status"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "excludelogbinaryformat"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueString" : "tabbed-snapshots"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-internal-dependency",
        "valueCode" : "hl7.fhir.uv.tools.r4#0.8.0"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "copyrightyear"
          },
          {
            "url" : "value",
            "valueString" : "2023+"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "releaselabel"
          },
          {
            "url" : "value",
            "valueString" : "release"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "show-inherited-invariants"
          },
          {
            "url" : "value",
            "valueString" : "false"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "usage-stats-opt-out"
          },
          {
            "url" : "value",
            "valueString" : "false"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "logging"
          },
          {
            "url" : "value",
            "valueString" : "progress"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "shownav"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "active-tables"
          },
          {
            "url" : "value",
            "valueString" : "false"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-contact"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-jurisdiction"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-publisher"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-version"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "produce-jekyll-data"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "autoload-resources"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-liquid"
          },
          {
            "url" : "value",
            "valueString" : "template/liquid"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-liquid"
          },
          {
            "url" : "value",
            "valueString" : "input/liquid"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-qa"
          },
          {
            "url" : "value",
            "valueString" : "temp/qa"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-temp"
          },
          {
            "url" : "value",
            "valueString" : "temp/pages"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-output"
          },
          {
            "url" : "value",
            "valueString" : "output"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-suppressed-warnings"
          },
          {
            "url" : "value",
            "valueString" : "input/ignoreWarnings.txt"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "path-history"
          },
          {
            "url" : "value",
            "valueString" : "http://smart.who.int/trust/history.html"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "template-html"
          },
          {
            "url" : "value",
            "valueString" : "template-page.html"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "template-md"
          },
          {
            "url" : "value",
            "valueString" : "template-page-md.html"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-context"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-copyright"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-license"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "apply-wg"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "fmm-definition"
          },
          {
            "url" : "value",
            "valueString" : "http://hl7.org/fhir/versions.html#maturity"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "propagate-status"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "excludelogbinaryformat"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      },
      {
        "extension" : [
          {
            "url" : "code",
            "valueCode" : "tabbed-snapshots"
          },
          {
            "url" : "value",
            "valueString" : "true"
          }
        ],
        "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-parameter"
      }
    ],
    "resource" : [
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "StructureDefinition:logical:abstract"
          }
        ],
        "reference" : {
          "reference" : "StructureDefinition/CWT"
        },
        "name" : "CBOR Web Token (CWT) Claim",
        "description" : "Logical Model for Data elements in CBOR Web Token (CWT) https://www.iana.org/assignments/cwt/cwt.xhtml",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "StructureDefinition:logical"
          }
        ],
        "reference" : {
          "reference" : "StructureDefinition/CWTPayload"
        },
        "name" : "CBOR Web Token (CWT) Payload (Common)",
        "description" : "Logical Model for CBOR Web Token (CWT) Payload Logical Modelin CWT Payload https://www.iana.org/assignments/cwt/cwt.xhtml",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "StructureDefinition:logical"
          }
        ],
        "reference" : {
          "reference" : "StructureDefinition/COSEHeader"
        },
        "name" : "COSE Headers (DRAFT)",
        "description" : "Data elements for COSE Headers https://www.iana.org/assignments/cose/cose.xhtml#header-parameters",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/DistributeBusinessRules"
        },
        "name" : "Distribute business rules",
        "description" : "Make received business rules available through a distrubution point to a Receiver",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/DistributeBusinessRulesCertLogic"
        },
        "name" : "Distribute CertLogic business rules",
        "description" : "Make received CertLoigc business rules available through a distrubution point to a Receiver",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/DistributeBusinessRulesFHIR"
        },
        "name" : "Distribute FHIR business rules",
        "description" : "Make received business rules available through a distrubution point to a Receiver through HL7 FHIR standards",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/DistributePKIMaterial"
        },
        "name" : "Distribute PKI material",
        "description" : "Make received trust material available through a distrubution point to a Trust Network Participant",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/DistributePKIMaterialDID"
        },
        "name" : "Distribute PKI material as DID",
        "description" : "Make received trust material available through a distrubution point to a Trust Network Participant as DID",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/DistributePKIMaterialAPI"
        },
        "name" : "Distribute PKI material via API",
        "description" : "Make received trust material available through a distrubution point to a Trust Network Participant via API",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ALB"
        },
        "name" : "GDHCNParticipant-ALB",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ALB-UAT"
        },
        "name" : "GDHCNParticipant-ALB-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-AND"
        },
        "name" : "GDHCNParticipant-AND",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-AND-DEV"
        },
        "name" : "GDHCNParticipant-AND-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-AND-UAT"
        },
        "name" : "GDHCNParticipant-AND-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ARG-DEV"
        },
        "name" : "GDHCNParticipant-ARG-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ARM"
        },
        "name" : "GDHCNParticipant-ARM",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ARM-DEV"
        },
        "name" : "GDHCNParticipant-ARM-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ARM-UAT"
        },
        "name" : "GDHCNParticipant-ARM-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BEL"
        },
        "name" : "GDHCNParticipant-BEL",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BEL-UAT"
        },
        "name" : "GDHCNParticipant-BEL-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BEN"
        },
        "name" : "GDHCNParticipant-BEN",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BEN-UAT"
        },
        "name" : "GDHCNParticipant-BEN-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BHS-DEV"
        },
        "name" : "GDHCNParticipant-BHS-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BLZ-DEV"
        },
        "name" : "GDHCNParticipant-BLZ-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BRA"
        },
        "name" : "GDHCNParticipant-BRA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BRA-DEV"
        },
        "name" : "GDHCNParticipant-BRA-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BRA-UAT"
        },
        "name" : "GDHCNParticipant-BRA-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-BRB-DEV"
        },
        "name" : "GDHCNParticipant-BRB-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CAN-UAT"
        },
        "name" : "GDHCNParticipant-CAN-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CHL-DEV"
        },
        "name" : "GDHCNParticipant-CHL-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-COL-DEV"
        },
        "name" : "GDHCNParticipant-COL-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CRI-DEV"
        },
        "name" : "GDHCNParticipant-CRI-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CYP"
        },
        "name" : "GDHCNParticipant-CYP",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CYP-DEV"
        },
        "name" : "GDHCNParticipant-CYP-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CYP-UAT"
        },
        "name" : "GDHCNParticipant-CYP-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CZE"
        },
        "name" : "GDHCNParticipant-CZE",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-CZE-UAT"
        },
        "name" : "GDHCNParticipant-CZE-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-DOM-DEV"
        },
        "name" : "GDHCNParticipant-DOM-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ECU-DEV"
        },
        "name" : "GDHCNParticipant-ECU-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ESP"
        },
        "name" : "GDHCNParticipant-ESP",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ESP-UAT"
        },
        "name" : "GDHCNParticipant-ESP-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-EST"
        },
        "name" : "GDHCNParticipant-EST",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-EST-DEV"
        },
        "name" : "GDHCNParticipant-EST-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-EST-UAT"
        },
        "name" : "GDHCNParticipant-EST-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-FIN"
        },
        "name" : "GDHCNParticipant-FIN",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-FIN-UAT"
        },
        "name" : "GDHCNParticipant-FIN-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-FRA"
        },
        "name" : "GDHCNParticipant-FRA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-FRA-UAT"
        },
        "name" : "GDHCNParticipant-FRA-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-FRO"
        },
        "name" : "GDHCNParticipant-FRO",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-FRO-UAT"
        },
        "name" : "GDHCNParticipant-FRO-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-GTM-DEV"
        },
        "name" : "GDHCNParticipant-GTM-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-HND-DEV"
        },
        "name" : "GDHCNParticipant-HND-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-HRV-UAT"
        },
        "name" : "GDHCNParticipant-HRV-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-IDN"
        },
        "name" : "GDHCNParticipant-IDN",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-IDN-DEV"
        },
        "name" : "GDHCNParticipant-IDN-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-IDN-UAT"
        },
        "name" : "GDHCNParticipant-IDN-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-IRL"
        },
        "name" : "GDHCNParticipant-IRL",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-IRL-UAT"
        },
        "name" : "GDHCNParticipant-IRL-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-ISL"
        },
        "name" : "GDHCNParticipant-ISL",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-LTU"
        },
        "name" : "GDHCNParticipant-LTU",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-LTU-UAT"
        },
        "name" : "GDHCNParticipant-LTU-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-LVA"
        },
        "name" : "GDHCNParticipant-LVA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-LVA-DEV"
        },
        "name" : "GDHCNParticipant-LVA-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-LVA-UAT"
        },
        "name" : "GDHCNParticipant-LVA-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-MCO"
        },
        "name" : "GDHCNParticipant-MCO",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-MCO-UAT"
        },
        "name" : "GDHCNParticipant-MCO-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-MLT"
        },
        "name" : "GDHCNParticipant-MLT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-MLT-UAT"
        },
        "name" : "GDHCNParticipant-MLT-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-MYS"
        },
        "name" : "GDHCNParticipant-MYS",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-MYS-UAT"
        },
        "name" : "GDHCNParticipant-MYS-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-NLD"
        },
        "name" : "GDHCNParticipant-NLD",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-NLD-UAT"
        },
        "name" : "GDHCNParticipant-NLD-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-NZL"
        },
        "name" : "GDHCNParticipant-NZL",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-NZL-UAT"
        },
        "name" : "GDHCNParticipant-NZL-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-OMN"
        },
        "name" : "GDHCNParticipant-OMN",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-OMN-DEV"
        },
        "name" : "GDHCNParticipant-OMN-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-OMN-UAT"
        },
        "name" : "GDHCNParticipant-OMN-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-PAN-DEV"
        },
        "name" : "GDHCNParticipant-PAN-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-PER-DEV"
        },
        "name" : "GDHCNParticipant-PER-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-POL"
        },
        "name" : "GDHCNParticipant-POL",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-POL-UAT"
        },
        "name" : "GDHCNParticipant-POL-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-PRT"
        },
        "name" : "GDHCNParticipant-PRT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-PRT-UAT"
        },
        "name" : "GDHCNParticipant-PRT-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-PRY-DEV"
        },
        "name" : "GDHCNParticipant-PRY-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SAU-UAT"
        },
        "name" : "GDHCNParticipant-SAU-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SGP"
        },
        "name" : "GDHCNParticipant-SGP",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SGP-DEV"
        },
        "name" : "GDHCNParticipant-SGP-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SGP-UAT"
        },
        "name" : "GDHCNParticipant-SGP-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SLV-DEV"
        },
        "name" : "GDHCNParticipant-SLV-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SMR"
        },
        "name" : "GDHCNParticipant-SMR",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SMR-DEV"
        },
        "name" : "GDHCNParticipant-SMR-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SMR-UAT"
        },
        "name" : "GDHCNParticipant-SMR-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SUR-DEV"
        },
        "name" : "GDHCNParticipant-SUR-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SVK"
        },
        "name" : "GDHCNParticipant-SVK",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SVK-UAT"
        },
        "name" : "GDHCNParticipant-SVK-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SVN"
        },
        "name" : "GDHCNParticipant-SVN",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SVN-DEV"
        },
        "name" : "GDHCNParticipant-SVN-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SVN-UAT"
        },
        "name" : "GDHCNParticipant-SVN-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SWE"
        },
        "name" : "GDHCNParticipant-SWE",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-SWE-UAT"
        },
        "name" : "GDHCNParticipant-SWE-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-TGO"
        },
        "name" : "GDHCNParticipant-TGO",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-TGO-DEV"
        },
        "name" : "GDHCNParticipant-TGO-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-TGO-UAT"
        },
        "name" : "GDHCNParticipant-TGO-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-THA"
        },
        "name" : "GDHCNParticipant-THA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-THA-UAT"
        },
        "name" : "GDHCNParticipant-THA-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-TUR"
        },
        "name" : "GDHCNParticipant-TUR",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-TUR-UAT"
        },
        "name" : "GDHCNParticipant-TUR-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-URY-DEV"
        },
        "name" : "GDHCNParticipant-URY-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-USA-DEV"
        },
        "name" : "GDHCNParticipant-USA-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-WHO"
        },
        "name" : "GDHCNParticipant-WHO",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-WHO-DEV"
        },
        "name" : "GDHCNParticipant-WHO-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-WHO-UAT"
        },
        "name" : "GDHCNParticipant-WHO-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XCL-DEV"
        },
        "name" : "GDHCNParticipant-XCL-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XML-DEV"
        },
        "name" : "GDHCNParticipant-XML-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXA-DEV"
        },
        "name" : "GDHCNParticipant-XXA-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXA-UAT"
        },
        "name" : "GDHCNParticipant-XXA-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXB-DEV"
        },
        "name" : "GDHCNParticipant-XXB-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXB-UAT"
        },
        "name" : "GDHCNParticipant-XXB-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXC-DEV"
        },
        "name" : "GDHCNParticipant-XXC-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXC-UAT"
        },
        "name" : "GDHCNParticipant-XXC-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXD-DEV"
        },
        "name" : "GDHCNParticipant-XXD-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXD-UAT"
        },
        "name" : "GDHCNParticipant-XXD-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXE-DEV"
        },
        "name" : "GDHCNParticipant-XXE-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXF-DEV"
        },
        "name" : "GDHCNParticipant-XXF-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXG-DEV"
        },
        "name" : "GDHCNParticipant-XXG-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXH-DEV"
        },
        "name" : "GDHCNParticipant-XXH-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXI-DEV"
        },
        "name" : "GDHCNParticipant-XXI-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXJ-DEV"
        },
        "name" : "GDHCNParticipant-XXJ-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXK-DEV"
        },
        "name" : "GDHCNParticipant-XXK-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXO-DEV"
        },
        "name" : "GDHCNParticipant-XXO-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXO-UAT"
        },
        "name" : "GDHCNParticipant-XXO-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXP-DEV"
        },
        "name" : "GDHCNParticipant-XXP-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXS-UAT"
        },
        "name" : "GDHCNParticipant-XXS-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXU-DEV"
        },
        "name" : "GDHCNParticipant-XXU-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXU-UAT"
        },
        "name" : "GDHCNParticipant-XXU-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXV-DEV"
        },
        "name" : "GDHCNParticipant-XXV-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXV-UAT"
        },
        "name" : "GDHCNParticipant-XXV-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXX-DEV"
        },
        "name" : "GDHCNParticipant-XXX-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XXX-UAT"
        },
        "name" : "GDHCNParticipant-XXX-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XYK-DEV"
        },
        "name" : "GDHCNParticipant-XYK-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Organization"
          }
        ],
        "reference" : {
          "reference" : "Organization/GDHCNParticipant-XYK-UAT"
        },
        "name" : "GDHCNParticipant-XYK-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ALB-All"
        },
        "name" : "GDHCNParticipantDID-ALB-All",
        "description" : "Albania Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ALB\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/ALB/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ALB-DSC"
        },
        "name" : "GDHCNParticipantDID-ALB-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ALB-SCA"
        },
        "name" : "GDHCNParticipantDID-ALB-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ALB-UAT-All"
        },
        "name" : "GDHCNParticipantDID-ALB-UAT-All",
        "description" : "Albania Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ALB\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ALB/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ALB-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-ALB-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ALB-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-ALB-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-All"
        },
        "name" : "GDHCNParticipantDID-AND-All",
        "description" : "Andorra Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:AND\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/AND/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-DEV-All"
        },
        "name" : "GDHCNParticipantDID-AND-DEV-All",
        "description" : "Andorra Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:AND\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/AND/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-AND-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-AND-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-DSC"
        },
        "name" : "GDHCNParticipantDID-AND-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-SCA"
        },
        "name" : "GDHCNParticipantDID-AND-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-UAT-All"
        },
        "name" : "GDHCNParticipantDID-AND-UAT-All",
        "description" : "Andorra Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:AND\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/AND/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-AND-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-AND-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-AND-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARG-DEV-All"
        },
        "name" : "GDHCNParticipantDID-ARG-DEV-All",
        "description" : "Argentina Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ARG\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARG/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARG-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-ARG-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARG-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-ARG-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-All"
        },
        "name" : "GDHCNParticipantDID-ARM-All",
        "description" : "Armenia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ARM\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/ARM/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-DEV-All"
        },
        "name" : "GDHCNParticipantDID-ARM-DEV-All",
        "description" : "Armenia Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ARM\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ARM/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-ARM-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-ARM-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-DSC"
        },
        "name" : "GDHCNParticipantDID-ARM-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-SCA"
        },
        "name" : "GDHCNParticipantDID-ARM-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-UAT-All"
        },
        "name" : "GDHCNParticipantDID-ARM-UAT-All",
        "description" : "Armenia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ARM\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ARM/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-ARM-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ARM-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-ARM-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEL-All"
        },
        "name" : "GDHCNParticipantDID-BEL-All",
        "description" : "Belgium Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BEL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/BEL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEL-DSC"
        },
        "name" : "GDHCNParticipantDID-BEL-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEL-SCA"
        },
        "name" : "GDHCNParticipantDID-BEL-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEL-UAT-All"
        },
        "name" : "GDHCNParticipantDID-BEL-UAT-All",
        "description" : "Belgium Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BEL\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEL-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-BEL-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEL-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-BEL-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEN-All"
        },
        "name" : "GDHCNParticipantDID-BEN-All",
        "description" : "Benin Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BEN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/BEN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEN-DSC"
        },
        "name" : "GDHCNParticipantDID-BEN-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEN-SCA"
        },
        "name" : "GDHCNParticipantDID-BEN-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEN-UAT-All"
        },
        "name" : "GDHCNParticipantDID-BEN-UAT-All",
        "description" : "Benin Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BEN\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BEN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEN-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-BEN-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BEN-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-BEN-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BHS-DEV-All"
        },
        "name" : "GDHCNParticipantDID-BHS-DEV-All",
        "description" : "Bahamas Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BHS\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BHS/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BHS-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-BHS-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BHS-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-BHS-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BLZ-DEV-All"
        },
        "name" : "GDHCNParticipantDID-BLZ-DEV-All",
        "description" : "Belize Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BLZ\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BLZ/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BLZ-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-BLZ-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BLZ-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-BLZ-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-All"
        },
        "name" : "GDHCNParticipantDID-BRA-All",
        "description" : "Brazil Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BRA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/BRA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-DEV-All"
        },
        "name" : "GDHCNParticipantDID-BRA-DEV-All",
        "description" : "Brazil Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BRA\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-BRA-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-BRA-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-DSC"
        },
        "name" : "GDHCNParticipantDID-BRA-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-SCA"
        },
        "name" : "GDHCNParticipantDID-BRA-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-UAT-All"
        },
        "name" : "GDHCNParticipantDID-BRA-UAT-All",
        "description" : "Brazil Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BRA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/BRA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-BRA-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRA-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-BRA-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRB-DEV-All"
        },
        "name" : "GDHCNParticipantDID-BRB-DEV-All",
        "description" : "Barbados Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:BRB\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/BRB/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRB-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-BRB-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-BRB-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-BRB-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CAN-UAT-All"
        },
        "name" : "GDHCNParticipantDID-CAN-UAT-All",
        "description" : "Canada Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CAN\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CAN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CAN-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-CAN-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CAN-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-CAN-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CHL-DEV-All"
        },
        "name" : "GDHCNParticipantDID-CHL-DEV-All",
        "description" : "Chile Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CHL\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CHL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CHL-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-CHL-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CHL-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-CHL-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-COL-DEV-All"
        },
        "name" : "GDHCNParticipantDID-COL-DEV-All",
        "description" : "Colombia Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:COL\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/COL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-COL-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-COL-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-COL-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-COL-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CRI-DEV-All"
        },
        "name" : "GDHCNParticipantDID-CRI-DEV-All",
        "description" : "Costa Rica Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CRI\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CRI/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CRI-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-CRI-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CRI-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-CRI-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-All"
        },
        "name" : "GDHCNParticipantDID-CYP-All",
        "description" : "Cyprus Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CYP\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/CYP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-DEV-All"
        },
        "name" : "GDHCNParticipantDID-CYP-DEV-All",
        "description" : "Cyprus Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CYP\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/CYP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-CYP-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-CYP-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-DSC"
        },
        "name" : "GDHCNParticipantDID-CYP-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-SCA"
        },
        "name" : "GDHCNParticipantDID-CYP-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-UAT-All"
        },
        "name" : "GDHCNParticipantDID-CYP-UAT-All",
        "description" : "Cyprus Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CYP\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CYP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-CYP-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CYP-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-CYP-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CZE-All"
        },
        "name" : "GDHCNParticipantDID-CZE-All",
        "description" : "Czechia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CZE\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/CZE/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CZE-DSC"
        },
        "name" : "GDHCNParticipantDID-CZE-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CZE-SCA"
        },
        "name" : "GDHCNParticipantDID-CZE-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CZE-UAT-All"
        },
        "name" : "GDHCNParticipantDID-CZE-UAT-All",
        "description" : "Czechia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:CZE\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/CZE/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CZE-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-CZE-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-CZE-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-CZE-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-DOM-DEV-All"
        },
        "name" : "GDHCNParticipantDID-DOM-DEV-All",
        "description" : "Dominican Republic Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:DOM\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/DOM/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-DOM-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-DOM-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-DOM-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-DOM-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ECU-DEV-All"
        },
        "name" : "GDHCNParticipantDID-ECU-DEV-All",
        "description" : "Ecuador Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ECU\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/ECU/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ECU-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-ECU-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ECU-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-ECU-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ESP-All"
        },
        "name" : "GDHCNParticipantDID-ESP-All",
        "description" : "Spain Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ESP\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/ESP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ESP-DSC"
        },
        "name" : "GDHCNParticipantDID-ESP-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ESP-SCA"
        },
        "name" : "GDHCNParticipantDID-ESP-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ESP-UAT-All"
        },
        "name" : "GDHCNParticipantDID-ESP-UAT-All",
        "description" : "Spain Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ESP\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/ESP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ESP-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-ESP-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ESP-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-ESP-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-All"
        },
        "name" : "GDHCNParticipantDID-EST-All",
        "description" : "Estonia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:EST\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/EST/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-DEV-All"
        },
        "name" : "GDHCNParticipantDID-EST-DEV-All",
        "description" : "Estonia Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:EST\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/EST/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-EST-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-EST-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-DSC"
        },
        "name" : "GDHCNParticipantDID-EST-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-SCA"
        },
        "name" : "GDHCNParticipantDID-EST-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-UAT-All"
        },
        "name" : "GDHCNParticipantDID-EST-UAT-All",
        "description" : "Estonia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:EST\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/EST/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-EST-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-EST-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-EST-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FIN-All"
        },
        "name" : "GDHCNParticipantDID-FIN-All",
        "description" : "Finland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FIN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/FIN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FIN-DSC"
        },
        "name" : "GDHCNParticipantDID-FIN-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FIN-SCA"
        },
        "name" : "GDHCNParticipantDID-FIN-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FIN-UAT-All"
        },
        "name" : "GDHCNParticipantDID-FIN-UAT-All",
        "description" : "Finland Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FIN\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FIN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FIN-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-FIN-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FIN-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-FIN-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRA-All"
        },
        "name" : "GDHCNParticipantDID-FRA-All",
        "description" : "France Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FRA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/FRA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRA-DSC"
        },
        "name" : "GDHCNParticipantDID-FRA-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRA-SCA"
        },
        "name" : "GDHCNParticipantDID-FRA-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRA-UAT-All"
        },
        "name" : "GDHCNParticipantDID-FRA-UAT-All",
        "description" : "France Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FRA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRA-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-FRA-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRA-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-FRA-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRO-All"
        },
        "name" : "GDHCNParticipantDID-FRO-All",
        "description" : "Faroe Islands Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FRO\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/FRO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRO-DSC"
        },
        "name" : "GDHCNParticipantDID-FRO-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRO-SCA"
        },
        "name" : "GDHCNParticipantDID-FRO-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRO-UAT-All"
        },
        "name" : "GDHCNParticipantDID-FRO-UAT-All",
        "description" : "Faroe Islands Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:FRO\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/FRO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRO-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-FRO-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-FRO-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-FRO-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-GTM-DEV-All"
        },
        "name" : "GDHCNParticipantDID-GTM-DEV-All",
        "description" : "Guatemala Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:GTM\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/GTM/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-GTM-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-GTM-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-GTM-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-GTM-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-HND-DEV-All"
        },
        "name" : "GDHCNParticipantDID-HND-DEV-All",
        "description" : "Honduras Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:HND\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/HND/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-HND-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-HND-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-HND-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-HND-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-HRV-UAT-All"
        },
        "name" : "GDHCNParticipantDID-HRV-UAT-All",
        "description" : "Croatia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:HRV\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/HRV/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-HRV-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-HRV-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-HRV-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-HRV-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-All"
        },
        "name" : "GDHCNParticipantDID-IDN-All",
        "description" : "Indonesia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IDN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/IDN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-DEV-All"
        },
        "name" : "GDHCNParticipantDID-IDN-DEV-All",
        "description" : "Indonesia Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IDN\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/IDN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-IDN-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-IDN-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-DSC"
        },
        "name" : "GDHCNParticipantDID-IDN-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-SCA"
        },
        "name" : "GDHCNParticipantDID-IDN-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-UAT-All"
        },
        "name" : "GDHCNParticipantDID-IDN-UAT-All",
        "description" : "Indonesia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IDN\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IDN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-IDN-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IDN-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-IDN-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IRL-All"
        },
        "name" : "GDHCNParticipantDID-IRL-All",
        "description" : "Ireland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IRL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/IRL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IRL-DSC"
        },
        "name" : "GDHCNParticipantDID-IRL-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IRL-SCA"
        },
        "name" : "GDHCNParticipantDID-IRL-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IRL-UAT-All"
        },
        "name" : "GDHCNParticipantDID-IRL-UAT-All",
        "description" : "Ireland Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:IRL\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/IRL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IRL-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-IRL-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-IRL-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-IRL-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ISL-All"
        },
        "name" : "GDHCNParticipantDID-ISL-All",
        "description" : "Iceland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:ISL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/ISL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ISL-DSC"
        },
        "name" : "GDHCNParticipantDID-ISL-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-ISL-SCA"
        },
        "name" : "GDHCNParticipantDID-ISL-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LTU-All"
        },
        "name" : "GDHCNParticipantDID-LTU-All",
        "description" : "Lithuania Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:LTU\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/LTU/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LTU-DSC"
        },
        "name" : "GDHCNParticipantDID-LTU-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LTU-SCA"
        },
        "name" : "GDHCNParticipantDID-LTU-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LTU-UAT-All"
        },
        "name" : "GDHCNParticipantDID-LTU-UAT-All",
        "description" : "Lithuania Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:LTU\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LTU/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LTU-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-LTU-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LTU-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-LTU-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-All"
        },
        "name" : "GDHCNParticipantDID-LVA-All",
        "description" : "Latvia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:LVA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/LVA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-DEV-All"
        },
        "name" : "GDHCNParticipantDID-LVA-DEV-All",
        "description" : "Latvia Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:LVA\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/LVA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-LVA-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-LVA-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-DSC"
        },
        "name" : "GDHCNParticipantDID-LVA-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-SCA"
        },
        "name" : "GDHCNParticipantDID-LVA-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-UAT-All"
        },
        "name" : "GDHCNParticipantDID-LVA-UAT-All",
        "description" : "Latvia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:LVA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/LVA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-LVA-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-LVA-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-LVA-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MCO-All"
        },
        "name" : "GDHCNParticipantDID-MCO-All",
        "description" : "Monaco Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MCO\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/MCO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MCO-DSC"
        },
        "name" : "GDHCNParticipantDID-MCO-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MCO-SCA"
        },
        "name" : "GDHCNParticipantDID-MCO-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MCO-UAT-All"
        },
        "name" : "GDHCNParticipantDID-MCO-UAT-All",
        "description" : "Monaco Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MCO\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MCO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MCO-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-MCO-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MCO-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-MCO-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MLT-All"
        },
        "name" : "GDHCNParticipantDID-MLT-All",
        "description" : "Malta Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MLT\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/MLT/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MLT-DSC"
        },
        "name" : "GDHCNParticipantDID-MLT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MLT-SCA"
        },
        "name" : "GDHCNParticipantDID-MLT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MLT-UAT-All"
        },
        "name" : "GDHCNParticipantDID-MLT-UAT-All",
        "description" : "Malta Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MLT\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MLT/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MLT-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-MLT-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MLT-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-MLT-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MYS-All"
        },
        "name" : "GDHCNParticipantDID-MYS-All",
        "description" : "Malaysia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MYS\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/MYS/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MYS-DSC"
        },
        "name" : "GDHCNParticipantDID-MYS-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MYS-SCA"
        },
        "name" : "GDHCNParticipantDID-MYS-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MYS-UAT-All"
        },
        "name" : "GDHCNParticipantDID-MYS-UAT-All",
        "description" : "Malaysia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:MYS\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/MYS/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MYS-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-MYS-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-MYS-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-MYS-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NLD-All"
        },
        "name" : "GDHCNParticipantDID-NLD-All",
        "description" : "Netherlands (Kingdom of the) Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:NLD\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/NLD/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NLD-DSC"
        },
        "name" : "GDHCNParticipantDID-NLD-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NLD-SCA"
        },
        "name" : "GDHCNParticipantDID-NLD-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NLD-UAT-All"
        },
        "name" : "GDHCNParticipantDID-NLD-UAT-All",
        "description" : "Netherlands (Kingdom of the) Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:NLD\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NLD/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NLD-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-NLD-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NLD-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-NLD-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NZL-All"
        },
        "name" : "GDHCNParticipantDID-NZL-All",
        "description" : "New Zealand Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:NZL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/NZL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NZL-DSC"
        },
        "name" : "GDHCNParticipantDID-NZL-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NZL-SCA"
        },
        "name" : "GDHCNParticipantDID-NZL-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NZL-UAT-All"
        },
        "name" : "GDHCNParticipantDID-NZL-UAT-All",
        "description" : "New Zealand Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:NZL\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/NZL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NZL-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-NZL-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-NZL-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-NZL-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-All"
        },
        "name" : "GDHCNParticipantDID-OMN-All",
        "description" : "Oman Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:OMN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/OMN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-DEV-All"
        },
        "name" : "GDHCNParticipantDID-OMN-DEV-All",
        "description" : "Oman Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:OMN\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/OMN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-OMN-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-OMN-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-DSC"
        },
        "name" : "GDHCNParticipantDID-OMN-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-SCA"
        },
        "name" : "GDHCNParticipantDID-OMN-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-UAT-All"
        },
        "name" : "GDHCNParticipantDID-OMN-UAT-All",
        "description" : "Oman Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:OMN\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/OMN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-OMN-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-OMN-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-OMN-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PAN-DEV-All"
        },
        "name" : "GDHCNParticipantDID-PAN-DEV-All",
        "description" : "Panama Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:PAN\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PAN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PAN-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-PAN-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PAN-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-PAN-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PER-DEV-All"
        },
        "name" : "GDHCNParticipantDID-PER-DEV-All",
        "description" : "Peru Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:PER\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PER/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PER-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-PER-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PER-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-PER-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-POL-All"
        },
        "name" : "GDHCNParticipantDID-POL-All",
        "description" : "Poland Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:POL\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/POL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-POL-DSC"
        },
        "name" : "GDHCNParticipantDID-POL-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-POL-SCA"
        },
        "name" : "GDHCNParticipantDID-POL-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-POL-UAT-All"
        },
        "name" : "GDHCNParticipantDID-POL-UAT-All",
        "description" : "Poland Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:POL\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/POL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-POL-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-POL-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-POL-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-POL-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRT-All"
        },
        "name" : "GDHCNParticipantDID-PRT-All",
        "description" : "Portugal Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:PRT\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/PRT/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRT-DSC"
        },
        "name" : "GDHCNParticipantDID-PRT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRT-SCA"
        },
        "name" : "GDHCNParticipantDID-PRT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRT-UAT-All"
        },
        "name" : "GDHCNParticipantDID-PRT-UAT-All",
        "description" : "Portugal Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:PRT\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/PRT/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRT-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-PRT-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRT-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-PRT-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRY-DEV-All"
        },
        "name" : "GDHCNParticipantDID-PRY-DEV-All",
        "description" : "Paraguay Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:PRY\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/PRY/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRY-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-PRY-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-PRY-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-PRY-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SAU-UAT-All"
        },
        "name" : "GDHCNParticipantDID-SAU-UAT-All",
        "description" : "Saudi Arabia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SAU\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SAU/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SAU-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-SAU-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SAU-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-SAU-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-All"
        },
        "name" : "GDHCNParticipantDID-SGP-All",
        "description" : "Singapore Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SGP\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/SGP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-DEV-All"
        },
        "name" : "GDHCNParticipantDID-SGP-DEV-All",
        "description" : "Singapore Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SGP\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SGP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-SGP-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-SGP-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-DSC"
        },
        "name" : "GDHCNParticipantDID-SGP-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-SCA"
        },
        "name" : "GDHCNParticipantDID-SGP-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-UAT-All"
        },
        "name" : "GDHCNParticipantDID-SGP-UAT-All",
        "description" : "Singapore Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SGP\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SGP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-SGP-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SGP-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-SGP-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SLV-DEV-All"
        },
        "name" : "GDHCNParticipantDID-SLV-DEV-All",
        "description" : "El Salvador Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SLV\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SLV/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SLV-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-SLV-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SLV-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-SLV-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-All"
        },
        "name" : "GDHCNParticipantDID-SMR-All",
        "description" : "San Marino Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SMR\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/SMR/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-DEV-All"
        },
        "name" : "GDHCNParticipantDID-SMR-DEV-All",
        "description" : "San Marino Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SMR\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SMR/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-SMR-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-SMR-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-DSC"
        },
        "name" : "GDHCNParticipantDID-SMR-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-SCA"
        },
        "name" : "GDHCNParticipantDID-SMR-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-UAT-All"
        },
        "name" : "GDHCNParticipantDID-SMR-UAT-All",
        "description" : "San Marino Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SMR\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SMR/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-SMR-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SMR-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-SMR-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SUR-DEV-All"
        },
        "name" : "GDHCNParticipantDID-SUR-DEV-All",
        "description" : "Suriname Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SUR\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SUR/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SUR-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-SUR-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SUR-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-SUR-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVK-All"
        },
        "name" : "GDHCNParticipantDID-SVK-All",
        "description" : "Slovakia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SVK\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/SVK/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVK-DSC"
        },
        "name" : "GDHCNParticipantDID-SVK-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVK-SCA"
        },
        "name" : "GDHCNParticipantDID-SVK-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVK-UAT-All"
        },
        "name" : "GDHCNParticipantDID-SVK-UAT-All",
        "description" : "Slovakia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SVK\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVK/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVK-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-SVK-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVK-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-SVK-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-All"
        },
        "name" : "GDHCNParticipantDID-SVN-All",
        "description" : "Slovenia Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SVN\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/SVN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-DEV-All"
        },
        "name" : "GDHCNParticipantDID-SVN-DEV-All",
        "description" : "Slovenia Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SVN\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/SVN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-SVN-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-SVN-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-DSC"
        },
        "name" : "GDHCNParticipantDID-SVN-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-SCA"
        },
        "name" : "GDHCNParticipantDID-SVN-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-UAT-All"
        },
        "name" : "GDHCNParticipantDID-SVN-UAT-All",
        "description" : "Slovenia Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SVN\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SVN/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-SVN-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SVN-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-SVN-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SWE-All"
        },
        "name" : "GDHCNParticipantDID-SWE-All",
        "description" : "Sweden Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SWE\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/SWE/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SWE-DSC"
        },
        "name" : "GDHCNParticipantDID-SWE-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SWE-SCA"
        },
        "name" : "GDHCNParticipantDID-SWE-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SWE-UAT-All"
        },
        "name" : "GDHCNParticipantDID-SWE-UAT-All",
        "description" : "Sweden Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:SWE\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/SWE/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SWE-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-SWE-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-SWE-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-SWE-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-All"
        },
        "name" : "GDHCNParticipantDID-TGO-All",
        "description" : "Togo Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:TGO\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/TGO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-DEV-All"
        },
        "name" : "GDHCNParticipantDID-TGO-DEV-All",
        "description" : "Togo Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:TGO\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/TGO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-TGO-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-TGO-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-DSC"
        },
        "name" : "GDHCNParticipantDID-TGO-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-SCA"
        },
        "name" : "GDHCNParticipantDID-TGO-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-UAT-All"
        },
        "name" : "GDHCNParticipantDID-TGO-UAT-All",
        "description" : "Togo Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:TGO\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TGO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-TGO-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TGO-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-TGO-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-THA-All"
        },
        "name" : "GDHCNParticipantDID-THA-All",
        "description" : "Thailand Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:THA\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/THA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-THA-DSC"
        },
        "name" : "GDHCNParticipantDID-THA-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-THA-SCA"
        },
        "name" : "GDHCNParticipantDID-THA-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-THA-UAT-All"
        },
        "name" : "GDHCNParticipantDID-THA-UAT-All",
        "description" : "Thailand Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:THA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/THA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-THA-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-THA-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-THA-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-THA-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TUR-All"
        },
        "name" : "GDHCNParticipantDID-TUR-All",
        "description" : "Türkiye Trustlist (DID v2) - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:TUR\nresolvable at https://tng-cdn.who.int/v2/trustlist/-/TUR/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TUR-DSC"
        },
        "name" : "GDHCNParticipantDID-TUR-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TUR-SCA"
        },
        "name" : "GDHCNParticipantDID-TUR-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TUR-UAT-All"
        },
        "name" : "GDHCNParticipantDID-TUR-UAT-All",
        "description" : "Türkiye Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:TUR\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/TUR/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TUR-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-TUR-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-TUR-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-TUR-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-URY-DEV-All"
        },
        "name" : "GDHCNParticipantDID-URY-DEV-All",
        "description" : "Uruguay Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:URY\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/URY/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-URY-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-URY-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-URY-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-URY-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-USA-DEV-All"
        },
        "name" : "GDHCNParticipantDID-USA-DEV-All",
        "description" : "United States of America Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:USA\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/USA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-USA-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-USA-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-USA-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-USA-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO"
        },
        "name" : "GDHCNParticipantDID-WHO",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV"
        },
        "name" : "GDHCNParticipantDID-WHO-DEV",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV-All"
        },
        "name" : "GDHCNParticipantDID-WHO-DEV-All",
        "description" : "DEV Participant WHO Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:WHO\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/WHO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-WHO-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-WHO-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT"
        },
        "name" : "GDHCNParticipantDID-WHO-UAT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT-All"
        },
        "name" : "GDHCNParticipantDID-WHO-UAT-All",
        "description" : "UAT Participant WHO Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:WHO\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/WHO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-WHO-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-WHO-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-WHO-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XCL-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XCL-DEV-All",
        "description" : "DEV Participant XCL Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XCL\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XCL/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XCL-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XCL-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XCL-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XCL-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XML-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XML-DEV-All",
        "description" : "DEV Participant XML Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XML\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XML/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XML-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XML-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XML-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XML-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXA-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXA-DEV-All",
        "description" : "DEV Participant XXA Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXA\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXA-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXA-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXA-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXA-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXA-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXA-UAT-All",
        "description" : "UAT Participant XXA Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXA\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXA/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXA-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXA-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXA-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXA-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXB-DEV-All",
        "description" : "DEV Participant XXB Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXB\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXB/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXB-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXB-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXB-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXB-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXB-UAT-All",
        "description" : "UAT Participant XXB Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXB\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXB/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXB-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXB-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXB-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXB-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXC-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXC-DEV-All",
        "description" : "DEV Participant XXC Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXC\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXC/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXC-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXC-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXC-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXC-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXC-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXC-UAT-All",
        "description" : "UAT Participant XXC Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXC\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXC/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXC-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXC-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXC-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXC-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXD-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXD-DEV-All",
        "description" : "DEV Participant XXD Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXD\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXD/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXD-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXD-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXD-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXD-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXD-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXD-UAT-All",
        "description" : "UAT Participant XXD Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXD\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXD/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXD-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXD-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXD-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXD-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXE-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXE-DEV-All",
        "description" : "DEV Participant XXE Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXE\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXE/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXE-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXE-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXE-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXE-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXF-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXF-DEV-All",
        "description" : "DEV Participant XXF Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXF\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXF/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXF-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXF-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXF-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXF-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXG-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXG-DEV-All",
        "description" : "DEV Participant XXG Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXG\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXG/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXG-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXG-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXG-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXG-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXH-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXH-DEV-All",
        "description" : "DEV Participant XXH Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXH\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXH/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXH-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXH-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXH-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXH-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXI-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXI-DEV-All",
        "description" : "DEV Participant XXI Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXI\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXI/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXI-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXI-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXI-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXI-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXJ-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXJ-DEV-All",
        "description" : "DEV Participant XXJ Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXJ\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXJ/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXJ-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXJ-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXJ-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXJ-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXK-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXK-DEV-All",
        "description" : "DEV Participant XXK Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXK\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXK/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXK-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXK-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXK-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXK-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXO-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXO-DEV-All",
        "description" : "DEV Participant XXO Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXO\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXO-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXO-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXO-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXO-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXO-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXO-UAT-All",
        "description" : "UAT Participant XXO Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXO\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXO/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXO-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXO-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXO-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXO-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXP-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXP-DEV-All",
        "description" : "DEV Participant XXP Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXP\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXP/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXP-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXP-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXP-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXP-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXS-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXS-UAT-All",
        "description" : "UAT Participant XXS Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXS\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXS/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXS-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXS-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXS-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXS-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXU-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXU-DEV-All",
        "description" : "DEV Participant XXU Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXU\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXU/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXU-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXU-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXU-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXU-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXU-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXU-UAT-All",
        "description" : "UAT Participant XXU Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXU\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXU/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXU-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXU-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXU-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXU-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXV-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXV-DEV-All",
        "description" : "DEV Participant XXV Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXV\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXV/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXV-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXV-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXV-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXV-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXV-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXV-UAT-All",
        "description" : "UAT Participant XXV Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXV\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXV/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXV-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXV-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXV-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXV-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXX-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XXX-DEV-All",
        "description" : "DEV Participant XXX Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXX\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XXX/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXX-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XXX-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXX-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XXX-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXX-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XXX-UAT-All",
        "description" : "UAT Participant XXX Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XXX\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XXX/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXX-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XXX-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XXX-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XXX-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XYK-DEV-All"
        },
        "name" : "GDHCNParticipantDID-XYK-DEV-All",
        "description" : "DEV Participant XYK Trustlist (DID v2) - DEV - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XYK\nresolvable at https://tng-cdn-dev.who.int/v2/trustlist/-/XYK/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XYK-DEV-DSC"
        },
        "name" : "GDHCNParticipantDID-XYK-DEV-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XYK-DEV-SCA"
        },
        "name" : "GDHCNParticipantDID-XYK-DEV-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-All"
        },
        "name" : "GDHCNParticipantDID-XYK-UAT-All",
        "description" : "UAT Participant XYK Trustlist (DID v2) - UAT - All keys\ndid:web:tng-cdn.who.int:v2:trustlist:-:XYK\nresolvable at https://tng-cdn-uat.who.int/v2/trustlist/-/XYK/did.json",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-DSC"
        },
        "name" : "GDHCNParticipantDID-XYK-UAT-DSC",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Endpoint"
          }
        ],
        "reference" : {
          "reference" : "Endpoint/GDHCNParticipantDID-XYK-UAT-SCA"
        },
        "name" : "GDHCNParticipantDID-XYK-UAT-SCA",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "StructureDefinition:logical"
          }
        ],
        "reference" : {
          "reference" : "StructureDefinition/HCert"
        },
        "name" : "Health Certificate",
        "description" : "Logical Model for the HCERT",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ActorDefinition"
          }
        ],
        "reference" : {
          "reference" : "ActorDefinition/Holder"
        },
        "name" : "Holder",
        "description" : "A Holder is an individual that has Verifiable Digtial Health Certificate in their possesion, received from an Issuer.  The Holder may choose to share the Verifiable Digital Health Certificate with a Receiver.",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/IssuerVDHC"
        },
        "name" : "Issue Verifiable Digital Health Certificate",
        "description" : "Issue a Verifiable Digital Health Certificate to a Holder",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ActorDefinition"
          }
        ],
        "reference" : {
          "reference" : "ActorDefinition/Issuer"
        },
        "name" : "Issuer",
        "description" : "An Issuer a system authorized by a Trust Network Participant to generate Verifiable Digital Health Certificates which are provided to a Holder.   An Issuer is responsible for generating the content that is digitally signed within the Verifiable Digital Health Certificate.   In order to sign this content, an Issuer should either itself be a Document Signer or utilize a Document Signer service, as authorized by the jurisdicitonal policy.",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ProvideVDHC"
        },
        "name" : "Provide Verifiable Digital Health Certificate",
        "description" : "Provide a Verifiable Digital Health Certificate to a Receiver",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/PublishBusinessRules"
        },
        "name" : "Publish business rules",
        "description" : "Publish business rules to a Trust Anchor",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/PublishBusinessRulesCertLogic"
        },
        "name" : "Publish Cert Logic business rules",
        "description" : "Publish Cert Logic business rules to a Trust Anchor",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/PublishBusinessRulesFHIR"
        },
        "name" : "Publish HL7 FHIR business rules",
        "description" : "Publish business rules to a Trust Anchor using HL7 FHIR",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/PublishPKIMaterial"
        },
        "name" : "Publish PKI material",
        "description" : "Publish trust material to a Trust Anchor",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/PublishPKIMaterialDID"
        },
        "name" : "Publish PKI material as DID",
        "description" : "Publish trust material to a Trust Anchor as DID",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/PublishPKIMaterialAPI"
        },
        "name" : "Publish PKI material via API",
        "description" : "Publish trust material to a Trust Anchor via API",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceiveBusinessRules"
        },
        "name" : "Receive business rules",
        "description" : "Receive business rules from a Trust Network Participant, for distribution within the Trust Network",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceiveBusinessRulesCertLogic"
        },
        "name" : "Receive CertLogic business rules",
        "description" : "Receive CertLogic business rules from a Trust Network Participant, for distribution within the Trust Network",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceiveBusinessRulesFHIR"
        },
        "name" : "Receive HL7 FHIR business rules",
        "description" : "Receive business rules from a Trust Network Participant, for distribution within the Trust Network using HL7 FHIR standard",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceivePKUMaterial"
        },
        "name" : "Receive PKI material",
        "description" : "Receive trust material from a Trust Network Participant, for distribution within the Trust Network",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceivePKUMaterialDID"
        },
        "name" : "Receive PKI material as DID",
        "description" : "Receive trust material from a Trust Network Participant, for distribution within the Trust Network as DID",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceivePKUMaterialAPI"
        },
        "name" : "Receive PKI material via API",
        "description" : "Receive trust material from a Trust Network Participant, for distribution within the Trust Network via API",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/ReceiveVDHC"
        },
        "name" : "Receive Verifiable Digital Health Certificate",
        "description" : "Receive a Verifiable Digital Health Certificate from an Issuer",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ActorDefinition"
          }
        ],
        "reference" : {
          "reference" : "ActorDefinition/Receiver"
        },
        "name" : "Receiver",
        "description" : "A Reciever is a system authorized by a Trust Network Participant to receive from a Holder a Veritifable, verify and utilize the content within.",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RequestVDHC"
        },
        "name" : "Request Verifiable Digital Health Certificate",
        "description" : "Request a Verifiable Digital Health Certificate from an Issuer",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RetrieveBusinessRules"
        },
        "name" : "Retrieve business rules",
        "description" : "Retrieve business rules from a distribution point using",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RetrieveBusinessRulesCertLogic"
        },
        "name" : "Retrieve Cert Logic compatible business rules",
        "description" : "Retrieve Cert Logic business rules from a distribution point",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RetrieveBusinessRulesFHIR"
        },
        "name" : "Retrieve HL7 FHIR compatible business rules",
        "description" : "Retrieve business rules from a distribution point using HL7 FHIR standards",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RetrievePKIMaterial"
        },
        "name" : "Retrieve PKI material",
        "description" : "Retrieve PKI material from a distribution point",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RetrievePKIMaterialDID"
        },
        "name" : "Retrieve PKI material as DID",
        "description" : "Retrieve PKI material from a distribution point as DID",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/RetrievePKIMaterialAPI"
        },
        "name" : "Retrieve PKI material via API",
        "description" : "Retrieve PKI material from a distribution point via API",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "StructureDefinition:logical:abstract"
          }
        ],
        "reference" : {
          "reference" : "StructureDefinition/SchemeInformation"
        },
        "name" : "Scheme Information",
        "description" : "Logical Model for Information on the trusted list and its issuing scheme",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ActorDefinition"
          }
        ],
        "reference" : {
          "reference" : "ActorDefinition/TrustNetworkAnchor"
        },
        "name" : "Trust Network Anchor",
        "description" : "Trust Anchor which receives and distributes PKI-material within a Trust Network",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ActorDefinition"
          }
        ],
        "reference" : {
          "reference" : "ActorDefinition/TrustNetworkParticipant"
        },
        "name" : "Trust Network Participant",
        "description" : "Trust Network Participant which publishes and or receives PKI-material within a Trust Network",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "Requirements"
          }
        ],
        "reference" : {
          "reference" : "Requirements/UtilizeVDHC"
        },
        "name" : "Utilize a Verifiable Digital Health Certificate",
        "description" : "Utilize a Verifiable Digital Health Certificate that was provided by a Holder",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/KeyUsage"
        },
        "name" : "WHO GDHCN  Key Usage ValueSet",
        "description" : "ValueSet of codes for key usage codes for Production environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/KeyUsage-DEV"
        },
        "name" : "WHO GDHCN  Key Usage ValueSet - DEV",
        "description" : "ValueSet of codes for key usage codes for Development environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/KeyUsage-UAT"
        },
        "name" : "WHO GDHCN  Key Usage ValueSet - UAT",
        "description" : "ValueSet of codes for key usage codes for User Acceptance Testing environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Actors"
        },
        "name" : "WHO GDHCN Actor ValueSet of actor codes",
        "description" : "ValueSet of codes for actor codes",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/ConnectionTypes"
        },
        "name" : "WHO GDHCN Connection Types",
        "description" : "ValueSet of GDHCN Trust Network Connection Types",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/ConnectionTypes"
        },
        "name" : "WHO GDHCN Connection Types",
        "description" : "CodeSystem for GDHCN connection types",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/KeyUsage"
        },
        "name" : "WHO GDHCN Key Usage CodeSystem",
        "description" : "CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html) for Production environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/KeyUsage-DEV"
        },
        "name" : "WHO GDHCN Key Usage CodeSystem - DEV",
        "description" : "CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html) for Development environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/KeyUsage-UAT"
        },
        "name" : "WHO GDHCN Key Usage CodeSystem - UAT",
        "description" : "CodeSystem for GDHCN Key Usage that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html) for User Acceptance Testing environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/PayloadTypes"
        },
        "name" : "WHO GDHCN Payload Types",
        "description" : "ValueSet of GDHCN Trust Network Payload Types",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/PayloadTypes"
        },
        "name" : "WHO GDHCN Payload Types",
        "description" : "CodeSystem for GDHCN Payload types",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Transactions"
        },
        "name" : "WHO GDHCN Transaction Codes",
        "description" : "ValueSet of WHO GDHCN Transaction Codes",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Transactions"
        },
        "name" : "WHO GDHCN Transactions CodeSystem",
        "description" : "CodeSystem for GDHCN transactions that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Actors"
        },
        "name" : "WHO GDHCN Trust Actors CodeSystem",
        "description" : "CodeSystem for SMART Trust actors that has usage codes for verification keys published to the Trust Network as defined by the [certificate governance](concepts_certificate_governance.html)",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Domains"
        },
        "name" : "WHO GDHCN Trust Domains",
        "description" : "ValueSet of WHO GDHCN Trust Domains for Production environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Domains"
        },
        "name" : "WHO GDHCN Trust Domains",
        "description" : "CodeSystem for define WHO GDHCN Trust Domains for Production environment.",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Domains-DEV"
        },
        "name" : "WHO GDHCN Trust Domains - DEV",
        "description" : "ValueSet of WHO GDHCN Trust Domains for Development environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Domains-DEV"
        },
        "name" : "WHO GDHCN Trust Domains - DEV",
        "description" : "CodeSystem for define WHO GDHCN Trust Domains for Development environment.",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Domains-UAT"
        },
        "name" : "WHO GDHCN Trust Domains - UAT",
        "description" : "ValueSet of WHO GDHCN Trust Domains for User Acceptance Testing environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Domains-UAT"
        },
        "name" : "WHO GDHCN Trust Domains - UAT",
        "description" : "CodeSystem for define WHO GDHCN Trust Domains for User Acceptance Testing environment.",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Participants"
        },
        "name" : "WHO GDHCN Trust Network Participant",
        "description" : "ValueSet of GDHCN Trust Network Participants for Production environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Participants-DEV"
        },
        "name" : "WHO GDHCN Trust Network Participant - DEV",
        "description" : "ValueSet of GDHCN Trust Network Participants for Development environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Participants-DEV"
        },
        "name" : "WHO GDHCN Trust Network Participant - DEV",
        "description" : "CodeSystem for GDHCN Trust Network Participants for Development environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "ValueSet"
          }
        ],
        "reference" : {
          "reference" : "ValueSet/Participants-UAT"
        },
        "name" : "WHO GDHCN Trust Network Participant - UAT",
        "description" : "ValueSet of GDHCN Trust Network Participants for User Acceptance Testing environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Participants-UAT"
        },
        "name" : "WHO GDHCN Trust Network Participant - UAT",
        "description" : "CodeSystem for GDHCN Trust Network Participants for User Acceptance Testing environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/Participants"
        },
        "name" : "WHO GDHCN Trust Network Participants CodeSystem",
        "description" : "CodeSystem for GDHCN Trust Network Participants which are not already included in the ISO-3166 three letter code system for Production environment",
        "exampleBoolean" : false
      },
      {
        "extension" : [
          {
            "url" : "http://hl7.org/fhir/tools/StructureDefinition/resource-information",
            "valueString" : "CodeSystem"
          }
        ],
        "reference" : {
          "reference" : "CodeSystem/RefMartCountryList"
        },
        "name" : "WHO RefMart Jurisidiction List",
        "description" : "CodeSystem for WHO Refmart Country and Jurisidiction List available at https://xmart-api-public.who.int/REFMART/REF_COUNTRY for Production environment",
        "exampleBoolean" : false
      }
    ],
    "page" : {
      "extension" : [
        {
          "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
          "valueUrl" : "toc.html"
        }
      ],
      "nameUrl" : "toc.html",
      "title" : "Table of Contents",
      "generation" : "html",
      "page" : [
        {
          "extension" : [
            {
              "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
              "valueUrl" : "index.html"
            }
          ],
          "nameUrl" : "index.html",
          "title" : "Home",
          "generation" : "markdown",
          "page" : [
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "overview.html"
                }
              ],
              "nameUrl" : "overview.html",
              "title" : "Overview",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "dependencies.html"
                }
              ],
              "nameUrl" : "dependencies.html",
              "title" : "Dependencies",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "ethical_principles.html"
                }
              ],
              "nameUrl" : "ethical_principles.html",
              "title" : "Ethical Considerations and Data Protection Principles",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "faq.html"
                }
              ],
              "nameUrl" : "faq.html",
              "title" : "Frequently Asked Questions",
              "generation" : "markdown"
            }
          ]
        },
        {
          "extension" : [
            {
              "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
              "valueUrl" : "business_requirements.html"
            }
          ],
          "nameUrl" : "business_requirements.html",
          "title" : "Business Requirements",
          "generation" : "markdown",
          "page" : [
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "concepts.html"
                }
              ],
              "nameUrl" : "concepts.html",
              "title" : "Concepts",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "concepts_certificate_governance.html"
                }
              ],
              "nameUrl" : "concepts_certificate_governance.html",
              "title" : "Certificate Governance",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "concepts_onboarding.html"
                }
              ],
              "nameUrl" : "concepts_onboarding.html",
              "title" : "Onboarding Process",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "use_cases.html"
                }
              ],
              "nameUrl" : "use_cases.html",
              "title" : "Use Cases",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "decision_support.html"
                }
              ],
              "nameUrl" : "decision_support.html",
              "title" : "Decision Support Logic",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "functional.html"
                }
              ],
              "nameUrl" : "functional.html",
              "title" : "Functional Requirements",
              "generation" : "markdown"
            }
          ]
        },
        {
          "extension" : [
            {
              "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
              "valueUrl" : "data_exchange.html"
            }
          ],
          "nameUrl" : "data_exchange.html",
          "title" : "Data Models and Exchange",
          "generation" : "markdown",
          "page" : [
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "system-actors.html"
                }
              ],
              "nameUrl" : "system-actors.html",
              "title" : "System Actors",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "transactions.html"
                }
              ],
              "nameUrl" : "transactions.html",
              "title" : "Transactions",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "sequence-diagrams.html"
                }
              ],
              "nameUrl" : "sequence-diagrams.html",
              "title" : "Sequence Diagrams",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "trust_domains.html"
                }
              ],
              "nameUrl" : "trust_domains.html",
              "title" : "Trust Domains",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "concepts_did.html"
                }
              ],
              "nameUrl" : "concepts_did.html",
              "title" : "DID Trustlist Specification",
              "generation" : "markdown",
              "page" : [
                {
                  "extension" : [
                    {
                      "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                      "valueUrl" : "concepts_did_gdhcn.html"
                    }
                  ],
                  "nameUrl" : "concepts_did_gdhcn.html",
                  "title" : "DID Trustlist v2",
                  "generation" : "markdown"
                },
                {
                  "extension" : [
                    {
                      "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                      "valueUrl" : "concepts_did_v1.html"
                    }
                  ],
                  "nameUrl" : "concepts_did_v1.html",
                  "title" : "DID Trustlist v1 (deprecated)",
                  "generation" : "markdown"
                }
              ]
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "hcert_spec.html"
                }
              ],
              "nameUrl" : "hcert_spec.html",
              "title" : "HCERT Specification",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "trust_network_gateway_architecture.html"
                }
              ],
              "nameUrl" : "trust_network_gateway_architecture.html",
              "title" : "Trust Network Gateway Architecture",
              "generation" : "markdown"
            }
          ]
        },
        {
          "extension" : [
            {
              "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
              "valueUrl" : "deployment.html"
            }
          ],
          "nameUrl" : "deployment.html",
          "title" : "Deployment",
          "generation" : "markdown",
          "page" : [
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "concepts_onboarding_checklist.html"
                }
              ],
              "nameUrl" : "concepts_onboarding_checklist.html",
              "title" : "Onboarding Checklist",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "security_privacy.html"
                }
              ],
              "nameUrl" : "security_privacy.html",
              "title" : "Security and Privacy Considerations",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "testing.html"
                }
              ],
              "nameUrl" : "testing.html",
              "title" : "Testing",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "reference_implementation.html"
                }
              ],
              "nameUrl" : "reference_implementation.html",
              "title" : "Reference Implementations",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "downloads.html"
                }
              ],
              "nameUrl" : "downloads.html",
              "title" : "Downloads",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "changes.html"
                }
              ],
              "nameUrl" : "changes.html",
              "title" : "Changes",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "endpoints.html"
                }
              ],
              "nameUrl" : "endpoints.html",
              "title" : "Endpoints",
              "generation" : "markdown"
            }
          ]
        },
        {
          "extension" : [
            {
              "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
              "valueUrl" : "indices.html"
            }
          ],
          "nameUrl" : "indices.html",
          "title" : "Indices",
          "generation" : "markdown",
          "page" : [
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "artifacts.html"
                }
              ],
              "nameUrl" : "artifacts.html",
              "title" : "Artifact Index",
              "generation" : "html"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "references.html"
                }
              ],
              "nameUrl" : "references.html",
              "title" : "References",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "maps.html"
                }
              ],
              "nameUrl" : "maps.html",
              "title" : "Mappings",
              "generation" : "markdown"
            },
            {
              "extension" : [
                {
                  "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
                  "valueUrl" : "license.html"
                }
              ],
              "nameUrl" : "license.html",
              "title" : "License",
              "generation" : "markdown"
            }
          ]
        },
        {
          "extension" : [
            {
              "url" : "http://hl7.org/fhir/tools/StructureDefinition/ig-page-name",
              "valueUrl" : "dak-api.html"
            }
          ],
          "nameUrl" : "dak-api.html",
          "title" : "DAK API Documentation Hub",
          "generation" : "markdown"
        }
      ]
    },
    "parameter" : [
      {
        "code" : "path-resource",
        "value" : "input/capabilities"
      },
      {
        "code" : "path-resource",
        "value" : "input/examples"
      },
      {
        "code" : "path-resource",
        "value" : "input/extensions"
      },
      {
        "code" : "path-resource",
        "value" : "input/models"
      },
      {
        "code" : "path-resource",
        "value" : "input/operations"
      },
      {
        "code" : "path-resource",
        "value" : "input/profiles"
      },
      {
        "code" : "path-resource",
        "value" : "input/resources"
      },
      {
        "code" : "path-resource",
        "value" : "input/vocabulary"
      },
      {
        "code" : "path-resource",
        "value" : "input/maps"
      },
      {
        "code" : "path-resource",
        "value" : "input/testing"
      },
      {
        "code" : "path-resource",
        "value" : "input/history"
      },
      {
        "code" : "path-resource",
        "value" : "fsh-generated/resources"
      },
      {
        "code" : "path-pages",
        "value" : "template/config"
      },
      {
        "code" : "path-pages",
        "value" : "input/images"
      },
      {
        "code" : "path-tx-cache",
        "value" : "input-cache/txcache"
      }
    ]
  }
}

```
