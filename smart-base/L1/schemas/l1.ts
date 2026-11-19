/**
 * The L1 layer of the SMART Guidelines knowledge graph, 3.0 — layout
 * (publication, section, element), content (recommendation, remark, key
 * question, outcome, evidence, catalogued intervention, indicator) and the
 * references a DAK points at them with — as typed data.
 *
 * MIGRATED from WorldHealthOrganization/smart-kg `ontology/l1/l1.json` at
 * commit 3f5e477b9628fa818e71a2b2298371196c5af97c (main). Every note, value set, predicate, edge, grounding
 * and omission is carried verbatim; what is NEW is each property's type, Zod
 * schema and FHIR mapping. `npm run build` regenerates
 * `generated/l1.json` (smart-kg's format) and the FSH under `input/fsh/`.
 * This file is the source of truth: smart-kg is deprecated (owner,
 * 2026-10-16) and the JSON is no longer held equal to its file.
 *
 * Typing decisions a reviewer should check, because l1.json names these
 * properties without typing them:
 *  - issued, modified, reviewBy are FHIR `date` (smart-kg's fixtures write
 *    `issued: "2016"`).
 *  - creator and aliases repeat; identifiers and variants are lists of objects;
 *    columnMap is an object (a list of column/field pairs in FHIR); cells admit
 *    null, which carries meaning (filled through columnMap).
 *  - ordinal and studyCount are unsignedInt; isCore and isSurveyBased boolean;
 *    contentHash and sha256 are 64 hex digits.
 *
 * REUSE in the FHIR projection: publication derives from smart-base
 * `DublinCore` (its note: "Metadata follows Dublin Core"); terminology-code
 * derives from FHIR `Coding`; indicator and health-intervention say on
 * `correspondsTo` which smart-base model they match and why they do not
 * derive from it.
 */
import type { LayerSpec, ValueSet } from "./ontology.ts";
import { p } from "./props.ts";

/** The smart-kg commit this layer was migrated from. */
export const MIGRATED_FROM = { repository: "https://github.com/WorldHealthOrganization/smart-kg", path: "ontology/l1/l1.json", commit: "3f5e477b9628fa818e71a2b2298371196c5af97c" } as const;

