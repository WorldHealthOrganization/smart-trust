Feature: PCF Consent rules: agreement versions, the version chain and cache withdrawal

  @test:schemas/pcf-consent-rules.test.ts::rule_2:_a_Consent_counts_only_for_the_agreement_version_it_cites::keepsConsentsCitingVersion
  Scenario: consentsCitingAgreement keeps only Consents whose policy.uri is that version
    Given Consents citing version 1, version 2 and no version
    When the Consents citing version 1 are kept
    Then only the Consent "a" is kept

  @test:schemas/pcf-consent-rules.test.ts::rule_2:_a_Consent_counts_only_for_the_agreement_version_it_cites::version1ConsentOnlyPermitsVersion1
  Scenario: a Consent for version 1 permits under version 1 and is not counted under version 2
    Given a Consent citing version 1
    Then a request under agreement version 1 is permitted
    And a request under agreement version 2 is "unknown"

  @test:schemas/pcf-consent-rules.test.ts::rule_2:_a_Consent_counts_only_for_the_agreement_version_it_cites::policyUriOverridesUid
  Scenario: agreementPolicyUri overrides the agreement's uid; with neither, Consents are not filtered
    Given a Consent citing version 1 and an evaluator whose agreement policy URI is version 2
    Then the request is "unknown"
    Given a Consent citing no version and an evaluator with no agreement
    Then the request is permitted

  @test:schemas/pcf-consent-rules.test.ts::rule_2_with_the_version_chain_(owner_card_2026-10-30_19:55Z)::narrowerPurposeOrEarlierEndNarrows
  Scenario: a narrower purpose or an earlier end date is a narrowing amendment; the reverse is not
    Given a base agreement for the purpose "PurposeOfUse" ending 2028-01-01
    Then an amendment to the purpose "TREAT" is narrowing
    And an amendment ending 2027-01-01 is narrowing
    And the base as an amendment of a "TREAT" agreement is not narrowing
    And an amendment ending 2029-01-01 is not narrowing

  @test:schemas/pcf-consent-rules.test.ts::rule_2_with_the_version_chain_(owner_card_2026-10-30_19:55Z)::droppingDutyOrProhibitionWidens
  Scenario: dropping a duty, a prohibition or changing a party widens use
    Then an amendment that drops the duty is not narrowing
    And an amendment that drops a prohibition is not narrowing
    And an amendment that changes the assignee is not narrowing

  @test:schemas/pcf-consent-rules.test.ts::rule_2_with_the_version_chain_(owner_card_2026-10-30_19:55Z)::earlierVersionCountsWhileNarrowing
  Scenario: a Consent for an earlier version counts only while every step back narrows
    Given a chain of three versions where each step narrows
    Then a Consent for version 3 covers versions 3, 2 and 1
    And a Consent citing version 1 permits a request under version 3
    Given a chain where the step from version 1 to version 2 widens
    Then a Consent for version 3 covers versions 3 and 2 only
    And a Consent citing version 1 leaves a request under version 3 "unknown"

  @test:schemas/pcf-consent-rules.test.ts::rule_2_with_the_version_chain_(owner_card_2026-10-30_19:55Z)::missingOrLoopStopsWalk
  Scenario: a missing version or a loop stops the walk
    Given a chain where version 2 points back to a version that is missing
    Then version 2 covers only itself
    Given a chain where versions 1 and 2 point at each other
    Then version 2 covers versions 1 and 2

  @test:schemas/pcf-consent-rules.test.ts::rule_4:_cached_registry_results_end_when_a_Consent_is_withdrawn::cacheServesUntilWithdrawn
  Scenario: a second lookup is served from cache until the Consent is withdrawn
    Given a registry client with a 60 second cache
    When the patient's Consents are looked up twice
    Then the first lookup is "determined" and the server was hit once
    When the Consent is withdrawn
    Then one cache entry is dropped
    When the patient's Consents are looked up again
    Then the server was hit twice and no Consents are found
    When the clock moves past the cache lifetime and the lookup is repeated
    Then the server was hit three times

  @test:schemas/pcf-consent-rules.test.ts::rule_4:_cached_registry_results_end_when_a_Consent_is_withdrawn::cacheEndsAtProvisionEnd
  Scenario: an entry ends no later than its Consent's provision.period.end
    Given a registry client with a one-day cache, one minute before its Consent's period ends
    When the Consents are looked up, then looked up again just after the period end
    Then the server was hit for both lookups
