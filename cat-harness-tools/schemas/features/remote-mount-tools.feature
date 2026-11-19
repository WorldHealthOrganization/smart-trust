# The "tools" field of a remote mount's per-instance override in schemas/kg/remote-mount.ts, which picks Tools by id for a runnable mount.
# Each Scenario names the test that executes it.
Feature: Tools chosen by id in a remote mount override

  @test:schemas/remote-mount-tools.test.ts::MountOverrideSchema.tools::names_Tools_by_id,_beside_the_other_override_fields
  Scenario: An override names Tools by id alongside its other fields
    Given an override naming the tools "bean-query" and "agent-memory" and the directory "skills"
    When it is parsed
    Then its tools are "bean-query" and "agent-memory"
    And a remote mount whose "cat-harness" override names the tool "bpmn-checklist" parses with that tool kept

  @test:schemas/remote-mount-tools.test.ts::MountOverrideSchema.tools::refuses_an_id_that_is_not_a_Tool_id,_an_id_named_twice,_and_an_empty_list
  Scenario: An override refuses a malformed Tool id, a repeated id, and an empty list
    When an override naming the tool "Bean_Query" is parsed, it is refused
    And an override naming "tools/bean-query" is refused
    And an override naming "bean-query" twice is refused
    And an override with an empty tools list is refused
