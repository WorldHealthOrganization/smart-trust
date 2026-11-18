# scripts/check-voice-skills.ts (check:voice-skills) finds voice instruction bodies that restate their
# voice's rules, and checks that each declared instruction body exists. Each Scenario names the test that executes it.
Feature: The voice-skills check

  @test:scripts/tests/content/voice-skills.test.ts::the_corpus_passes::no_voice_this_repository_ships_restates_its_own_rules
  Scenario: No shipped voice restates its own rules
    Given the repository's voices
    When checkVoiceSkills runs
    Then it reports no findings

  @test:scripts/tests/content/voice-skills.test.ts::the_corpus_passes::...and_there_IS_a_corpus,_so_the_pass_is_not_vacuous
  Scenario: The shipped corpus of voices and rules is not empty
    Given the repository's voices graph
    Then it is read
    And it holds at least one voice
    And the voices hold at least one rule between them

  @test:scripts/tests/content/voice-skills.test.ts::each_of_the_four_restatement_signals_fires::a_body_naming_a_rule_id
  Scenario: A body naming a rule id is a restatement
    Given the rule "who-ed-ize-preferred"
    When a body mentions "who-ed-ize-preferred"
    Then exactly one finding is reported
    And it says the body "names the rule id"

  @test:scripts/tests/content/voice-skills.test.ts::each_of_the_four_restatement_signals_fires::a_body_restating_a_rule_title
  Scenario: A body restating a rule title is a restatement
    Given a rule titled "-ize, not -ise"
    When a body contains that title
    Then a finding says the body "restates the rule"

  @test:scripts/tests/content/voice-skills.test.ts::each_of_the_four_restatement_signals_fires::a_body_copying_the_source_passage
  Scenario: A body copying the source passage is a restatement
    Given a rule with a source quote
    When a body contains that quote
    Then a finding mentions the "source passage"

  @test:scripts/tests/content/voice-skills.test.ts::each_of_the_four_restatement_signals_fires::a_body_giving_both_sides_of_a_terminology_pair
  Scenario: A body giving both sides of a terminology pair is a restatement
    Given a rule preferring "organize" over "organise"
    When a body says "Write organize, never organise."
    Then a finding mentions the "terminology pair"

  @test:scripts/tests/content/voice-skills.test.ts::and_it_does_not_fire_on_what_a_body_is_FOR::instructions_about_what_to_do_with_the_rules_are_clean
  Scenario: Instructions about using the rules are clean
    Given a body that says how to read and apply the rules without stating any rule
    Then no restatement is reported

  @test:scripts/tests/content/voice-skills.test.ts::and_it_does_not_fire_on_what_a_body_is_FOR::ONE_side_of_a_terminology_pair_is_not_a_restatement
  Scenario: One side of a terminology pair is not a restatement
    Given a rule preferring "organize" over "organise"
    When a body uses only "organize"
    Then no restatement is reported

  @test:scripts/tests/content/voice-skills.test.ts::and_it_does_not_fire_on_what_a_body_is_FOR::the_front_matter's_description_is_not_body
  Scenario: The front matter's description is not checked as body
    Given a file whose front-matter description contains the rule title and whose body does not
    Then no restatement is reported

  @test:scripts/tests/content/voice-skills.test.ts::and_it_does_not_fire_on_what_a_body_is_FOR::a_short_title_is_not_matched,_because_a_short_title_can_be_ordinary_prose
  Scenario: A short rule title is not matched in prose
    Given a rule titled "Be brief"
    When a body begins "Be brief when you summarise a finding."
    Then no restatement is reported

  @test:scripts/tests/content/voice-skills.test.ts::the_structural_half_—_what_Zod_cannot_check::every_shipped_voice's_declared_instruction_body_resolves
  Scenario: Every shipped voice-skill declares an instruction body that exists
    # Gap: no assertion that any shipped voice is folio-voice-skill/v1, so the loop may check nothing
    Given each shipped voice whose voice.json schema is "folio-voice-skill/v1"
    Then it declares an instructions file
    And that file exists in the voice's directory

  @test:scripts/tests/content/voice-skills.test.ts::the_structural_half_—_what_Zod_cannot_check::a_voice_that_promises_NO_body_is_not_reported_as_missing_one
  Scenario: A voice that promises no body is not reported as missing one
    Given the shipped voices that are not "folio-voice-skill/v1" and declare no instructions file
    Then there is at least one such voice
    And none of them has a SKILL.md
    And checkVoiceSkills reports no finding for any of them

  @test:scripts/tests/content/voice-skills.test.ts::the_structural_half_—_what_Zod_cannot_check::the_reader_is_told_the_repository_root_rather_than_deriving_it_wrongly
  Scenario: The voices reader is given the repository root explicitly
    Given the repository root
    Then repoRootFor of it is its parent directory
    And readVoicesGraph given the repository root explicitly reads a graph
