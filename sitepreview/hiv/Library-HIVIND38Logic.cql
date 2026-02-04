/**
 * Library: HIV.IND.38 Logic
 * Ref No: VER.2
 * Short Name: Early infant diagnosis (EID) coverage
 *
 * Definition: % of HIV-exposed infants who receive a virological test for HIV within two months (and 12 months) of birth
 *
 * Numerator: Number of HIV-exposed infants born during the reporting period who received a virological HIV test within two months (and 12 months) of birth
 * Numerator Calculation: COUNT of infants who are an "HIV-exposed infant or child" with "Infant date of birth" within the reporting period AND with "Date of viral load sample collection" LESS THAN 2 months AFTER "Infant date of birth" AND "HIV test type"='Nucleic acid test for HIV'
 * Numerator Exclusions: 
 *
 * Denominator: Estimated number of HIV-positive women who delivered during the reporting period.   |  | Note: The denominator is a proxy measure for the number of infants born to HIV-infected women.
 * Denominator Calculation: *Estimated number of HIV-positive women who delivered during the reporting period
 * Denominator Exclusions: 
 *
 * Disaggregations:
 * • Test result (HIV-positive, HIV-negative, indeterminate, other) to enable calculation of the percentage positive and the percentage with an indeterminate result among HIV-exposed infants receiving a virological test 
 *  • Age of infant (<2 months, 2-12 months) to allow the separate calculation of the proportion of exposed infants receiving virological testing within two months of birth and within 12 months of birth 
 *  • Cities and other administrative regions of epidemiologic importance
 *
 * Disaggregation Elements: HIV test date (at 2 months, at 12 months) | Age of infant (<2 months, 2-12 months)
 *
 * Numerator and Denominator Elements:
 * Date of viral load sample collection 
 *  HIV test type 
 *  HIV-exposed infant or child 
 *  Infant date of birth
 *
 * Reference: Consolidated guidelines on person-centred HIV strategic information: strengthening routine data for impact. Geneva: World Health Organization; 2022
 * 
 * Data Concepts:
 * HIV.B.DE81: HIV test type | Type of HIV test
 * HIV.B.DE82: Rapid diagnostic test for HIV | Antibody test for HIV performed with a rapid diagnostic
 * HIV.B.DE83: Enzyme immunoassay for HIV | Antibody test for HIV performed with an enzyme immunoassay
 * HIV.B.DE84: Nucleic acid test for HIV | Virological test, which includes testing for early infant diagnosis
 * HIV.B.DE85: Dual HIV/syphilis rapid diagnostic test | Antibody test for HIV and syphilis performed with a rapid diagnostic
 * HIV.B.DE86: HIV self-test | Antibody test for HIV performed by self-tester using a rapid diagnostic
 * HIV.B.DE110: HIV test date | Date of the HIV test
 * HIV.D.DE194: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.E.DE87: Infant date of birth | The infant's date of birth (DOB) if known
 * HIV.E.DE90: Age of infant | Infant age calculated using date of birth
 * HIV.E.DE112: HIV-exposed infant or child | Whether the infant or child was determined to have had HIV exposure
 * HIV.E.DE168: HIV test type | Type of HIV test
 * HIV.E.DE169: Rapid diagnostic test for HIV | Antibody test for HIV performed with a rapid diagnostic (RDT)
 * HIV.E.DE170: Enzyme immunoassay for HIV | Antibody test for HIV performed with an enzyme immunoassay (EIA)
 * HIV.E.DE171: Nucleic acid test for HIV | Virological test, which includes testing for early infant diagnosis
 * HIV.E.DE172: Dual HIV/syphilis rapid diagnostic test | Antibody test for HIV and syphilis performed with a rapid diagnostic
 * HIV.E.DE224: HIV test date | Date of the HIV test
 * HIV.G.DE8: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.SRV.DE1: HIV test date | Date of the HIV test
 * HIV.SRV.DE12: Date of viral load sample collection | Date and time when the sample was collected to test the client's HIV viral load
 * HIV.SRV.DE20: HIV-exposed infant or child | Whether the infant or child was determined to have had HIV exposure
 *
 * Additional Context
 * - what it measures: This indicator measures early HIV diagnosis in infants.
 * - rationale: • High coverage of early virological testing of infants helps initiate ART early in children with confirmed HIV infection and supports counselling on efforts to prevent seroconversion of those with a negative early test result. | • Current PMTCT guidelines recommend virological testing for HIV-exposed infants within two months of birth.
 * - method: For the numerator: Programme records (for example, PMTCT registers, laboratory records). |  | For the denominator: Modelling-based estimates (for example, Spectrum AIM) |  | The recommended reporting period is 12 months.
 * 
 * Suggested Scoring Method: proportion | http://hl7.org/fhir/us/cqfmeasures/StructureDefinition/proportion-measure-cqfm
 */

library HIVIND38Logic

// Included Libraries
using FHIR version '4.0.1'

include HIVCommon version '0.0.1' called HIC
include FHIRHelpers version '4.0.1'

include WHOCommon called WCom
include HIVElements called HE
include HIVIndicatorElements called HIE

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
 * Numerator
 * 
 * Definition: Number of HIV-exposed infants born during the reporting period who received a virological HIV test within two months (and 12 months) of birth
 * Calculation: COUNT of infants who are an "HIV-exposed infant or child" with "Infant date of birth" within the reporting period AND with "Date of viral load sample collection" LESS THAN 2 months AFTER "Infant date of birth" AND "HIV test type"='Nucleic acid test for HIV'
 */


define "Numerator":
  exists(HIE."HIV-exposed infant or child E.DE112" O
  with [Patient] P
      such that O.subject.references(P) and P.birthDate during "Measurement Period")
   and exists(
    HE."Nucleic acid test for HIV B.DE84" O 
    with [Patient] Pt
    such that O.subject.references(Pt) 
    and months between start of O.effective.toInterval() and FHIRHelpers.ToDate(Pt.birthDate) < 2 months)


/**
 * Denominator - THiS SHOULDN'T BE PROPORTION
 *
 * Definition: Estimated number of HIV-positive women who delivered during the reporting period.   |  | Note: The denominator is a proxy measure for the number of infants born to HIV-infected women.
 * Calculation: *Estimated number of HIV-positive women who delivered during the reporting period
 */

define "Denominator":
  true
    

/* end Populations */

/*
 * Disaggregators
 */

define "Age Stratifier":
	HIE."By Age Stratifier 7"

define "Geographic Region Stratifier":
	HIE."By Geographic Region Stratifier"

define "EID test number 1 test result":
  HIE."EID test number 1 test result"

define "Stratification":
 HIE."By Age Stratifier 7"
+ ':' + HIE."By Geographic Region Stratifier"
+ HIE."EID test number 1 test result".code 