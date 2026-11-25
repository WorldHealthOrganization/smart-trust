# scripts/eval-crdm-detect-blind.ts blinds the packet handed to an annotator (no label, reason or issue number), redacts
# corpus issues from the skill text, and computes Cohen's kappa for agreement.
# Each Scenario names the test that executes it.
Feature: Blinded detection evaluation

  @test:scripts/tests/eval-crdm-detect-blind.test.ts::the_packet_an_annotator_is_handed::carries_no_label,_no_reason_and_no_issue_number
  Scenario: The blinded packet carries no label, reason or issue number
    Given items numbered 187 and 199, each with a feature label and a reason
    When they are packed
    Then every blinded item has exactly the keys "id", "text" and "title"
    And the blinded packet does not contain "187"
    And the key maps "b01" to 187 and "b02" to 199

  @test:scripts/tests/eval-crdm-detect-blind.test.ts::the_packet_an_annotator_is_handed::the_skill_loses_only_the_paragraphs_that_name_a_CORPUS_issue
  Scenario: Only paragraphs naming a corpus issue are redacted
    Given skill text whose paragraphs are an intro, "#187 is not a feature.", "See #980 for the ruling." and an outro
    When it is redacted for corpus issues 187 and 199
    Then only the "#187" paragraph is removed

  @test:scripts/tests/eval-crdm-detect-blind.test.ts::Cohen's_kappa::perfect_agreement_is_1,_and_agreement_at_chance_is_0
  Scenario: Kappa is 1 at perfect agreement and 0 at chance
    When kappa is computed over two pairs that always agree
    Then it is 1
    When it is computed over the four combinations of true and false
    Then it is close to 0
