# schemas/kg/index-config.ts and schemas/kg/cat-harness.ts let an index declare the gate exemptions
# of its own workflows, in the layer declaration's shape, kept by every rewrite. Each Scenario names the test that executes it.
Feature: An index's own gate exemptions

  @test:schemas/index-config-gate-exemptions.test.ts::an_index's_own_gate_exemptions::parse_in_the_shape_an_instance_declaration_uses
  Scenario: Gate exemptions parse in the shape an instance declaration uses
    Given a step exemption matching "bun run cat state:push -- --id health" of kind "ci-only" with a reason
    When it is parsed as an index config's gateExemptions and on its own by GateExemptionsSchema
    Then both parses succeed

  @test:schemas/index-config-gate-exemptions.test.ts::an_index's_own_gate_exemptions::are_refused_when_malformed_—_no_reason,_an_unknown_kind,_an_unknown_key
  Scenario: Malformed gate exemptions are refused
    Given gate exemptions with a blank reason, with the unknown kind "slow", and with an unknown key "extra"
    When each is parsed as an index config's gateExemptions
    Then each parse fails

  @test:schemas/index-config-gate-exemptions.test.ts::an_index's_own_gate_exemptions::survive_formatIndexConfig,_last,_and_are_absent_when_not_declared
  Scenario: Gate exemptions survive formatting, come last, and are absent when not declared
    Given an index config with a site landing and the step exemption
    When it is parsed and formatted with formatIndexConfig
    Then the formatted JSON carries the same gateExemptions
    And gateExemptions is its last key
    And an index config that declares none formats with no gateExemptions key

  @test:schemas/index-config-gate-exemptions.test.ts::a_file_a_gate's_allowlist_admits_(owner,_2026-10-16,_item_6b)::parses,_beside_steps_and_scripts
  Scenario: A file exemption parses alone and beside step exemptions
    # Gap: the title says "beside steps and scripts", but no script exemption is included.
    Given a file exemption for gate "check:structure-accessor" on "schemas/library-ref.ts" with a reason
    When it is parsed by GateExemptionsSchema alone and together with the step exemptions
    Then both parses succeed

  @test:schemas/index-config-gate-exemptions.test.ts::a_file_a_gate's_allowlist_admits_(owner,_2026-10-16,_item_6b)::is_refused_with_no_reason,_no_gate,_an_unknown_key,_or_a_path_outside_the_instance
  Scenario: A malformed file exemption is refused
    Given file exemptions with a blank reason, an empty gate, an unknown key, an absolute path "/abs/a.ts", and a climbing path "../up/a.ts"
    When each is parsed by GateExemptionsSchema
    Then each parse fails
