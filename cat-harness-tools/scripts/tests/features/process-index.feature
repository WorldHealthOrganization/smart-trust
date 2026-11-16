# The workflow page's process table: the view logic of the shipped viewer,
# and the JSON-LD it reads (bean ax6r). Each Scenario names the test that executes it.
Feature: The process index

  @test:scripts/tests/process-index.test.ts::grouping::by_concern_group:_groups_in_order,_the_ungrouped_remainder_last,_rows_by_instance_then_name
  Scenario: Grouping by concern group
    Given rows in the content and sdlc groups and one ungrouped
    When they are grouped by group
    Then the groups are content, sdlc and the ungrouped remainder last, and content's rows run by instance then name

  @test:scripts/tests/process-index.test.ts::grouping::by_instance:_rows_ordered_by_concern_group_inside_each_instance
  Scenario: Grouping by instance orders rows by concern group inside each instance
    When the rows are grouped by instance
    Then the instances come in order and cat-harness's rows run content before sdlc

  @test:scripts/tests/process-index.test.ts::grouping::every_row_lands_in_exactly_one_group
  Scenario: Every row lands in exactly one group
    Then grouping by group and by instance each keeps every row once

  @test:scripts/tests/process-index.test.ts::grouping::an_empty_or_absent_list_is_no_groups,_not_an_error
  Scenario: An empty or absent list is no groups
    Then grouping no rows, or undefined, gives no groups

  @test:scripts/tests/process-index.test.ts::links::an_SVG_under_the_canonical_site_is_re-rooted_at_this_one
  Scenario: An SVG under the canonical site is re-rooted at this one
    Then an SVG under the canonical site is linked under the local site when both are given
    And unchanged when they are not

  @test:scripts/tests/process-index.test.ts::links::a_relative,_protocol-relative_or_scripted_URL_is_dropped_rather_than_linked
  Scenario: Relative, protocol-relative and scripted URLs are dropped
    Then a protocol-relative SVG, a root-relative SVG and a javascript: source give empty links
    And an https source is kept

  @test:scripts/tests/process-index.test.ts::links::a_subgraph_IRI_is_fetched_only_under_the_repository's_own_subgraph_IRI
  Scenario: A subgraph IRI is fetched only under the repository's own subgraph IRI
    Then a subgraph IRI under the repository's own maps to the local subgraph file
    And an IRI on another host, or one climbing out with .., maps to nothing

  @test:scripts/tests/process-index.test.ts::rows_from_a_hydrated_processes_subgraph::the_concern_group_is_the_nesting_below_the_top_processes_subgraph;_calls_come_from_ProcessNodes
  Scenario: The concern group is the nesting below the top processes subgraph
    Given a hydrated processes subgraph with a top process and a nested sdlc subgraph holding a process that calls it
    Then the rows are Top in no group and Child in sdlc, both of instance h
    And Child's calls are Top, Top's summary is its own and Child's is empty
    And the document holds processes, while one holding only skills does not

  @test:scripts/tests/process-index.test.ts::a_dependency's_subgraph_carries_`source`,_not_`sourcePath`_(t8c4)::the_row's_path_and_BPMN_link_come_from_the_absolute_`source`_IRI
  Scenario: A dependency's row takes its path and BPMN link from the absolute source IRI
    Given a dependency's subgraph member carrying source and no sourcePath
    Then its row's path and source are both that IRI

  @test:scripts/tests/process-index.test.ts::first_sentence::a_summary_is_the_documentation's_first_sentence
  Scenario: A summary is the documentation's first sentence
    Then "Own. More." gives "Own." and "No stop" gives itself

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::every_file_the_walk_reaches_exists_and_validates
  Scenario: Every file the subgraph walk reaches exists and validates
    Given the subgraph JSON-LD is built
    Then the walk reports no problems

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::every_diagram_an_instance_in_this_graph_declares_is_a_Process_node,_and_nothing_else_is
  Scenario: Every diagram a framed instance declares is a Process node, and nothing else is
    Given an aggregate checkout
    Then the published processes' diagram paths are exactly the diagrams declared by framed instances

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::bootstrap's_diagrams_are_not_re-carried_into_this_graph_(pve3,_#432)
  Scenario: bootstrap's diagrams are not re-carried into this graph
    Then bootstrap and bootstrap-tools declare at least one diagram, and none of their instances is framed

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::bootstrap's_diagrams_are_covered_through_its_OWN_subgraphs,_linked_by_`seeAlso`_(t8c4)
  Scenario: bootstrap's diagrams are covered through its own subgraphs, linked by seeAlso
    Given the subgraph JSON-LD is built
    Then the unframed processes reached by seeAlso have no problems and are exactly the unframed instances' diagrams, at least one
    And every seeAlso IRI is a subgraph root of another site

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::with_no_`seeAlso`,_an_unframed_instance's_diagrams_are_NOT_counted
  Scenario: With no seeAlso an unframed instance's diagrams are not counted
    Then reaching unframed processes with no seeAlso finds none

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::the_shipped_viewer_reads_the_same_rows_from_the_same_files
  Scenario: The shipped viewer reads the same rows from the same files
    Given the hydrated processes subgraphs are built
    When the viewer reads every viewed processes subgraph of cat-harness and folio-assistant-core
    Then it reads as many rows as there are published processes of those two layers

  @test:scripts/tests/process-index.test.ts::the_committed_subgraph_JSON-LD::every_node_has_documentation,_and_no_summary_carries_work-plan_or_issue_chatter
  Scenario: Every process node has documentation and no work-plan chatter
    Then every published process has a string summary, none naming an issue number, a bean, an owner ruling or a date
    # Gap: when the subgraph JSON-LD is not built the process list is empty and the loop asserts nothing.