export const L1_VALUE_SETS: ValueSet[] = [
  {
    "id": "publication-type",
    "note": "What kind of publication this is. The distinction that matters most for provenance is guideline versus not: a summary table or position paper restates recommendations made elsewhere, and a §1.9 product makes none of its own. Conflating them makes a citation resolve to the wrong authority.",
    "source": "WHO handbook for guideline development (2014), Table 1.2 and §1.7–1.9; the BCG decision table's citation for summary-table; CDHIv2.fsh for classification",
    "codes": [
      {
        "code": "standard-guideline",
        "definition": "Recommendations on a specific topic or condition, usually new. Most WHO guidelines. Handbook §1.7.1."
      },
      {
        "code": "consolidated-guideline",
        "definition": "Aggregates existing recommendations on a disease or condition, evaluated as up to date; may add new ones. Existing recommendations must be explicitly cross-referenced. Handbook §1.7.2."
      },
      {
        "code": "interim-guideline",
        "definition": "Guidance when data are incomplete and more are expected; short shelf-life, states when an update is anticipated. Handbook §1.7.3."
      },
      {
        "code": "rapid-advice-guideline",
        "definition": "Produced in one to three months in a public health emergency, with a review-by date. Handbook §1.7.4, chapter 11."
      },
      {
        "code": "emergency-guideline",
        "definition": "Rapid response guidance within hours to days; may rest on expert opinion only. Handbook §1.7.4."
      },
      {
        "code": "collaborative-guideline",
        "definition": "Developed with one or more external organizations sharing the remit. Handbook §1.8.1."
      },
      {
        "code": "external-guideline",
        "definition": "Developed by an external organization and adopted by WHO. Handbook §1.8.2."
      },
      {
        "code": "adapted-guideline",
        "definition": "An existing WHO guideline adapted to a local context by a Member State. Handbook §1.8.3, §13.1."
      },
      {
        "code": "position-paper",
        "definition": "A WHO position paper — for vaccines, the SAGE-reviewed statement of WHO's position published in the Weekly Epidemiological Record. States recommendations; the immunization summary tables are drawn from these."
      },
      {
        "code": "summary-table",
        "definition": "A tabular restatement of recommendations made in other publications — e.g. \"WHO recommendations for routine immunization – summary tables\". Cite-worthy, but not the originating authority: a citation resolving here should normally be followed on to the recommendation it restates."
      },
      {
        "code": "classification",
        "definition": "A WHO classification, such as the Classification of Digital Health Interventions (CDHI). Its codes are cross-referenced through terminology-code, never modelled here."
      },
      {
        "code": "implementation-guidance",
        "definition": "An operational manual, implementation guide or tool based on approved guidelines — a \"how to\" document. Makes no recommendations of its own. Handbook §1.9. A DAK is one of these."
      },
      {
        "code": "methodology",
        "definition": "A document describing how guidance is produced — the guideline development handbook itself. Handbook §1.9 (standard operating procedures)."
      },
      {
        "code": "supplement",
        "definition": "A web annex or supplementary document of another publication, typically holding systematic reviews, GRADE evidence profiles and evidence-to-decision tables. Handbook §12.1. Reached by hasSupplement."
      }
    ]
  },
  {
    "id": "identifier-type",
    "note": "Which kind of identifier a publication carries. The first available, in this order, builds the publication IRI. url comes last: a web address is the least stable identifier and is used only for sources that have no other.",
    "source": "WHO IRIS practice; CDHIv2.fsh carries an ISBN",
    "codes": [
      {
        "code": "isbn",
        "definition": "ISBN-13, electronic version preferred."
      },
      {
        "code": "iris-handle",
        "definition": "WHO IRIS handle, e.g. 10665/250796."
      },
      {
        "code": "doi",
        "definition": "Digital Object Identifier."
      },
      {
        "code": "issn",
        "definition": "ISSN, for serials such as the Weekly Epidemiological Record."
      },
      {
        "code": "url",
        "definition": "The canonical web address of a WHO source published only on the web, such as the routine immunization summary tables or the UHC Compendium. Used for the IRI only when no isbn, iris-handle, doi or issn exists; scheme, query and trailing slash are dropped. A moved page is a new publication, linked to the old one by supersedes."
      },
      {
        "code": "other",
        "definition": "Any other identifier; never used to build an IRI."
      }
    ]
  },
  {
    "id": "grc-status",
    "note": "Whether the Guideline Review Committee approved the publication. All WHO publications containing recommendations must be approved (handbook §1.10.1); a consolidated guideline whose recommendations were all previously approved and unchanged does not require review (§1.7.2). Absent means not recorded — not the same as not reviewed.",
    "source": "WHO handbook for guideline development (2014), §1.7.2, §1.10.1",
    "codes": [
      {
        "code": "approved",
        "definition": "Approved by the GRC."
      },
      {
        "code": "not-required",
        "definition": "GRC review was not required — a §1.9 product, or a consolidation of previously approved, unchanged recommendations."
      },
      {
        "code": "not-reviewed",
        "definition": "Contains recommendations and was not reviewed by the GRC — including those published before the GRC was established in 2007, which the handbook says should be updated (§12.5.2)."
      }
    ]
  },
  {
    "id": "recommendation-kind",
    "note": "What sort of normative statement this is. Grading is optional: ANC 2016 prints a direction ('Recommended', 'Not recommended') and no GRADE strength. A strength always needs a direction. A good practice statement and a no-recommendation carry no strength or certainty, and a no-recommendation carries no direction.",
    "source": "WHO handbook §10.4, §10.7; ANC guideline (2016) Table 1, verified; Guyatt et al. 2016 on good practice statements",
    "codes": [
      {
        "code": "recommendation",
        "definition": "A graded recommendation, with a direction and a strength. Handbook §10.4."
      },
      {
        "code": "context-specific",
        "definition": "Recommended only in specified contexts or settings, stated in the recommendation. ANC guideline (2016) Table 1, verified."
      },
      {
        "code": "research-context",
        "definition": "Recommended only in the context of rigorous research. ANC guideline (2016) Table 1, verified."
      },
      {
        "code": "good-practice-statement",
        "definition": "An ungraded statement whose benefit is so clear that grading the evidence is not a useful exercise. Carries no strength or certainty. Guyatt et al. 2016."
      },
      {
        "code": "no-recommendation",
        "definition": "\"No recommendation can be made because…\" — the guideline development group decided the evidence could not support one. Handbook §10.7. Distinct from very-low certainty: absent evidence and weak evidence are different findings."
      }
    ]
  },
  {
    "id": "recommendation-direction",
    "note": "For or against. The handbook prefers \"we recommend against X\" to \"X is not recommended\", which is ambiguous between against and no recommendation (§10.6).",
    "source": "WHO handbook for guideline development (2014) §10.1, §10.6",
    "codes": [
      {
        "code": "for",
        "definition": "The recommendation is in favour of the intervention."
      },
      {
        "code": "against",
        "definition": "The recommendation is against the intervention."
      }
    ]
  },
  {
    "id": "recommendation-strength",
    "note": "GRADE strength. Strength is not certainty: a strong recommendation can rest on low-certainty evidence and a conditional one on high. Record \"weak\" as conditional; the handbook treats them as synonyms (§10.4).",
    "source": "WHO handbook for guideline development (2014) §10.4",
    "codes": [
      {
        "code": "strong",
        "definition": "The desirable effects of adherence clearly outweigh the undesirable. Handbook §10.4.1."
      },
      {
        "code": "conditional",
        "definition": "Less certain about the balance of benefits and harms; generally states the conditions under which to implement. Also called weak. Handbook §10.4.2."
      }
    ]
  },
  {
    "id": "certainty",
    "note": "GRADE certainty of evidence. The 2014 handbook calls it quality of evidence and names certainty as a synonym (§9.1). Rated per outcome on evidence; the overall certainty on a recommendation is the lowest across its critical outcomes (§9.6).",
    "source": "WHO handbook for guideline development (2014) §9.1, §9.5–9.6",
    "codes": [
      {
        "code": "high",
        "definition": "Very confident the true effect lies close to the estimate."
      },
      {
        "code": "moderate",
        "definition": "Moderately confident; the true effect is likely close to the estimate but may be substantially different."
      },
      {
        "code": "low",
        "definition": "Limited confidence; the true effect may be substantially different."
      },
      {
        "code": "very-low",
        "definition": "Very little confidence; the true effect is likely substantially different. Not the same as no evidence — that is kind no-recommendation."
      }
    ]
  },
  {
    "id": "outcome-importance",
    "note": "How the guideline development group rated an outcome on the 1–9 scale: 7–9 critical, 4–6 important. Unimportant outcomes are not carried into evidence profiles, so they have no code here.",
    "source": "WHO handbook for guideline development (2014) §7.6, Fig. 7.1",
    "codes": [
      {
        "code": "critical",
        "definition": "Rated 7–9: critical for decision-making. Only critical outcomes determine overall certainty."
      },
      {
        "code": "important",
        "definition": "Rated 4–6: important but not critical for decision-making."
      }
    ]
  },
  {
    "id": "recommendation-status",
    "note": "Whether a recommendation is still in force. Recommendations in one guideline go out of date at different times (§1.7.2), and a department that doubts a recommendation's validity should say so before the update is done (§12.5.4). This is what impact analysis filters on.",
    "source": "WHO handbook for guideline development (2014) §1.7.2, §12.5",
    "codes": [
      {
        "code": "current",
        "definition": "In force."
      },
      {
        "code": "under-review",
        "definition": "Flagged as possibly out of date, with an update planned. Handbook §12.5.4."
      },
      {
        "code": "superseded",
        "definition": "Replaced by another recommendation, reached by supersedes."
      },
      {
        "code": "withdrawn",
        "definition": "Withdrawn without replacement."
      }
    ]
  },
  {
    "id": "change-status",
    "note": "Whether this edition of a consolidated guideline introduces, updates or carries a recommendation or indicator unchanged. Printed as NEW / UPDATE tags.",
    "source": "Consolidated guidelines on person-centred HIV strategic information (2022), summary recommendations; handbook §1.7.2",
    "codes": [
      {
        "code": "new",
        "definition": "Introduced in this edition."
      },
      {
        "code": "updated",
        "definition": "Changed in this edition."
      },
      {
        "code": "unchanged",
        "definition": "Carried from an earlier edition without change."
      }
    ]
  },
  {
    "id": "intervention-type",
    "note": "DRAFT. What kind of intervention a recommendation or catalogued intervention concerns. To be aligned with the UHC Compendium's categories once checked.",
    "source": "WHO handbook §1.7.1 (clinical, health system, public health, diagnostic, surveillance); digital interventions per CDHI",
    "codes": [
      {
        "code": "medicine",
        "definition": "A medicine or supplement."
      },
      {
        "code": "vaccine",
        "definition": "A vaccine."
      },
      {
        "code": "diagnostic",
        "definition": "A test or screening."
      },
      {
        "code": "procedure",
        "definition": "A clinical procedure."
      },
      {
        "code": "device-product",
        "definition": "A device or commodity."
      },
      {
        "code": "behavioural",
        "definition": "Counselling, education or behaviour change."
      },
      {
        "code": "public-health",
        "definition": "A population-level public health measure."
      },
      {
        "code": "health-system",
        "definition": "Service delivery, workforce or financing."
      },
      {
        "code": "health-information",
        "definition": "Data collection, monitoring or surveillance."
      },
      {
        "code": "digital",
        "definition": "A digital health intervention, classified by CDHI."
      }
    ]
  },
  {
    "id": "remark-type",
    "note": "What a remark is for. Grounded in the six remarks attached to ANC recommendation A.1.1.",
    "source": "ANC guideline (2016) p. 15; handbook §10.6, §10.8",
    "codes": [
      {
        "code": "definition",
        "definition": "Defines a term used in the recommendation."
      },
      {
        "code": "implementation",
        "definition": "How to put the recommendation into practice."
      },
      {
        "code": "precaution",
        "definition": "A caution to observe when applying it."
      },
      {
        "code": "contraindication",
        "definition": "When the intervention must not be given."
      },
      {
        "code": "subgroup",
        "definition": "Guidance specific to a subgroup."
      },
      {
        "code": "research-gap",
        "definition": "Evidence the guideline group says is still needed (handbook §10.8)."
      },
      {
        "code": "training",
        "definition": "A training or capacity need."
      }
    ]
  },
  {
    "id": "evidence-type",
    "note": "Which kind of evidence a row is, and so which scale its certainty is on: GRADE for effects, GRADE-CERQual for qualitative findings.",
    "source": "ANC guideline (2016) methods (GRADE and GRADE-CERQual)",
    "codes": [
      {
        "code": "effect",
        "definition": "Quantitative effect estimate; certainty is GRADE."
      },
      {
        "code": "qualitative",
        "definition": "Qualitative finding; certainty is GRADE-CERQual confidence."
      },
      {
        "code": "resource-use",
        "definition": "Costs or resource requirements."
      },
      {
        "code": "other",
        "definition": "Any other kind."
      }
    ]
  },
  {
    "id": "element-type",
    "note": "What kind of printed block a publication element is.",
    "source": "Observed in the ANC and HIV SI guidelines and the immunization summary tables",
    "codes": [
      {
        "code": "table",
        "definition": "A table, with columns and rows."
      },
      {
        "code": "table-row",
        "definition": "One row of a table."
      },
      {
        "code": "footnote",
        "definition": "A footnote attached to a row or a block."
      },
      {
        "code": "figure",
        "definition": "A figure."
      },
      {
        "code": "chart",
        "definition": "A chart; its data stays with its source."
      },
      {
        "code": "image",
        "definition": "An image."
      },
      {
        "code": "flowchart",
        "definition": "A flowchart or algorithm; its steps are modelled at L2, not here."
      },
      {
        "code": "box",
        "definition": "A boxed panel."
      },
      {
        "code": "list",
        "definition": "A list set apart on the page."
      }
    ]
  },
  {
    "id": "row-type",
    "note": "The role of a row within a table.",
    "source": "HIV SI guideline Table 2.3; ANC Table 1",
    "codes": [
      {
        "code": "header",
        "definition": "A header row, including repeated headers on later pages."
      },
      {
        "code": "group",
        "definition": "A group heading row such as 'A. Nutritional interventions'."
      },
      {
        "code": "data",
        "definition": "A row carrying content."
      },
      {
        "code": "note",
        "definition": "A note row inside the table."
      }
    ]
  },
  {
    "id": "citation-kind",
    "note": "Whether a citation string names a source, or stands in for one that is missing.",
    "source": "IMMZ DAK indicators workbook: '[Add appropriate reference]'",
    "codes": [
      {
        "code": "reference",
        "definition": "Names a source."
      },
      {
        "code": "placeholder",
        "definition": "The author's marker that a source is still to be added. Never resolves; counted as a coverage gap."
      }
    ]
  },
  {
    "id": "terminology-system",
    "note": "Code systems a DAK is expected to use. An unknown system is a warning, because a misspelt system silently breaks joins across guidelines.",
    "source": "smart-base input/fsh/profiles/SGLogicalModel.fsh and Aliases.fsh; UHC Compendium; CDHIv2.fsh",
    "codes": [
      {
        "code": "SMART",
        "definition": "SMART Guidelines codes."
      },
      {
        "code": "ICD-11",
        "definition": "ICD-11."
      },
      {
        "code": "ICF",
        "definition": "ICF."
      },
      {
        "code": "ICHI",
        "definition": "International Classification of Health Interventions."
      },
      {
        "code": "SNOMED-GPS",
        "definition": "SNOMED CT Global Patient Set."
      },
      {
        "code": "ATC",
        "definition": "Anatomical Therapeutic Chemical classification."
      },
      {
        "code": "UHC",
        "definition": "UHC Compendium of health interventions."
      },
      {
        "code": "CDHI",
        "definition": "Classification of Digital Health Interventions."
      }
    ]
  },
  {
    "id": "resolution-status",
    "note": "Whether a citation string has been matched to what it cites. `ambiguous` is a legitimate terminal state — two publications with similar titles is a question for a person — and must not be collapsed to resolved.",
    "source": "docs/SCOPE.md",
    "codes": [
      {
        "code": "unresolved",
        "definition": "Not yet matched."
      },
      {
        "code": "resolved",
        "definition": "Matched; a resolvesTo edge says to what."
      },
      {
        "code": "ambiguous",
        "definition": "More than one candidate, and choosing is a judgement for a person."
      }
    ]
  }
];

