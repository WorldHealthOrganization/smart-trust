# Specifies that the checkout root's AGENTS.md, the file every agent opens
# first, carries enough links for a link check over it to mean something.
Feature: The root AGENTS.md carries a non-trivial number of links

  @test:test/coordinator/agent-entry-links-repo-root.test.ts::this_repository,_right_now::AGENTS.md_carries_a_NON-TRIVIAL_number_of_links
  Scenario: AGENTS.md has more than twenty links
    Given the checkout root's AGENTS.md
    When its links are parsed
    Then there are more than 20 of them
