/**
 * Library: HIV.IND.22 Logic
 * Ref No: HTS.5
 * Short Name: HTS partner services
 *
 * Definition: Number of people who were identified and tested using partner testing services and who received their results
 *
 * Numerator: For the general population: Number of elicited partners and other contacts* of people diagnosed with HIV who received HTS |  | Additional cascade data collected: | • Number of people diagnosed with HIV (index cases) offered partner services | • Number of people diagnosed with HIV (index cases) accepting partner services | • Number of contacts/partners of people living with HIV whose information is elicited from people diagnosed with HIV (index cases) |  | For key populations: Number of elicited contacts1 of members of key populations who received HTS. | Additional cascade data collected: | • Number of key population members offered social network-based/partner services | • Number of key population members accepting social network-based/partner services | • Number of contacts of key population members elicited
 * Numerator Calculation: COUNT of clients "Referred through partner services" that are a 'Partner or contact of an index case' AND "Type of contact or partner for partner services" IN 'Sexual partner', 'Drug-injecting partner' with "HIV test date" AND "Date HIV test results returned" in the reporting period
 * Numerator Exclusions: 
 *
 * Denominator: 1
 * Denominator Calculation: 1
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • By index case gender (male, female, other**) 
 *  • Age (0–4, 5–9, 10–14, 15–19, 20–24, 25–49, 50+ years)*** 
 *  • HIV status of partner or contact (already known positive, newly diagnosed positive, negative) 
 *  • Key populations (men who have sex with men, people living in prisons and other closed settings, people who inject drugs, sex workers, trans and gender diverse people)**** 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: *Gender [of index case] | Age | Partner HIV status (reported) | HIV status of contact | Key population member type
 *
 * Numerator and Denominator Elements:
 * Date HIV test results returned 
 *  HIV test date 
 *  Referred through partner services 
 *  Type of contact or partner for partner services
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.A.DE17: Age | Calculated age (number of years) of the client based on date of birth
 * HIV.B.DE5: Referred through partner services | Client reported coming to the facility after receiving a provider-assisted referral or patient referral from a contact or partner
 * HIV.B.DE6: Partner or contact of an index case | The client is a contact or partner of a person diagnosed with HIV (an index case)
 * HIV.B.DE7: Partner or contact of an HIV testing client (non-index case) | The client is a contact or partner identified through partner or social network services, but is not known to be a partner of an index-case
 * HIV.B.DE8: Type of contact or partner for partner services | Client's relationship to the person that referred the client for partner services or family services
 * HIV.B.DE9: Biological child | Client is the biological child of the person that referred the client for family services
 * HIV.B.DE10: Drug-injecting partner | Client is a drug-injecting partner of the person that referred the client for partner services
 * HIV.B.DE11: Sexual partner | Client is a sexual partner of the person that referred the client for partner services
 * HIV.B.DE12: Social contact | Client is a social contact of the person that referred the client for social-network services
 * HIV.B.DE33: Partner HIV status (reported) | The HIV status of the client's partner.
 * HIV.B.DE34: HIV-positive | Client's partner is HIV-positive
 * HIV.B.DE35: HIV-negative | Client's partner is HIV-negative
 * HIV.B.DE36: Unknown | Don't know HIV status - client does not know partner's HIV status
 * HIV.B.DE50: Key population member type* | The type of key population that the client is included in
 * HIV.B.DE51: Sex worker | Client is a sex worker
 * HIV.B.DE52: Men who have sex with men | Client is a man who has sex with men
 * HIV.B.DE53: Trans and gender-diverse people | Client identifies as trans and gender-diverse
 * HIV.B.DE54: People who inject drugs | Client is a person who injects drugs
 * HIV.B.DE55: People living in prisons and other closed settings | Client lives in a prison or another closed setting
 * HIV.B.DE60: Date HIV test results returned | Date HIV test result returned to client
 * HIV.B.DE110: HIV test date | Date of the HIV test
 * HIV.E.DE114: Key population member type* | The type of key population that the infant's mother is included in
 * HIV.E.DE115: Sex worker | Infant's mother is a sex worker
 * HIV.E.DE116: People who inject drugs | Infant's mother is a person who injects drugs
 * HIV.E.DE117: Trans and gender-diverse people | Infant's mother identifies as trans and gender-diverse
 * HIV.E.DE118: People living in prisons and other closed setting | Infant's mother is in a prison or closed setting
 * HIV.E.DE224: HIV test date | Date of the HIV test
 * HIV.PRV.DE11: HIV status of contact | The HIV status of the client's contact
 * HIV.PRV.DE12: HIV-positive | Client's contact is HIV-positive
 * HIV.PRV.DE13: HIV-negative | Client's contact is HIV-negative
 * HIV.PRV.DE14: Unknown | Client does not know contact's HIV status
 * HIV.SRV.DE1: HIV test date | Date of the HIV test
 *
 * Additional Context
 * - what it measures: This measures the coverage and impact of the testing cascade of services for partners and other contacts* of people living with HIV, including key population members.
 * - rationale: • Contact testing, including among sexual partners, has been shown to increase the diagnosis of already-infected contacts and partners of newly identified HIV cases. | • Among serodiscordant couples, partner notification and testing can be a critical step in preventing infection of the uninfected partner. | • Contact and/or partner notification and testing should be voluntary and provided with supportive services.
 * - method: Patient monitoring data (HIV index testing services register or logbook, HTS registers or reporting forms) or EMR
 * 
 * Suggested Scoring Method: continuous-variable | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/cv-measure-cqfm
 */

