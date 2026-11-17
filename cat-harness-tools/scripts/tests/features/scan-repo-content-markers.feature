# The markers section of scan-repo-content: what a harness could declare, and
# whether it already does. Each Scenario names the test that executes it.
Feature: Repository content markers

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::with_no_index.config.json,_every_finding_is_`unknown`,_never_`not-declared`
  Scenario: With no index config every finding is unknown
    Given a repository with IG files and a BPMN file but no index.config.json
    When its markers are scanned
    Then the index is "absent"
    And there is at least one finding and every finding's declared state is "unknown"

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::sushi-config.yaml_suggests_contentTypes.ig_with_an_include_list_of_the_paths_present
  Scenario: sushi-config.yaml suggests an IG content type
    Given a repository with sushi-config.yaml, input/fsh and input/pagecontent, and an index declaring no content types
    When its markers are scanned
    Then the "ig" finding targets contentTypes and is "not-declared"
    And it suggests ig.include of sushi-config.yaml, input/fsh/ and input/pagecontent/

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::a_declared_section_reads_`declared`,_and_the_scan_writes_nothing
  Scenario: A declared section reads declared and nothing is written
    Given an index that already declares contentTypes.ig
    When its markers are scanned
    Then the "ig" finding is "declared"
    And index.config.json is unchanged

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::a_legacy_dak.json_suggests_contentTypes.dak_with_its_scalar_fields
  Scenario: A legacy dak.json suggests contentTypes.dak with its scalar fields
    Given a dak.json with id, name and a nested object
    When its markers are scanned
    Then the "dak" suggestion holds only id and name

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::directories_are_checked_against_the_local_instance's_declaration
  Scenario: Directories are checked against the local instance's declaration
    Given an index naming a local instance "demo" that declares a library directory
    And files under library/, uploads/, processes/conduct/ and a .beans.yml
    When its markers are scanned
    Then library is "declared" and uploads is "not-declared"
    And uploads suggests a directory entry at demo.json#directories with path uploads/
    And processes suggests path processes/
    And the beans finding's paths are [".beans.yml"]

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::an_unreadable_index_is_its_own_state
  Scenario: An unreadable index is its own state
    Given an index.config.json that is not valid JSON
    When its markers are scanned
    Then the index is "unreadable"
    And the formatted report says "unknown"

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::Lean_and_folio_manifests_suggest_an_instance_contentType
  Scenario: Lean and folio manifests suggest an instance content type
    Given a lakefile.lean and folio manifests
    When its markers are scanned
    Then the findings include contentType:paper and contentType:document

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanMarkers::build_output_and_node_modules_are_never_evidence
  Scenario: Build output and node_modules are never evidence
    Given BPMN files only under node_modules and fsh-generated
    When its markers are scanned
    Then there are no findings

  @test:scripts/tests/scan-repo-content-markers.test.ts::declarableDirs::anchors_on_the_nearest_`processes`_directory_and_collapses_nested_ones
  Scenario: Declarable directories anchor on the nearest processes directory
    Given BPMN files at a/processes/x/1.bpmn, a/processes/2.bpmn and b/3.bpmn
    When the declarable processes directories are computed
    Then they are "b/" and "a/processes/"

  @test:scripts/tests/scan-repo-content-markers.test.ts::scanRepo_carries_markers::the_full_scan's_JSON_has_a_markers_section
  Scenario: The full repository scan carries markers
    Given a repository with IG files and an empty index
    When the repository is scanned
    Then its markers include an "ig" finding
