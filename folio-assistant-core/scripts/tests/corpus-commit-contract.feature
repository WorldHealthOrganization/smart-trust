Feature: the corpus commit contract in the editing process

  @test:scripts/tests/corpus-commit-contract.test.ts::the_corpus_is_a_data_store,_and_the_one_step_that_writes_it_names_this_contract::onlyCommitWritesCorpus
  Scenario: Task_Commit is the only step that writes the corpus store, and requires corpus-commit-contract
    When the editing process is loaded
    Then Task_Commit writes the corpus and requires corpus-commit-contract
    And no other step writes the corpus

  @test:scripts/tests/corpus-commit-contract.test.ts::1._receive_the_write_only_after_the_editor_accepts::oneFlowFromAccept
  Scenario: the one flow into Task_Commit is Gateway_EditorDecision's `accept`
    When the flows into Task_Commit are listed
    Then there is one, the editor decision's accept

  @test:scripts/tests/corpus-commit-contract.test.ts::1._receive_the_write_only_after_the_editor_accepts::withoutAcceptNothingReaches
  Scenario: without that flow, nothing reaches the corpus
    When reachability is computed with and without the accept flow
    Then Task_Commit is reachable only through it
    And the end in the corpus is reached only from the bean-closed gateway

  @test:scripts/tests/corpus-commit-contract.test.ts::1._receive_the_write_only_after_the_editor_accepts::onlyAcceptEnablesCommit
  Scenario: run to the editor's decision, any other answer leaves Task_Commit not enabled
    When the process runs to the editor's decision with each answer
    Then Task_Commit is never enabled before it
    And only accept enables Task_Commit

  @test:scripts/tests/corpus-commit-contract.test.ts::3._the_commit-hygiene_requirement_holds,_and_may_not_be_relaxed::commitNotRelaxable
  Scenario: Task_Commit's policy is relaxable="false"
    When Task_Commit's policy is read
    Then it is not relaxable
