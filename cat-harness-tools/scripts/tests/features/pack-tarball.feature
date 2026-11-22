# pack-tarball builds a layer's npm tarball with its binary release record, and
# kg-retrieve-npm verifies and reads it back. Each Scenario names the test that executes it.
Feature: Packing and retrieving a knowledge-graph tarball

  @test:scripts/tests/pack-tarball.test.ts::pack-tarball_and_kg-retrieve-npm_tooling::packTarball_builds_npm_tarball_and_creates_valid_folio-binary-release/v1_record
  Scenario: A tarball and a valid binary release record are built, and round-trip
    Given a package with a declaration, a skill and a schema
    When it is packed for testowner/test-kg
    Then the tarball exists, named test-scope-test-kg-1.2.3.tgz, with a size and a sha256
    And the release record is v1.2.3 from that repository with one published asset matching the tarball's name, size and digest
    And the record validates and is written to disk
    When the tarball is retrieved against its release
    Then it is verified, and its view names the declaration, one skill, one schema and the package's name and version

  @test:scripts/tests/pack-tarball.test.ts::pack-tarball_and_kg-retrieve-npm_tooling::kg-retrieve-npm_refuses_tarball_when_release_digest_mismatches
  Scenario: A tarball whose digest does not match its release is refused
    Given a tarball and a release record with another digest
    Then retrieving the tarball against the release throws

  @test:scripts/tests/pack-tarball.test.ts::pack-tarball_and_kg-retrieve-npm_tooling::unhydrated_pack_excludes_library_PNGs_while_hydrated_pack_includes_them
  Scenario: An unhydrated pack leaves out library PNGs; a hydrated pack holds them
    Given a package with a skill and a library PNG
    When it is packed by default
    Then the tarball holds the skill and not the PNG
    When it is packed hydrated
    Then the tarball is named .hydrated.tgz with a -hydrated release id, and holds both
