# Every diagram has a current .pot in every locale that translates diagrams,
# and translate-bpmn --check notices each state: missing, fresh,
# timestamp-only, stale, orphaned and nothing-examined.
Feature: BPMN translation templates are current, and the check notices when they are not

  @test:scripts/tests/process/bpmn-pot-current.test.ts::BPMN_translation_templates::at_least_one_locale_gates_—_otherwise_this_proves_nothing
  Scenario: The fr locale gates on diagrams
    Given the harness's declared translation-sources directory
    When its locales holding a processes directory are listed
    Then they include "fr"

  @test:scripts/tests/process/bpmn-pot-current.test.ts::BPMN_translation_templates::no_diagram_is_missing_or_stale_in_a_gating_locale
  Scenario: The committed templates pass translate-bpmn --check
    Given the harness root
    When translate-bpmn --check is run
    Then its output carries the "never extracted" count
    And it exits 0

  @test:scripts/tests/process/bpmn-pot-current.test.ts::translate-bpmn_--check_—_every_state::no_locale_gates_→_exit_2,_never_a_clean_pass_over_nothing
  Scenario: With no gating locale the check exits 2
    Given a throwaway instance with one diagram and an empty translations/fr
    When translate-bpmn --check is run on it
    Then it says "Nothing was checked"
    And it exits 2

  @test:scripts/tests/process/bpmn-pot-current.test.ts::translate-bpmn_--check_—_every_state::a_missing_.pot_fails;_extracting_it_makes_the_check_pass
  Scenario: A missing .pot fails, and extracting it makes the check pass
    Given a throwaway instance with one diagram and no fr template
    When the check is run for locale fr
    Then it reports "NEVER EXTRACTED" and exits 1
    When the fr template is extracted
    Then extraction exits 0 and demo.pot exists
    And a plain --check now gates on fr and exits 0

  @test:scripts/tests/process/bpmn-pot-current.test.ts::translate-bpmn_--check_—_every_state::a_POT-Creation-Date_difference_alone_is_not_staleness
  Scenario: A changed POT-Creation-Date alone is not stale
    Given a throwaway instance with an extracted fr template carrying a POT-Creation-Date line
    When only that date is changed and the check is run
    Then it exits 0

  @test:scripts/tests/process/bpmn-pot-current.test.ts::translate-bpmn_--check_—_every_state::a_label_changed_after_extraction_makes_the_.pot_stale
  Scenario: A label changed after extraction makes the template stale
    Given a throwaway instance with an extracted fr template
    When the diagram's task label is changed and the check is run
    Then it reports "OUT OF DATE" naming demo.pot
    And it exits 1

  @test:scripts/tests/process/bpmn-pot-current.test.ts::translate-bpmn_--check_—_every_state::a_template_whose_diagram_is_gone_is_a_finding
  Scenario: A template with no diagram is a finding
    Given a throwaway instance with an extracted fr template and an extra gone.pot with no diagram
    When the check is run
    Then it names gone.pot
    And it exits 1
