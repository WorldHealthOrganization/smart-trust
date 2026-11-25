# Specifies schemas/content/prov.ts: W3C PROV-O decision records citing their
# agreement (a DCAT distribution with an SPDX SHA-256 checksum) and an optional
# grant, the hash-chained log (DSA B4, bean 3z44), and the IHE PCF Consent
# id + versionId citation on consent-based decisions (PCF8, bean 2egb).
Feature: PROV-O decision records cite their agreement and Consent, in a hash chain

  Background:
    Given a PROV activity "run" with an agent, a role, a plan, used and generated entities, and a policy

  @test:schemas/content/prov.test.ts::PROV-O_decision_records_and_hash_chain_(DSA_B4,_bean_3z44)::DSA_B4_decision_records_cite_agreement_URL_+_SHA-256_(and_optional_grant)_and_enforce_the_hash_chain
  Scenario: Decision records cite agreement and grant, and the hash chain is enforced
    Given an agreement distribution with a SHA-256 checksum and a grant credential
    When "run", which cites no agreement, is parsed with the decision record schema
    Then it is refused
    When a chain is built from two records citing the agreement, the first also the grant, and a third is appended
    Then the chain has three records, the first with a null previous hash and each next one linking to the record hash before it
    And the chain verifies
    And the first record's cited agreements and grants are that agreement and that grant
    And the agreement's checksum is an SPDX sha256 checksum of the given value
    And no key of the record names an agreement or a grant
    And building a chain from a record citing no agreement throws, naming the agreement
    And an agreement distribution with a 4-character checksum, or a non-IRI id, is refused
    And swapping the first record's agreement checksum gives a hash mismatch
    And editing the first record's used entities fails verification with a hash mismatch
    And removing the first record, or the middle one, fails verification with a broken link
    And removing the last record fails verification when the expected head hash or the expected count of 3 is given

  @test:schemas/content/prov.test.ts::PROV_decision_record_cites_Consent_id_+_versionId_(PCF8,_bean_2egb)::ProvConsentRefSchema_requires_non-empty_id_and_versionId
  Scenario: A Consent reference needs a non-empty id and versionId
    Given Consent references with both, with only an id, with only a versionId, with an empty id, and with an empty versionId
    When each is parsed with the Consent reference schema
    Then the one with both is accepted
    And the others are refused

  @test:schemas/content/prov.test.ts::PROV_decision_record_cites_Consent_id_+_versionId_(PCF8,_bean_2egb)::every_consent-based_decision_names_its_Consent_(id_+_versionId)
  Scenario: Every consent-based decision names its Consent
    Given an agreement distribution cited by the records
    When a consent-based record naming its Consent is stamped
    Then it keeps the Consent and the consent decision record schema accepts it
    And the activity schema refuses a record marked consent-based with no Consent
    And it refuses a record whose policies include a Consent URN and that names no Consent
    And stamping a consent-based record with no Consent throws, naming the Consent
    When a chain of two consent-based records under "urn:dsa:pcf6", each naming its Consent, is built
    Then it verifies when Consent is required, and when "urn:dsa:pcf6" is a consent policy
    And removing the first record's Consent fails verification under that consent policy, with a missing-consent error
    And changing the first record's Consent versionId fails verification with a hash mismatch
