Feature: linkTerms — linking defined terms in prose

  Background:
    Given the terms KnowledgeGraph, Node, NodeKind, Role and Process, each linked to its anchor in d.md

  @test:scripts/term-links.test.ts::linkTerms::linksEveryUseLongestFirst
  Scenario: links every use, plural included, longest name first
    When "A Node Kind names Nodes. Two Roles and a Process." is linked
    Then Node Kind, Nodes, Roles and Process are each linked to their own term's anchor
    And 4 links are added

  @test:scripts/term-links.test.ts::linkTerms::skipsCodeHeadingsLinks
  Scenario: leaves code, headings, existing links, bold names, table headers and fenced blocks alone
    Given text whose only term uses are in a heading, a table header, a bold name, inline code, an existing link and a fenced block
    When it is linked
    Then the text is unchanged and no links are added

  @test:scripts/term-links.test.ts::linkTerms::noTermsUnchanged
  Scenario: no terms: the text comes back unchanged (an empty alternation matches everywhere)
    When "What to do." is linked with no terms
    Then the text is unchanged and no links are added

  @test:scripts/term-links.test.ts::linkTerms::unlinkedTermsForGuard
  Scenario: unlinkedTerms names what a guard should fail on
    When the unlinked terms of "a [Role](r.md) and a Process" are found
    Then the result is just Process
