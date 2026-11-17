# Writer records published to a git ref, and the gate that judges them
# (cat-harness-tools#1702). Each Scenario names the test that executes it.
Feature: Writer records on a git ref

  @test:scripts/tests/writer-records-ref.test.ts::publishRefusal::refuses_no_records,_another_commit's_records,_and_a_record_whose_outputs_entry_is_missing
  Scenario: Publishing refuses bad records
    Given records of commit "abc" for writer "w" and a writer carried from "older", each with an outputs entry
    Then publishing no records is refused with "no records"
    And publishing them as commit "def" is refused with "not of def"
    And publishing them as "abc" is accepted
    And a writer whose outputs entry is missing is refused with "no outputs entry for ghost"

  @test:scripts/tests/writer-records-ref.test.ts::refsToPrune::keeps_main_and_the_refs_of_the_newest_commits
  Scenario: Pruning keeps main and the newest refs
    Given refs for main and commits a, b and c, with c newest then a
    Then keeping 1 prunes a and b
    And keeping 2 prunes b

  @test:scripts/tests/writer-records-ref.test.ts::publish_and_fetch_through_a_ref::a_published_commit's_ref_is_found_first,_then_main's;_nothing_found_is_no_records
  Scenario: Records are fetched from the commit's ref, then main's
    Given records of "abc" committed and pushed to a bare remote under abc's ref and main's ref
    When a reader fetches records for "abc"
    Then it finds abc's ref, writes records.json of sha "abc" and the writer's outputs manifest
    And fetching for "nope" falls back to main's ref
    And against an empty remote with the refs deleted it finds none

  @test:scripts/tests/writer-records-ref.test.ts::the_gate_on_published_records::red_on_a_writer_that_would_have_been_served_stale,_green_otherwise,_skipped_with_no_records
  Scenario: The gate is red on a stale writer
    Then a skip-unsafe writer makes the gate exit 1, naming "w (out/a.html)"
    And only skip-safe writers exit 0
    And no records gives a gate skipped as "none"

  @test:scripts/tests/writer-records-ref.test.ts::the_gate_on_published_records::merges_into_the_derive:publish_record_beside_its_own_entry
  Scenario: The gate merges into the derive:publish record
    Given a derive:publish record with its own entry
    When the gate entry is merged in
    Then both entries are present
    And merging into a new file creates it holding the gate entry
