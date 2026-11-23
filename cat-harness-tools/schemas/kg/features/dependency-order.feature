# Specifies schemas/kg/dependency-order.ts: flattenDependencies, runInOrder,
# ancestorsOf and findConflicts.
Feature: Steps are ordered by what they need, and failures and conflicts are reported

  @test:schemas/kg/dependency-order.test.ts::rule_1_—_a_node_runs_after_everything_it_needs::orders_a_chain
  Scenario: A chain is ordered by its needs
    Given steps c needing b, a, and b needing a, declared in that order
    When they are flattened
    Then there are no problems
    And the order is a, b, c

  @test:schemas/kg/dependency-order.test.ts::rule_1_—_a_node_runs_after_everything_it_needs::the_owner's_pipeline:_kg_→_readme_→_the_dynamic_renders
  Scenario: The readme, the viewer and the visualisers run after the KG export
    Given steps kg-export, readme, kg-viewer and visualisers, the last three needing kg-export
    When they are flattened
    Then there are no problems
    And the order holds exactly those four steps
    And readme comes after kg-export
    And kg-viewer comes after kg-export
    And visualisers comes after kg-export

  @test:schemas/kg/dependency-order.test.ts::rule_2_—_ties_break_on_declaration_order::two_independent_steps_keep_the_order_they_were_declared_in
  Scenario: Independent steps keep their declaration order
    Given the independent steps zebra and aardvark, declared in that order
    When they are flattened
    Then the order is zebra, aardvark

  @test:schemas/kg/dependency-order.test.ts::rule_2_—_ties_break_on_declaration_order::renaming_a_node_does_not_reshuffle_its_unrelated_siblings
  Scenario: Renaming a step does not move an unrelated sibling
    Given the independent steps a, m, z, and the same with m renamed m2
    When both are flattened
    Then the orders are a, m, z and a, m2, z
    And m2 holds the position m held
    And with the renamed node left out, the two orders are identical

  @test:schemas/kg/dependency-order.test.ts::rule_3_—_a_cycle_is_reported,_never_broken::returns_no_order_at_all
  Scenario: A cycle yields no order and one problem
    Given a needing b and b needing a
    When they are flattened
    Then the order is empty
    And there is exactly one problem

  @test:schemas/kg/dependency-order.test.ts::rule_3_—_a_cycle_is_reported,_never_broken::names_EVERY_node_in_the_cycle,_not_the_first_one_found
  Scenario: A cycle problem names every step in it
    Given a needing c, b needing a and c needing b
    When they are flattened
    Then the first problem is a cycle naming a, b and c

  @test:schemas/kg/dependency-order.test.ts::rule_3_—_a_cycle_is_reported,_never_broken::a_clean_subgraph_beside_a_cycle_is_still_not_ordered_—_partial_output_gets_run
  Scenario: A clean step beside a cycle is not ordered either
    Given an independent step ok beside a cycle between a and b
    When they are flattened
    Then the order is empty
    And there is exactly one problem, a cycle naming a and b and not ok

  @test:schemas/kg/dependency-order.test.ts::rule_4_—_a_missing_dependency_is_reported,_never_dropped::is_a_problem,_and_the_step_is_not_silently_ordered
  Scenario: A missing dependency is a problem and nothing is ordered
    Given a step a needing "ghost", which is not declared
    When it is flattened
    Then the order is empty
    And the first problem is "missing" and names "ghost"

  @test:schemas/kg/dependency-order.test.ts::rule_4_—_a_missing_dependency_is_reported,_never_dropped::a_duplicate_id_is_a_problem_—_nothing_says_which_of_the_two_was_ordered
  Scenario: A duplicate id is a problem
    Given two steps both with id a
    When they are flattened
    Then the order is empty
    And there is exactly one problem, a "duplicate" naming the id a

  @test:schemas/kg/dependency-order.test.ts::fatal_is_per_step::a_fatal_failure_stops_the_run
  Scenario: A fatal failure stops the run
    Given the ordered steps kg (fatal), readme (fatal, needs kg), viewer (needs kg), tiles (needs viewer) and unrelated
    When they are run and kg fails
    Then the run stops at kg
    And kg is the only step recorded

  @test:schemas/kg/dependency-order.test.ts::fatal_is_per_step::a_non-fatal_failure_skips_what_needed_it_and_nothing_else
  Scenario: A non-fatal failure skips only what needed it
    Given the same ordered steps
    When they are run and viewer fails
    Then the run does not stop
    And viewer failed, tiles was skipped, and unrelated and readme ran

  @test:schemas/kg/dependency-order.test.ts::fatal_is_per_step::a_skipped_step_names_the_step_that_BROKE,_not_the_chain_that_carried_it
  Scenario: A skipped step names the step that broke
    Given the same ordered steps
    When they are run and viewer fails
    Then tiles is recorded as blocked by viewer

  @test:schemas/kg/dependency-order.test.ts::multiple_inheritance_—_ancestors_and_conflicts_(bean_a1lq)::a_diamond_resolves_once,_below_both_branches
  Scenario: A diamond is ordered once, below both branches
    Given D, B and C needing D, and A needing B and C
    When they are flattened
    Then there are no problems and the order is D, B, C, A
    And the ancestors of A are B, C and D

  @test:schemas/kg/dependency-order.test.ts::multiple_inheritance_—_ancestors_and_conflicts_(bean_a1lq)::an_override_by_a_layer_that_reaches_the_other_is_not_a_conflict
  Scenario: An override by a step that reaches the other is not a conflict
    Given the graph D, A, B needing D, and root needing A and B
    And D and B both define the key k
    When conflicts are found
    Then there are none

  @test:schemas/kg/dependency-order.test.ts::multiple_inheritance_—_ancestors_and_conflicts_(bean_a1lq)::two_unrelated_layers_at_DIFFERENT_depths_conflict_—_incomparable,_not_same-depth
  Scenario: Two unrelated steps at different depths conflict
    Given the same graph, where A and D both define the key k
    When conflicts are found
    Then there is exactly one conflict, naming A and D

  @test:schemas/kg/dependency-order.test.ts::multiple_inheritance_—_ancestors_and_conflicts_(bean_a1lq)::the_child_that_reaches_both_settles_the_conflict_by_redefining_the_key
  Scenario: A child reaching both settles the conflict by redefining the key
    Given the same graph, where A, D and root all define the key k
    When conflicts are found
    Then there are none
