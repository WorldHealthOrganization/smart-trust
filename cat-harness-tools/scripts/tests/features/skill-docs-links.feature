# What gen-skill-docs leaves behind must be the published tree: links resolve,
# no page is orphaned, no twin banner names a page that is not there.
# Each Scenario names the test that executes it.
Feature: Generated skill page links

  @test:scripts/tests/skill-docs-links.test.ts::generated_skill_instruction_pages::the_generated_directory_exists_and_has_pages
  Scenario: The generated skill pages exist
    Given the skill reference pages have been generated
    Then there are more than 10 Markdown pages

  @test:scripts/tests/skill-docs-links.test.ts::generated_skill_instruction_pages::a_link_that_is_correct_AT_ITS_SOURCE_resolves_from_the_generated_page_too
  Scenario: A link correct at its source resolves from the generated page
    Given the skill reference pages have been generated
    When every relative link on each page is resolved
    Then no link resolves only from one directory up, the source's depth

  @test:scripts/tests/skill-docs-links.test.ts::indexSummary::a_short_line_is_kept_whole
  Scenario: A short summary line is kept whole
    Then "A short summary." is summarised unchanged

  @test:scripts/tests/skill-docs-links.test.ts::indexSummary::a_cut_inside_a_link_target_is_extended_to_the_link's_end
  Scenario: A cut inside a link target extends to the link's end
    When a line whose 40-character cut falls inside a link target is summarised
    Then the summary ends at the end of that link

  @test:scripts/tests/skill-docs-links.test.ts::indexSummary::a_cut_outside_any_link_stays_at_the_limit
  Scenario: A cut outside any link stays at the limit
    When a line whose 30-character cut falls after its link is summarised
    Then the summary is its first 30 characters

  @test:scripts/tests/skill-docs-links.test.ts::orphanPages::a_page_nothing_produced_is_an_orphan
  Scenario: A page nothing produced is an orphan
    Then of a.md and b.md with only a written, b.md is an orphan

  @test:scripts/tests/skill-docs-links.test.ts::orphanPages::index.md_is_the_generator's_own_and_is_never_an_orphan
  Scenario: index.md is never an orphan
    Then index.md and a.md with only a written give no orphan

  @test:scripts/tests/skill-docs-links.test.ts::orphanPages::non-markdown_is_not_judged
  Scenario: Non-Markdown files are not judged
    Then a .svg beside the pages is not an orphan

  @test:scripts/tests/skill-docs-links.test.ts::orphanPages::the_PUBLISHED_name_is_what_is_compared,_not_the_source_basename
  Scenario: The published name is compared
    Then local-todo-manager.md is not an orphan when local-todo-manager was written
    And it is an orphan when only todo-manager was written

  @test:scripts/tests/skill-docs-links.test.ts::orphanPages::it_is_DISCRIMINATING_over_the_real_output_directory
  Scenario: Over the real output with nothing written, the pages are orphans
    Given the skill reference pages have been generated
    Then with nothing written more than 10 pages are orphans

  @test:scripts/tests/skill-docs-links.test.ts::unpublishedTwins::both_twins_produced_is_clean
  Scenario: Both twins produced is clean
    Then a twin entry for a and local-a, both written, reports nothing

  @test:scripts/tests/skill-docs-links.test.ts::unpublishedTwins::a_twin_nothing_produces_is_named,_with_the_entry_it_belongs_to
  Scenario: An unproduced twin is named with its entry
    Then with only a written, "a -> local-a" is reported

  @test:scripts/tests/skill-docs-links.test.ts::unpublishedTwins::an_entry_whose_OWN_name_is_not_among_its_twins_is_reported_too
  Scenario: An entry missing its own name among its twins is reported
    Then an entry a whose twins are x and y reports that no twin publishes under "a" itself

  @test:scripts/tests/skill-docs-links.test.ts::unpublishedTwins::it_is_DISCRIMINATING_over_a_table_that_is_entirely_unpublished
  Scenario: An entirely unpublished table reports both twins
    Then with nothing written the a/local-a entry reports 2 problems

  @test:scripts/tests/skill-docs-links.test.ts::twinsInCheckout::the_partner's_group_directory_absent:_the_entry_is_dropped_and_named,_so_no_banner_and_no_failure
  Scenario: A twin whose group directory is absent is dropped and named
    Given the local- group's directory is absent from the checkout
    Then the a/local-a entry is dropped and named as absent
    And the remaining table reports no unpublished twin

  @test:scripts/tests/skill-docs-links.test.ts::twinsInCheckout::the_group_present_(the_folio-assistant_index):_the_entry_is_kept,_and_a_missing_stub_still_fails
  Scenario: With the group present the entry is kept and a missing stub fails
    Given every group directory is present
    Then the table is unchanged with nothing absent
    And with only a written "a -> local-a" is reported

  @test:scripts/tests/skill-docs-links.test.ts::twinsInCheckout::a_twin_no_declared_group_would_publish_is_kept,_so_the_table_contradicting_the_groups_still_fails
  Scenario: A twin no declared group publishes is kept and fails
    Given an entry a whose twin other-a no group would publish
    Then the entry is kept
    And with only a written "a -> other-a" is reported
