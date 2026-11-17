# scripts/gen-auto-docs.ts writes the derived auto-docs index pages: one per artefact type
# and sub-graph, plus a page for each level above them, indexing artefacts rather than
# their renderings. Each Scenario names the test that executes it.
Feature: Auto-docs index pages

  @test:scripts/tests/gen-auto-docs.test.ts::the_type_registry::every_type_declares_the_graph_typology_its_artefacts_live_in
  Scenario: Every type declares the graph typology its artefacts live in
    Given the auto-docs type registry
    Then it holds at least one type
    And every type names a graph, has a lowercase slash-separated id, and describes what it extracts in more than 20 characters

  @test:scripts/tests/gen-auto-docs.test.ts::the_type_registry::`toc`_is_not_a_type,_and_that_is_a_decision_rather_than_an_omission
  Scenario: There is no table-of-contents type
    Given the auto-docs type registry
    Then no type has the id "toc" or "index/toc"

  @test:scripts/tests/gen-auto-docs.test.ts::the_type_registry::no_two_types_share_an_id
  Scenario: No two types share an id
    Given the auto-docs type registry
    Then every type id is distinct

  @test:scripts/tests/gen-auto-docs.test.ts::index/skills_agrees_with_knownSkills,_exactly::the_same_set_of_names,_neither_more_nor_fewer
  Scenario: The skills index lists exactly the known skills
    Given the items the "index/skills" type collects
    And the known skills of the harness and of every sibling instance not exempt from the visualiser
    Then no known skill is missing from the items
    And no item names a skill that is not known

  @test:scripts/tests/gen-auto-docs.test.ts::index/skills_agrees_with_knownSkills,_exactly::every_item_names_a_file_that_exists
  Scenario: Every skills index item names a file that exists
    Given the items the "index/skills" type collects
    Then each item's path exists in the checkout

  @test:scripts/tests/gen-auto-docs.test.ts::index/skills_agrees_with_knownSkills,_exactly::items_are_in_a_deterministic_order
  Scenario: Skills index items are in a deterministic order
    Given the items the "index/skills" type collects
    Then their paths are in English locale order

  @test:scripts/tests/gen-auto-docs.test.ts::index/processes_extracts_what_a_BPMN_declares_about_itself::finds_the_diagrams,_and_each_carries_its_lanes_and_activity_count
  Scenario: The processes index finds the diagrams with their activity counts
    # Gap: lanes are not checked, only the activity count.
    Given the items the "index/processes" type collects
    Then there are more than 20
    And every item is a ".bpmn" file with a non-negative activity count

  @test:scripts/tests/gen-auto-docs.test.ts::index/processes_extracts_what_a_BPMN_declares_about_itself::at_least_one_names_the_skills_its_activities_reference
  Scenario: At least one process names the skills its activities reference
    Given the items the "index/processes" type collects
    Then at least one item lists skills

  @test:scripts/tests/gen-auto-docs.test.ts::index/processes_extracts_what_a_BPMN_declares_about_itself::a_layer's_shared-steps_file_is_labelled_by_its_instance,_so_two_layers'_rows_differ
  Scenario: Each layer's shared-steps file is labelled by its instance
    Given the processes index items named "Shared steps (…)"
    Then their names are all distinct
    And none is labelled "Shared steps (global-tasks)"

  @test:scripts/tests/gen-auto-docs.test.ts::index/processes_extracts_what_a_BPMN_declares_about_itself::summaries_are_one_sentence,_not_a_whole_documentation_block
  Scenario: Process summaries are short single lines
    Given the items the "index/processes" type collects
    Then every summary given is at most 230 characters and has no line break

  @test:scripts/tests/gen-auto-docs.test.ts::owningDirectory_picks_the_most_specific_declaration::an_inner_declaration_wins_over_the_outer_one_that_also_contains_the_file
  Scenario: An inner declaration wins over an outer one containing the file
    Given declared directories "outer" at cat-harness/skills, "inner" at cat-harness/processes and "other" at who-iris/skills
    When the owner of "cat-harness/processes/x.bpmn" is found
    Then it is "inner"

  @test:scripts/tests/gen-auto-docs.test.ts::owningDirectory_picks_the_most_specific_declaration::a_file_only_the_outer_declaration_contains_goes_to_the_outer_one
  Scenario: A file only the outer declaration contains goes to it
    Given the same declared directories
    When the owner of "cat-harness/skills/todo-manager.md" is found
    Then it is "outer"

  @test:scripts/tests/gen-auto-docs.test.ts::owningDirectory_picks_the_most_specific_declaration::a_file_under_no_declaration_is_unattributed_rather_than_guessed
  Scenario: A file under no declaration is unattributed
    Given the same declared directories
    When the owner of "somewhere/else/x.md" is found
    Then there is none

  @test:scripts/tests/gen-auto-docs.test.ts::owningDirectory_picks_the_most_specific_declaration::a_prefix_that_is_not_a_path_boundary_does_not_match
  Scenario: A prefix that is not a path boundary does not match
    Given the same declared directories
    When the owner of "who-iris/skills-extra/x.md" is found
    Then there is none

  @test:scripts/tests/gen-auto-docs.test.ts::declaredDirectories_is_filtered_and_existence-checked::returns_only_directories_declaring_the_asked-for_graph
  Scenario: Declared directories are filtered by graph
    # Gap: existence-checking of the directories is not asserted.
    Given the directories declaring the "cat-harness" graph
    Then there is more than one
    And "docs" is not among them

  @test:scripts/tests/gen-auto-docs.test.ts::declaredDirectories_is_filtered_and_existence-checked::an_undeclared_graph_yields_nothing_rather_than_everything
  Scenario: An undeclared graph yields no directories
    Given the graph "no-such-graph-typology"
    When its declared directories are listed
    Then the list is empty

  @test:scripts/tests/gen-auto-docs.test.ts::the_emitted_page::carries_the_ownership_line_the_pruner_reads
  Scenario: The emitted page carries the ownership line
    Given an auto-docs page rendered for scope "who-iris-skills"
    Then it contains 'var SCOPE = "who-iris-skills";'

  @test:scripts/tests/gen-auto-docs.test.ts::the_emitted_page::says_it_is_an_index_and_not_the_documentation
  Scenario: The emitted page says it is an index and not the documentation
    Given an auto-docs page with no items
    Then it contains "not the documentation"
    And it contains "auto-docs"

  @test:scripts/tests/gen-auto-docs.test.ts::the_emitted_page::an_item_with_no_description_says_so_rather_than_showing_blank
  Scenario: An item with no description says so
    Given an auto-docs page with one item that has no summary
    Then it contains "no description in the artefact"

  @test:scripts/tests/gen-auto-docs.test.ts::a_THEMED_page,_so_the_layout_gives_it_the_top_band_(2026-10-07)::is_on_the_default_layout,_excluded_from_the_nav,_with_a_quoted_title
  Scenario: Themed pages use the default layout, are excluded from the nav and quote their title
    Given an auto-docs page and a level page
    Then each starts with front matter for the default layout and a quoted title
    And each has the line "nav_exclude: true"

  @test:scripts/tests/gen-auto-docs.test.ts::a_THEMED_page,_so_the_layout_gives_it_the_top_band_(2026-10-07)::is_not_a_document_of_its_own,_and_declares_no_rail
  Scenario: Themed pages are fragments with no rail of their own
    Given an auto-docs page and a level page
    Then neither holds a doctype, html, head or body tag
    And neither contains "fa-nav"
    And each holds the "da-title" heading and the "da-page" wrapper

  @test:scripts/tests/gen-auto-docs.test.ts::a_THEMED_page,_so_the_layout_gives_it_the_top_band_(2026-10-07)::styles_nothing_outside_its_own_wrapper
  Scenario: Themed pages style nothing outside their own wrapper
    Given an auto-docs page and a level page
    When the selectors of each page's style block are read, comments removed
    Then every selector starts with ".da-page"

  @test:scripts/tests/gen-auto-docs.test.ts::a_THEMED_page,_so_the_layout_gives_it_the_top_band_(2026-10-07)::keeps_the_body_Liquid-raw,_with_the_front_matter_outside_it
  Scenario: The page body is Liquid-raw with the front matter outside it
    Given an auto-docs page whose item summary holds Liquid output braces and two endraw tags
    Then the front matter holds no Liquid tag
    And the body opens a raw block
    And both endraw tags from the summary are escaped
    And the only unescaped endraw left closes the body at its end

  @test:scripts/tests/gen-auto-docs.test.ts::a_THEMED_page,_so_the_layout_gives_it_the_top_band_(2026-10-07)::a_title_with_a_quote_still_parses_as_one_YAML_scalar
  Scenario: A title with a quote is escaped in the front matter
    Given a type titled 'Say "hi"'
    When its auto-docs page is rendered
    Then the front matter title is the quoted, escaped 'Say "hi" · auto-docs'

  @test:scripts/tests/gen-auto-docs.test.ts::what_is_published::a_sub-graph_page_exists_for_who-iris,_the_sparse_case
  Scenario: A sub-graph page is published for who-iris
    # Skipped: standing alone, where who-iris is not mounted
    Given the built site of the harness
    Then the skills index page for "who-iris-skills" exists
    And it mentions "iris-dspace"

  @test:scripts/tests/gen-auto-docs.test.ts::what_is_published::no_page_is_published_for_a_sub-graph_that_contributes_nothing
  Scenario: No processes page is published for a sub-graph with no processes
    # Gap: passes trivially when the site has not been built.
    Given the built site of the harness
    Then there is no processes index directory for "who-iris-skills"

  @test:scripts/tests/gen-auto-docs.test.ts::the_LEVEL_pages_—_a_route_that_reads_like_a_section_must_answer::every_level_above_a_built_type_has_an_index
  Scenario: Every level above a built type has an index page
    # Skipped: when the auto-docs level pages have not been built
    Given every prefix of every type id in the registry
    Then the built site has an index.html under auto-docs for each prefix

  @test:scripts/tests/gen-auto-docs.test.ts::the_LEVEL_pages_—_a_route_that_reads_like_a_section_must_answer::a_level_page_names_ITSELF,_so_the_one_pruner_can_read_its_ownership
  Scenario: A level page names itself as its scope
    # Skipped: when the auto-docs level pages have not been built
    Given the built auto-docs root and "index" level pages
    Then the root page contains 'var SCOPE = "auto-docs";'
    And the "index" level page contains 'var SCOPE = "index";'

  @test:scripts/tests/gen-auto-docs.test.ts::the_LEVEL_pages_—_a_route_that_reads_like_a_section_must_answer::its_links_are_relative_to_itself,_so_the_tree_can_move
  Scenario: A level page links relative to itself
    # Skipped: when the auto-docs level pages have not been built
    Given the built "index" level page
    Then it links to each "index/" type by its last segment followed by a slash
    And it holds no href starting with "/"

  @test:scripts/tests/gen-auto-docs.test.ts::the_LEVEL_pages_—_a_route_that_reads_like_a_section_must_answer::renders_a_level_with_nothing_under_it_as_a_stated_absence
  Scenario: A level with nothing under it states the absence
    Given the "index" level with no entries
    When its level page is rendered
    Then it contains "Nothing is built under this level"

  @test:scripts/tests/gen-auto-docs.test.ts::the_LEVEL_pages_—_a_route_that_reads_like_a_section_must_answer::counts_a_type's_items_and_says_what_a_nested_level_holds
  Scenario: A level page describes nested levels and fetches type counts
    Given the root level with a nested "index" level holding "2 type(s) below" and a "glossary" type counted 7
    When its level page is rendered with a counts file
    Then it contains "2 type(s) below"
    And it links to "glossary/"
    And it carries the count key "glossary" rather than the number 7
    And it fetches the counts file "../assets/auto-docs/index.json"

  @test:scripts/tests/gen-auto-docs.test.ts::a_description_naming_another_artefact_on_the_page_links_to_its_row_(bean_qgjh)::links_the_one_row_whose_fragment_ends_in_that_name
  Scenario: A description naming another row's artefact links to that row
    Given rows for an adjudicator and a reviewer, the adjudicator's summary naming "reviewer", "adjudicator" and "ghost"
    When the page is rendered
    Then the reviewer row has the id "a-g-l-json-role-reviewer"
    And "reviewer" in the summary is a code link to that row

  @test:scripts/tests/gen-auto-docs.test.ts::a_description_naming_another_artefact_on_the_page_links_to_its_row_(bean_qgjh)::never_links_a_row_to_itself,_nor_a_name_no_row_carries
  Scenario: A row never links to itself nor to a name no row carries
    Given the same rows
    When the page is rendered
    Then "adjudicator" and "ghost" stay plain code

  @test:scripts/tests/gen-auto-docs.test.ts::a_description_naming_another_artefact_on_the_page_links_to_its_row_(bean_qgjh)::a_name_two_rows_share_stays_code
  Scenario: A name two rows share stays plain code
    Given the same rows plus another row whose fragment also ends in "reviewer"
    When the page is rendered
    Then there is no link to the reviewer row

  @test:scripts/tests/gen-auto-docs.test.ts::a_code_span_that_is_not_a_row_here_links_to_a_skill_page_or_a_file_(bean_qgjh)::a_skill_name,_with_or_without_.md,_links_to_its_instruction_page
  Scenario: A skill name, with or without .md, links to its instruction page
    Given a summary naming "todo-manager" and "todo-manager.md", with a resolver for the skill
    When the page is rendered
    Then both code spans link to "../skill/todo-manager.html"

  @test:scripts/tests/gen-auto-docs.test.ts::a_code_span_that_is_not_a_row_here_links_to_a_skill_page_or_a_file_(bean_qgjh)::a_repository_path_links_to_its_source
  Scenario: A repository path links to its source
    Given a summary naming "a/b.bpmn", with a resolver for that file
    When the page is rendered
    Then the code span links to its source URL

  @test:scripts/tests/gen-auto-docs.test.ts::a_code_span_that_is_not_a_row_here_links_to_a_skill_page_or_a_file_(bean_qgjh)::a_name_that_resolves_to_neither_stays_code
  Scenario: A name that resolves to neither a skill nor a file stays code
    Given a summary naming "claim", which neither resolver knows
    When the page is rendered
    Then "claim" stays plain code

  @test:scripts/tests/gen-auto-docs.test.ts::counts_are_fetched_from_one_file,_so_pages_do_not_move_when_a_count_does::a_sibling's_count_changing_leaves_the_page_byte-identical
  Scenario: A sibling's count changing leaves the page byte-identical
    Given a sub-graph page whose sibling "a-skills" is counted 5, then 6
    When both are rendered
    Then the two pages are identical

  @test:scripts/tests/gen-auto-docs.test.ts::counts_are_fetched_from_one_file,_so_pages_do_not_move_when_a_count_does::each_sibling_carries_its_key_and_a_pending_mark,_filled_from_the_counts_file
  Scenario: Each sibling carries a count key and a pending mark filled from the counts file
    Given a sub-graph page with siblings "a-skills" and "b-skills" and the counts file "../../x.json"
    Then each sibling carries its count key under the type id
    And a pending count state is marked
    And the page fetches "../../x.json" and reads its counts

  @test:scripts/tests/gen-auto-docs.test.ts::counts_are_fetched_from_one_file,_so_pages_do_not_move_when_a_count_does::a_level_page's_type_count_changing_leaves_it_byte-identical
  Scenario: A level page's type count changing leaves it byte-identical
    Given a level page whose "skills" type is counted 1, then 2
    When both are rendered
    Then the two pages are identical
