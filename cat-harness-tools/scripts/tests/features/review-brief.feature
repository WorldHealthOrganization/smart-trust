# The review page's "What to expect" pane: what it takes from a PR body, for
# change-set PRs and ordinary branches alike. Each Scenario names the test
# that executes it.
Feature: Review brief pane

  @test:scripts/tests/review-brief.test.ts::review_brief::a_marked_review-brief_section_is_shown_alone
  Scenario: A marked review-brief section is shown alone
    Given a PR body with text around a <!-- review-brief --> section and a generated footer
    When the brief text is taken
    Then it is only the marked section's text, flagged as marked

  @test:scripts/tests/review-brief.test.ts::review_brief::an_ordinary_PR_body_loses_comments,_the_attribution_line_and_the_footer
  Scenario: An ordinary PR body loses comments, attribution and footer
    Given a PR body with an attribution comment, a "Requested by" line, a sentence and the footer
    When the brief text is taken
    Then it is "Fixes the banner." and is not marked

  @test:scripts/tests/review-brief.test.ts::review_brief::keeps_a_rule_that_is_part_of_the_body
  Scenario: A horizontal rule inside the body is kept
    Given a body "a", a rule, then "b"
    When the brief text is taken
    Then the text is unchanged

  @test:scripts/tests/review-brief.test.ts::review_brief::finds_the_issue_a_PR_closes
  Scenario: The issue a PR closes is found
    Then "Closes #184." yields 184
    And "fixes #7" yields 7
    And "see #9" yields no issue

  @test:scripts/tests/review-brief.test.ts::review_brief::names_the_change_set_only_when_the_title_does
  Scenario: The change set is named only when the PR title names it
    Given a PR titled "CS-001: define DPI-F"
    Then the brief model's change set is "CS-001"
    And with the title "fix: banner" the change set is null
    And with no PR the model's source is "none"

  @test:scripts/tests/review-brief.test.ts::review_brief::reads_the_repository_from_the_banner's_links
  Scenario: The repository is read from the banner's branch link
    Given a branch URL on github.com/litlfred/smart-ra
    Then the repository is owner "litlfred", repo "smart-ra"
    And a javascript: URL yields no repository

  @test:scripts/tests/review-brief.test.ts::review_brief::where_to_look:_sections_by_number_of_changes,_most_first
  Scenario: Where to look lists sections by change count, most first
    Given changes in sections a, b, b and c
    When the top 2 sections are taken
    Then they are b with 2 and a with 1

  @test:scripts/tests/review-brief.test.ts::review_brief::Markdown_blocks:_headings,_lists,_rules,_paragraphs
  Scenario: The brief is split into Markdown blocks
    Given Markdown with a level-2 heading, a list with a continued item, a two-line paragraph and a rule
    When it is split into blocks
    Then the blocks are a heading, a list of "one more" and "two", a paragraph "para line" and a rule

  @test:scripts/tests/review-brief.test.ts::review_brief::the_page_carries_the_pane_and_never_uses_innerHTML
  Scenario: The review page carries the pane and never uses innerHTML
    When the review page HTML is generated
    Then it has the "brief" element, the renderBrief function and a fetch of review-brief.json
    And it never contains "innerHTML"
    And its PR-number regex keeps its \d escape
