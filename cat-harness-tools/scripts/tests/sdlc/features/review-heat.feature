# scripts/review-heat.ts computes the review heat map: per section, the changes, open and stale
# comments, QA results and review coverage, and the fill bucket of each cell. Each Scenario names
# the test that executes it.
Feature: Review heat map numbers

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::counts_changes,_open_comments,_defects_and_stale_comments_per_section,_in_reading_order
  Scenario: Changes, open comments, defects and stale comments are counted per section, in reading order
    Given changes a and b in "doc::sec:one" and c in "doc::sec:two", and an unchanged block u in "doc::sec:three"
    And an open defect on a made against an older hash, an addressed question on b, a resolved defect on b and an open editorial comment on u
    When the heat is computed
    Then "doc::sec:one" has 2 changed, 2 open, 1 defect and 1 stale comment
    And "doc::sec:two" has 1 changed and nothing open
    And "doc::sec:three" has 0 changed and 1 open
    And the rows come in that order, with every QA and coverage count at zero

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::an_orphaned_open_comment_is_still_counted,_under_no_section,_last
  Scenario: An orphaned open comment is still counted, under no section, last
    Given only an open question on a block that no longer exists, marked orphaned
    When the heat is computed
    Then the last row is "(listed in no section)" with 1 open comment and nothing else

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::QA:_a_failing_or_stale_block_is_counted_in_its_section;_a_clean_unchanged_section_gets_no_row
  Scenario: QA failing blocks are counted in their section, and a clean unchanged section gets no row
    # Gap: only failing and passing QA states are used here; stale is covered by the next Scenario
    Given QA results failing "major" on a, failing "critical" on b, and passing on c and u
    When the heat is computed
    Then QA is reported as present
    And the only rows are "doc::sec:one" and "doc::sec:two"
    And "doc::sec:one" has 2 failing QA blocks, worst "critical", out of 2
    And "doc::sec:two" has 0 failing out of 1 QA block

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::QA:_a_stale_verdict_in_an_unchanged_section_IS_a_place_to_look,_and_is_not_a_pass
  Scenario: A stale QA verdict in an unchanged section gets a row and is not a pass
    Given a stale QA result on the unchanged block u
    When the heat is computed
    Then the last row is "doc::sec:three" with 1 stale QA block and 0 failing

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::QA:_a_passing_block_with_agent-judged_criteria_never_run_passes_on_SCRIPTS_ONLY,_and_says_how_many_(9791)
  Scenario: A passing block with unrun agent-judged criteria passes on scripts only, and says how many
    Given QA passing on a with 15 agent-judged criteria not run, on b with 0, and on c with no such field
    When the heat is computed
    Then "doc::sec:one" has 2 QA blocks, 1 passing on scripts only, and 15 criteria needing an agent
    And "doc::sec:two" has 1 QA block counted as judged-unknown, not as fully judged

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::QA_wording:_scripts-only_and_fully_judged_are_different_words_(9791)
  Scenario: The rendering words scripts-only and fully judged differently
    # Gap: checks the source text of renderHeat, not rendered output
    Given the source text of renderHeat
    Then it contains "passing on scripts only ("
    And it contains "passing, every applicable criterion judged"

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::QA_without_blocks.json_cannot_be_placed,_so_it_is_not_published_rather_than_guessed
  Scenario: QA without blocks.json is not published rather than guessed
    Given a QA failing result and no blocks file
    When the heat is computed
    Then QA is reported as absent

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::coverage:_a_changed_block_counts_as_reviewed_only_on_a_verdict_for_its_CURRENT_hash_(px0t)
  Scenario: A changed block counts as reviewed only on a verdict for its current hash
    Given a changed block a, an added block b and a removed block in "doc::sec:one"
    And a verdict on a for its older hash "a1" and a verdict on b for its current hash "b1"
    When the heat is computed
    Then verdicts are reported as present
    And "doc::sec:one" has 3 changed, 2 needing review and 1 reviewed

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::coverage_without_verdicts,_or_without_blocks.json,_is_not_measured_rather_than_zero
  Scenario: Coverage without verdicts, or without blocks.json, is not measured rather than zero
    Given no verdicts
    When the heat is computed, verdicts are reported as absent
    And with an empty verdict list but no blocks file, verdicts are also reported as absent

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::no_comment_file_and_no_blocks_file_are_SAID,_not_zeroed
  Scenario: A missing comment file and blocks file are said, not zeroed
    Given no comments and no blocks file
    When the heat is computed
    Then comments are reported as absent
    And blocks are reported as absent

  @test:scripts/tests/sdlc/review-heat.test.ts::computeHeat::is_self-contained,_so_the_page_can_embed_exactly_this_function
  Scenario: computeHeat is self-contained, so the page can embed exactly this function
    Given a function rebuilt from the source text of computeHeat alone
    When it is run on the fixture changes and blocks
    Then it returns the same result as computeHeat itself

  @test:scripts/tests/sdlc/review-heat.test.ts::heatBucket::zero_is_no_fill;_the_rest_are_tertiles_of_the_column's_maximum
  Scenario: Zero has no fill and other values fall into tertiles of the column maximum
    Given a column maximum of 6
    When the values 0 to 6 are bucketed
    Then they give buckets 0, 1, 1, 2, 2, 3, 3
    And a value of 3 against a maximum of 0 gives bucket 0
