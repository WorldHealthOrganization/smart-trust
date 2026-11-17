Feature: a sample import run through its process

  @test:scripts/sample-import-run.test.ts::the_whole_item_—_a_derived_thumbnail's_sourceLoss_gate_is_unknown::wholeItemRefused
  Scenario: the gates refuse, nothing lands, and the run ends Not imported
    When the whole item, whose derived thumbnail has an unknown sourceLoss gate, is imported
    Then the run completes with the gates and materialized gateways saying no
    And nothing lands and it ends Not imported

  @test:scripts/sample-import-run.test.ts::the_ORIGINAL_bundle_only_—_every_gate_permitted::originalImported
  Scenario: it materializes, lands as a trial, passes the import test, and ends Imported
    When only the ORIGINAL bundle, every gate permitted, is imported
    Then it passes the gates, lands as a trial, passes and ends Imported
    And the fetch step says it was not performed and the liveness could not be determined
    And the trial file is written under kept-trash and nothing else is written

  @test:scripts/sample-import-run.test.ts::held_bytes_that_no_longer_match_their_recorded_fixity::tamperedRefused
  Scenario: the fetch substitute is refused rather than trusted
    When the held bytes no longer match their fixity
    Then the run is refused naming the sha256 mismatch
