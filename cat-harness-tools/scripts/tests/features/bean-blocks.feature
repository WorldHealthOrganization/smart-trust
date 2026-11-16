# scripts/check-bean-blocks.ts (check:bean-blocks) inspects an in-progress bean's "Blocked on"
# section for its four fields, reports blocking prose as advisory, and holds the store to a baseline.
# Each Scenario names the test that executes it.
Feature: Bean "Blocked on" blocks

  @test:scripts/tests/bean-blocks.test.ts::the_structured_form_is_enforced::all_four_fields_present_⇒_ok
  Scenario: A block with all four fields is ok
    Given an in-progress bean whose body has a "## Blocked on" heading with waits on, since, expires and handoff
    When the bean is inspected
    Then the verdict is "ok"
    And no field is missing

  @test:scripts/tests/bean-blocks.test.ts::the_structured_form_is_enforced::stripping_`%s`_turns_it_incomplete
  Scenario: Removing any one field makes the block incomplete
    Given the complete block with every line naming one field removed
    When the bean is inspected
    Then the verdict is "incomplete"
    And the missing fields include the removed one
    And this holds for each of "waits on", "since", "expires" and "handoff"

  @test:scripts/tests/bean-blocks.test.ts::the_structured_form_is_enforced::`expires`_is_answered_by_beans.ts,_so_`expiry`_and_`expire`_also_count
  Scenario: The expiry field may be written as expires, expiry or expire
    Given the complete block with "expires" replaced by each of "expires", "expiry" and "expire"
    When the bean is inspected
    Then the verdict is "ok" every time

  @test:scripts/tests/bean-blocks.test.ts::prose_is_reported,_never_failed::blocking_language_with_no_heading_is_`unstructured`,_not_`incomplete`
  Scenario: Blocking prose with no heading is unstructured, not incomplete
    Given an in-progress bean whose body says "This is genuinely blocked on the upstream spec."
    When the bean is inspected
    Then the verdict is "unstructured"

  @test:scripts/tests/bean-blocks.test.ts::prose_is_reported,_never_failed::a_bean_that_is_NOT_in-progress_is_not_reported_at_all
  Scenario: A bean that is not in progress is not reported
    Given a bean whose body says "was blocked, then unblocked"
    When it is inspected with status todo, completed, scrapped and draft
    Then no verdict is returned for any of them

  @test:scripts/tests/bean-blocks.test.ts::prose_is_reported,_never_failed::a_bean_with_no_block_language_is_silent
  Scenario: A bean with no blocking language is silent
    Given an in-progress bean whose body is "ordinary work"
    When the bean is inspected
    Then no verdict is returned

  @test:scripts/tests/bean-blocks.test.ts::the_heading_matcher::accepts_trailing_words,_because_the_corpus_writes_them
  Scenario: The heading matcher accepts trailing words and any case
    Given the headings "## Blocked on", "## Blocked on upstream", "### blocked on X" and "## Blocked On"
    When each is matched against the block heading pattern followed by a body line
    Then every one matches

  @test:scripts/tests/bean-blocks.test.ts::the_heading_matcher::does_not_fire_on_the_words_in_a_sentence
  Scenario: The heading matcher ignores the words inside a sentence
    Given the sentence "it is blocked on the spec"
    When it is matched against the block heading pattern
    Then it does not match

  @test:scripts/tests/bean-blocks.test.ts::the_real_corpus::there_IS_a_corpus,_so_a_clean_run_is_not_vacuous
  Scenario: The bean history is large enough that a clean run is not vacuous
    Given the repository's active beans plus its archived beans
    Then there are more than 100 of them
    And scanning them yields at least one "ok" block

  @test:scripts/tests/bean-blocks.test.ts::the_real_corpus::every_structured_block_in_the_store_is_complete,_or_baselined_by_id
  Scenario: Every incomplete block in the store is named in the baseline
    Given the beans in the repository's store and the outstanding ids in the baseline file
    When the store is scanned
    Then every "incomplete" verdict appears in the baseline as "incomplete:<id>"

  @test:scripts/tests/bean-blocks.test.ts::the_real_corpus::...and_every_complete_one_names_a_REVIEW_date,_not_a_takeover_date
  Scenario: Every complete block in the store names a handoff
    # Gap: only the presence of the word handoff is checked, not that the date is a review date rather than a takeover date
    Given the beans in the repository's store
    When the store is scanned
    Then every bean with an "ok" verdict has a file that mentions "handoff"
