Feature: The translation round-trip report and the attestations it is built from
  The untainted round-trip report is derived from the agents' rulings, kept as
  translation-qa attestations, and today's translation catalogues for ar, es,
  fr, ru and zh.

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::buildsFromAttestations
  Scenario: it builds from the attestations and today's catalogues
    When the report is built
    Then its schema is "qa-results/v1"
    And its totals are keyed by exactly ar, es, fr, ru and zh

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::backTranslatorsUseReadWriteOnly
  Scenario: every back-translator reports Read and Write only
    When the report is built
    Then every locale's family summary contains "Back-translator tools: Read,Write."

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::rulingsMayRunAheadButNotBehind
  Scenario: rulings may be recorded ahead of the strings, never behind them
    Given rulings for the msgids a, b and c and a catalogue holding a and b
    Then a and b are paired with their rulings, and c's ruling is unused
    And rulings for a and b against a catalogue holding a, b and c is an error that says to re-run the agents

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::removingOrReorderingStringsKeepsEveryRuling
  Scenario: rulings are paired by content, so removing or reordering strings invalidates none
    Given rulings for the msgids a, b (warn) and c
    When b is removed from the catalogue
    Then a and c keep their own rulings and b's ruling is unused
    When the catalogue holds c, b and a in that order
    Then each string is paired with its own ruling, b's still a warn

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::changedTranslationIsStaleNotPassed
  Scenario: a ruling on an earlier translation is stale, not a pass
    Given a ruling for msgid a that judged the msgstr "old"
    When the catalogue's msgstr for a is "new"
    Then the pairing is marked stale

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::pruneDropsRemovedKeepsAheadNeverChangesAVerdict
  Scenario: prune drops the rulings of removed strings, keeps rulings that run ahead, and changes no verdict
    Given a run entry and rulings for a, gone (warn), c (fail) and ahead
    And the catalogue's history once held a, gone and c, and now holds a and c
    When the rulings are pruned
    Then gone's ruling is dropped and ahead's is kept
    And the run entry stays first, and the kept rulings are indexed 0, 1 and 2 with verdicts pass, fail and pass
    And a catalogue string with no ruling is an error that says to re-run the agents

  @test:scripts/tests/translation-roundtrip-report.test.ts::translation_round-trip_report::parsePoJoinsLinesSkipsHeader
  Scenario: parsePo joins continuation lines and skips the header
    Given a PO text with a header entry and one entry whose msgid "a " continues on the next line with "b"
    When it is parsed as "x.po"
    Then the result is the single entry with catalogue "x.po", msgid "a b" and msgstr "c"

  @test:scripts/tests/translation-roundtrip-report.test.ts::the_agents'_rulings_are_attestations::attestationPerCatalogueAndLocale
  Scenario: one translation-qa file per catalogue and locale, a ruling for every string, each a judgement
    Given each of the five locales and each of the catalogues site/iris-site.po and glossary/who-iris--who-terms.po
    Then a translation-qa attestations file exists for that catalogue and locale
    And its schema is "qa-attestations/v1", its family "translation-qa" and its locale that locale
    And its subject is the translation catalogue at translations/<locale>/<catalogue>
    And every string of that translated catalogue has a ruling found by the hash of its msgid (rulings for strings not on this branch yet, or removed from it, may remain)
    And the run and every entry have a reviewer of kind "agent"
    And the run's back-translation trailer says tools used were "Read,Write"

  @test:scripts/tests/translation-roundtrip-report.test.ts::the_agents'_rulings_are_attestations::derivedReportNotCommitted
  Scenario: the derived report is no longer committed beside them
    When git lists the tracked files under test/results
    Then the list is empty