const VS = Object.fromEntries(L1_VALUE_SETS.map((v) => [v.id, v])) as Record<string, ValueSet>;

export const L1: LayerSpec = {
  schemaVersion: "3.0",
  layer: "L1",
  namespace: "http://smart.who.int/kg/",
  instanceNamespace: "https://smart.who.int/kg/l1",
  source: "authored",
  note: "Authored, not generated. L1 holds what WHO says and where it is printed: layout (publication, section, element), content (recommendation, remark, key question, outcome, evidence, catalogued intervention, indicator) and the references a DAK uses to point at them (citation, reference entry, terminology code). Nothing in L1 points out of L1. Every class and edge is grounded in an artefact that exists today; groundedIn says which.",
  groundedIn: [
    {
      "what": "The citation format L1 references already use",
      "where": "smart-base input/dmn/DAK.DT.IMMZ.D2.DT.BCG.dmn",
      "detail": "The decision table declares an output column `References` whose description is literally \"Reference for the source content (L1)\", and each rule carries a free-text citation in its second annotationEntry, e.g. \"WHO recommendations for routine immunization – summary tables (March 2023) (1)\". L1 traceability already exists at DMN rule granularity — as an unresolvable string. Turning those strings into resolvable IRIs is the point of this graph."
    },
    {
      "what": "The bibliographic vocabulary already in use",
      "where": "smart-base input/fsh/models/DublinCore.fsh and HealthInterventions.fsh",
      "detail": "HealthInterventions carries `reference 1..* DublinCore`. Publication metadata below reuses Dublin Core terms rather than inventing a citation model."
    },
    {
      "what": "How WHO normative publications are already identified in this estate",
      "where": "smart-base input/fsh/codesystems/CDHIv2.fsh, CDSCv2.fsh",
      "detail": "Carries ISBN 978-92-4-008194-9, publisher, version and CC BY-NC-SA rights. A worked example of a normative WHO publication given machine-readable identity."
    },
    {
      "what": "An existing L1-ward link from a DAK component",
      "where": "smart-base input/fsh/models/ProgramIndicator.fsh",
      "detail": "`references 0..* id` — \"References to Health Intervention IDs providing additional context\"."
    },
    {
      "what": "What a WHO guideline must contain, and how it is built",
      "where": "WHO handbook for guideline development, 2nd edition (2014). ISBN 978-92-4-154896-0. sha256 bfcd856e3ad7ab20408ee2fb097c6e9cb5c826f0926bccee4ebd708af924a651",
      "detail": "The Guideline Review Committee's own rulebook, and the grounding for the normative half of this layer. Guideline types: Table 1.2 and §1.7 (p5–8); products that are not guidelines: §1.9 (p11); GRC approval of every publication containing recommendations: §1.10.1 (p12). Key questions in PICO format, and \"a one-to-one relationship between recommendations and key questions does not exist\": §7.2–7.4 (p79–87). Outcomes rated critical / important / unimportant: §7.6 (p87–88). GRADE evidence profiles per key question and per outcome: §9.2 (p110). Overall certainty is the lowest across critical outcomes, per recommendation: §9.6 (p120). Direction and strength: §10.1, §10.4 (p123–129). A recommendation carries a justification and remarks, reflects PICO but does not name outcomes, and links to the evidence profiles and evidence-to-decision tables: §10.6 (p130–131). \"No recommendation can be made\": §10.7 (p131). Evidence profiles and EtD tables published in annexes: §12.1 (p157). Review-by dates, and recommendations updated individually: §1.7.2 (p7), §12.5 (p163–164). Page numbers are the printed ones."
    },
    {
      "what": "Recommendation categories later than the 2014 handbook, and a table that defines recommendations",
      "where": "WHO recommendations on antenatal care for a positive pregnancy experience (2016), ISBN 978-92-4-154991-2, sha256 338300b76172d410b91048209305fac53e1166c3be295a18b3f2c0c7c6b54182; web annexes (same ISBN)",
      "detail": "Table 1 (p. xi–xiv) lists all 49 recommendations with a 'Type of recommendation' column: Recommended, Not recommended, Context-specific recommendation, Context-specific recommendation (research). No GRADE strength is printed, so grading is optional. Footnotes carry remarks and 'This recommendation supersedes the previous recommendation found in … (2012)'. Web annex 1 gives key questions with P, I, C and O labelled inline and one outcome list shared by a group of questions; Web annex 3 records certainty against named outcomes. Recommendation A.1.1 is printed in Table 1 (p. xi), in Chapter 3 with six remarks (p. 15), and again on p. 108."
    },
    {
      "what": "Indicators and ungraded recommendations in a consolidated guideline",
      "where": "Consolidated guidelines on person-centred HIV strategic information (WHO, 2022), ISBN 978-92-4-005531-5, sha256 2647e4d36f0be1488c282ed60b846d8e3947faef9b5e9800c9f8fea9a355844f",
      "detail": "Indicator PRV.3 is printed three times with different fields: summary list (p. xxiii), Table 2.3 (p. 40), Chapter 8 reference sheet (p. 294). Its rationale cites a recommendation from another guideline. Recommendations carry NEW/UPDATE tags and sub-recommendations a), b) with their own tags, and no GRADE labels. Boxes 3.17 and 4.1 quote other guidelines' recommendations with their original grades."
    },
    {
      "what": "Where DAK citations actually occur, and how they fail",
      "where": "a WHO SMART immunizations IG's decision-logic workbook (input/decision-logic/IMMZ DAK_decision-support logic.xlsx) and its indicators workbook (input/L2/IMMZ DAK_indicators.xlsx)",
      "detail": "Reference cells cite '… (n)', where (n) is a row of the workbook's own References sheet holding the full bibliographic entry and URL; each workbook numbers its own list. Some cells hold two citations on separate lines. Of 50 indicators, 44 cite a reference, 4 carry the placeholder '[Add appropriate reference]', 2 are blank."
    }
  ],
  valueSets: L1_VALUE_SETS,
  predicates: [
    {
      "predicate": "contains",
      "iri": "http://smart.who.int/kg/contains",
      "note": "Layout containment only: publication, sections, elements. It never points at content."
    },
    {
      "predicate": "hasSupplement",
      "iri": "http://smart.who.int/kg/hasSupplement",
      "note": "A guideline to its web annex or supplementary document (handbook §12.1)."
    },
    {
      "predicate": "supersedes",
      "iri": "http://smart.who.int/kg/supersedes",
      "note": "This replaces that, between publications and between individual recommendations (handbook §1.7.2, §12.5; ANC Table 1 footnotes)."
    },
    {
      "predicate": "refines",
      "iri": "http://smart.who.int/kg/refines",
      "note": "A recommendation narrows or conditions another."
    },
    {
      "predicate": "partOf",
      "iri": "http://smart.who.int/kg/partOf",
      "note": "A sub-recommendation a), b) to its parent. Each part carries its own change status (HIV SI 2022)."
    },
    {
      "predicate": "definedIn",
      "iri": "http://smart.who.int/kg/definedIn",
      "note": "The one publication that issued this content: its authority."
    },
    {
      "predicate": "presentedIn",
      "iri": "http://smart.who.int/kg/presentedIn",
      "note": "A place this content is printed, in any publication. Many per node. Restatement is presentedIn into a publication other than definedIn. The edge carries renderedText only when the printed wording differs from the stored text."
    },
    {
      "predicate": "answers",
      "iri": "http://smart.who.int/kg/answers",
      "note": "A recommendation answers a key question. Many-to-many (handbook §7.4)."
    },
    {
      "predicate": "addresses",
      "iri": "http://smart.who.int/kg/addresses",
      "note": "A row of an evidence profile addresses a key question."
    },
    {
      "predicate": "hasOutcome",
      "iri": "http://smart.who.int/kg/hasOutcome",
      "note": "A key question names an outcome. A list shared by several questions is one set of outcome nodes."
    },
    {
      "predicate": "forOutcome",
      "iri": "http://smart.who.int/kg/forOutcome",
      "note": "An evidence row grades one outcome. Optional: qualitative evidence may concern a criterion such as values."
    },
    {
      "predicate": "aboutIntervention",
      "iri": "http://smart.who.int/kg/aboutIntervention",
      "note": "The I of a key question, joined to a catalogued intervention."
    },
    {
      "predicate": "supportedBy",
      "iri": "http://smart.who.int/kg/supportedBy",
      "note": "A recommendation to the evidence it rests on."
    },
    {
      "predicate": "hasRemark",
      "iri": "http://smart.who.int/kg/hasRemark",
      "note": "A recommendation to a remark: definition, implementation, precaution, contraindication, subgroup, research gap or training."
    },
    {
      "predicate": "recommends",
      "iri": "http://smart.who.int/kg/recommends",
      "note": "A recommendation concerns a catalogued intervention. Optional: only when the mapping is known."
    },
    {
      "predicate": "measures",
      "iri": "http://smart.who.int/kg/measures",
      "note": "What an indicator counts: a catalogued intervention, or adherence to a recommendation (handbook Table 10.2)."
    },
    {
      "predicate": "justifiedBy",
      "iri": "http://smart.who.int/kg/justifiedBy",
      "note": "Why an indicator exists: the recommendation its rationale cites (HIV SI 2022, PRV.3)."
    },
    {
      "predicate": "crossReferences",
      "iri": "http://smart.who.int/kg/crossReferences",
      "note": "Names an external code. Records that a code was cited, never what it means. Terminology is a leaf."
    },
    {
      "predicate": "classifiedAs",
      "iri": "http://smart.who.int/kg/classifiedAs",
      "note": "Placement of a catalogued intervention in UHC, ICHI or CDHI."
    },
    {
      "predicate": "numberedAs",
      "iri": "http://smart.who.int/kg/numberedAs",
      "note": "A citation's '(n)' to row n of the same artefact's reference list. Mechanical."
    },
    {
      "predicate": "resolvesTo",
      "iri": "http://smart.who.int/kg/resolvesTo",
      "note": "What a citation or reference entry refers to, as precisely as the string allows. Matching is a judgement: inferred, or decided when a person chose between candidates."
    }
  ],
  classes: [
    {
      id: "publication",
      name: "Publication",
      kind: "Source",
      iri: "http://smart.who.int/kg/publication",
      note: "A WHO publication: a guideline of any of the handbook's types, a position paper, a summary table, a classification, implementation guidance, or a supplement. Metadata follows Dublin Core.",
      properties: {
        title: p.inherited(p.string("Title", "A name given to the resource")),
        creator: p.inherited(p.list(p.string("Creator", "An entity responsible for making the resource"))),
        publisher: p.inherited(p.string("Publisher", "An entity responsible for making the resource available")),
        issued: p.date("Issued", "Dublin Core dcterms:issued — date of formal issuance (YYYY, YYYY-MM or YYYY-MM-DD)."),
        modified: p.date("Modified", "Dublin Core dcterms:modified — date the publication was changed."),
        version: p.string("Version", "Edition or version, as printed."),
        identifiers: p.backbone("Identifiers", "Typed identifiers; the first of isbn, iris-handle, doi, issn, url builds the IRI.", { type: p.code(VS["identifier-type"], "error", "Type", "The identifier's kind."), value: p.string("Value", "The identifier, as printed.") }),
        language: p.inherited(p.string("Language", "A language of the resource")),
        rights: p.inherited(p.string("Rights", "Information about rights held in and over the resource")),
        url: p.uri("URL", "Where the publication is published."),
        sha256: p.sha256("SHA-256", "Hash of the PDF; pins the source."),
        publicationType: p.code(VS["publication-type"], "error", "Publication type", "What kind of publication this is."),
        grcStatus: p.code(VS["grc-status"], "error", "Grc status", "Whether the Guideline Review Committee approved the publication."),
        reviewBy: p.date("Review by", "The handbook's review-by date (§12.5.1)."),
      },
      valueSets: {"publicationType": "publication-type", "grcStatus": "grc-status"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+$",
      minDerivation: "inferred",
      propertyNote: "identifiers is a list of {type, value}; type is from identifier-type, and the first of isbn, iris-handle, doi, issn, url builds the IRI, so an edition change is a new publication. issued and modified are Dublin Core. reviewBy is the handbook's review-by date (§12.5.1). sha256 pins the PDF.",
      parent: { name: "DublinCore", where: "smart-base input/fsh/models/DublinCore.fsh" },
    },
    {
      id: "publication-section",
      name: "Publication section",
      kind: "Source",
      iri: "http://smart.who.int/kg/publication-section",
      note: "A chapter, annex or numbered section, at any depth.",
      properties: {
        heading: p.string("Heading", "The section heading, verbatim."),
        number: p.string("Number", "The section number as printed (\"1.2\", \"Annex 3\")."),
        pageRange: p.string("Page range", "Pages the section occupies, as printed or physical (\"12-18\")."),
        ordinal: p.unsignedInt("Ordinal", "Position among its siblings."),
      },
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/section/[^/]+$",
      minDerivation: "inferred",
    },
    {
      id: "publication-element",
      name: "Publication element",
      kind: "Source",
      iri: "http://smart.who.int/kg/publication-element",
      note: "One printed block: a table, a table row, a footnote, a figure, a chart, an image, a flowchart, a box or a list. It records where something is printed and exactly what is printed that no content node holds. It carries no meaning of its own; meaning lives in content nodes, joined by presentedIn.",
      properties: {
        elementType: p.code(VS["element-type"], "error", "Element type", "What kind of printed block a publication element is."),
        label: p.string("Label", "The element's printed label (\"Table 3\", \"Box 2\")."),
        caption: p.markdown("Caption", "The element's caption, verbatim."),
        pageRange: p.string("Page range", "Pages the element is printed on."),
        ordinal: p.unsignedInt("Ordinal", "Position among its siblings."),
        rowType: p.code(VS["row-type"], "error", "Row type", "The role of a row within a table."),
        columns: p.verbatimList("Columns", "The header text, verbatim, one per column; a blank header is an empty string."),
        columnMap: p.map("Column map", "Per column, the content field that fills it when the table is re-rendered (e.g. 'Recommendation' -> statement).", "column", "field"),
        cells: p.cells("Cells", "Text no content node holds, per column; a cell filled through columnMap is null."),
        text: p.markdown("Text", "Unmodelled printed text, such as a footnote that is not a remark."),
        sha256: p.sha256("SHA-256", "Hash of the image, for an image element."),
      },
      valueSets: {"elementType": "element-type", "rowType": "row-type"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/element/.+$",
      minDerivation: "inferred",
      propertyNote: "columns is the header text, verbatim. columnMap names, per column, the content field that fills it when the table is re-rendered (e.g. 'Recommendation' -> statement). cells holds only text no content node holds; a cell filled through columnMap is null. text is for unmodelled printed text such as a footnote that is not a remark. sha256 is for images.",
    },
    {
      id: "recommendation",
      name: "Recommendation",
      kind: "Concept",
      iri: "http://smart.who.int/kg/recommendation",
      note: "A normative statement from a WHO guideline. Kinds other than a graded recommendation (context-specific, research-only, good practice statement, no-recommendation) are the same node with a different kind.",
      properties: {
        identifier: p.string("Identifier", "The published number (e.g. A.1.1); sub-recommendations append their letter."),
        statement: p.markdown("Statement", "The recommendation, VERBATIM; the only stored copy."),
        kind: p.code(VS["recommendation-kind"], "error", "Kind", "What sort of normative statement this is."),
        direction: p.code(VS["recommendation-direction"], "error", "Direction", "For or against."),
        strength: p.code(VS["recommendation-strength"], "error", "Strength", "GRADE strength."),
        overallCertainty: p.code(VS["certainty"], "error", "Overall certainty", "GRADE certainty of evidence."),
        justification: p.markdown("Justification", "The printed justification, verbatim."),
        status: p.code(VS["recommendation-status"], "error", "Status", "Whether a recommendation is still in force."),
        changeStatus: p.code(VS["change-status"], "error", "Change status", "Whether this edition of a consolidated guideline introduces, updates or carries a recommendation or indicator unchanged."),
        intervention: p.string("Intervention", "Verbatim slot: the intervention, quoted from the statement, a remark, caption or heading."),
        interventionType: p.code(VS["intervention-type"], "error", "Intervention type", "DRAFT."),
        population: p.string("Population", "Verbatim slot: the population."),
        setting: p.string("Setting", "Verbatim slot: the setting (absorbs the former conditionality)."),
        provider: p.string("Provider", "Verbatim slot: who provides it."),
        timing: p.string("Timing", "Verbatim slot: when."),
        contentHash: p.sha256("Content hash", "sha256 of the normalised statement; unchanged on re-extraction means current."),
      },
      valueSets: {"kind": "recommendation-kind", "direction": "recommendation-direction", "strength": "recommendation-strength", "overallCertainty": "certainty", "status": "recommendation-status", "changeStatus": "change-status", "interventionType": "intervention-type"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/recommendation/[^/]+(/[^/]+)*$",
      minDerivation: "inferred",
      propertyNote: "statement is verbatim and is the only stored copy. intervention, population, setting, provider and timing are verbatim slots taken from the statement, its remarks, or the enclosing caption or heading. setting absorbs the former conditionality. identifier is the published number (e.g. A.1.1), used in the IRI; sub-recommendations append their letter.",
      contentFields: ["statement"],
    },
    {
      id: "remark",
      name: "Remark",
      kind: "Concept",
      iri: "http://smart.who.int/kg/remark",
      note: "A remark attached to a recommendation (handbook §10.6). May also be printed as a table footnote.",
      properties: {
        text: p.markdown("Text", "The remark, verbatim."),
        remarkType: p.code(VS["remark-type"], "error", "Remark type", "What a remark is for."),
        ordinal: p.unsignedInt("Ordinal", "Position among the recommendation's remarks."),
        contentHash: p.sha256("Content hash", "sha256 of the normalised text."),
      },
      valueSets: {"remarkType": "remark-type"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/recommendation/.+/remark/[^/]+$",
      minDerivation: "inferred",
      contentFields: ["text"],
    },
    {
      id: "key-question",
      name: "Key question",
      kind: "Concept",
      iri: "http://smart.who.int/kg/key-question",
      note: "A question in PICO format, framed before the evidence search (handbook §7.1–7.4). P and C are verbatim text with codes through crossReferences; I is also joined to a catalogued intervention; O is the outcome node.",
      properties: {
        identifier: p.string("Identifier", "The question's published number."),
        text: p.markdown("Text", "The question, verbatim."),
        population: p.string("Population", "P, verbatim."),
        intervention: p.string("Intervention", "I, verbatim."),
        comparator: p.string("Comparator", "C, verbatim."),
        setting: p.string("Setting", "Setting, verbatim."),
        contentHash: p.sha256("Content hash", "sha256 of the normalised text."),
      },
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/key-question/[^/]+$",
      minDerivation: "inferred",
      contentFields: ["text"],
    },
    {
      id: "outcome",
      name: "Outcome",
      kind: "Concept",
      iri: "http://smart.who.int/kg/outcome",
      note: "An outcome a guideline group chose to judge a key question by, with its importance in this guideline (handbook §7.6). A node because evidence attaches to it and one list is shared by several questions (ANC Web annex 1). Flat: one node per specific outcome.",
      properties: {
        name: p.string("Name", "The outcome as first printed."),
        importance: p.code(VS["outcome-importance"], "error", "Importance", "How the guideline development group rated an outcome on the 1–9 scale: 7–9 critical, 4–6 important."),
        aliases: p.list(p.string("Aliases", "Other printed forms of the outcome (e.g. 'EGWG').")),
        category: p.string("Category", "The printed group heading (e.g. 'Fetal/newborn morbidity')."),
      },
      valueSets: {"importance": "outcome-importance"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/outcome/[^/]+$",
      minDerivation: "inferred",
      propertyNote: "name as first printed; aliases are the other printed forms (e.g. 'EGWG'); category is the printed group heading (e.g. 'Fetal/newborn morbidity').",
    },
    {
      id: "evidence",
      name: "Evidence",
      kind: "Concept",
      iri: "http://smart.who.int/kg/evidence",
      note: "One row of an evidence profile: the evidence for one outcome of one key question, with its certainty (handbook §9.2).",
      properties: {
        evidenceType: p.code(VS["evidence-type"], "error", "Evidence type", "Which kind of evidence a row is, and so which scale its certainty is on: GRADE for effects, GRADE-CERQual for qualitative findings."),
        certainty: p.code(VS["certainty"], "error", "Certainty", "GRADE certainty of evidence."),
        summary: p.markdown("Summary", "Summary of the body of evidence."),
        studyCount: p.unsignedInt("Study count", "Number of studies in the body of evidence."),
        citation: p.string("Citation", "Bibliographic citation of the evidence review."),
        contentHash: p.sha256("Content hash", "sha256 of the normalised summary."),
      },
      valueSets: {"evidenceType": "evidence-type", "certainty": "certainty"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/evidence/.+$",
      minDerivation: "inferred",
      contentFields: ["summary"],
    },
    {
      id: "health-intervention",
      name: "Health intervention",
      kind: "Concept",
      iri: "http://smart.who.int/kg/health-intervention",
      note: "An intervention identified in a WHO catalogue or classification (UHC Compendium, ICHI, CDHI), digital interventions included. A peer of recommendation, not a recommendation. A DAK may draw on both.",
      properties: {
        identifier: p.string("Identifier", "The catalogue code (UHC, ICHI, CDHI)."),
        name: p.string("Name", "Name, as catalogued."),
        description: p.markdown("Description", "Description, as catalogued."),
        interventionType: p.code(VS["intervention-type"], "error", "Intervention type", "DRAFT."),
      },
      valueSets: {"interventionType": "intervention-type"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/health-intervention/[^/]+$",
      minDerivation: "inferred",
      correspondsTo: { name: "HealthInterventions", why: "identifier and description correspond to HealthInterventions.id and description[x]; not a Parent because HealthInterventions requires reference 1..* DublinCore, which here is an edge (definedIn) rather than a field" },
    },
    {
      id: "indicator",
      name: "Indicator",
      kind: "Concept",
      iri: "http://smart.who.int/kg/indicator",
      note: "A WHO indicator, identified by its published reference number. Printed in several places (HIV SI 2022: summary list, Table 2.3, reference sheet) and stored once.",
      properties: {
        refNo: p.string("Reference number", "The indicator's printed reference number (e.g. PRV.3)."),
        shortName: p.string("Short name", "Short name, as printed."),
        definition: p.markdown("Definition", "Definition, verbatim."),
        numerator: p.markdown("Numerator", "Numerator, verbatim."),
        denominator: p.markdown("Denominator", "Denominator, verbatim."),
        variants: p.backbone("Variants", "Population- or level-specific forms (PRV.17, PRV.3).", { population: p.string("Population", "The population this variant is for."), definition: p.markdown("Definition", "Definition, verbatim."), numerator: p.markdown("Numerator", "Numerator, verbatim."), denominator: p.markdown("Denominator", "Denominator, verbatim.") }),
        whatItMeasures: p.markdown("What it measures", "As printed."),
        rationale: p.markdown("Rationale", "As printed."),
        methodOfMeasurement: p.markdown("Method of measurement", "As printed."),
        disaggregation: p.markdown("Disaggregation", "As printed."),
        programmeArea: p.string("Programme area", "As printed."),
        isCore: p.boolean("Is core", "Whether the publication marks it a core indicator."),
        isSurveyBased: p.boolean("Is survey-based", "Whether it is measured by survey."),
        changeStatus: p.code(VS["change-status"], "error", "Change status", "Whether this edition of a consolidated guideline introduces, updates or carries a recommendation or indicator unchanged."),
        contentHash: p.sha256("Content hash", "sha256 of the normalised definition, numerator and denominator."),
      },
      valueSets: {"changeStatus": "change-status"},
      iriPattern: "^https://smart\\.who\\.int/kg/l1/publication/(isbn|iris-handle|doi|issn|url)-[^/]+/indicator/[^/]+$",
      minDerivation: "inferred",
      propertyNote: "variants is a list of {population, definition, numerator, denominator} for population-specific or level-specific forms (PRV.17, PRV.3).",
      contentFields: ["definition", "numerator", "denominator"],
      correspondsTo: { name: "ProgramIndicator", why: "definition, numerator, denominator and disaggregation are ProgramIndicator's elements and types (markdown); not a Parent because ProgramIndicator makes them 1..1 and an L1 indicator is recorded with what its source prints" },
    },
    {
      id: "citation",
      name: "Citation",
      kind: "Reference",
      iri: "http://smart.who.int/kg/citation",
      note: "One citation string exactly as written in a DAK artefact. A cell holding several citations yields several nodes. Content-addressed in the DAK's namespace, so one string is one node across artefacts.",
      properties: {
        text: p.string("Text", "The citation string, VERBATIM, as written in the DAK artefact."),
        numbering: p.string("Numbering", "The '(n)' back-reference into the artefact's reference list."),
        citationKind: p.code(VS["citation-kind"], "error", "Citation kind", "Whether a citation string names a source, or stands in for one that is missing."),
        resolutionStatus: p.code(VS["resolution-status"], "error", "Resolution status", "Whether a citation string has been matched to what it cites."),
      },
      valueSets: {"citationKind": "citation-kind", "resolutionStatus": "resolution-status"},
      minDerivation: "derived",
      propertyNote: "Where a citation was found is recorded by appearsIn (L2) and by each use edge (L2-DMN, L3 citesSource), not on the node.",
    },
    {
      id: "reference-entry",
      name: "Reference entry",
      kind: "Reference",
      iri: "http://smart.who.int/kg/reference-entry",
      note: "One row of a DAK artefact's own reference list: '(1)' and the full bibliographic text and URL it stands for. Resolved once; every citation numbered to it shares the result.",
      properties: {
        number: p.string("Number", "The entry's number in the reference list."),
        text: p.markdown("Text", "The full bibliographic text, verbatim."),
        url: p.uri("URL", "The URL the entry prints."),
        resolutionStatus: p.code(VS["resolution-status"], "error", "Resolution status", "Whether a citation string has been matched to what it cites."),
      },
      valueSets: {"resolutionStatus": "resolution-status"},
      iriPattern: "^.+/reference/[^/]+$",
      minDerivation: "derived",
    },
    {
      id: "terminology-code",
      name: "Terminology code",
      kind: "Reference",
      iri: "http://smart.who.int/kg/terminology-code",
      note: "A code in an external terminology — ICD-10, ICD-11, SNOMED CT, ATC, or a WHO classification such as CDHI. CROSS-REFERENCE ONLY. It records system, code and display, and asserts NOTHING about the terminology: no hierarchy, no subsumption, no synonyms, no post-coordination. The terminology has its own authority, its own release cycle and its own tooling, and a partial copy here would be wrong within one release. Resolve meaning against the terminology server, not against this graph.",
      properties: {
        system: p.inherited(p.code(VS["terminology-system"], "warning", "System", "Code systems a DAK is expected to use.")),
        code: p.inherited(p.string("Code", "Symbol in syntax defined by the system")),
        display: p.inherited(p.string("Display", "Representation defined by the system")),
        version: p.inherited(p.string("Version", "Version of the system - if relevant")),
      },
      valueSets: {"system": {"set": "terminology-system", "severity": "warning"}},
      minDerivation: "derived",
      parent: { name: "Coding", where: "FHIR R4 core datatype" },
    },
  ],
  edges: [
    {
      "predicate": "contains",
      "source": "publication",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "contains",
      "source": "publication-section",
      "target": "publication-section",
      "qualifier": "subsection",
      "minDerivation": "inferred"
    },
    {
      "predicate": "contains",
      "source": "publication-section",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "contains",
      "source": "publication",
      "target": "publication-element",
      "qualifier": "unsectioned",
      "minDerivation": "inferred"
    },
    {
      "predicate": "contains",
      "source": "publication-element",
      "target": "publication-element",
      "qualifier": "part",
      "minDerivation": "inferred",
      "note": "table to row, row to footnote"
    },
    {
      "predicate": "hasSupplement",
      "source": "publication",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "supersedes",
      "source": "publication",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "supersedes",
      "source": "recommendation",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "refines",
      "source": "recommendation",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "partOf",
      "source": "recommendation",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "recommendation",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "indicator",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "health-intervention",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "key-question",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "evidence",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "outcome",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "definedIn",
      "source": "remark",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "recommendation",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "recommendation",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "indicator",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "indicator",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "health-intervention",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "health-intervention",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "key-question",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "key-question",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "evidence",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "evidence",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "outcome",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "outcome",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "remark",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "presentedIn",
      "source": "remark",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "answers",
      "source": "recommendation",
      "target": "key-question",
      "minDerivation": "inferred"
    },
    {
      "predicate": "addresses",
      "source": "evidence",
      "target": "key-question",
      "minDerivation": "inferred"
    },
    {
      "predicate": "hasOutcome",
      "source": "key-question",
      "target": "outcome",
      "minDerivation": "inferred"
    },
    {
      "predicate": "forOutcome",
      "source": "evidence",
      "target": "outcome",
      "minDerivation": "inferred"
    },
    {
      "predicate": "aboutIntervention",
      "source": "key-question",
      "target": "health-intervention",
      "minDerivation": "inferred"
    },
    {
      "predicate": "supportedBy",
      "source": "recommendation",
      "target": "evidence",
      "minDerivation": "inferred"
    },
    {
      "predicate": "hasRemark",
      "source": "recommendation",
      "target": "remark",
      "minDerivation": "inferred"
    },
    {
      "predicate": "recommends",
      "source": "recommendation",
      "target": "health-intervention",
      "minDerivation": "inferred"
    },
    {
      "predicate": "measures",
      "source": "indicator",
      "target": "health-intervention",
      "minDerivation": "inferred"
    },
    {
      "predicate": "measures",
      "source": "indicator",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "justifiedBy",
      "source": "indicator",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "recommendation",
      "target": "terminology-code",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "recommendation",
      "target": "terminology-code",
      "qualifier": "intervention",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "recommendation",
      "target": "terminology-code",
      "qualifier": "population",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "recommendation",
      "target": "terminology-code",
      "qualifier": "setting",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "recommendation",
      "target": "terminology-code",
      "qualifier": "provider",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "recommendation",
      "target": "terminology-code",
      "qualifier": "timing",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "key-question",
      "target": "terminology-code",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "indicator",
      "target": "terminology-code",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "health-intervention",
      "target": "terminology-code",
      "minDerivation": "inferred"
    },
    {
      "predicate": "crossReferences",
      "source": "outcome",
      "target": "terminology-code",
      "minDerivation": "inferred"
    },
    {
      "predicate": "classifiedAs",
      "source": "health-intervention",
      "target": "terminology-code",
      "qualifier": "UHC",
      "minDerivation": "inferred"
    },
    {
      "predicate": "classifiedAs",
      "source": "health-intervention",
      "target": "terminology-code",
      "qualifier": "ICHI",
      "minDerivation": "inferred"
    },
    {
      "predicate": "classifiedAs",
      "source": "health-intervention",
      "target": "terminology-code",
      "qualifier": "CDHI",
      "minDerivation": "inferred"
    },
    {
      "predicate": "numberedAs",
      "source": "citation",
      "target": "reference-entry",
      "minDerivation": "derived"
    },
    {
      "predicate": "resolvesTo",
      "source": "citation",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "citation",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "citation",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "citation",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "citation",
      "target": "indicator",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "citation",
      "target": "health-intervention",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "reference-entry",
      "target": "publication",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "reference-entry",
      "target": "publication-section",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "reference-entry",
      "target": "publication-element",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "reference-entry",
      "target": "recommendation",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "reference-entry",
      "target": "indicator",
      "minDerivation": "inferred"
    },
    {
      "predicate": "resolvesTo",
      "source": "reference-entry",
      "target": "health-intervention",
      "minDerivation": "inferred"
    }
  ],
  deliberatelyOmitted: [
    {
      "what": "Population, intervention, comparator and outcome as classes, with hasPopulation / hasIntervention / hasComparator / hasOutcome from the recommendation",
      "why": "Removed in 2.0. They hung PICO off the wrong node. The handbook frames PICO on the key question (§7.2), makes questions and recommendations many-to-many (§7.4), and says a recommendation should not name outcomes (§10.6) — so an extractor filling hasOutcome or hasComparator from a recommendation's text would be inventing them. PICO is now properties of key-question, and I is joined to health-intervention."
    },
    {
      "what": "Evidence-to-decision criteria as properties or nodes",
      "why": "The judgement a DAK adapter would most like to read, and no L1 question needs it. The vocabulary is also unsettled: the 2014 handbook lists eight factors (Table 10.1), the GRADE EtD framework for clinical and public-health recommendations has twelve (Alonso-Coello et al., BMJ 2016). Choosing one is a decision to make with a consumer in hand."
    },
    {
      "what": "The reasons certainty was rated down or up",
      "why": "Risk of bias, inconsistency, indirectness, imprecision, publication bias; large effect, dose-response, confounding (handbook §9.5). They live in the evidence profile, which evidence points at through reportedIn. Nothing here re-examines a grade."
    },
    {
      "what": "Contributors, the guideline development group, declarations of interest, funding",
      "why": "Required in the guideline document (§12.1) and irrelevant to impact, coverage or citation resolution."
    },
    {
      "what": "Translations as linked publications",
      "why": "Handbook §12.4.3. No citation in the DAK estate is known to point at a translated edition. Add a translationOf edge when one does."
    },
    {
      "what": "schedule and schedule-entry",
      "why": "Removed in 3.0. A schedule row restates intervention, population and timing, which a recommendation already carries in its timing slot. A printed schedule table is publication elements with verbatim cells; the structured dose table is L2 scheduling input."
    },
    {
      "what": "restates and reportedIn",
      "why": "Removed in 3.0. presentedIn into another publication is restatement; presentedIn into an annex element is where evidence is reported."
    },
    {
      "what": "external-artifact, appearsIn and implementedBy",
      "why": "Moved to L2 in 3.0, unchanged. A DAK file is the DAK's own material, not WHO content, and L2 already licensed recommendation implementedBy its components, so L1 held a second path for the same question. L1 now has no edge pointing out of it; every higher layer points down into it."
    },
    {
      "what": "Research gaps as their own class",
      "why": "They are remarks with remarkType research-gap (handbook §10.8). Promote them if programmes need to track gaps across guidelines (question for subject-matter experts)."
    },
    {
      "what": "Population and comparator as nodes",
      "why": "Evidence is not graded per population within a guideline, so nothing attaches to them; a terminology code is the join key across guidelines. Promote population if evidence is ever graded per subgroup (question for subject-matter experts)."
    },
    {
      "what": "Evidence-to-decision judgements",
      "why": "ANC Web annex 3 records them as a structured table per recommendation. No L1 question needs them yet, and the criteria differ between the 2014 handbook (8) and the GRADE EtD framework (12)."
    }
  ],
};
