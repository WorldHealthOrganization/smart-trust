Feature: L1 membership of a publication
  Whether a publication is an L1 member is inferred from its Dublin Core
  record, decided from declared, context and inferred classifications, and
  each classification is checked against the platform schema's rules.

  @test:smart-base/L1/scripts/l1-membership.test.ts::inferL1::infersOwnerRulings
  Scenario: the owner's rulings of 2026-10-07 are what the rule infers
    Given the IRIS records of "Leave no one behind" (type Publications), the immunization DAK (series Smart guidelines) and the DDCC specification
    Then "Leave no one behind" is inferred a member, of publication type "implementation-guidance"
    And the DAK and the DDCC specification are inferred not members

  @test:smart-base/L1/scripts/l1-membership.test.ts::inferL1::noSignalIsUndetermined
  Scenario: no signal is undetermined, not 'no'
    Given a record titled only "Annual report 2023"
    Then nothing is inferred

  @test:smart-base/L1/scripts/l1-membership.test.ts::decideL1::declaredBeatsContextBeatsInferred
  Scenario: declared beats context beats inferred, and disagreement is reported
    Given an intake with a declared "not a member" and a context "member" classification, for the "Leave no one behind" record
    When L1 membership is decided
    Then the status is "not-member", derived as "decided"
    And two disagreements are reported

  @test:smart-base/L1/scripts/l1-membership.test.ts::decideL1::inferredAloneDecides
  Scenario: inferred alone decides, as inferred
    Given no intake and the "Leave no one behind" record
    When L1 membership is decided
    Then it is a member, derived as "inferred", of type "implementation-guidance", with no disagreements

  @test:smart-base/L1/scripts/l1-membership.test.ts::decideL1::decidingRecordBorrowsAgreeingType
  Scenario: a deciding record without a type borrows an agreeing lower one's
    Given an intake with a declared "member" classification with no type, and the "Leave no one behind" record
    When L1 membership is decided
    Then the publication type is "implementation-guidance" and there are no disagreements

  @test:smart-base/L1/scripts/l1-membership.test.ts::decideL1::nothingRecordedIsUndetermined
  Scenario: nothing recorded and nothing inferred is undetermined
    When L1 membership is decided with no intake and no record
    Then the status is "undetermined"

  @test:smart-base/L1/scripts/l1-membership.test.ts::checkClassification_holds_the_platform_schema's_rules::namesEachBrokenField
  Scenario: a good record passes; each broken field is named
    Then a well-formed classification has no problems
    And a classification with an empty scheme, member "yes", source "guessed", at "Oct" and an extra field reports exactly those five problems

  @test:smart-base/L1/scripts/l1-membership.test.ts::checkClassification_holds_the_platform_schema's_rules::decideRefusesBrokenIntake
  Scenario: decideL1 refuses an intake whose record breaks them
    Given an intake whose classification has an empty basis
    Then deciding L1 membership throws
