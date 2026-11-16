# A QA verdict's date is derived from the tree it reviewed (owner ruling
# 2026-11-06), falling back to a legacy entry's own reviewed_at. Each Scenario
# names the test that executes it.
Feature: A QA verdict is dated by the tree it reviewed

  @test:scripts/tests/qa-entry-date.test.ts::entryDate::the_tree's_commit_date_wins_over_the_entry's_own
  Scenario: The tree's commit date wins over the entry's own
    Given an entry reviewing tree A with reviewed_at 2020-01-01, and tree A committed 2026-11-06T04:00
    Then its date is 2026-11-06T04:00:00Z

  @test:scripts/tests/qa-entry-date.test.ts::entryDate::a_legacy_entry_keeps_its_own_date;_with_neither_there_is_none,_never_now
  Scenario: A legacy entry keeps its own date, and with neither there is none
    Then an entry with only reviewed_at 2026-06-12 is dated 2026-06-12T00:00:00Z
    And an entry whose tree has no known commit date has no date

  @test:scripts/tests/qa-entry-date.test.ts::newestFirst::orders_by_the_derived_date,_and_by_position_(list[0]_leads)_otherwise
  Scenario: Newest first orders by derived date, then by position
    Given entries old (tree dated 11-01), fresh (tree dated 11-05), and u1 and u2 with undated trees
    When they are ordered newest first
    Then the order is fresh, old, u1, u2
