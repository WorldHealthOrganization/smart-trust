Feature: kg:processes and kg:files — an instance's README sections drawn from its own declaration

  Background:
    Given a temporary instance "Demo" declaring processes, skills and a test/results directory, with a README asset described "Start here. Then read on."
    And processes Main (calling Sub, with a task bound to skill do-it) and Sub (calling the shared global task GT_Shared bound to skill share-it)
    And two result files under test/results/kg-qa

  @test:scripts/readme-graph-sections.test.ts::kg:processes::entryProcessFirst
  Scenario: entry process first, each with its picture and who starts it
    Given the instance with a picture beside each process diagram
    When the processes section is rendered
    Then Main comes before Sub
    And Main is described as the one you start, which calls "Sub"
    And Sub is described as started from "Main"
    And Main's picture processes/main.svg is shown

  @test:scripts/readme-graph-sections.test.ts::kg:processes::noPictureLeavesRegion
  Scenario: a diagram with no picture leaves the region untouched, never a broken image
    Given the instance without pictures
    When the processes section is rendered
    Then it is skipped
    And its notes mention render:bpmn

  @test:scripts/readme-graph-sections.test.ts::kg:processes::noDeclarationUndetermined
  Scenario: no declaration is undetermined, not 'no Processes'
    Given an empty directory with no declaration
    Then both the processes section and the files section are skipped

  @test:scripts/readme-graph-sections.test.ts::kg:files::assetsAndDeclarationFirst
  Scenario: assets and the declaration sit at the top
    When the files section is rendered for the instance with pictures
    Then it has a row for README.md described "Start here."
    And a row for demo.json described "Demo"

  @test:scripts/readme-graph-sections.test.ts::kg:files::filesDescribedFromThemselves
  Scenario: each file described from itself; used-by only from a recorded relation
    When the files section is rendered for the instance with pictures
    Then do-it.md is described "Does it." and used by "Main"
    And sub.bpmn is "a Process: Sub" used by "Main"
    And main.bpmn is "a Process: Main" with no user
    And its picture is described as the picture of `main.bpmn`, generated from it

  @test:scripts/readme-graph-sections.test.ts::kg:files::globalTaskSkillUsedBy
  Scenario: a global task's Skill is used by the processes that call it; its file says what it holds
    When the files section is rendered for the instance with pictures
    Then share-it.md is described "Shares it." and used by "Sub"
    And global-tasks.bpmn is described as 1 global task, the steps several Processes share

  @test:scripts/readme-graph-sections.test.ts::kg:files::headingUsesFirstSentence
  Scenario: directory heading uses the first sentence of its description
    When the files section is rendered for the instance with pictures
    Then the processes/ directory heading reads "The diagrams."

  @test:scripts/readme-graph-sections.test.ts::kg:files::resultsTreeCollapses
  Scenario: a results tree collapses to one row with its count
    When the files section is rendered for the instance with pictures
    Then test/results/ is one row reading "2 files, in subdirectories"
    And kg-qa/a.json is not listed

  @test:scripts/readme-graph-sections.test.ts::firstSentenceDropsBold
  Scenario: firstSentence stops at the first sentence and drops bold
    Then the first sentence of "**Bold** start. Second." is "Bold start."
