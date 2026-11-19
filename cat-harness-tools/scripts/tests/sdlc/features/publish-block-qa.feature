# scripts/publish-block-qa.ts publishes each folio block's QA verdicts for the heat map:
# a per-block summary, the agent-judged criteria still owed, and the state of the corpus.
# Each Scenario names the test that executes it.
Feature: Publishing block QA verdicts

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::no_sidecar_is_unaudited
  Scenario: A block with no sidecar is unaudited
    Given no block QA sidecar
    When the block is summarised against md hash "m1"
    Then its state is "unaudited"

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::a_fresh_fail_is_failing,_with_its_severity
  Scenario: A fresh fail makes a block failing, with its severity
    Given a sidecar with a critical fail and a pass, both on the current md hash
    When the block is summarised
    Then its state is "failing" with 1 fail, 0 warns, worst "critical", no stale criteria and none needing an agent

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::all_fresh_and_none_failing_is_passing
  Scenario: A block with every verdict fresh and none failing is passing
    Given a sidecar with one pass on the current md hash
    When the block is summarised
    Then its state is "passing"

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::a_stale_fail_is_NOT_counted_as_failing,_and_a_stale_verdict_is_never_a_pass
  Scenario: A stale fail is not counted as failing, and a stale verdict is never a pass
    Given a sidecar with a critical fail on an old md hash and a pass on the current one
    When the block is summarised
    Then its state is "stale" with 0 fails, 0 warns, no worst severity, 1 stale criterion and none needing an agent

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::an_agent-judged_criterion_never_given_a_verdict_is_counted,_so_'passing'_says_scripts_only_(9791)
  Scenario: An agent-judged criterion never given a verdict is counted alongside a passing state
    Given a sidecar with one fresh pass and two agent-judged criteria with no verdict
    When the block is summarised with those agent criteria
    Then its state is "passing"
    And 2 criteria need an agent

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::a_FRESH_verdict_on_an_agent-judged_criterion_counts_as_judged;_a_stale_one_does_not_(9791)
  Scenario: A fresh verdict on an agent-judged criterion counts as judged and a stale one does not
    Given a fresh pass on one agent-judged criterion and a pass on an old hash on another
    When the block is summarised with both as agent criteria
    Then 1 criterion needs an agent

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::summariseBlock::no_sidecar:_every_agent-judged_criterion_still_needs_an_agent
  Scenario: With no sidecar every agent-judged criterion still needs an agent
    Given no sidecar and three agent-judged criteria
    When the block is summarised
    Then 3 criteria need an agent

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::agentCriteriaFor_(9791)::comes_from_the_criteria's_own_declarations:_exactly_the_non-automated_ones_that_apply
  Scenario: The agent criteria are exactly the registered non-automated ones that apply to the kind
    Given the QA criteria registry
    When the agent criteria for a prose block are listed with no voices given
    Then there is at least one
    And each is non-automated and applies to prose or to every kind
    And their number equals the registry's non-automated criteria that apply to prose

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::agentCriteriaFor_(9791)::a_criterion_scoped_to_a_voice_the_folio_does_not_activate_is_not_asked_for
  Scenario: A criterion scoped to a voice the folio does not activate is not asked for
    Given a non-automated criterion "voice-x" scoped to voice "who"
    When agent criteria for prose are listed with no active voices
    Then none are listed
    And with voice "who" active, "voice-x" is listed

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::the_corpus_itself_(bean_`tfqf`,_R60)::no_results_tree_and_no_verdict_anywhere_is_`absent`:_the_unaudited_count_is_then_unknown
  Scenario: No results tree and no verdict anywhere makes the corpus absent
    # Gap: only the state and examined count are checked, not how the unaudited count is reported
    Given a folio with one prose block and no block QA results tree
    When the folio's block QA is published
    Then the corpus state is "absent" with 0 blocks examined

  @test:scripts/tests/sdlc/publish-block-qa.test.ts::the_corpus_itself_(bean_`tfqf`,_R60)::a_results_tree_holding_no_verdict_for_these_blocks_is_`present`:_genuinely_never_swept
  Scenario: A results tree holding no verdict for the blocks makes the corpus present
    Given a folio with one prose block and an empty block QA results tree
    When the folio's block QA is published
    Then the corpus state is "present" with 0 blocks examined
