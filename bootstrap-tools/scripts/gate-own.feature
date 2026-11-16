Feature: Gate scoping — a layer's PR checks judge only the caller's own files
  iri:sync:check is tested with a planted stale IRI in a file of each side, so the gate is
  seen failing on the caller's own file and passing past another layer's.

  @test:scripts/gate-own.test.ts::gateOwnsFile:_a_file_is_the_caller's_when_its_deepest_instance_directory_is::unsetJudgesEverything
  Scenario: unset is undefined: judge everything
    Given no own-paths and no foreign-paths setting
    When it is asked whether "harness-layer/AGENTS.md" is the caller's
    Then the answer is undefined

  @test:scripts/gate-own.test.ts::gateOwnsFile:_a_file_is_the_caller's_when_its_deepest_instance_directory_is::layerRootOwnsOnlyItsDirectory
  Scenario: a layer root: its own directory is its own, a mounted layer's and the index's root files are not
    Given own paths "site-layer" and foreign paths "harness-layer,tools-layer"
    Then "site-layer/AGENTS.md" and "./site-layer/scripts/x.ts" are the caller's
    And "harness-layer/docs/guides/agent-onboarding.md" and "README.md" are not
    And "site-layer-extra/AGENTS.md" is not, because a prefix of a name is not containment

  @test:scripts/gate-own.test.ts::gateOwnsFile:_a_file_is_the_caller's_when_its_deepest_instance_directory_is::rootInstanceOwnsRootFilesOnly
  Scenario: an instance at the root owns the root's files but not a mounted layer under it
    Given own paths "." and foreign paths "harness-layer"
    Then "README.md" is the caller's
    And "harness-layer/AGENTS.md" is not

  @test:scripts/gate-own.test.ts::iri:sync:check_judges_only_the_caller's_own_files::unscopedFailsBothStaleFiles
  Scenario: unscoped, both stale files fail it, as before
    Given a git root with instances "own" (version 2.0.0) and "other", each holding a file that links "own" one major behind
    When iri:sync:check runs with no own-paths setting
    Then it exits 1
    And it names both "own/a.md" and "other/b.md"

  @test:scripts/gate-own.test.ts::iri:sync:check_judges_only_the_caller's_own_files::scopedChargesOnlyOwnStaleFile
  Scenario: scoped, the caller's own stale file still fails it; the other layer's is counted, not charged
    Given the same two instances
    When iri:sync:check runs with own paths "own" and foreign paths "other"
    Then it exits 1
    And it names "own/a.md" but not "other/b.md"
    And it reports "1 file(s) of other layers"

  @test:scripts/gate-own.test.ts::iri:sync:check_judges_only_the_caller's_own_files::scopedPassesWhenOwnFilesCurrent
  Scenario: scoped to a caller whose own files are current, it passes
    Given the same two instances
    When iri:sync:check runs with own paths "elsewhere" and foreign paths "own,other"
    Then it exits 0
    And it reports "2 file(s) of other layers"
