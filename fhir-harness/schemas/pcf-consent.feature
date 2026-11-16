Feature: IHE PCF Consent: implicit policies, translating Consents to ODRL and deciding requests

  @test:schemas/pcf-consent.test.ts::Four_IHE_PCF_1.1.0_Volume_1_§1:53.2.1_implicit-policy_ODRL_Sets::exportsFourImplicitSets
  Scenario: exports all four canonical implicit policy Sets and resolves them by URI and alias
    Then the implicit policy Sets are basic-normal, all-normal, break-glass-only and deny, in that order
    And each is an ODRL "Set" under the PCF profile
    And each resolves by its URI and by its alias ("basic-normal", "opt-out", "break-glass-only", "opt-in")
    And "nonexistent" resolves to nothing

  @test:schemas/pcf-consent.test.ts::Four_IHE_PCF_1.1.0_Volume_1_§1:53.2.1_implicit-policy_ODRL_Sets::basicNormalPermitsTreat
  Scenario: 1. Policy-basic-normal permits TREAT (and sub-codes), denies non-treatment, unknown without purpose
    Given the basic-normal implicit policy
    Then TREAT, ETREAT, BTG, COC, CLINTRL and POPHLTH are permitted
    And CAREMGT, HRESCH and HPAYMT are denied
    And a request with no purpose is "unknown"

  @test:schemas/pcf-consent.test.ts::Four_IHE_PCF_1.1.0_Volume_1_§1:53.2.1_implicit-policy_ODRL_Sets::allNormalPermitsAnyPurpose
  Scenario: 2. Policy-all-normal permits any valid HL7 PurposeOfUse, denies draft dpv:*, unknown without purpose
    Given the all-normal implicit policy
    Then TREAT, HPAYMT, HOPERAT, HRESCH, CLINTRCH, PUBHLTH, PATRQT and BTG are permitted
    And "dpv:ResearchAndDevelopment" is denied
    And a request with no purpose is "unknown"

  @test:schemas/pcf-consent.test.ts::Four_IHE_PCF_1.1.0_Volume_1_§1:53.2.1_implicit-policy_ODRL_Sets::breakGlassOnlyPermitsBtg
  Scenario: 3. Policy-break-glass-only permits BTG, denies all other purposes, unknown without purpose
    Given the break-glass-only implicit policy
    Then BTG is permitted
    And TREAT and HRESCH are denied
    And a request with no purpose is "unknown"

  @test:schemas/pcf-consent.test.ts::Four_IHE_PCF_1.1.0_Volume_1_§1:53.2.1_implicit-policy_ODRL_Sets::denyPolicyDeniesAll
  Scenario: 4. Policy-deny denies all requests unconditionally
    Given the deny implicit policy
    Then TREAT, BTG and a request with no purpose are all denied

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Basic_Consent_&_Additional_PurposeOfUse_(consentToOdrl_+_decide)::basicTreatTranslatesToIsARules
  Scenario: ex-consent-basic-treat: translates to ODRL Set with TREAT/HPAYMT/HOPERAT isA rules
    Given a basic permit Consent for TREAT, HPAYMT and HOPERAT
    Then it is detected as the basic profile
    When it is translated to ODRL
    Then it is a Set with the Consent's uid, assigned by the patient, with 3 permissions and no prohibition
    And the permissions constrain the purpose by "isA" TREAT, HPAYMT and HOPERAT
    And the TPO codes and their sub-codes are permitted
    And HRESCH and HMARKT are denied and a request with no purpose is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Basic_Consent_&_Additional_PurposeOfUse_(consentToOdrl_+_decide)::citesPerformerAndVersion
  Scenario: ex-consent-basic-treat-infant & versionId: cites performer and versionId in policy uid
    Given a basic Consent at version 2 performed by the mother
    Then its policy uid ends ":v2"
    And its citation names the id, version, uid, status, patient, performer and policy URI
    And its ODRL Set is assigned by the mother and permits TREAT

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Basic_Consent_&_Additional_PurposeOfUse_(consentToOdrl_+_decide)::researchSubsumesSubConcepts
  Scenario: ex-consent-basic-research (Additional PurposeOfUse HRESCH): ontological subsumption permits sub-concepts
    Given a permit Consent for the purpose HRESCH under a research policy
    When it is translated to ODRL
    Then it has one permission to use for anyone, constrained by "isA" HRESCH
    And HRESCH and its research sub-codes are permitted
    And TREAT is denied and a request with no purpose is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Basic_Consent_&_Additional_PurposeOfUse_(consentToOdrl_+_decide)::rejectTranslatesToProhibitions
  Scenario: ex-consent-basic-reject: base deny translates to prohibition rules and overrides implicit permit
    Given a deny Consent for the TPO purposes
    When it is translated to ODRL
    Then it has no permission and 3 prohibitions
    And TREAT, HPAYMT and HOPERAT are denied, even with the all-normal implicit policy
    And a request with no purpose is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Basic_Consent_&_Additional_PurposeOfUse_(consentToOdrl_+_decide)::periodEnforcesExpiration
  Scenario: ex-consent-expired-treat: provision.period enforces expiration and falls back to implicit policy when expired
    Given a permit Consent whose period ends 2022-12-31
    Then it is not expired on 2022-06-15 or late on 2022-12-31, and is expired on 2023-01-01
    And TREAT is permitted on 2022-06-15 and on 2022-12-31
    And TREAT on 2023-01-01 is denied with no implicit policy or the deny policy, and permitted with basic-normal
    And TREAT with no date is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Basic_Consent_&_Additional_PurposeOfUse_(consentToOdrl_+_decide)::nonActiveConsentIsUnknown
  Scenario: inactive, rejected, draft, entered-in-error or missing Consent -> unknown (or implicit policy)
    Then with no Consent, TREAT is "unknown", permitted under basic-normal and denied under deny
    Given a Consent that is inactive, rejected, draft, proposed or entered-in-error
    Then it translates to no permission and no prohibition
    And TREAT is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Intermediate_&_Advanced_Consent_examples_(nested_exceptions,_data_&_securityLabel_scoping)::intermediatePurposeAndActor
  Scenario: ex-consent-intermediate-purpose: specific research project code (FooBar) and actor
    Given an intermediate Consent permitting a researcher organisation for the purpose "FooBar"
    Then it is detected as the intermediate profile
    And the researcher is permitted for FooBar
    And another organisation, or the researcher for TREAT, is denied
    And a request with no actor is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Intermediate_&_Advanced_Consent_examples_(nested_exceptions,_data_&_securityLabel_scoping)::breakGlassNestedPermit
  Scenario: ex-dissent-intermediate-break-glass: root deny with nested BTG permit exception
    Given a Consent that denies with a nested permit for privileged users and BTG
    Then its ODRL conflict strategy is "odrl:perm"
    And the privileged group, or a member of it, is permitted for BTG
    And the privileged group for TREAT, or a clerk for BTG, is denied

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Intermediate_&_Advanced_Consent_examples_(nested_exceptions,_data_&_securityLabel_scoping)::dataInstanceScoping
  Scenario: ex-consent-intermediate-data & not-data: positive and negative data instance scoping
    Given a Consent permitting only an encounter and a blood pressure observation
    Then reading the blood pressure is permitted, the alcohol use observation is denied and no target is "unknown"
    Given a Consent that permits but denies the alcohol use observation
    Then reading the blood pressure is permitted, the alcohol use observation is denied and no target is "unknown"

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Intermediate_&_Advanced_Consent_examples_(nested_exceptions,_data_&_securityLabel_scoping)::authoredByEncounterTimeframe
  Scenario: ex-consent-intermediate-authoredby, encounter, and timeframe (positive and negative)
    Given a Consent that denies data authored by one practitioner
    Then data by another author is permitted and data by that practitioner is denied
    Given a Consent that denies data related to one encounter
    Then data of another encounter is permitted and data of that encounter is denied
    Given a Consent permitting data from 2022 only
    Then data from 2022-06-01 is permitted and data from 2023-03-01 is denied

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Intermediate_&_Advanced_Consent_examples_(nested_exceptions,_data_&_securityLabel_scoping)::securityLabelScoping
  Scenario: ex-consent-advanced-normal-focused-psy-or-sdv & break-glass-restricted: securityLabel scoping
    Given an advanced Consent permitting normal data and PSY or SDV data only to one practitioner
    Then it is detected as the advanced profile
    And another practitioner is permitted normal data and denied PSY data
    And the named practitioner is permitted PSY and SDV data
    Given an advanced Consent permitting restricted data only to privileged users for BTG
    Then another practitioner is permitted normal data and denied restricted data
    And the privileged group is permitted restricted data for BTG and denied it for TREAT

  @test:schemas/pcf-consent.test.ts::IHE_PCF_Intermediate_&_Advanced_Consent_examples_(nested_exceptions,_data_&_securityLabel_scoping)::remainingIntermediateAdvanced
  Scenario: all remaining Intermediate and Advanced PCF examples (authoredby, encounter, not-timeframe, normal, restricted, not-restricted, focused-restricted, focused-psy)
    Given the authoredby Consent
    Then data by the named author is permitted, by another author denied, and with no author "unknown"
    Given the encounter Consent
    Then data of the named encounter is permitted and of another encounter denied
    Given the not-timeframe Consent denying 2022 data
    Then data from 2023 is permitted and from 2022 denied
    Given the advanced normal Consent
    Then normal data is permitted and restricted data denied
    Given the advanced normal-restricted Consent
    Then normal and restricted data are permitted and very restricted data denied
    Given the advanced not-restricted Consent
    Then normal data is permitted and restricted data denied
    Given the focused-restricted and focused-psy Consents
    Then the named practitioner is permitted the labelled data and another practitioner is denied it

  @test:schemas/pcf-consent.test.ts::Published_ihe.iti.pcf#1.1.0_package_Consent_examples_sweep::packageExamplesValidateAndDecide
  Scenario: every Consent-ex-*.json in ihe.iti.pcf#1.1.0 validates against R4 StructureDefinition-Consent and translates/decides per PCF Volume 1
    Given the Consent example files of the published PCF package
    Then there are 23
    And each validates against the strict R4 Consent schema
    And each translates to an ODRL Set with at least one rule
    And each decides "unknown" for a request with no scope

  @test:schemas/pcf-consent.test.ts::Published_package_provenance,_v3-ActReason_hierarchy,_R4_Consent_schema,_and_injected_ConsentEvaluator_(bean_6jnx)::supportFilesMatchSha
  Scenario: every file in test/support/pcf matches its recorded sha256 in provenance.json
    Given the provenance record of the support packages
    Then it lists the R4 core, R5 core, terminology and PCF packages
    And each package lists files, and each file matches its recorded sha256

  @test:schemas/pcf-consent.test.ts::Published_package_provenance,_v3-ActReason_hierarchy,_R4_Consent_schema,_and_injected_ConsentEvaluator_(bean_6jnx)::purposeOfUseFromTerminology
  Scenario: HL7_PURPOSE_OF_USE is read from hl7.terminology.r4#5.3.0 CodeSystem-v3-ActReason.json without hand-typing
    Then the purpose-of-use hierarchy has 60 codes
    And CLINTRL, POPHLTH and COC are under TREAT, CAREMGT is under HOPERAT
    And HTEST, SYSDEV, LABELING, METAMGT and HSYSADMIN have their published parents, and HAAUTH is absent
    Given a Consent permitting HOPERAT
    Then HTEST, LABELING and METAMGT are permitted through the hierarchy

  @test:schemas/pcf-consent.test.ts::Published_package_provenance,_v3-ActReason_hierarchy,_R4_Consent_schema,_and_injected_ConsentEvaluator_(bean_6jnx)::consentSchemaFromR4Core
  Scenario: FhirConsentSchema and code lists come from hl7.fhir.r4.core#4.0.1 and isConsentExpired is deduplicated
    Then the expiry check is the same function as the client's
    And the Consent status, provision type and data meaning codes are the R4 value sets in order
    And a Consent with an invalid status, provision type, data meaning or an unknown element is refused
    And the sources declare no hand-written FhirConsent interface, no hand-typed purpose-of-use literal, no second expiry function and no Consent literal schema in the client

  @test:schemas/pcf-consent.test.ts::Published_package_provenance,_v3-ActReason_hierarchy,_R4_Consent_schema,_and_injected_ConsentEvaluator_(bean_6jnx)::evaluatorIntegratesObtainConsentDuty
  Scenario: createPcfConsentEvaluator integrates with cat-harness odrl:obtainConsent duty (a7c1 + 2egb citation)
    Given an agreement that permits use of a patient's data with an obtainConsent duty
    Then with no Consent, or an inactive one, the decision is "unknown"
    And with a deny Consent, the decision is "deny" and the evaluator cites that Consent at version 2
    And with a matching permit Consent, the decision is "permit" and the citation names that Consent at version 3
