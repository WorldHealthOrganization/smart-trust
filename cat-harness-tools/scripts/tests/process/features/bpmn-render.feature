# Plane stripping before a bpmn-js import: a BPMN file may carry one plane per
# drilled-into sub-process, which a plain Viewer cannot import. Only the first
# plane is kept and the rest are counted. And the SVG file name for each
# rendered diagram.
Feature: Rendering keeps the primary BPMN plane and names each SVG safely

  @test:scripts/tests/process/bpmn-render.test.ts::keepPrimaryPlane::a_single-plane_file_is_returned_untouched
  Scenario: A single-plane file is returned untouched
    Given a definitions document holding one BPMNDiagram
    When keepPrimaryPlane is applied
    Then the stripped count is 0
    And the XML is unchanged

  @test:scripts/tests/process/bpmn-render.test.ts::keepPrimaryPlane::a_file_with_no_diagram_at_all_is_untouched
  Scenario: A file with no diagram is returned untouched
    Given a definitions document holding a process and no BPMNDiagram
    When keepPrimaryPlane is applied
    Then the result is the same XML with a stripped count of 0

  @test:scripts/tests/process/bpmn-render.test.ts::keepPrimaryPlane::keeps_the_first_plane_and_counts_the_rest
  Scenario: The first plane is kept and the rest are counted
    Given a definitions document holding diagrams D1, D2 and D3
    When keepPrimaryPlane is applied
    Then the stripped count is 2
    And the XML still contains D1 but neither D2 nor D3

  @test:scripts/tests/process/bpmn-render.test.ts::keepPrimaryPlane::the_document_stays_well-formed_—_the_closing_tag_survives
  Scenario: The closing definitions tag survives stripping
    Given a definitions document holding diagrams D1 and D2
    When keepPrimaryPlane is applied
    Then the XML still ends with "</definitions>"

  @test:scripts/tests/process/bpmn-render.test.ts::keepPrimaryPlane::process_content_before_the_diagrams_is_preserved
  Scenario: Process content before the diagrams is preserved
    Given a definitions document holding a process with a task, then diagrams D1 and D2
    When keepPrimaryPlane is applied
    Then the XML still contains the task element

  @test:scripts/tests/process/bpmn-render.test.ts::keepPrimaryPlane::works_with_an_unprefixed_BPMNDiagram
  Scenario: A single unprefixed BPMNDiagram is not stripped
    # Gap: the title claims the unprefixed form is matched; with one diagram a stripped count of 0 is also what an unmatched (zero-diagram) file gives, so the body cannot tell the two apart
    Given a definitions document holding one unprefixed BPMNDiagram
    When keepPrimaryPlane is applied
    Then the stripped count is 0

  @test:scripts/tests/process/bpmn-render.test.ts::svgName::a_sole_diagram_is_named_for_its_file
  Scenario: A sole diagram's SVG is named for its file
    Given the file "/x/IMMZ.A.Foo.bpmn" with its only diagram "Diagram_1"
    When its SVG name is computed
    Then it is "IMMZ.A.Foo.svg"

  @test:scripts/tests/process/bpmn-render.test.ts::svgName::multiple_diagrams_are_distinguished_by_id
  Scenario: One of several diagrams is named with its id
    Given the file "/x/IMMZ.A.Foo.bpmn" with diagram "Diagram_1" among several
    When its SVG name is computed
    Then it is "IMMZ.A.Foo__Diagram_1.svg"

  @test:scripts/tests/process/bpmn-render.test.ts::svgName::spaces_in_a_WHO_filename_become_safe
  Scenario: Spaces in a file name become hyphens
    Given the file "/x/Workflow D_ admin.bpmn" with its only diagram
    When its SVG name is computed
    Then it is "Workflow-D_-admin.svg"
