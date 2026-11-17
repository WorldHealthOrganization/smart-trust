# `unlinkOptIn` in `scripts/kind-table.ts` writes a kind description's link into an
# opt-in sub-graph as its text alone, since the kind table is an always-on page.
# Each Scenario names the test that executes it.
Feature: Kind table drops links into opt-in sub-graphs

  @test:scripts/tests/kind-table-optin.test.ts::unlinkOptIn::a_link_into_an_opt-in_sub-graph_keeps_its_text_and_loses_its_target
  Scenario: A link into an opt-in sub-graph keeps its text and loses its target
    Given the checkout "/checkout/cat-harness" with the opt-in sub-graph "cat-harness.sdlc" at "sdlc"
    When "see [the witness](../../../sdlc/skills/sdlc-core/qa-witness.md#x)" is unlinked
    Then the result is "see the witness"

  @test:scripts/tests/kind-table-optin.test.ts::unlinkOptIn::a_link_that_stays_outside_every_opt-in_sub-graph_is_left_as_it_is
  Scenario: A link outside every opt-in sub-graph is left as it is
    Given the same checkout and opt-in sub-graph
    When "see [fencing](../graph-management/domain-fencing.md)" is unlinked
    Then the text is unchanged

  @test:scripts/tests/kind-table-optin.test.ts::unlinkOptIn::an_absolute_URL,_a_site-rooted_path_and_an_anchor_are_left_as_they_are
  Scenario: An absolute URL, a site-rooted path and an anchor are left as they are
    Given the same checkout and opt-in sub-graph
    When a text linking "https://example.org/sdlc/", "/sdlc/x.md" and "#sdlc" is unlinked
    Then the text is unchanged

  @test:scripts/tests/kind-table-optin.test.ts::unlinkOptIn::a_sibling_sharing_the_sub-graph's_prefix_is_not_inside_it
  Scenario: A sibling directory sharing the sub-graph's prefix is not inside it
    Given the same checkout and opt-in sub-graph
    When a link to "../../../sdlc-extra/a.md" is unlinked
    Then the text is unchanged
