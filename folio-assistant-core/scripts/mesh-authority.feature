Feature: MeSH authority validation, stage three of skill-pipeline subject indexing

  @test:scripts/mesh-authority.test.ts::validate::resolvedWithAllowableQualifier
  Scenario: a heading with an allowable qualifier resolves
    When "Measles" with qualifier "prevention & control" is validated
    Then it resolves to D008457 with that qualifier

  @test:scripts/mesh-authority.test.ts::validate::entryTermBecomesPreferredHeading
  Scenario: an entry term is replaced by its preferred heading
    When "Rubeola" is validated
    Then it resolves to Measles, marked as reached through an entry term

  @test:scripts/mesh-authority.test.ts::validate::notFoundIsDroppedNeverEmitted
  Scenario: a heading the authority lacks is never emitted
    When a label and an id the authority does not hold are validated
    Then both are not-found and the validated list is empty

  @test:scripts/mesh-authority.test.ts::validate::ambiguousListsOptionsAndEmitsNothing
  Scenario: a label carried by two descriptors goes to a person
    When a label that two descriptors carry is validated
    Then it is ambiguous, both options are listed, and nothing is emitted

  @test:scripts/mesh-authority.test.ts::validate::disallowedQualifierKeepsDescriptorOnly
  Scenario: a qualifier the descriptor does not allow is dropped
    When "Measles Vaccine" with qualifier "surgery" is validated
    Then the descriptor is kept without the qualifier

  @test:scripts/mesh-authority.test.ts::validate::descriptorIdIsCheckedAgainstTheAuthority
  Scenario: a descriptor id is checked, not trusted
    When a held id and an unheld id are validated
    Then the first resolves and the second is not-found

  @test:scripts/mesh-authority.test.ts::helpers::entryTermQueryQuotesTheLabel
  Scenario: the entry-term query quotes the label
    When a label with quotes builds the query
    Then the label is a quoted literal

  @test:scripts/mesh-authority.test.ts::helpers::reportTableHasOneRowPerCandidateAndEscapesBars
  Scenario: the review table has one row per candidate
    When two candidates are reported
    Then the table has a header, a rule and two rows, with bars escaped
