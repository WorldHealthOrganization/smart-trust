Feature: bootstrap's knowledge-graph-data-store contract, held against a git repository read through the git CLI

  Background:
    Given stores made as fresh git repositories, each holding its files in one commit by a fixed writer identity
    And a declaration whose bytes a reformatting would change, and instructions with mixed line endings

  @test:scripts/knowledge-graph-data-store.test.ts::1._serve_a_file_exactly_as_committed::servesDeclarationByteForByte
  Scenario: the declaration and the instructions at the predetermined path come back byte for byte
    Given a store holding demo.json and docs/bootstrap/initialization.md
    When both are read at HEAD
    Then each comes back byte for byte as committed

  @test:scripts/knowledge-graph-data-store.test.ts::1._serve_a_file_exactly_as_committed::readsAtRef
  Scenario: a read AT A REF returns what was committed there, not what came later
    Given a store holding demo.json, whose first commit is noted
    And a later commit that changes demo.json
    When demo.json is read at the first commit and at HEAD
    Then the first read returns the original bytes
    And the HEAD read returns the changed content

  @test:scripts/knowledge-graph-data-store.test.ts::1._serve_a_file_exactly_as_committed::servesListedFiles
  Scenario: the files the declaration lists are served under the same rule
    Given a store whose declaration lists a skills directory holding skills/x.md
    When skills/x.md is read at HEAD
    Then it comes back byte for byte as committed

  @test:scripts/knowledge-graph-data-store.test.ts::2._tell_absent_from_present::uncommittedPathAbsent
  Scenario: an uncommitted path is ABSENT — not an empty file, and not a read that merely failed
    Given a store holding demo.json and an empty empty.json
    Then empty.json is served as zero bytes
    And other.json is reported absent
    And asking git to show other.json fails with a message that it does not exist

  @test:scripts/knowledge-graph-data-store.test.ts::2._tell_absent_from_present::untrackedFileAbsent
  Scenario: a file on disk but never committed is absent from the store
    Given a store holding demo.json, and draft.json written to disk but not committed
    Then draft.json is reported absent

  @test:scripts/knowledge-graph-data-store.test.ts::2._tell_absent_from_present::absentVersusUnreadable
  Scenario: a reader is told absent and present-but-unreadable apart: initSteps says which
    Given a store "nothing" holding only a README
    When initSteps runs on it offline in a dry run
    Then its only step is declaration, whose detail says there is no <name>.json
    Given a store "broken" whose broken.json names itself but has directories that are not a list
    When initSteps runs on it offline in a dry run
    Then its only step is declaration, not-done, whose detail says it is not a Knowledge Graph declaration
    And that detail differs from the absent store's

  @test:scripts/knowledge-graph-data-store.test.ts::3._serve_siblings_the_same_way::readsSiblingNeeds
  Scenario: a `needs` entry is read from ../<name>/<name>.json, and its instructions from the predetermined path
    Given a store "demo" that needs "base", and a sibling store "base" holding base.json and its instructions
    Then base.json is served from the base store as committed
    When initSteps runs on demo offline in a dry run
    Then needs:base is done, with the base store's directory as its detail
    And instructions:base is stated

  @test:scripts/knowledge-graph-data-store.test.ts::3._serve_siblings_the_same_way::missingSiblingReported
  Scenario: a sibling that is not there is absent, and reported so — never skipped
    Given a store "demo" that needs "base", with no base beside it
    When initSteps runs on demo offline in a dry run
    Then needs:base is not-done, with a detail saying there is no base.json

  @test:scripts/knowledge-graph-data-store.test.ts::4._keep_what_is_written::committedDeclarationReadBack
  Scenario: a committed declaration is read back by a later reader, with who wrote it and when
    Given a store holding demo.json committed at 2026-10-20T09:00:00+00:00
    When a fresh clone of it is made
    Then the clone's demo.json is byte for byte the declaration
    And its history for demo.json is one commit by Writer, writer@example.org, at that instant
