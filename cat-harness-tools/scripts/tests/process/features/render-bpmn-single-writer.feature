# One writer for the SVGs drawn beside their .bpmn: the platform renderer
# calls bootstrap-tools' own besideSource rather than re-implementing it, and
# every committed beside-source SVG in bootstrap/processes keeps the
# generated-by note.
Feature: The beside-source SVGs have one writer, and keep its provenance note

  @test:scripts/tests/process/render-bpmn-single-writer.test.ts::the_platform_renderer_delegates_beside-source_SVGs_(bean_gm9g)::it_imports_bootstrap-tools'_own_besideSource
  Scenario: The platform renderer imports and calls bootstrap-tools' besideSource
    Given the source of scripts/render-bpmn.ts
    When it is read
    Then it imports besideSource as besideSourceSvg from "@litlfred/bootstrap-tools/scripts/render-bpmn.ts"
    And it calls besideSourceSvg(renderer, file, processPath)

  @test:scripts/tests/process/render-bpmn-single-writer.test.ts::the_platform_renderer_delegates_beside-source_SVGs_(bean_gm9g)::every_diagram_gets_a_copy_beside_its_source,_not_only_an_exempt_layer's_(bean_akiq)
  Scenario: The beside-source set is every source diagram
    # Gap: the title claims every diagram gets a copy; the body only checks the source text declares `const besideSource = new Set(sources);`, it renders nothing
    Given the source of scripts/render-bpmn.ts
    When it is read
    Then it contains "const besideSource = new Set(sources);"

  @test:scripts/tests/process/render-bpmn-single-writer.test.ts::the_platform_renderer_delegates_beside-source_SVGs_(bean_gm9g)::it_does_not_carry_its_own_copy_of_the_beside-source_writer
  Scenario: The platform renderer does not call its old siblingLinks writer
    # Gap: the title claims no copy of the writer; the body only checks no call to `siblingLinks(` appears, so a copy under another name would pass
    Given the source of scripts/render-bpmn.ts
    When it is read
    Then it contains no call to siblingLinks(

  @test:scripts/tests/process/render-bpmn-single-writer.test.ts::every_committed_beside-source_SVG_keeps_its_provenance_note_(bean_gm9g)::there_are_SVGs_to_check_—_the_bootstrap_submodule_is_checked_out
  Scenario: There are committed SVGs in bootstrap/processes
    Given the bootstrap/processes directory of the checkout
    When its .svg files are listed
    Then there is at least one

  @test:scripts/tests/process/render-bpmn-single-writer.test.ts::every_committed_beside-source_SVG_keeps_its_provenance_note_(bean_gm9g)::%s_says_the_bootstrap_toolset_generated_it
  Scenario: Every committed beside-source SVG carries the generated-by note
    Given each .svg file in bootstrap/processes
    When its first three lines are read
    Then they contain bootstrap-tools' GENERATED_BY note
