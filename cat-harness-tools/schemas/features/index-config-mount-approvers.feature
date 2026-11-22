# schemas/kg/index-config.ts lets an index declare who may consent to its mounts (mountApprovers,
# folio-assistant#2389), kept with contentTypes by every rewrite. Each Scenario names the test that executes it.
Feature: An index's mount approvers

  @test:schemas/index-config-mount-approvers.test.ts::an_index's_mount_approvers::parse_as_a_non-empty_list_of_distinct_names
  Scenario: Mount approvers parse only as a non-empty list of distinct names
    Given an index config with mountApprovers ["litlfred"]
    Then it parses
    And mountApprovers of an empty list, a list holding "", a list with "a" twice, or the bare string "litlfred" each fail to parse

  @test:schemas/index-config-mount-approvers.test.ts::an_index's_mount_approvers::survive_formatIndexConfig,_with_contentTypes,_and_are_absent_when_not_declared
  Scenario: Mount approvers and content types survive formatting and are absent when not declared
    Given an index config with mountApprovers ["litlfred"] and a contentTypes section for "dak"
    When it is parsed and formatted with formatIndexConfig
    Then the formatted JSON keeps mountApprovers ["litlfred"]
    And it keeps the contentTypes section unchanged
    And an index config declaring neither formats with no mountApprovers and no contentTypes key
