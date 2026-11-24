Feature: a general ChangeSet, not only for public comment

  @test:schemas/change-set-general.test.ts::ChangeSet,_general::noCommentValidRefsDefaultEmpty
  Scenario: a change that answers no public comment is valid, with refs defaulting to empty
    When a change set that answers no public comment is validated
    Then it is valid
    And its refs default to an empty list

  @test:schemas/change-set-general.test.ts::ChangeSet,_general::publicCommentChangeSetUnchanged
  Scenario: a public-comment change-set is unchanged
    When change sets with refs "PC-0042" and "not-a-ref" are validated
    Then "PC-0042" is accepted
    And "not-a-ref" is refused

  @test:schemas/change-set-general.test.ts::ChangeSet,_general::carriesRenderedImpact
  Scenario: it carries one rendered impact per renderer, and refuses a malformed one
    Given a rendered impact from renderer "fhir-ig-pages" with one changed file
    When a change set carrying it, and one whose file has change "edited", are validated
    Then the well-formed one is accepted
    And the malformed one is refused
