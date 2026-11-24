Feature: when a materialized copy was last read

  @test:scripts/tests/materialization-last-read.test.ts::MaterializationSchema_with_and_without_lastReadAt::validatesWithoutLastRead
  Scenario: validates without lastReadAt
    When a working record without lastReadAt is validated
    Then it is accepted with no lastReadAt

  @test:scripts/tests/materialization-last-read.test.ts::MaterializationSchema_with_and_without_lastReadAt::validatesWithLastRead
  Scenario: validates with valid lastReadAt string
    When a working record with an ISO lastReadAt is validated
    Then it is accepted with that lastReadAt

  @test:scripts/tests/materialization-last-read.test.ts::MaterializationSchema_with_and_without_lastReadAt::rejectsEmptyLastRead
  Scenario: rejects empty lastReadAt string
    When a record with an empty lastReadAt is validated
    Then it is refused

  @test:scripts/tests/materialization-last-read.test.ts::touchMaterializedRead_and_recordMaterializationRead::touchSetsIsoNow
  Scenario: touchMaterializedRead updates lastReadAt with ISO 8601 string
    When a record is touched as read
    Then lastReadAt is an ISO 8601 string between before and after
    And the rest of the record is unchanged

  @test:scripts/tests/materialization-last-read.test.ts::touchMaterializedRead_and_recordMaterializationRead::recordAcceptsDate
  Scenario: recordMaterializationRead accepts explicit Date
    When a read is recorded at an explicit date
    Then lastReadAt is that date

  @test:scripts/tests/materialization-last-read.test.ts::touchMaterializedRead_and_recordMaterializationRead::touchAndRecordAliases
  Scenario: touchMaterializedRead and recordMaterializationRead are aliases
    When the two functions are compared
    Then they are the same function

  @test:scripts/tests/materialization-last-read.test.ts::cacheRows()_populates_lastReadAt::cacheRowsReadLastRead
  Scenario: reads lastReadAt when present and preserves undefined when absent
    When cache rows are made from records with and without lastReadAt
    Then the first row carries it and the second has none

  @test:scripts/tests/materialization-last-read.test.ts::eviction_candidate_ranking_accounts_for_lastReadAt::leastRecentlyReadFirst
  Scenario: least recently read copies prioritized for eviction over more recently read copies
    When an older-read small copy and a newer-read large copy are ranked for eviction
    Then the older-read one comes first

  @test:scripts/tests/materialization-last-read.test.ts::eviction_candidate_ranking_accounts_for_lastReadAt::recordedBeforeMissing
  Scenario: recorded lastReadAt prioritized for eviction over missing lastReadAt
    When a copy with a recorded read and one without are ranked
    Then the recorded one comes first

  @test:scripts/tests/materialization-last-read.test.ts::eviction_candidate_ranking_accounts_for_lastReadAt::expiredFirstRegardless
  Scenario: expired copies sort before no-expiry regardless of lastReadAt
    When an expired copy read today and a no-expiry copy are ranked
    Then the expired one comes first

  @test:scripts/tests/materialization-last-read.test.ts::eviction_candidate_ranking_accounts_for_lastReadAt::tiedReadLargerFirst
  Scenario: tied lastReadAt falls back to larger bytes first
    When two copies read at the same time are ranked
    Then the larger comes first
