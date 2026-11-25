# The methodologies viewer (bean yunp): the join keyed by node path, the three
# evidence states, and the links on the page a reader gets. Each Scenario
# names the test that executes it.
Feature: The methodologies viewer

  @test:scripts/tests/methodologies-viz.test.ts::the_three_evidence_states_are_three,_and_stay_apart::a_citation_that_resolves_is_`ingested`
  Scenario: A citation that resolves is ingested
    Given a node whose evidence resolves
    When the rows are built
    Then its state is "ingested"

  @test:scripts/tests/methodologies-viz.test.ts::the_three_evidence_states_are_three,_and_stay_apart::an_origin_with_no_`evidence:`_is_`cited-only`_—_an_open_question,_not_a_defect
  Scenario: An origin with no evidence is cited-only
    Given a node with no evidence that the report lists as having none
    When the rows are built
    Then its state is "cited-only"

  @test:scripts/tests/methodologies-viz.test.ts::the_three_evidence_states_are_three,_and_stay_apart::an_`evidence:`_naming_nothing_is_`dangling`,_NOT_the_same_as_having_none
  Scenario: Evidence naming nothing is dangling, not the same as none
    Given a node whose evidence the report lists as unresolved
    When the rows are built
    Then its state is "dangling", which differs from the cited-only node's

  @test:scripts/tests/methodologies-viz.test.ts::the_three_evidence_states_are_three,_and_stay_apart::all_three_are_distinguishable_ON_THE_PAGE,_in_words_and_not_only_in_colour
  Scenario: All three states are told apart in words on the page
    When the page is rendered from the three rows
    Then it says "source held", "cited, not ingested" and "citation does not resolve"

  @test:scripts/tests/methodologies-viz.test.ts::the_join_is_keyed_by_node_path,_not_by_name::two_instances_adopting_the_same_name_do_not_share_a_verdict
  Scenario: Two instances adopting the same name do not share a verdict
    Given this instance's swot with evidence and smart-base's swot reported as having none
    When the rows are built
    Then this instance's swot is ingested and smart-base's is cited-only

  @test:scripts/tests/methodologies-viz.test.ts::the_join_is_keyed_by_node_path,_not_by_name::a_node_that_does_not_validate_is_not_a_row_—_it_is_a_finding
  Scenario: A node that does not validate is not a row
    When the rows are built from an invalid node
    Then there are none

  @test:scripts/tests/methodologies-viz.test.ts::the_join_is_keyed_by_node_path,_not_by_name::an_untagged_file_is_not_a_row_either_—_a_README_in_the_directory_is_correct
  Scenario: An untagged file is not a row
    When the rows are built from an untagged README
    Then there are none

  @test:scripts/tests/methodologies-viz.test.ts::which_instance_declared_it_—_`instanceOf`::this_instance's_own_node_names_this_instance
  Scenario: This instance's own node names this instance
    Then the instance of methodologies/swot.md is cat-harness

  @test:scripts/tests/methodologies-viz.test.ts::which_instance_declared_it_—_`instanceOf`::a_SIBLING's_node_names_the_sibling,_not_`..`
  Scenario: A sibling's node names the sibling
    Then the instance of a node under ../smart-base/ is smart-base, and under ../folio-assistant-core/ is folio-assistant-core

  @test:scripts/tests/methodologies-viz.test.ts::ingested_sources_link_what_resolves_(qgjh)::links_a_known_library_item,_relative_to_the_page_it_sits_on
  Scenario: A known library item links its viewer, item page and source relative to the page
    When the evidence line of a known item is written on methodologies/index.md
    Then it links the item to the viewer one level up, then its item page and its source

  @test:scripts/tests/methodologies-viz.test.ts::ingested_sources_link_what_resolves_(qgjh)::links_the_entry's_own_page_as_[view]_when_it_has_one_(owner,_2026-10-16)
  Scenario: An entry with its own page links it as view
    When the evidence line of an item with an entry page is written
    Then it links the viewer and then the entry page as [view]

  @test:scripts/tests/methodologies-viz.test.ts::ingested_sources_link_what_resolves_(qgjh)::links_each_node's_extracted_method,_the_body_the_page_does_not_draw_(owner,_2026-10-16)
  Scenario: Each node's extracted method is linked
    When the page is rendered with a source-link resolver
    Then it links the method as extracted to the node's own page
    And without the resolver it does not

  @test:scripts/tests/methodologies-viz.test.ts::ingested_sources_link_what_resolves_(qgjh)::gives_each_node_its_own_page_at_<route>/<instance>/<name>/,_the_library's_pattern
  Scenario: Each node gets its own page at <route>/<instance>/<name>/
    Then the node page of m sits at methodologies/cat-harness/m/index.md
    And its body starts at the heading after the front matter
    And the node page carries the title, links the node file and a relative link through the source host, keeps external and anchor links, and links back to all methodologies

  @test:scripts/tests/methodologies-viz.test.ts::ingested_sources_link_what_resolves_(qgjh)::lists_the_skills_whose_uses-methodology_names_it_(owner,_2026-10-16)
  Scenario: A node page lists the skills that use the methodology
    When a node page is written with skills s1, linked, and s2, unlinked
    Then it lists them under Applied by skills
    And with no skills it has no such list

  @test:scripts/tests/methodologies-viz.test.ts::ingested_sources_link_what_resolves_(qgjh)::leaves_an_unknown_item,_or_no_resolver,_as_code
  Scenario: An unknown item, or no resolver, stays code
    Then the evidence line of an unknown item is code
    And the evidence line of a known item with no resolver is code

  @test:scripts/tests/methodologies-viz.test.ts::code_spans_in_prose_that_name_a_methodology_or_library_item_are_links_(owner,_2026-11-10)::links_a_methodology_on_this_site_to_its_section,_and_leaves_others_as_code
  Scenario: A methodology on this site is linked to its section; others stay code
    Then a code span naming grade links to #grade and one naming kepner-tregoe stays code
    And with a prefix the link is relative to it

  @test:scripts/tests/methodologies-viz.test.ts::code_spans_in_prose_that_name_a_methodology_or_library_item_are_links_(owner,_2026-11-10)::links_a_<layer>/library/<slug>/_reference_to_the_library_viewer,_relative_to_the_page
  Scenario: A <layer>/library/<slug>/ reference links to the library viewer
    Then a who-iris library reference links to the viewer relative to the page
    And an unknown library reference stays code

  @test:scripts/tests/methodologies-viz.test.ts::code_spans_in_prose_that_name_a_methodology_or_library_item_are_links_(owner,_2026-11-10)::does_not_re-link_a_span_that_is_already_link_text
  Scenario: A span that is already link text is not re-linked
    Then [`grade`](x) is unchanged

  @test:scripts/tests/methodologies-viz.test.ts::code_spans_in_prose_that_name_a_methodology_or_library_item_are_links_(owner,_2026-11-10)::is_applied_on_the_list_page_and_on_a_node_page
  Scenario: Prose linking is applied on the list page and on a node page
    Given a methodology whose applies-when names grade
    Then the list page links grade to #grade
    And the node page links it to ../../#grade
