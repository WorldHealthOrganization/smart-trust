# The per-repository skill index (bean e0uk): the skills:index region of a
# layer's AGENTS.md lists the skills the layer publishes, falling back to a
# directory list and SKILLS.md past the AGENTS.md byte budget. Each Scenario
# names the test that executes it.
Feature: A layer's AGENTS.md indexes its own skills

  @test:scripts/tests/readme-skills-index.test.ts::what_a_skill_says_it_is_for::the_first_sentence,_capped_at_a_word
  Scenario: A skill's summary is its first sentence, capped at a word
    Then the summary of "Does a thing. Then more." is "Does a thing."
    And a long sentence capped at 50 ends in "…", is at most 50 characters, and does not cut a word
    And blank text has no summary

  @test:scripts/tests/readme-skills-index.test.ts::what_a_skill_says_it_is_for::a_description_wins;_a_heading_that_only_repeats_the_name_falls_through_to_the_first_paragraph
  Scenario: A description wins, and a heading repeating the name falls through
    Then a skill with description "Reads A." is summarised from the description
    And a skill with no description whose heading is its name is summarised from its first paragraph
    And a heading that says more than the name is used
    And a bare name heading gives no summary

  @test:scripts/tests/readme-skills-index.test.ts::what_a_skill_says_it_is_for::first_paragraph_skips_quotes,_lists,_tables_and_fenced_code
  Scenario: The first paragraph skips quotes, lists, tables and fenced code
    Then the first paragraph after a heading, quote, list, table and fenced block is "This one."

  @test:scripts/tests/readme-skills-index.test.ts::the_AGENTS.md_region::lists_the_instance's_own_skills_with_links,_and_leaves_the_rest_of_the_file_alone
  Scenario: The region lists the layer's skills with links and leaves the rest alone
    Given skills alpha (description with a pipe) and beta under skills/pkg/, and an AGENTS.md with text around an empty region
    When the README sync runs
    Then it exits 0 and the text around the region is unchanged
    And the region has a linked row for alpha with the pipe escaped, and "**`skills/pkg/`** (2)"
    And no SKILLS.md is written, and --check exits 0

  @test:scripts/tests/readme-skills-index.test.ts::the_AGENTS.md_region::--check_fails_when_a_skill_is_added_and_the_region_was_not_re-synced
  Scenario: --check fails when a skill is added and the region is not re-synced
    Given the region synced with skill alpha
    When skill gamma is added and --check runs
    Then it exits 1 saying "AGENTS.md is out of date"

  @test:scripts/tests/readme-skills-index.test.ts::the_AGENTS.md_region::an_AGENTS.md_without_the_region_is_never_touched
  Scenario: An AGENTS.md without the region is never touched
    Given an AGENTS.md holding only "# Mine"
    When the README sync runs
    Then AGENTS.md still holds only "# Mine"

  @test:scripts/tests/readme-skills-index.test.ts::past_the_AGENTS.md_budget::AGENTS.md_gets_the_directories_and_SKILLS.md_the_full_list;_--check_then_holds
  Scenario: Past the budget AGENTS.md gets the directories and SKILLS.md the full list
    Given an AGENTS.md filled to near its byte budget, and skills alpha and beta in two packages
    Then the layer's own skill index counts 2
    When the README sync runs
    Then AGENTS.md links SKILLS.md and lists "skills/pkg/" with a count of 1, without linking alpha
    And SKILLS.md lists alpha with its summary
    And --check exits 0
    When SKILLS.md is deleted
    Then --check exits 1 saying SKILLS.md "is missing"

  @test:scripts/tests/readme-skills-index.test.ts::skills_in_an_opt-in_sub-graph::are_listed_by_name,_unlinked,_under_a_directory_marked_opt-in
  Scenario: Skills in an opt-in sub-graph are listed by name, unlinked
    Given skill alpha, and skill gamma in an opt-in group "extra" the layer enables
    When the README sync runs
    Then alpha is linked and gamma is listed as "| `gamma` | G. |" without a link
    And its directory is marked "(opt-in `fixture.extra`)"

  @test:scripts/tests/readme-skills-index.test.ts::skills_in_an_opt-in_sub-graph::the_short_form_names_the_directory_without_a_link
  Scenario: The short form names an opt-in directory without a link
    Given the same layer
    Then the package "extra/skills/ops" is opt-in "fixture.extra"
    And the compact index lists it unlinked with "(opt-in `fixture.extra`)" and links "skills/pkg/"
