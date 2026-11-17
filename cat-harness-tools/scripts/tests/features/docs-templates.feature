# scripts/check-docs-templates.ts judges every Liquid link interpolation in the docs templates:
# a site-root literal must pass relative_url or absolute_url, while a variable is declined, not flagged.
# Each Scenario names the test that executes it.
Feature: Site-root links in docs templates

  @test:scripts/tests/docs-templates.test.ts::a_literal_is_judged::a_site-root-absolute_literal_without_a_filter_FAILS
  Scenario: A site-root-absolute literal without a filter fails
    When the expression "{{ '/assets/js/docs-ui.js' }}" is judged
    Then the verdict is "unresolved-literal"

  @test:scripts/tests/docs-templates.test.ts::a_literal_is_judged::...and_passes_once_filtered,_by_either_filter
  Scenario: A site-root literal passes once filtered by either relative_url or absolute_url
    When "{{ '/assets/js/docs-ui.js' | relative_url }}" is judged
    Then the verdict is "ok"
    And the same literal piped through absolute_url is also "ok"

  @test:scripts/tests/docs-templates.test.ts::a_literal_is_judged::a_literal_that_is_ALREADY_relative_needs_no_filter
  Scenario: A literal that is already relative needs no filter
    When "{{ '#section' }}" and "{{ 'mailto:x@example.org' }}" are judged
    Then both verdicts are "ok"

  @test:scripts/tests/docs-templates.test.ts::a_literal_is_judged::a_trailing_filter_that_does_not_resolve_is_still_unresolved
  Scenario: A trailing filter that does not resolve leaves the literal unresolved
    When "{{ '/assets/x.css' | escape }}" is judged
    Then the verdict is "unresolved-literal"

  @test:scripts/tests/docs-templates.test.ts::a_variable_is_DECLINED,_not_flagged::an_absolute_forge_URL_in_a_variable_is_not_a_finding
  Scenario: An absolute forge URL held in a variable is declined, not a finding
    When "{{ st.viewHref }}" and "{{ st.editHref }}" are judged
    Then both verdicts are "declined"

  @test:scripts/tests/docs-templates.test.ts::a_variable_is_DECLINED,_not_flagged::a_site-root_variable_is_also_declined_—_the_template_cannot_see_it
  Scenario: A site-root variable is also declined because the template cannot see its value
    When "{{ st.art.card.src }}" is judged
    Then the verdict is "declined"

  @test:scripts/tests/docs-templates.test.ts::a_variable_is_DECLINED,_not_flagged::a_filtered_variable_is_OK,_because_the_filter_is_visible
  Scenario: A filtered variable is OK because the filter is visible
    When "{{ st.art.card.src | relative_url }}" is judged
    Then the verdict is "ok"

  @test:scripts/tests/docs-templates.test.ts::a_variable_is_DECLINED,_not_flagged::declined_never_reaches_the_failing_set
  Scenario: A declined finding never reaches the failing set
    Given a "declined" finding in file "a" and an "unresolved-literal" finding in file "b"
    When the unresolved findings are selected
    Then only the finding in file "b" remains

  @test:scripts/tests/docs-templates.test.ts::this_repository's_own_templates::carry_no_unresolved_site-root_literal
  Scenario: This repository's own templates carry no unresolved site-root literal
    Given the docs templates of this repository
    When they are scanned
    Then no finding is unresolved

  @test:scripts/tests/docs-templates.test.ts::this_repository's_own_templates::and_were_actually_examined_—_an_empty_corpus_is_not_a_pass
  Scenario: This repository's own templates were actually examined
    Given the docs templates of this repository
    When they are scanned
    Then more than zero files were read
    And more than zero findings were recorded