library HIVIND22Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'
include WHOCommon called WCom
include HIVIndicatorElements called HIE
include HIVElements called HE

// Indicator Definition
parameter "Measurement Period" Interval<Date> default Interval[@2023-01-01, @2023-01-30]

context Patient
/* Populations */

/*
 *Initial Population
 */

define "Initial Population":
  true

/**
 * Measure Population
 *
 * Definition: For the general population: Number of elicited partners and other contacts* of people diagnosed with HIV who received HTS |  | Additional cascade data collected: | • Number of people diagnosed with HIV (index cases) offered partner services | • Number of people diagnosed with HIV (index cases) accepting partner services | • Number of contacts/partners of people living with HIV whose information is elicited from people diagnosed with HIV (index cases) |  | For key populations: Number of elicited contacts1 of members of key populations who received HTS. | Additional cascade data collected: | • Number of key population members offered social network-based/partner services | • Number of key population members accepting social network-based/partner services | • Number of contacts of key population members elicited
 * Calculation: For the general population: Number of elicited partners and other contacts* of people diagnosed with HIV who received HTS |  | Additional cascade data collected: | • Number of people diagnosed with HIV (index cases) offered partner services | • Number of people diagnosed with HIV (index cases) accepting partner services | • Number of contacts/partners of people living with HIV whose information is elicited from people diagnosed with HIV (index cases) |  | For key populations: Number of elicited contacts1 of members of key populations who received HTS. | Additional cascade data collected: | • Number of key population members offered social network-based/partner services | • Number of key population members accepting social network-based/partner services | • Number of contacts of key population members elicited
 */
                                                       
define "Measure Population":
    exists(HE."Partner or contact of an index case" IC
    with HE."Drug-injecting partner" DIP
      such that IC.hasMember.references(DIP)
    with HIE."HIV test results returned in measurement period" HIV
      such that IC.hasMember.references(HIV)
      and HIV.issued.toInterval() during "Measurement Period")
    or 
    exists(HE."Partner or contact of an index case" IC
    with HE."Sexual partner" SP
      such that IC.hasMember.references(SP)
      with HIE."HIV test results returned in measurement period" HIV
      such that IC.hasMember.references(HIV)
      and HIV.issued.toInterval() during "Measurement Period")



/**
 * Measure Observation
 * Definition: For the general population: Number of elicited partners and other contacts* of people diagnosed with HIV who received HTS |  | Additional cascade data collected: | • Number of people diagnosed with HIV (index cases) offered partner services | • Number of people diagnosed with HIV (index cases) accepting partner services | • Number of contacts/partners of people living with HIV whose information is elicited from people diagnosed with HIV (index cases) |  | For key populations: Number of elicited contacts1 of members of key populations who received HTS. | Additional cascade data collected: | • Number of key population members offered social network-based/partner services | • Number of key population members accepting social network-based/partner services | • Number of contacts of key population members elicited
 * Calculation: For the general population: Number of elicited partners and other contacts* of people diagnosed with HIV who received HTS |  | Additional cascade data collected: | • Number of people diagnosed with HIV (index cases) offered partner services | • Number of people diagnosed with HIV (index cases) accepting partner services | • Number of contacts/partners of people living with HIV whose information is elicited from people diagnosed with HIV (index cases) |  | For key populations: Number of elicited contacts1 of members of key populations who received HTS. | Additional cascade data collected: | • Number of key population members offered social network-based/partner services | • Number of key population members accepting social network-based/partner services | • Number of contacts of key population members elicited                                                      
 */     

define function "Measure Observation"(Patient "Patient"):
  1
/* end Populations */

/*
 * Disaggregators
 */

define "Administrative Gender Stratifier":
	HIE."By Administrative Gender Stratifier"

define "Age Stratifier":
	HIE."By Age Stratifier 2"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "patientGroups Stratifier":
	HIE."patientGroups"

define "HIV status of partner or contact":
  HIE."HIV status of partner or contact"

define "Stratification":
 HIE."By Administrative Gender Stratifier".code 
 + ':' + HIE."HIV status of partner or contact".code
  + ':' + HIE."By Age Stratifier 2"
+ ':' + HIE."By Geographic Region Stratifier"
+ Combine(HIE.patientGroups, ':')
