# The harness's content-adapter contract (src/types.ts, src/content-types.ts) names
# no core content type, and the repository partition (scripts/repo-partition.ts) has
# no wrong-direction edges. Each Scenario names the test that executes it.
Feature: The adapter contract respects the layer partition

  @test:scripts/tests/adapter-layering.test.ts::the_partition_has_no_wrong-direction_edges::zero,_and_the_count_is_real
  Scenario: The repository partition has no wrong-direction edges over a real scan
    When the repository partition is analysed
    Then it lists no cross-layer edges
    And it scanned more than 200 modules
    And it counted more than 300 edges

  @test:scripts/tests/adapter-layering.test.ts::the_partition_has_no_wrong-direction_edges::...and_nothing_is_unassigned,_which_is_a_separate_axis
  Scenario: No module is unassigned and no edge is unresolved
    When the repository partition is analysed
    Then no module is assigned to "unassigned"
    And there are no unresolved edges

  @test:scripts/tests/adapter-layering.test.ts::the_harness_contract_does_not_import_the_content_model::`src/types.ts`_imports_nothing_from_`schemas/`
  Scenario: src/types.ts imports nothing from schemas/
    Given the source of src/types.ts in this layer
    Then none of its import lines names a path under "schemas/"
    And it has at least one import line

  @test:scripts/tests/adapter-layering.test.ts::the_harness_contract_does_not_import_the_content_model::`src/content-types.ts`_imports_nothing_at_all_—_it_is_the_vocabulary,_not_a_consumer
  Scenario: src/content-types.ts imports nothing at all
    Given the source of src/content-types.ts in this layer
    Then it contains "export interface ContentSource"
    And it has no import lines

  @test:scripts/tests/adapter-layering.test.ts::the_harness_contract_does_not_import_the_content_model::the_two_layers_it_belongs_to_disagree,_which_is_why_this_matters
  Scenario: src/types.ts lives in this layer while schemas/types.ts is classified as core
    Then src/types.ts exists in this layer
    And src/types.ts does not exist in the harness
    And the partition classifies schemas/types.ts as "core"

  @test:scripts/tests/adapter-layering.test.ts::the_core_types_still_satisfy_the_harness_minima::a_FeedbackItem_is_usable_wherever_a_TodoRef_is_required
  Scenario: A FeedbackItem is assignable to a TodoRef
    Given a FeedbackItem literal with id "todo-001", built without a cast
    When it is assigned to a TodoRef
    Then the file compiles and the reference's id is "todo-001"

  @test:scripts/tests/adapter-layering.test.ts::the_core_types_still_satisfy_the_harness_minima::a_PaperMacro_is_usable_wherever_a_MacroDef_is_required
  Scenario: A PaperMacro is assignable to a MacroDef
    Given a PaperMacro with a TeX macro and its unicode form
    When it is assigned to a MacroDef
    Then the definition's tex is the same macro

  @test:scripts/tests/adapter-layering.test.ts::the_core_types_still_satisfy_the_harness_minima::the_minima_stay_MINIMA_—_a_copy_of_the_core_model_is_the_defect
  Scenario: TodoRef stays a small structural minimum
    Given the source of src/content-types.ts
    When the fields of interface TodoRef are counted
    Then there are at most 4
