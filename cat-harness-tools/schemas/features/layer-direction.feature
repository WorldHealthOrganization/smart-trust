# schemas/kg/layer-direction.ts gives one wrong-direction verdict for an edge between two layers,
# shared by check:partition and kg-detangle, from a `needs` graph or the partition's own rule.
# Each Scenario names the test that executes it.
Feature: One verdict on the direction of an edge between layers

  @test:schemas/layer-direction.test.ts::directionOf_over_a_`needs`_graph::a_layer_reaches_itself_and_everything_it_transitively_needs
  Scenario: A layer may point at itself and at any layer it transitively needs
    Given a needs graph where folio-assistant-core needs cat-harness, which needs bootstrap
    When the direction of an edge is judged from folio-assistant-core to folio-assistant-core and to bootstrap
    Then both verdicts are "allowed"

  @test:schemas/layer-direction.test.ts::directionOf_over_a_`needs`_graph::pointing_up_the_stack_is_wrong-direction,_with_a_basis_naming_both_layers
  Scenario: An edge pointing up the stack is wrong-direction and its basis names both layers
    Given the same needs graph
    When the direction of an edge from bootstrap to cat-harness is judged
    Then the verdict is "wrong-direction"
    And the basis names 'bootstrap' and 'cat-harness'

  @test:schemas/layer-direction.test.ts::directionOf_over_a_`needs`_graph::absent_`needs`_is_UNDETERMINED_—_never_'reaches_nothing'_and_never_'reaches_anything'
  Scenario: A layer with no declared needs leaves its outgoing edges undetermined
    Given a needs graph with a layer "undeclared" that declares no needs
    When edges from "undeclared" to cat-harness and to itself are judged
    Then both verdicts are "undetermined"
    And an edge from bootstrap into "undeclared" is still "wrong-direction"

  @test:schemas/layer-direction.test.ts::directionOf_over_a_`needs`_graph::an_end_in_no_layer_at_all_is_undetermined,_and_says_which_end
  Scenario: An edge whose end sits in no layer is undetermined and names that end
    Given an edge from "x/y.md" that sits in no layer, to bootstrap
    When its direction is judged
    Then the verdict is "undetermined" with the basis "x/y.md sits in no declared layer"

  @test:schemas/layer-direction.test.ts::permits::a_permit_turns_a_refused_edge_into_`permitted`,_carrying_the_permit
  Scenario: A permit turns a refused edge into a permitted one carrying the permit
    Given a rule where "low" may not reach "high" and a permit for "l.ts" to "h.ts" with reason "side-effect registration"
    When the edge from "l.ts" in low to "h.ts" in high is judged
    Then the verdict is "permitted"
    And the permit's reason is "side-effect registration"

  @test:schemas/layer-direction.test.ts::permits::a_permit_on_an_ALLOWED_edge_is_not_consulted_—_so_a_caller_can_report_it_stale
  Scenario: A permit on an already allowed edge is not consulted
    Given a permit for "h.ts" to "l.ts" where "high" may already reach "low"
    When that edge is judged
    Then the verdict is plain "allowed", so a caller can report the permit as stale

  @test:schemas/layer-direction.test.ts::the_partition's_own_rule_runs_through_the_same_function::harness_importing_core_is_wrong-direction;_core_importing_harness_is_allowed
  Scenario: The partition's own rule refuses harness importing core and allows core importing harness
    Given the partition's ALLOWED table as the rule
    When edges harness to core, core to harness and test to base are judged
    Then harness to core is "wrong-direction"
    And core to harness and test to base are "allowed"

  @test:schemas/layer-direction.test.ts::detangle's_cut_kind_is_read_off_the_verdict_and_nothing_else::wrong-direction_maps_to_the_wrong-direction_cut_kind
  Scenario: A wrong-direction verdict gives detangle's wrong-direction cut kind
    Given the verdict for an edge from bootstrap to cat-harness
    When detangle classifies the edge by that verdict
    Then the cut kind is "wrong-direction"

  @test:schemas/layer-direction.test.ts::detangle's_cut_kind_is_read_off_the_verdict_and_nothing_else::allowed_and_undetermined_stay_unclassified_—_restatement_vs_essential_is_an_adjudication
  Scenario: Allowed and undetermined verdicts leave the edge unclassified
    Given edges from cat-harness to bootstrap and from "undeclared" to bootstrap
    When detangle classifies each by its verdict
    Then each cut kind is "unclassified"
    And each carries a non-empty basis
