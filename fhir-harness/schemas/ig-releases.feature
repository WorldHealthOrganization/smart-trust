Feature: The IG releases record, built from GitHub releases as pointers

  @test:schemas/ig-releases.test.ts::ig-releases/v1::releaseBecomesPointers
  Scenario: a GitHub release becomes pointers: name, url, size and digest, never bytes
    Given a GitHub release with one asset "package.tgz"
    When it is recorded
    Then the asset is its name, download url, size 9, sha256 digest and content type

  @test:schemas/ig-releases.test.ts::ig-releases/v1::skipsDraftsAndUnpublished
  Scenario: drafts and unpublished releases are not recorded
    Given a draft release, an unpublished release "v2" and a published release "v3"
    When they are recorded
    Then only "v3" is recorded

  @test:schemas/ig-releases.test.ts::ig-releases/v1::noDigestOmittedMalformedRefused
  Scenario: an asset with no digest keeps no digest field, and a malformed digest is refused
    Given an asset with no digest
    Then its recorded asset has no digest
    Given an asset whose digest is "md5:x"
    Then recording it throws

  @test:schemas/ig-releases.test.ts::ig-releases/v1::roundTripValidatesPointersOnly
  Scenario: a record written to releases.json and read back validates; one carrying anything but pointers is refused
    Given a record of two releases written to releases.json and read back
    Then the schema accepts it
    And the same record with an asset carrying "content" is refused
    And the same record with "$schema" "ig-releases/v0" is refused

  @test:schemas/ig-releases.test.ts::releasesAsOf_(bean_fwtz:_the_record_moves_with_the_pin,_not_the_clock)::keepsReleasesByPinnedTime
  Scenario: keeps releases published by the pinned time and stamps that date
    Given a release "v1" and a release "v2" published after the pinned time
    When the releases are taken as of the pinned time
    Then the record is stamped "2026-03-23"
    And only "v1" is kept

  @test:schemas/ig-releases.test.ts::releasesAsOf_(bean_fwtz:_the_record_moves_with_the_pin,_not_the_clock)::refusesUnreadableTime
  Scenario: refuses a time it cannot read
    Then taking the releases as of "yesterday" throws
