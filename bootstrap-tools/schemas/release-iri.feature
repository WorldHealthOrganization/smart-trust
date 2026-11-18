Feature: an instance's release addresses, and the sync that keeps literal copies of them at the declared major

  Background:
    Given the release addresses of iriBase "https://example.org/kg/" at version "2.3.4"

  @test:schemas/release-iri.test.ts::releaseIris::iriCarriesMajorOnly
  Scenario: agents and people both read the major; the full version is in no address
    Then the agent address and the human address are both "https://example.org/kg/v2/"
    And the version is "2.3.4"
    And the agent address of "schemas/x.schema.json" is "https://example.org/kg/v2/schemas/x.schema.json"
    And the human address of "/guide.html" is "https://example.org/kg/v2/guide.html"

  @test:schemas/release-iri.test.ts::releaseIris::refusesMissingIriBaseOrVersion
  Scenario: no iriBase is no release; an iriBase without a semver version is refused
    Then a declaration with version "1.0.0" and no iriBase has no release addresses
    And an iriBase with version "v1" throws
    And an iriBase with no version throws

  @test:schemas/release-iri.test.ts::releaseIris::bootstrapReleaseIriOwnRepo
  Scenario: bootstrap declares one, at the address its own repository owns
    When bootstrap's release is read
    Then its iriBase is "https://litlfred.github.io/bootstrap/"
    And its agent address is the iriBase followed by "v" and its major
    And its agent address does not contain its full version

  @test:schemas/release-iri.test.ts::tagCompatible_—_semver_within_one_major::sameMajorCompatibleOnly
  Scenario: same major reads, another major does not
    Then "model-registry/1.9.0" is compatible with model-registry major 1
    And "model-registry/2.0.0" is not
    And "model-registry/v1" is not
    And "other/1.0.0" is not

  @test:schemas/release-iri.test.ts::iri-sync_rewrite::rewritesVersionsToDeclaredMajor
  Scenario: every full version — the declared one too — and a stale major move to the declared major; the current major stays
    Given text with addresses under 2.3.3, v1, 2.3.4 and v2
    When iri-sync rewrites it
    Then it reports 3 changes
    And the 2.3.3, v1 and 2.3.4 addresses now read v2
    And the v2 address is unchanged

  @test:schemas/release-iri.test.ts::iri-sync_rewrite::leavesMajorTreeAlone
  Scenario: a tree already at the major is left alone, so --check passes on it
    Given text whose addresses are already at v2
    When iri-sync rewrites it
    Then the text is unchanged with 0 changes

  @test:schemas/release-iri.test.ts::iri-sync_rewrite::fromMovesOldBaseOnly
  Scenario: --from moves an old base's identifiers, and leaves the bare base alone
    Given text with an identifier under "https://old.example/b/" and the bare old base
    When iri-sync rewrites it from the old base
    Then the identifier moves to "https://example.org/kg/v2/processes/ns#x"
    And the bare old base is unchanged
    And it reports 1 change

  @test:schemas/release-iri.test.ts::iri-sync_rewrite::neverTouchesOtherBase
  Scenario: another base is never touched
    Given text with an address under "https://example.org/other/1.0.0/"
    When iri-sync rewrites it
    Then the text is unchanged with 0 changes

  @test:schemas/release-iri.test.ts::a_toolset_supports_content_by_major_version::supportsListedMajorsOnly
  Scenario: listed majors are supported, others refused; no range syntax
    Given a toolset that supports bootstrap majors 0 and 2
    Then it supports bootstrap content "0.9.1" and "2.0.0"
    And it does not support bootstrap "1.0.0"
    And it does not support "other" content "0.1.0"
    And a toolset with no supports list does not support bootstrap "0.1.0"
