Feature: The DAK adapter's automated QA checkers
  The dak-scoped QA criteria smart-base contributes: companion presence, BPMN
  and DMN content, FSH kind and label prefix agreement, their registration,
  and the exemption of generated artefacts.

  Background:
    Given fixture block manifests and companion files in a temporary directory

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::companionPassesWhenPresent
  Scenario: passes when the artefact is there
    Given a decision-table manifest with its .dmn
    Then dak-companion-present passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::companionFailsWhenMissing
  Scenario: fails a manifest with no artefact — the case depends_on could not express
    Given a CQL library manifest with no companion
    Then dak-companion-present fails, with a hit saying "no .cql companion"

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::companionIgnoresPaperBlock
  Scenario: ignores a paper block entirely
    Given a theorem manifest
    Then dak-companion-present passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::companionCriterionDependsOnTsOnly
  Scenario: the criterion does NOT depend on the artefact it looks for
    Given the registered criterion dak-companion-present
    Then it depends on "ts" only
    And it is also invalidated by "dmn"

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::requiredCompanionRolesCheckable
  Scenario: every kind with a required companion is one this can check
    Then every required companion role is one of the companion roles
    And the dak adapter's companion roles in the registry include it

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::workbookBackedKindsNeedNoCompanion
  Scenario: workbook-backed kinds require no companion — measured, not overlooked
    Then no workbook-backed kind has a required companion
    And "decision-table" is workbook-backed

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::nakedDecisionTableNotFlagged
  Scenario: a decision-table with no artefact is NOT flagged
    Given a decision-table manifest with no .dmn
    Then dak-companion-present passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-companion-present::nakedBusinessProcessFlagged
  Scenario: a business-process with no .bpmn IS flagged — one file per process
    Given a business-process manifest with no .bpmn
    Then dak-companion-present fails, with a hit saying "no .bpmn companion"

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-bpmn-has-process::bpmnPassesNamespacedProcess
  Scenario: passes a namespaced <bpmn:process>
    Given a .bpmn holding a bpmn:process
    Then dak-bpmn-has-process passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-bpmn-has-process::bpmnFailsDefinitionsShell
  Scenario: fails a definitions shell
    Given a .bpmn holding only empty bpmn:definitions
    Then dak-bpmn-has-process fails, with a hit saying "no <process>"

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-bpmn-has-process::bpmnAbsentPasses
  Scenario: no .bpmn is not this checker's business — the gate handles that
    Given no .bpmn
    Then dak-bpmn-has-process passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-dmn-has-decision-table::dmnPassesDecisionWithTable
  Scenario: passes a decision carrying a table
    Given a .dmn whose decision holds a decisionTable
    Then dak-dmn-has-decision-table passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-dmn-has-decision-table::dmnFailsWithoutDecision
  Scenario: fails logic that expresses no decision
    Given a .dmn holding only empty definitions
    Then dak-dmn-has-decision-table fails, with a hit saying "no <decision>"

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-fsh-declares-kind::fshPassesWhenKindAgrees
  Scenario: passes when kind and FSH declaration agree
    Given a value-set manifest whose FSH declares a ValueSet
    Then dak-fsh-declares-kind passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-fsh-declares-kind::fshFailsValueSetDeclaringProfile
  Scenario: fails a value-set block whose FSH declares a Profile
    Given a value-set manifest whose FSH declares a Profile
    Then dak-fsh-declares-kind fails

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-label-prefix-matches-kind::labelPassesCorrectPrefix
  Scenario: passes a correctly-prefixed label
    Given a decision-table manifest labelled "dt:good"
    Then dak-label-prefix-matches-kind passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-label-prefix-matches-kind::labelFailsWrongPrefix
  Scenario: fails a manifest hand-edited past its builder's validation
    Given a decision-table manifest labelled "vs:mislabelled"
    Then dak-label-prefix-matches-kind fails, with a hit saying 'must start with "dt:"'

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::dak-label-prefix-matches-kind::labelIgnoresPaperBlock
  Scenario: leaves paper blocks alone
    Given a theorem manifest
    Then dak-label-prefix-matches-kind passes

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::registration::everyDakCriterionHasChecker
  Scenario: every DAK criterion has a checker and vice versa
    Then the registered dak-domain criteria are exactly the keys of the DAK automated checkers

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::registration::dakCriteriaScopedAutomatedContributed
  Scenario: all of them are dak-scoped, automated, and answered by smart-base
    Then every dak-domain criterion's adapters are exactly "dak", it is automated and its checker is contributed
    And the registry's checker entry for it is labelled "smart-base/pipeline/qa-checkers-dak.ts" and is the DAK checker of that id

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::registration::noDakCriterionNeedsImpossibleCompanion
  Scenario: no DAK criterion depends on a companion a DAK block cannot have
    Then no dak-domain criterion has an incompatible companion in the registry

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::generated_artefacts_are_not_judged_as_authored_content::detectsGeneratedMarkers
  Scenario: detects WHO's row-provenance marker
    Then an FSH file marked "generated from row 73" is a generated artefact
    And an FSH file described "Autogenerated from DAK artifacts" is a generated artefact

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::generated_artefacts_are_not_judged_as_authored_content::authoredNotMistakenForGenerated
  Scenario: an authored artefact is not mistaken for generated
    Then an FSH file with no marker is not generated
    And no file is not generated

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::generated_artefacts_are_not_judged_as_authored_content::generatedFileYieldsNotApplicable
  Scenario: a generated file yields n/a with a reason, not a fail
    Given a value-set manifest whose generated FSH declares a Profile
    Then dak-fsh-declares-kind is "n/a", noting "generated from an L2 source"

  @test:smart-base/pipeline/qa-checkers-dak.test.ts::generated_artefacts_are_not_judged_as_authored_content::authoredMismatchFlagged
  Scenario: the same mismatch IS flagged when the file is authored
    Given a value-set manifest whose authored FSH declares a Profile
    Then dak-fsh-declares-kind fails
