# readInstance in src/workflow/corpus-gate.ts: a workflow store kept on an unmounted branch is
# reported, not thrown (litlfred/dth-sfp#14). Each Scenario names the test that executes it.
Feature: Corpus gate reports an unreadable workflow store

  @test:test/corpus-gate-unmounted.test.ts::readInstance::an_unmounted_bean_graph_is_reported_as_unreachable,_not_thrown
  Scenario: An unmounted bean graph is reported
    Given a repository whose bean graph is declared on a branch that is not mounted
    When an instance is read from it
    Then there is no record and the reason names the unresolvable workflow directory

  @test:test/corpus-gate-unmounted.test.ts::readInstance::a_readable_store_with_no_record_is_simply_no_record
  Scenario: A readable store with no record
    Then the read returns no record and no reason

  @test:test/corpus-gate-unmounted.test.ts::readInstance::a_readable_record_is_returned;_a_malformed_one_still_throws
  Scenario: A malformed record is still an error
    Then a well-formed record is returned and a malformed one throws
