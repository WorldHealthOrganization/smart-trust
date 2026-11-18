# pipeline/build.ts hands every block buildPaper loads to the block-status-overlay
# pipeline-plugin slot, and builds on when nothing fills it.
# Each Scenario names the test that executes it.
Feature: The block-status-overlay slot in the paper build

  @test:pipeline/build-status-overlay.test.ts::the_block-status-overlay_slot::a_filled_slot_is_handed_each_block,_its_.ts_and_the_paper_directory
  Scenario: A filled overlay slot is handed each block, its .ts and the paper directory
    Given a paper with one chapter holding the remark block "rem:a"
    And a contribution registry whose block-status-overlay plugin records each call
    When the paper is built
    Then no block fails to load
    And the overlay was called exactly once, with "rem:a", the path of its rem-a.ts and the paper directory

  @test:pipeline/build-status-overlay.test.ts::the_block-status-overlay_slot::an_unfilled_slot_is_skipped:_the_block_still_loads,_with_no_error
  Scenario: An unfilled overlay slot is skipped and the block still loads
    Given the same paper and an empty contribution registry
    When the paper is built
    Then no block fails to load
    And the build holds one chapter
