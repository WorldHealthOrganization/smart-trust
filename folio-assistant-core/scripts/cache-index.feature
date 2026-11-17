Feature: the index of materialized copies: sizes, dates and eviction

  @test:scripts/cache-index.test.ts::size:_recorded,_measured,_directory,_absent::recordedSizeWins
  Scenario: a recorded size wins, and is labelled recorded, even when the file is not there
    When the row of a copy with a recorded size and no file is read
    Then its size is 999, labelled recorded

  @test:scripts/cache-index.test.ts::size:_recorded,_measured,_directory,_absent::unrecordedSizeMeasured
  Scenario: an unrecorded size is measured from the file and labelled measured
    When the row of a copy without a recorded size is read
    Then its size is 5, labelled measured

  @test:scripts/cache-index.test.ts::size:_recorded,_measured,_directory,_absent::directoryHasNoSize
  Scenario: a directory has no size of its own: its parts are counted, so it is not
    When the row of a directory is read
    Then it has no size, labelled directory

  @test:scripts/cache-index.test.ts::size:_recorded,_measured,_directory,_absent::noPathAbsent
  Scenario: no path means absent, never zero
    When the row of a copy with no path is read
    Then it has no size, labelled absent

  @test:scripts/cache-index.test.ts::size:_recorded,_measured,_directory,_absent::totalCountsKnownOnly
  Scenario: the total counts known sizes only, and says how many it could not
    When the rows are summarised
    Then the known bytes add the known sizes only
    And the counts per size basis are given

  @test:scripts/cache-index.test.ts::dates:_recorded_or_not,_never_invented::fetchedAtOnlyWhereRecorded
  Scenario: fetchedAt only where the record says; the rest stay undefined
    When the rows with a fetch date are listed
    Then only the recorded one has it

  @test:scripts/cache-index.test.ts::dates:_recorded_or_not,_never_invented::lastReadNeverRecorded
  Scenario: last read is not recorded for ANY row — the owner's ruling, not a gap filled in
    When the rows are read
    Then none has a last-read date

  @test:scripts/cache-index.test.ts::eviction_reports,_and_never_names_what_must_stay::expiredFirstThenNoLifetime
  Scenario: expired comes first, then working copies with no lifetime, largest first
    When the eviction candidates are listed
    Then the expired copy comes first, then working copies with no lifetime, largest first

  @test:scripts/cache-index.test.ts::eviction_reports,_and_never_names_what_must_stay::archivalNeverCandidate
  Scenario: an archival copy is never a candidate — it exists to outlive its source
    When the eviction candidates are listed
    Then the archival copy is not one

  @test:scripts/cache-index.test.ts::eviction_reports,_and_never_names_what_must_stay::freshNeverCandidate
  Scenario: a fresh copy is never a candidate
    When the eviction candidates are listed
    Then the fresh copy is not one

  @test:scripts/cache-index.test.ts::eviction_reports,_and_never_names_what_must_stay::compiledNotNoExpiryCandidate
  Scenario: a compiled copy is not a no-expiry candidate: its lifetime is its inputs (bean gpdo)
    When the eviction candidates are listed
    Then the compiled copy is not one

  @test:scripts/cache-index.test.ts::eviction_reports,_and_never_names_what_must_stay::everyCandidateHasReason
  Scenario: every candidate carries its reason
    When the eviction candidates are listed
    Then each carries a reason

  @test:scripts/cache-index.test.ts::the_real_corpus::realCorpusHasCopies
  Scenario: the index finds materialized copies at all, so the checks above are not over nothing
    When the real corpus is indexed
    Then it has at least one row
