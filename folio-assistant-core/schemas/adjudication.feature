Feature: adjudication requests and outcomes

  @test:schemas/adjudication.test.ts::who_may_adjudicate::excludesMechanicalKinds
  Scenario: excludes the MECHANICAL kind — the whole reason the step exists
    When the adjudicator kinds are read
    Then they contain neither "system" nor "external"

  @test:schemas/adjudication.test.ts::who_may_adjudicate::usesHarnessActorKinds
  Scenario: uses the HARNESS's spelling, and every excluded kind really exists
    When the adjudicator kinds and the excluded kinds are compared with the harness actor kinds
    Then every adjudicator kind is a harness actor kind
    And "system" and "external" are harness actor kinds too

  @test:schemas/adjudication.test.ts::who_may_adjudicate::matchesBpmnAdjudicatorStep
  Scenario: matches what `adjudication.bpmn` already declares on its adjudicator step
    When the adjudicator kinds are sorted
    Then they are exactly "agent" and "person"

  @test:schemas/adjudication.test.ts::who_may_adjudicate::agentAdjudicatorNamesModel
  Scenario: an `agent` adjudicator must name its model
    When an outcome by an agent without a model and one by a person are validated
    Then the agent's outcome is refused
    And the person's outcome is accepted

  @test:schemas/adjudication.test.ts::the_request::acceptsWorkedRequest
  Scenario: accepts the worked case
    When the worked request is validated
    Then it is accepted

  @test:schemas/adjudication.test.ts::the_request::refusesSinglePermittedAnswer
  Scenario: REFUSES a single permitted answer — that is assent, not a judgement
    When a request with only one code is validated
    Then it is refused

  @test:schemas/adjudication.test.ts::the_request::refusesDuplicateCodeToken
  Scenario: refuses two codes sharing a token — the outcome could not say which
    When a request with two codes sharing the token "stands" is validated
    Then it is refused

  @test:schemas/adjudication.test.ts::the_request::allowsEmptyAssetsNotMissing
  Scenario: allows NO assets, because a judgement about a process has none
    When a request with an empty assets list and one with no assets key are validated
    Then the empty list is accepted
    And the missing key is refused

  @test:schemas/adjudication.test.ts::the_request::refusesMisspelledKey
  Scenario: refuses a misspelled key rather than ignoring it
    When a request with an unknown key "prompts" is validated
    Then it is refused

  @test:schemas/adjudication.test.ts::an_asset_says_where_it_is,_when_it_is_anywhere::materializedNeedsLocator
  Scenario: refuses `materialized` with no locator
    When an asset in state "materialized" is validated with and without "at"
    Then without a locator it is refused
    And with at "library/x/" it is accepted

  @test:schemas/adjudication.test.ts::an_asset_says_where_it_is,_when_it_is_anywhere::unknownIsOwnState
  Scenario: carries `unknown` as its own state, not a flavour of `referenced`
    When an asset in state "unknown" is validated
    Then it is accepted

  @test:schemas/adjudication.test.ts::the_outcome::acceptsWorkedOutcome
  Scenario: accepts the worked case, and it answers its request
    When the worked outcome is validated and checked against its request
    Then it is accepted
    And it has no defects

  @test:schemas/adjudication.test.ts::the_outcome::refusesEmptyReasoning
  Scenario: REFUSES empty reasoning — what makes an outcome sound is the reason
    When an outcome with empty reasoning is validated
    Then it is refused

  @test:schemas/adjudication.test.ts::the_outcome::refusesCodeOutsideEnum
  Scenario: refuses a code outside the enum it records
    When an outcome whose code is not in its own codes is validated
    Then it is refused

  @test:schemas/adjudication.test.ts::the_outcome::reportsCodeNotPermitted
  Scenario: reports a code the REQUEST does not permit
    When an outcome's code "other" is checked against a request that does not permit it
    Then a defect says it is "not a permitted answer"

  @test:schemas/adjudication.test.ts::the_outcome::reportsWrongRequest
  Scenario: reports the wrong request rather than judging it silently
    When an outcome naming request "adj-2" is checked against another request
    Then the first defect names "adj-2"

  @test:schemas/adjudication.test.ts::enum_drift_—_the_reason_an_outcome_records_its_own_enum::reportsEnumDrift
  Scenario: is REPORTED when the request's codes have since changed
    Given the request's codes have since gained "refer-up"
    When the old outcome is checked against it
    Then a defect says "the enum drifted"
    And that defect says the outcome is "not wrong"

  @test:schemas/adjudication.test.ts::enum_drift_—_the_reason_an_outcome_records_its_own_enum::reorderingIsNotDrift
  Scenario: is NOT reported for a mere reordering
    When an outcome listing the same codes in another order is checked
    Then there are no defects

  @test:schemas/adjudication.test.ts::enum_drift_—_the_reason_an_outcome_records_its_own_enum::reportsEveryDefect
  Scenario: reports every defect, not just the first
    When an outcome with a wrong request, an unpermitted code and other codes is checked
    Then more than one defect is reported

  @test:schemas/adjudication.test.ts::it_expresses_the_adjudication_that_already_exists::carriesBpmnThreeOutcomes
  Scenario: carries `adjudication.bpmn`'s three outcomes, each keeping its meaning
    When the worked request is read
    Then it validates
    And its codes are "stands", "scope" and "dispensation", each with a meaning

  @test:schemas/adjudication.test.ts::it_expresses_the_adjudication_that_already_exists::canRestrictAdjudicatorView
  Scenario: can RESTRICT what the adjudicator sees — `adjudicator_sees`, not the artefact
    Given a request whose only asset is the checker output
    When it is validated
    Then it is accepted
    And its assets do not include the artefact

  @test:schemas/adjudication.test.ts::SWE-Debate_multi-round_debate_protocol_integration::acceptsThreeRoundDebate
  Scenario: accepts a structured 3-round debate outcome
    When the three-round debate outcome is validated and checked
    Then it is accepted with no defects

  @test:schemas/adjudication.test.ts::SWE-Debate_multi-round_debate_protocol_integration::detectsNonSequentialRounds
  Scenario: detects non-sequential debate rounds in adjudicationDefects
    Given a debate outcome whose rounds are numbered 1 and 3
    When it is checked against its request
    Then a defect says "debate rounds not sequential"
