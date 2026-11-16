# scripts/check-optin-links.ts reports links from always-on pages into an opt-in sub-graph, and
# between two opt-in groups, without rewriting them.
# Each Scenario names the test that executes it.
Feature: Links into opt-in groups

  @test:scripts/tests/check-optin-links.test.ts::which_links_are_read::relative_targets_only,_outside_fenced_code
  Scenario: Only relative link targets outside fenced code are read
    Given Markdown with relative, https, absolute, fragment and angle-bracketed links, and a link inside a fenced block
    When its relative links are read
    Then they are "x.md" and "z.md"

  @test:scripts/tests/check-optin-links.test.ts::the_gate::an_always-on_page_linking_into_a_group_is_a_finding;_a_link_within_the_group_is_not
  Scenario: An always-on page linking into an opt-in group is a finding
    Given a layer with always-on "docs/" and opt-in "extra/"
    And "docs/a.md" links to "../extra/g.md#top" and to "b.md"
    And "extra/g.md" links within extra and back to docs
    When the opt-in links are checked
    Then the only finding is "docs/a.md" targeting "../extra/g.md#top" in the "extra" group

  @test:scripts/tests/check-optin-links.test.ts::the_gate::a_link_between_two_opt-in_groups_is_a_finding:_each_is_switched_on_alone
  Scenario: A link between two opt-in groups is a finding
    Given "extra/g.md" links to "../more/m.md", both groups opt-in
    When the opt-in links are checked
    Then the findings name only the "more" group

  @test:scripts/tests/check-optin-links.test.ts::the_gate::a_file_that_declares_itself_generated_is_not_read
  Scenario: A file declaring itself generated is not read
    Given "docs/gen.md" with front matter "generated: readme:sync" linking into "extra/"
    When the opt-in links are checked
    Then 1 layer is examined
    And there are no findings
