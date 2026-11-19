# The profile-conformance QA axis wraps pipeline/profile-check.ts, which finds
# blocks valid against their own schema but outside the folio's declared content
# profile. Each Scenario names the test that executes it.
Feature: Profile conformance of a folio's blocks

  @test:pipeline/profile-conformance-axis.test.ts::the_mechanism_the_axis_wraps::finds_the_block_that_is_outside_the_declared_profile
  Scenario: A block outside the declared profile is a violation
    Given a folio declaring contentType "document"
    And it holds a theorem block in "bad.ts" and a prose block in "ok.ts"
    When the folio's profile is checked
    Then the profile is "document" and 2 blocks are checked
    And there is one violation, "kind-outside-profile", in "bad.ts"
    And its detail names the remedy 'contentType: "paper"'

  @test:pipeline/profile-conformance-axis.test.ts::the_mechanism_the_axis_wraps::a_paper_folio_holds_the_same_blocks_WITHOUT_violation
  Scenario: A paper folio holds the same blocks without violation
    Given a folio declaring contentType "paper" with the same theorem and prose blocks
    When the folio's profile is checked
    Then the profile is "paper" and 2 blocks are checked
    And there are no violations

  @test:pipeline/profile-conformance-axis.test.ts::declared_vs_resolved_—_the_distinction_the_axis_rests_on::an_undeclared_folio_resolves_to_`paper`_but_DECLARES_nothing
  Scenario: An undeclared folio resolves to paper but declares nothing
    Given a folio with no contentType declared
    When its declared profile is read
    Then the declared profile is undefined
    And checking the folio still resolves the profile "paper"

  @test:pipeline/profile-conformance-axis.test.ts::declared_vs_resolved_—_the_distinction_the_axis_rests_on::`declaredBy`_distinguishes_the_two_in_words,_and_is_NOT_what_the_axis_parses
  Scenario: The declaredBy text says whether the profile was declared
    # Gap: that the axis does not parse declaredBy is not checked
    Given a folio with no contentType and a folio declaring "document"
    When each one's declared profile is read
    Then the undeclared folio's declaredBy says "undetermined"
    And the document folio's declaredBy says "document"
