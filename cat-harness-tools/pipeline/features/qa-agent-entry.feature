# pipeline/qa-agent-entry.ts records one agent QA verdict for a block: a fail or
# warn must carry evidence, and the entry hashes every sibling file, the .lean
# included. Each Scenario names the test that executes it.
Feature: Agent QA verdict entries

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_evidence_guard::a_%s_verdict::without_--evidence_is_refused,_and_writes_nothing
  Scenario: A fail or warn verdict without evidence is refused
    Given a content repository with one block "blk.md"
    When a "fail" or "warn" verdict for criterion "da-overclaim" is recorded with no --evidence
    Then the command exits with code 2
    And stderr says "requires --evidence"
    And no QA file is written

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_evidence_guard::a_%s_verdict::with_whitespace-only_--evidence_is_refused
  Scenario: A fail or warn verdict with whitespace-only evidence is refused
    Given a content repository with one block "blk.md"
    When a "fail" or "warn" verdict is recorded with the evidence "   "
    Then the command exits with code 2
    And no QA file is written

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_evidence_guard::a_%s_verdict::with_evidence_is_accepted_and_recorded
  Scenario: A fail or warn verdict with evidence is recorded
    Given a content repository with one block "blk.md"
    When a "fail" or "warn" verdict is recorded with evidence mentioning "float64"
    Then the command exits with code 0
    And the latest "da-overclaim" entry's evidence contains "float64"

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_evidence_guard::%s_without_--evidence_still_succeeds
  Scenario: A pass or n/a verdict needs no evidence
    Given a content repository with one block "blk.md"
    When a "pass" or "n/a" verdict is recorded with no --evidence
    Then the command exits with code 0
    And the latest entry has that result and no evidence

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_field_hash::hashes_every_sibling_that_exists,_the_.lean_included
  Scenario: The entry hashes the .md, .ts and .lean siblings
    Given a block with .md, .ts and .lean files
    When a "pass" verdict is recorded
    Then the command exits with code 0
    And the entry's field hash has "md", "ts" and "lean" values

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_field_hash::omits_the_lean_keys_when_there_is_no_Lean
  Scenario: With no .lean the Lean hash keys are absent
    Given a block with .md and .ts files only
    When a "pass" verdict is recorded
    Then the command exits with code 0
    And the field hash has neither a "lean" nor a "lean_statement" key

  @test:pipeline/qa-agent-entry.test.ts::qa-agent-entry_field_hash::the_lean_hash_tracks_the_.lean_content,_not_its_existence
  Scenario: The Lean hash changes when the .lean content changes
    Given a block with .md and .lean files and a recorded "pass" verdict
    When the .lean content is changed and a "pass" verdict is recorded again
    Then the new Lean hash is defined
    And it differs from the earlier one
