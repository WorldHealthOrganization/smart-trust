Feature: the Data Sharing Agreement kind and its hash check

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::typologyExternalSchemasOnly
  Scenario: declares typologies/dsa.json with external nodeSchemas only (ODRL 2.2, DCAT 3, dcterms:source)
    When typologies/dsa.json is read and its node schemas resolved
    Then it is kind dsa with node schemas and no schema or validator of its own
    And at least four node schemas, all external, among them odrl:Agreement, dcat:Resource, dcat:Distribution and dcterms:source

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::workedExamplePasses
  Scenario: passes on the worked example and gives a new version a new hash
    When the worked example's directory is checked
    Then it passes with no errors, both versions passing
    And the versions have different hashes and v2 names v1 as previous

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::oneByteChangeFails
  Scenario: fails on a one-byte change to the legal text
    When the legal text is changed by one byte
    Then the check fails with a SHA-256 mismatch

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::uidIsFixedVersionUrl
  Scenario: requires the Agreement's uid to be the version's fixed-version URL (consent rule 2)
    When the Agreement's uid is a latest URL
    Then the check fails naming the fixed-version URL

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::amendedNamesPrevious
  Scenario: fails when an amended version does not name the version it amends in dcat:previousVersion
    When v2 has no dcat:previousVersion
    Then the directory check fails naming it

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::sourceNamesCheckedDistribution
  Scenario: requires the Agreement's dcterms:source to name the same distribution whose spdx:checksum is checked
    When the Agreement's dcterms:source names another file, or is missing
    Then both fail naming dcterms:source

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::rejectsUnknownField
  Scenario: rejects any field that is not in ODRL 2.2, DCAT 3 or DCMI Terms
    When a custom field is added to the Agreement and to the DCAT record
    Then both fail

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::newVersionNewHash
  Scenario: fails if a new version does not get a new hash
    When v2 carries the same legal text as v1
    Then the check fails saying a versioned DSA must get a new hash

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::pinnedContextsRejectMadeUp
  Scenario: loads ODRL 2.2, DCAT 3 and DCMI Terms from SHA-256-pinned official context files and rejects made-up prefixed terms
    When the official contexts are loaded
    Then five pinned context files supply the ODRL, DCAT and DCMI terms used
    And a made-up prefixed term is rejected
    And a context file with the wrong bytes throws a SHA-256 mismatch

  @test:scripts/dsa-hash.test.ts::dsa_kind_and_hash_check_(DSA_B3,_bean_folio-assistant-2z1t)::toolSatisfiesOnlyTheAlwaysOnDsaSkill
  Scenario: declares the check-dsa-hash Tool satisfying only the always-on dsa-checksum skill
    When core's tools are read
    Then check-dsa-hash satisfies only dsa-checksum, since the other dsa skills are in the opt-in dsa sub-graph
    And it runs bun run folio-assistant-core/scripts/check-dsa-hash.ts
