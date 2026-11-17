# The CLI src/qa-agent-write.ts records an agent's QA verdict for a block in the results tree,
# where every reader looks first. Each Scenario names the test that executes it.
Feature: The agent QA writer writes where the readers read

  @test:src/qa-agent-write.test.ts::qa-agent-write::writes_into_the_results_tree,_which_is_where_the_readers_look_first
  Scenario: The verdict is written into the results tree, which is where the readers look first
    Given a content repository with one block "content/ch1/blk"
    When the CLI records a pass for the criterion "c-one" from the repository root
    Then the block's results-tree QA file exists
    And no legacy QA file is written beside the block
    And the path the readers resolve is the results-tree one

  @test:src/qa-agent-write.test.ts::qa-agent-write::does_not_depend_on_the_cwd_it_is_run_from
  Scenario: The writer does not depend on the cwd it is run from
    Given a content repository with one block
    When the CLI records a pass for "c-one" run from the system temp directory
    Then the block's results-tree QA file exists

  @test:src/qa-agent-write.test.ts::qa-agent-write::migrates_a_legacy_verdict:_its_entries_are_kept,_and_the_new_one_lands_in_the_results_tree
  Scenario: A legacy verdict is migrated: its entries are kept and the new one lands in the results tree
    Given a block with a legacy QA file beside it holding the criterion "c-legacy"
    When the CLI records a pass for "c-new"
    Then the results-tree QA file holds exactly the criteria "c-legacy" and "c-new"

  @test:src/qa-agent-write.test.ts::qa-agent-write::appends_to_an_existing_results-tree_verdict_rather_than_to_a_shadowed_legacy_one
  Scenario: A second verdict appends to the existing results-tree verdict
    # Gap: no legacy file is present, so appending in preference to a shadowed legacy verdict is not exercised
    Given a content repository with one block
    When the CLI records a pass for "c-one" and then for "c-two"
    Then the results-tree QA file holds exactly the criteria "c-one" and "c-two"

  @test:src/qa-agent-write.test.ts::qa-agent-write::omits_agent_model_when_--model_is_not_supplied_(bean_gtx4)
  Scenario: The agent model is omitted when --model is not supplied
    Given a content repository with one block
    When the CLI records a pass for "c-nomodel" without --model
    Then the entry's reviewer kind is "agent"
    And the reviewer has no agent model
    And the reviewer's agent skill is "local/qa-agent-drain"

  @test:src/qa-agent-write.test.ts::qa-agent-write::records_agent_model_when_--model_is_supplied_(bean_gtx4)
  Scenario: The agent model is recorded when --model is supplied
    Given a content repository with one block
    When the CLI records a pass for "c-withmodel" with --model "claude-sonnet-4-6"
    Then the entry's reviewer kind is "agent"
    And the reviewer's agent model is "claude-sonnet-4-6"
