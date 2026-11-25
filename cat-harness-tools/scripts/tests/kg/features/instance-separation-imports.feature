# What scripts/tests/kg/instance-separation-imports.test.ts covers: a layer staged here ahead of moving to its own
# repository reaches the platform only through its platform.ts shim, and that shim reaches only the layers it needs.
# Each Scenario names the test that executes it.
Feature: Staged layers reach the platform only through platform.ts

  @test:scripts/tests/kg/instance-separation-imports.test.ts::staged_instances_reach_the_platform_only_through_platform.ts::every_exempted_name_is_a_staged_instance_(no_list_exempts_nothing)
  Scenario: Every exempted layer name is a staged layer
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given the staged layers, whose declarations name a repository other than where they live
    When the platform, not-yet-shimmed and shim-beyond-needs lists are read
    Then every name they list is a staged layer
    And no not-yet-shimmed name is also a platform layer

  @test:scripts/tests/kg/instance-separation-imports.test.ts::staged_instances_reach_the_platform_only_through_platform.ts::staged_instances_route_through_a_shim
  Scenario: Covered staged layers with code have a platform.ts shim
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given every covered staged layer that has git-tracked code files
    When its directory is looked in
    Then it holds a "platform.ts"

  @test:scripts/tests/kg/instance-separation-imports.test.ts::staged_instances_reach_the_platform_only_through_platform.ts::in_every_covered_instance,_no_file_but_platform.ts_imports_from_outside_it
  Scenario: No file but platform.ts in a covered layer imports from outside it
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given every covered staged layer not listed as not yet shimmed
    When each code file's relative imports are resolved
    Then none outside platform.ts resolves outside the layer

  @test:scripts/tests/kg/instance-separation-imports.test.ts::staged_instances_reach_the_platform_only_through_platform.ts::a_not-yet-shimmed_instance_never_gains_a_climb
  Scenario: A not-yet-shimmed layer never gains a climb over its ceiling
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    # Gap: the not-yet-shimmed list is currently empty, so no layer is checked
    Given each not-yet-shimmed layer with its climb ceiling
    When its climbs out of the layer are counted
    Then the count is not over the ceiling
    And it is not zero, else the layer should leave the list

  @test:scripts/tests/kg/instance-separation-imports.test.ts::staged_instances_reach_the_platform_only_through_platform.ts::every_shim_reaches_only_the_instances_its_declaration_needs
  Scenario: Every shim reaches only the layers its declaration needs
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    Given every covered staged layer not listed as beyond its needs
    When its platform.ts relative imports are resolved
    Then each lands inside the layer or a layer its declaration needs

  @test:scripts/tests/kg/instance-separation-imports.test.ts::staged_instances_reach_the_platform_only_through_platform.ts::an_instance_over_the_needs_line_never_gains_a_climb_past_it
  Scenario: A layer over the needs line never gains a climb past it
    # Skipped: unless run inside the aggregate checkout (inAggregate())
    # Gap: the shim-beyond-needs list is currently empty, so no layer is checked
    Given each layer listed with a beyond-needs ceiling
    When its shim's climbs beyond its needs are counted
    Then the count is not over the ceiling
