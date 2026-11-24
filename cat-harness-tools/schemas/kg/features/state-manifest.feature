# Specifies schemas/kg/state-manifest.ts (bean esz4): the state-manifest/v1
# schema of a state branch's manifest, keyed by tip or by route.
Feature: A state manifest records how its branch is keyed, seeded and kept

  @test:schemas/kg/state-manifest.test.ts::state-manifest/v1::a_tip-keyed_and_a_route-keyed_manifest_each_parse_as_their_own_shape
  Scenario: Tip-keyed and route-keyed manifests both parse
    Given an active tip-keyed manifest of the beans subgraph seeded from a main commit
    And a route-keyed seed manifest with its writer, gate and directories
    When each is parsed with the state manifest schema
    Then the first parses keyed by "tip" and the second keyed by "route"

  @test:schemas/kg/state-manifest.test.ts::state-manifest/v1::a_retired_branch_keeps_the_keys_that_record_WHY
  Scenario: A retired manifest keeps what superseded it
    Given the tip-keyed manifest marked retired, with retiredAt and supersededBy todos "cat/cat-harness/todos"
    When it is parsed
    Then its supersededBy is kept

  @test:schemas/kg/state-manifest.test.ts::state-manifest/v1::a_revision_expression_is_not_a_seed_commit_—_`<sha>^`_names_one_only_against_a_history
  Scenario: A revision expression is not a seed commit
    Given the tip-keyed manifest whose source sha is "<sha>^"
    When it is parsed
    Then it is refused

  @test:schemas/kg/state-manifest.test.ts::state-manifest/v1::a_route-keyed_manifest_without_its_writer_or_gate_is_refused_—_those_are_what_make_it_regenerable
  Scenario: A route-keyed manifest without its writer or its gate is refused
    Given the route-keyed manifest without its writer
    When it is parsed
    Then it is refused
    And the route-keyed manifest without its gate is refused too

  @test:schemas/kg/state-manifest.test.ts::state-manifest/v1::a_status_outside_the_four_is_refused
  Scenario: An unknown status is refused
    Given the tip-keyed manifest with status "live"
    When it is parsed
    Then it is refused
