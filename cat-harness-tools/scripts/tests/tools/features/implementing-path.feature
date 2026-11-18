# schemas/kg/harness-config.ts resolves a path the harness declares against the layer
# that implements the declarer, found through that layer's own needs.
# Each Scenario names the test that executes it.
Feature: Resolving a declared path through the implementing layer

  @test:scripts/tests/tools/implementing-path.test.ts::which_instances_implement_a_declarer::those_whose_OWN_needs_name_it_—_not_transitive_dependents,_not_the_aggregate_root
  Scenario: The implementers of a declarer are those whose own needs name it
    Given a checkout with aggregate root "top", declarer "base", direct dependents "impl" and "twin", and "far" needing only "impl"
    When the implementing instances of "base" are listed
    Then they are "impl" and "twin"

  @test:scripts/tests/tools/implementing-path.test.ts::resolving_a_declared_path::the_declaring_instance_first,_so_a_path_that_has_not_moved_resolves_where_it_always_did
  Scenario: A path held by the declaring instance resolves there first
    Given the checkout with "src/tools/x.ts" in both "base" and "impl"
    When "src/tools/x.ts" is resolved from "base"
    Then it is found in "base" via "own"

  @test:scripts/tests/tools/implementing-path.test.ts::resolving_a_declared_path::then_the_one_implementer_that_holds_it_—_the_moved_case
  Scenario: A path held by exactly one implementer resolves there
    Given the checkout with "src/tools/x.ts" only in "impl"
    When "src/tools/x.ts" is resolved from "base"
    Then it is found in "impl" via "needs"
    And the implementing root for that path is the "impl" directory

  @test:scripts/tests/tools/implementing-path.test.ts::resolving_a_declared_path::a_transitive_dependent's_copy_is_not_found
  Scenario: A copy held only by a transitive dependent is not found
    Given the checkout with "pipeline/c.ts" only in "far"
    When "pipeline/c.ts" is resolved from "base"
    Then it is missing
    And the places looked are "base" first, then "impl" and "twin", never "far"

  @test:scripts/tests/tools/implementing-path.test.ts::resolving_a_declared_path::a_file_at_the_aggregate_root_under_the_same_relative_path_is_not_found
  Scenario: A file at the aggregate root is not found
    Given the checkout with "src/tools/x.ts" only at the aggregate root
    When "src/tools/x.ts" is resolved from "base"
    Then it is missing

  @test:scripts/tests/tools/implementing-path.test.ts::resolving_a_declared_path::two_implementers_holding_it_is_ambiguous,_and_never_resolved_by_order
  Scenario: A path held by two implementers is ambiguous
    Given the checkout with "scripts/s.ts" in both "impl" and "twin"
    When "scripts/s.ts" is resolved from "base"
    Then it is ambiguous with candidates "impl" and "twin"
    And asking for its implementing root throws "more than one implementing instance"

  @test:scripts/tests/tools/implementing-path.test.ts::resolving_a_declared_path::missing_returns_the_declaring_root,_so_a_caller's_own_miss_report_is_unchanged
  Scenario: A missing path's implementing root is the declaring root
    Given the checkout with no "nowhere.ts" anywhere
    When the implementing root of "nowhere.ts" is asked from "base"
    Then it is the "base" directory

  @test:scripts/tests/tools/implementing-path.test.ts::in_this_checkout::this_layer_implements_the_harness,_and_is_found_through_its_needs
  Scenario: This layer implements the harness and the aggregate root does not
    Given this checkout
    When the implementing instances of the harness are listed
    Then they include "cat-harness-tools"
    And they do not include "folio-assistant"

  @test:scripts/tests/tools/implementing-path.test.ts::in_this_checkout::a_path_that_exists_only_in_this_layer_resolves_from_a_harness_declaration
  Scenario: A path only in this layer resolves from the harness
    Given "scripts/lib/roots.ts" does not exist in the harness
    When it is resolved from the harness
    Then it is found in "cat-harness-tools" at this layer's root via "needs"

  @test:scripts/tests/tools/implementing-path.test.ts::in_this_checkout::every_Tool_module_and_every_check:tools_path_resolves_today
  Scenario: Every in-process Tool module and every check:tools path resolves
    Given every instance root in this checkout and the Tools each declares
    When each in-process module is resolved from its declaring instance
    Then every one is found
    And more than 10 modules were resolved
    And check:tools reports no unresolved path
