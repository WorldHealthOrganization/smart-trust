# scripts/check-translation-officiality.ts checks that a locale's status.json and its PO catalogues'
# "X-Folio-Official" headers agree on whether the translation is official and signed off.
# Each Scenario names the test that executes it.
Feature: Translation officiality agrees between status.json and the catalogues

  @test:scripts/tests/check-translation-officiality.test.ts::officialityFindings::silence_on_both_sides_is_consistent:_unofficial
  Scenario: Silence on both sides is consistent and unofficial
    Given the locale "fr" with one catalogue "fr/x.po"
    When there is no status.json and the catalogue has no official header
    Then there are no findings
    And when status.json says official false and the catalogue says "no", there are no findings

  @test:scripts/tests/check-translation-officiality.test.ts::officialityFindings::both_saying_official,_with_a_person_named,_agree
  Scenario: Both sides official with a person named agree
    Given a status.json that is official, signed off by "litlfred" at a time
    And a catalogue saying "yes"
    When the officiality findings are computed
    Then there are no findings

  @test:scripts/tests/check-translation-officiality.test.ts::officialityFindings::status.json_official_but_a_catalogue_not:_disagree,_naming_the_catalogue
  Scenario: An official status.json with a non-official catalogue disagrees, naming the catalogue
    Given a signed-off official status.json
    And catalogues "fr/x.po" saying "yes" and "fr/y.po" with no official header
    When the officiality findings are computed
    Then the only finding is a "disagree" at "fr/y.po" whose detail mentions "(absent)"

  @test:scripts/tests/check-translation-officiality.test.ts::officialityFindings::a_catalogue_saying_yes_with_no_status.json:_disagree
  Scenario: A catalogue saying yes with no status.json disagrees
    Given no status.json and a catalogue saying "yes"
    When the officiality findings are computed
    Then the first finding is a "disagree" whose detail mentions "is absent"

  @test:scripts/tests/check-translation-officiality.test.ts::officialityFindings::official_with_nobody_named_is_its_own_finding
  Scenario: Official with nobody named is an unnamed finding
    Given a status.json that is official with no signedOffBy or signedOffAt
    And a catalogue saying "yes"
    When the officiality findings are computed
    Then the findings' severities are exactly "unnamed"

  @test:scripts/tests/check-translation-officiality.test.ts::officialityFindings::an_unreadable_status.json_is_unreadable,_never_a_pass
  Scenario: An unreadable status.json is reported, never passed
    Given a status.json that would not parse
    And a catalogue saying "yes"
    When the officiality findings are computed
    Then the only finding is "unreadable" at "fr/status.json" with detail "status.json will not parse"
