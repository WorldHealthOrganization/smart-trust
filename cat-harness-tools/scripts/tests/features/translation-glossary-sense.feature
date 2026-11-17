# translation:glossary:check — a glossary term used in the narrative in its
# glossary sense must be translated with its fixed translation (owner,
# 2026-11-07). Sense is decided by rule (the catalogue's subject area is the
# term's), then by an untainted adjudicator agent whose verdicts are stored in
# the instance, keyed by the term's id and the msgid's SHA-256. Each Scenario
# names its test as @test:<file>::<scope>::<name> (skill test-engineer).
Feature: Glossary terms in sense keep their fixed translation

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::a_use_in_the_term's_own_subject_area_is_in_sense_by_rule,_and_a_msgstr_without_the_fixed_term_fails
  Scenario: A use in the term's own subject area is in sense by rule and is enforced
    Given an instance whose own glossary fixes "Health worker" as "Agent de santé" in French
    And a page catalogue that renders "Every health worker signs in." without it
    When the French catalogues are checked
    Then the use is a not-fixed-rendering finding, in sense by rule
    And the check exits 1

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::a_use_of_another_area's_term_is_pending:_listed_with_its_term_id,_definition_and_sentence,_never_a_finding
  Scenario: A use of another subject area's term is pending adjudication
    Given a platform layer of another subject area that fixes "Actor"
    And a page sentence "Each actor signs the record." rendered without the fixed term
    And no verdict on that use
    When the French catalogues are checked
    Then the use is listed as pending, with the term's IRI, its definition, the sentence and the sentence's SHA-256
    And it is not a finding

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::an_other-sense_verdict_checks_nothing;_an_in-sense_verdict_is_enforced
  Scenario: An adjudicator's verdict decides a pending use
    Given the pending use of "Actor"
    When the adjudicator rules it other-sense
    Then it is listed as other-sense and not checked
    When the adjudicator rules it in-sense instead
    Then its missing fixed translation is a finding, in sense by verdict

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::a_changed_msgid_invalidates_its_verdict:_the_use_is_pending_again
  Scenario: A changed msgid invalidates its verdict
    Given an other-sense verdict recorded against an earlier wording of the sentence
    When the current sentence is checked
    Then the verdict does not apply and the use is pending again

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::an_exception_passes_and_is_listed,_for_an_adjudicated_use_and_for_one_in_sense_by_rule
  Scenario: A recorded exception passes and is listed
    Given an exception verdict, with its reason, on a use in sense by rule and on a pending use
    When the French catalogues are checked
    Then there are no findings
    And both uses are listed as exceptions with their reasons

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::zh_matches_the_fixed_term_as_a_substring;_ru_by_stem,_a_4-letter_word_by_its_first_three_letters
  Scenario: Chinese is matched by substring and Russian by stem
    Given fixed terms in Chinese and Russian
    When a msgstr writes the Chinese term inside a longer run of characters, or the Russian term inflected
    Then the fixed translation counts as rendered
    And a four-letter Russian word is matched by its first three letters
    And a different word is not a rendering

  @test:pipeline/translation-glossary.test.ts::in_sense:_by_rule,_then_by_an_adjudicator::the_English_term_kept_verbatim_renders_it_only_as_part_of_a_code_or_resource_name
  Scenario: The English term kept verbatim counts only inside a code or resource name
    Given msgstrs that keep the English term
    When the term stays with a name-shaped or identifier neighbour, or inside a quoted title kept whole
    Then it counts as rendered
    When the term stays alone in prose
    Then it does not

  @test:pipeline/translation-glossary.test.ts::the_verdict_store_and_the_adjudicator's_entry_points::--pending_--json_asks_each_use_once_across_locales,_with_term,_definition_and_sentence;_it_exits_0
  Scenario: The adjudicator is asked each use once
    Given the same pending use in French and Spanish
    When the pending questions are listed with --pending --json
    Then the use is one question naming both locales, with the term, its definition and the sentence
    And listing them exits 0

  @test:pipeline/translation-glossary.test.ts::the_verdict_store_and_the_adjudicator's_entry_points::--record_merges_verdicts_keyed_by_term_and_msgid_hash;_the_check_then_lists_them,_and_exits_1_only_on_an_in-sense_violation
  Scenario: Recording verdicts with --record
    Given an instance whose terminology pin "Clinic" is not rendered in "Clinic hours"
    And the check exits 1
    When an exception on that use is recorded with --record, by msgid
    Then the store holds it under the term's id and the msgid's SHA-256
    And the check lists the exception and exits 0
    And a verdict without a reason is refused with exit 2

  @test:pipeline/translation-glossary.test.ts::the_verdict_store_and_the_adjudicator's_entry_points::the_store_refuses_two_verdicts_on_one_use
  Scenario: One verdict per use
    Given a verdict store with two verdicts on the same term and msgid hash
    When it is validated
    Then it is refused

  @test:pipeline/translation-glossary.test.ts::the_verdict_store_and_the_adjudicator's_entry_points::the_KG_QA_report_lists_in-sense_violations,_exceptions,_pending_and_other-sense_uses
  Scenario: The KG QA report's glossary section shows the adjudication
    Given a glossary record with an in-sense violation, a pending use, an other-sense use and an exception
    When the Glossary consistency section is drawn
    Then only the violation counts as a finding
    And the pending, other-sense and exception uses each have their own table

  @test:pipeline/translation-glossary.test.ts::in_an_index_run,_the_gate_judges_the_caller's_own_instances::only_own_instance_paths_that_declare_translation-sources_are_judged;_none_named_means_the_harness,_as_before
  Scenario: In an IG's index run the gate judges only the IG's catalogues
    Given the runner names the caller's own instance directories
    When the glossary check runs with no --instance
    Then it judges only the own instances that declare translation-sources
    And with none named it judges the harness, as before

  @test:pipeline/translation-glossary.test.ts::a_fixed_translation's_parenthetical_gloss::the_term_rendered_without_the_fixed_translation's_parenthetical_gloss_still_renders_it
  Scenario: A fixed translation's parenthetical gloss is not required in running text
    Given a fixed translation that glosses itself in parentheses, an abbreviation or the English
    When running text renders the term without the gloss
    Then the term counts as rendered
    And text that does not render the term still fails


  @test:pipeline/translation-glossary.test.ts::matching::a_Russian_noun_with_a_fleeting_vowel_is_found_in_its_oblique_cases
  Scenario: A Russian noun whose vowel drops in its oblique cases still renders the term
    Given the fixed Russian translation «Узел»
    When running text uses «узла» or «узлы»
    Then the term counts as rendered
    And a different word does not

  @test:pipeline/translation-glossary.test.ts::the_CLI:_one_finding_per_line,_exit_0_/_1_/_2::a_layer_the_instance_needs_is_not_on_disk:_exits_2,_naming_it,_rather_than_judging_its_glossary_as_the_instance's_own
  Scenario: A layer the instance needs is absent, so the check refuses to judge
    Given an instance whose needs name a layer that is not on disk
    When the glossary check runs
    Then it exits 2 and names the absent layer
    And it judges nothing, since that layer's glossary would be read as the instance's own
