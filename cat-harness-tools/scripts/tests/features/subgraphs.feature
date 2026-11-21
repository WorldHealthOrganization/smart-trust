# A folder corresponds to a subgraph, and subgraphs should be disconnected.
# Each pinned property was once wrong in a way that looked like a clean
# result. Each Scenario names the test that executes it.
Feature: Subgraph containment and entanglement

  @test:scripts/tests/subgraphs.test.ts::subgraph_containment_is_derived_from_declared_paths::the_declaration_was_read_—_otherwise_nothing_below_holds
  Scenario: The harness declaration is read
    Then more than 10 directories resolve from the harness's declaration

  @test:scripts/tests/subgraphs.test.ts::subgraph_containment_is_derived_from_declared_paths::`methodologies/`_nests_nothing_—_the_thing_this_branch_actually_achieved
  Scenario: methodologies nests nothing and is nested in nothing
    Then no subgraph-tree entry names methodologies as parent or child
    And the methodologies directory resolves

  @test:scripts/tests/subgraphs.test.ts::subgraph_containment_is_derived_from_declared_paths::a_node_belongs_to_its_DEEPEST_subgraph,_not_to_the_outer_one
  Scenario: A node belongs to its deepest subgraph
    Given a synthetic outer/ directory with outer/inner/ inside it
    Then outer/inner/node.md is owned by inner and outer/node.md by outer
    And outer's only child is inner

  @test:scripts/tests/subgraphs.test.ts::subgraph_containment_is_derived_from_declared_paths::relative_and_absolute_queries_agree
  Scenario: Relative and absolute ownership queries agree
    Then methodologies/kepner-tregoe.md is owned by methodologies, by relative and by absolute path

  @test:scripts/tests/subgraphs.test.ts::the_entanglement_report::it_attributed_files_—_a_report_over_nothing_is_not_a_clean_corpus
  Scenario: The report attributes files
    When the real corpus is scanned
    Then more than 100 Markdown files are attributed

  @test:scripts/tests/subgraphs.test.ts::the_entanglement_report::a_DERIVED_graph's_unresolved_links_are_never_dangling
  Scenario: A derived graph's links are never dangling
    Given at least one derived directory is declared across the checkout
    When the real corpus is scanned
    Then no dangling link comes from a derived directory
    And every link in the derived bucket comes from one

  @test:scripts/tests/subgraphs.test.ts::the_entanglement_report::CRDM's_relocations_left_no_broken_links_behind_—_both_of_them
  Scenario: The CRDM and RACI skills have no dangling links
    When the real corpus is scanned
    Then no dangling link comes from skills/process/crdm/ or skills/process/raci/

  @test:scripts/tests/subgraphs.test.ts::the_entanglement_report::an_illustrative_placeholder_is_not_counted_as_a_broken_link
  Scenario: Placeholder targets are not dangling
    # Gap: run over the real corpus only; no placeholder link is constructed, so it passes trivially if the corpus holds none.
    When the real corpus is scanned
    Then no dangling link's target is made only of dots and ellipses

  @test:scripts/tests/subgraphs.test.ts::repository-scoped_directories_are_attributed::attribution_reaches_well_past_this_instance's_own_tree
  Scenario: Attribution reaches repository-scoped directories
    When the real corpus is scanned
    Then more than 900 files are attributed

  @test:scripts/tests/subgraphs.test.ts::repository-scoped_directories_are_attributed::nothing_declared_is_left_unexamined_without_a_reason
  Scenario: Nothing declared is left unexamined
    When the real corpus is scanned
    Then no directory is reported not examined

  @test:scripts/tests/subgraphs.test.ts::the_`../`_too_many_count_is_COMPUTED_(bean_`syrl`)::a_target_that_resolves_after_dropping_one_`../`_IS_one
  Scenario: A link that resolves after dropping one ../ is over-deep
    Given the skill reference pages have been built
    When a link ../../skill-instructions/index.md from the skill instructions directory is checked
    Then it is over-deep, repaired to ../skill-instructions/index.md

  @test:scripts/tests/subgraphs.test.ts::the_`../`_too_many_count_is_COMPUTED_(bean_`syrl`)::a_target_that_still_does_not_resolve_after_dropping_one_is_NOT
  Scenario: A link that does not resolve after dropping one ../ is not over-deep
    When a link to a directory that does not exist is checked
    Then it is not over-deep

  @test:scripts/tests/subgraphs.test.ts::the_`../`_too_many_count_is_COMPUTED_(bean_`syrl`)::a_target_with_no_`../`_at_all_is_never_one
  Scenario: A link with no ../ is never over-deep
    When reference/index.md is checked
    Then it is not over-deep

  @test:scripts/tests/subgraphs.test.ts::the_`../`_too_many_count_is_COMPUTED_(bean_`syrl`)::the_real_corpus_carries_none_—_the_repair_of_`mi97`_holds
  Scenario: The real corpus has no over-deep links
    Given the site directory exists
    Then no site-resolved link of the real corpus is over-deep

  @test:scripts/tests/subgraphs.test.ts::a_kind_whose_markdown_a_published_page_SHOWS_addresses_the_published_tree_(smart-immunizations#81)::renderable,_within_a_renderable_kind,_and_shown_on_a_published_page_each_do
  Scenario: Kinds whose Markdown a published page shows address the published tree
    Given kinds site (renderable), group (within site), annex (shown on published pages) and data
    Then site, group, annex, and data with annex each address the published tree

  @test:scripts/tests/subgraphs.test.ts::a_kind_whose_markdown_a_published_page_SHOWS_addresses_the_published_tree_(smart-immunizations#81)::a_kind_that_says_none_of_the_three_does_not,_so_its_unresolved_links_stay_dangling
  Scenario: Other kinds do not address the published tree
    Then data alone, no kinds, and an unknown kind do not

  @test:scripts/tests/subgraphs.test.ts::the_bean_archive_view_resolves_like_the_store_it_sits_in::only_a_bean-defs_directory_inside_another_pairs_up
  Scenario: Only a nested bean-defs directory is an archive view
    Given bean-defs at beans/defs and beans/defs/archive, bean-notes, and docs with docs/archive
    Then the only archive view is beans/defs/archive over the store beans/defs

  @test:scripts/tests/subgraphs.test.ts::the_bean_archive_view_resolves_like_the_store_it_sits_in::a_link_FROM_an_archived_bean_resolves_as_if_it_sat_in_the_store
  Scenario: A link from an archived item resolves from the store
    When ../../AGENTS.md is resolved from beans/defs/archive/b.md
    Then it resolves to the root AGENTS.md

  @test:scripts/tests/subgraphs.test.ts::the_bean_archive_view_resolves_like_the_store_it_sits_in::a_link_TO_a_bean_that_has_since_been_archived_still_resolves
  Scenario: A link to an archived item still resolves
    When ../defs/b.md is resolved from beans/notes/README.md
    Then it resolves to beans/defs/archive/b.md

  @test:scripts/tests/subgraphs.test.ts::the_bean_archive_view_resolves_like_the_store_it_sits_in::a_link_that_names_nothing_in_either_half_is_still_unresolved
  Scenario: A link to nothing in either half is unresolved
    Then ../../NOPE.md from the archive and ../defs/c.md from the notes resolve to nothing

  @test:scripts/tests/subgraphs.test.ts::a_declared_move_answers_at_the_old_path_until_its_window_closes::a_link_to_the_old_path_resolves_at_the_new_one
  Scenario: A declared move resolves the old path at the new one
    Given a move from skills/sdlc to sdlc/skills until 2099-12-31
    Then on 2026-11-05 the move is not expired
    And skills/sdlc/a.md resolves to sdlc/skills/a.md

  @test:scripts/tests/subgraphs.test.ts::a_declared_move_answers_at_the_old_path_until_its_window_closes::a_file_that_is_not_at_the_new_path_either_is_still_unresolved
  Scenario: A file missing at the new path is unresolved
    Then skills/sdlc/b.md does not resolve
    And skills/sdlc-x/a.md, which only shares the prefix's spelling, does not resolve

  @test:scripts/tests/subgraphs.test.ts::a_declared_move_answers_at_the_old_path_until_its_window_closes::past_`until`_the_move_is_expired_and_no_longer_honoured
  Scenario: An expired move is not honoured
    Given the move's until is 2026-11-04
    Then on 2026-11-05 it is expired and skills/sdlc/a.md does not resolve

  @test:scripts/tests/subgraphs.test.ts::a_declared_move_answers_at_the_old_path_until_its_window_closes::the_declaration_refuses_a_move_without_a_date
  Scenario: A move needs a date
    Then a declaration whose move's until is "soon" is refused
    And with until 2026-12-31 it is accepted

  @test:scripts/tests/subgraphs.test.ts::a_link_into_an_unbuilt_publish-time_artefact_is_unverifiable,_not_dangling::an_absent_declared_path_is_listed,_with_its_trailing_slash
  Scenario: An absent built-at-publish path is listed as unbuilt
    Given an instance declaring schemas/kinds/ as built at publish, not yet built
    Then the unbuilt paths are schemas/kinds/ with its trailing slash

  @test:scripts/tests/subgraphs.test.ts::a_link_into_an_unbuilt_publish-time_artefact_is_unverifiable,_not_dangling::while_unbuilt,_a_link_into_it_is_not_dangling;_a_link_elsewhere_still_is
  Scenario: While unbuilt, links into it are not dangling
    When a note links a file and the directory under schemas/kinds/ and ../nope.md
    Then only ../nope.md is dangling

  @test:scripts/tests/subgraphs.test.ts::a_link_into_an_unbuilt_publish-time_artefact_is_unverifiable,_not_dangling::once_built,_a_link_to_a_file_the_build_did_not_write_is_dangling_again
  Scenario: Once built, a link to a missing file is dangling
    Given schemas/kinds/ has been built with a.json
    Then nothing is unbuilt
    And of links to a.json and missing.json, only missing.json is dangling
