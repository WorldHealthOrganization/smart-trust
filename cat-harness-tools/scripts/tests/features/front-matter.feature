# scripts/front-matter.ts reads a node's front matter and derives its one-line summary (frontMatter, firstHeading,
# nodeSummary), which skill_list shows for every skill in the harness's skills corpus.
# Each Scenario names the test that executes it.
Feature: A node's front matter and its one-line summary

  @test:scripts/tests/front-matter.test.ts::front_matter::a_plain_scalar_description_is_read
  Scenario: A plain scalar description is read from front matter
    Given a file whose front matter has "description: one line"
    When frontMatter reads it
    Then the description is "one line"

  @test:scripts/tests/front-matter.test.ts::front_matter::a_folded_`>`_block_is_joined_onto_one_line
  Scenario: A folded description block is joined onto one line
    Given a file whose front matter has a folded ">" description over the lines "first part" and "second part"
    When frontMatter reads it
    Then the description is "first part second part"

  @test:scripts/tests/front-matter.test.ts::front_matter::a_file_with_no_front_matter_yields_{},_not_an_error
  Scenario: A file with no front matter yields an empty object
    Given a file that opens on a heading
    When frontMatter reads it
    Then the result is an empty object

  @test:scripts/tests/front-matter.test.ts::front_matter::an_unterminated_front-matter_block_yields_{}
  Scenario: An unterminated front-matter block yields an empty object
    Given a file opening with "---" and no closing fence
    When frontMatter reads it
    Then the result is an empty object

  @test:scripts/tests/front-matter.test.ts::nodeSummary_—_and_its_third_state::front_matter_wins_over_the_heading
  Scenario: The front-matter description wins over the heading
    Given a file with description "from front matter" and a heading "From heading"
    When nodeSummary reads it
    Then the summary is "from front matter"

  @test:scripts/tests/front-matter.test.ts::nodeSummary_—_and_its_third_state::the_heading_is_a_real_fallback,_not_a_consolation_prize
  Scenario: With no front matter the first heading is the summary
    Given a file with no front matter whose heading is "Directory conventions — what an instance declares it scans"
    When nodeSummary reads it
    Then the summary is that heading's text

  @test:scripts/tests/front-matter.test.ts::nodeSummary_—_and_its_third_state::a_node_declaring_NOTHING_returns_undefined,_never_an_empty_string
  Scenario: A node with neither front matter nor heading has an undefined summary
    Given a file of plain prose with no heading and no front matter
    When nodeSummary reads it
    Then the summary is undefined
    And firstHeading of a file holding only an h2 is undefined

  @test:scripts/tests/front-matter.test.ts::the_live_corpus_really_is_describable_—_the_assertion_that_would_have_caught_it::there_are_skills_to_check_—_otherwise_this_proves_nothing
  Scenario: The live skills corpus has more than 50 skills to check
    Given every skill markdown file other than README.md under the harness's skills packages
    Then there are more than 50 of them

  @test:scripts/tests/front-matter.test.ts::the_live_corpus_really_is_describable_—_the_assertion_that_would_have_caught_it::every_skill_yields_SOME_summary
  Scenario: Every live skill yields a summary
    Given every skill markdown file under the harness's skills packages
    When nodeSummary reads each
    Then no file yields an empty or undefined summary

  @test:scripts/tests/front-matter.test.ts::the_live_corpus_really_is_describable_—_the_assertion_that_would_have_caught_it::summaries_are_one_line_—_a_folded_block_must_not_leak_newlines
  Scenario: No live skill summary contains a newline
    Given every skill markdown file under the harness's skills packages
    When nodeSummary reads each
    Then no summary contains a newline
