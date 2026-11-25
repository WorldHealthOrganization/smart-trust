# scripts/lib/process-definers.ts maps each process id to the files that define it, and resolves
# a referrer's link to the nearest definer, so two layers defining one id each keep their own.
# Each Scenario names the test that executes it.
Feature: Resolving a process id to its nearest definer

  @test:scripts/tests/process/process-definers.test.ts::nearestDefiner::a_definer_refers_to_itself
  Scenario: A definer of a process resolves to itself
    Given two layers' files each defining "Process_Publication"
    When each definer file looks up "Process_Publication"
    Then each resolves to its own file

  @test:scripts/tests/process/process-definers.test.ts::nearestDefiner::equally_near_definers_fall_back_to_the_first_path,_deterministically
  Scenario: Equally near definers fall back to the first path in sorted order
    Given two layers' files each defining "Process_Publication", read in reverse order
    When a file in a third directory looks it up
    Then it resolves to the first of the two definer paths sorted

  @test:scripts/tests/process/process-definers.test.ts::nearestDefiner::an_unknown_id_resolves_to_nothing
  Scenario: An id no file defines resolves to nothing
    Given one file defining "Process_Publication"
    When "Nope" is looked up
    Then nothing is returned

  @test:scripts/tests/process/process-definers.test.ts::render-bpmn_resolves_every_link_per_referrer,_not_from_one_last-wins_map
  Scenario: render-bpmn resolves every link per referrer, not from one last-wins map
    # Gap: a source-text check of scripts/render-bpmn.ts; no diagram is rendered
    Given the source of scripts/render-bpmn.ts
    Then it passes each file its own definers when rendering beside the source SVG
    And it resolves called processes with the nearest definer for the calling file
    And it no longer names processHome, processPath or a processFile map

  @test:scripts/tests/process/process-definers.test.ts::nearestDefiner::each_referrer_resolves_to_its_own_layer's_definer_(read_order_%s)
  Scenario: Each referrer resolves to its own layer's definer, whatever the read order
    Given layer-a and layer-b each define "Process_Publication" and each have a caller file
    And the four files are read in the row's order
    When the definers are built
    Then both definer files are recorded for "Process_Publication", sorted
    And the nearest definer for each caller is its own layer's file
    And the definers from each caller map "Process_Publication" to its own layer's file
    # Rows: "layer-a,layer-b,layer-a,layer-b" and "layer-b,layer-a,layer-b,layer-a"
