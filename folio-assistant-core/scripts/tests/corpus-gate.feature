Feature: the gate on writes to the corpus

  @test:scripts/tests/corpus-gate.test.ts::what_the_gate_ignores::ignoresNonContent
  Scenario: non-content files are not its business
    When README, package.json and a source file are checked
    Then there are no findings

  @test:scripts/tests/corpus-gate.test.ts::what_the_gate_ignores::ignoresQaSidecar
  Scenario: a .qa.json is machine-written by the sweep and is not a corpus write
    When a block's .qa.json is checked
    Then there are no findings

  @test:scripts/tests/corpus-gate.test.ts::what_the_gate_ignores::skipsNonManifestTs
  Scenario: a .ts that is not a block manifest is skipped
    When a .ts that is not a block manifest is checked
    Then there are no findings

  @test:scripts/tests/corpus-gate.test.ts::refusing_by_default::noInstanceRefused
  Scenario: a block with no instance is refused, and told how to start one
    When a block with no workflow instance is checked
    Then it is refused, naming its label and how to start one

  @test:scripts/tests/corpus-gate.test.ts::refusing_by_default::beforeDecisionRefused
  Scenario: an instance that has not reached the editor's decision is refused
    When a block whose instance has not reached the editor's decision is checked
    Then it is refused as not enabled

  @test:scripts/tests/corpus-gate.test.ts::refusing_by_default::discardNeverAuthorises
  Scenario: a discarded change never authorises a write
    When a block whose change was discarded is checked
    Then it is refused

  @test:scripts/tests/corpus-gate.test.ts::allowing_what_the_process_authorised::acceptedAllowed
  Scenario: a block whose editor accepted the change is allowed
    When a block whose editor accepted the change is checked
    Then it is allowed, naming its instance

  @test:scripts/tests/corpus-gate.test.ts::allowing_what_the_process_authorised::alreadyCommittedAllowed
  Scenario: a block already committed in an earlier round stays allowed
    When a block committed in an earlier round is checked
    Then it is allowed as already recorded

  @test:scripts/tests/corpus-gate.test.ts::allowing_what_the_process_authorised::siblingMdOnce
  Scenario: a sibling .md is checked against its block, and reported once
    When a block and its sibling .md are checked
    Then there is one finding, allowed

  @test:scripts/tests/corpus-gate.test.ts::it_does_not_fail_open::unknownIdentityRefused
  Scenario: a manifest whose identity cannot be established is refused
    When a manifest whose identity cannot be established is checked
    Then it is refused saying the gate does not fail open

  @test:scripts/tests/corpus-gate.test.ts::it_does_not_fail_open::unloadablePolicyStops
  Scenario: an unloadable workflow policy stops the gate rather than emptying it
    When the workflow policy is not loadable
    Then the gate throws rather than passing
