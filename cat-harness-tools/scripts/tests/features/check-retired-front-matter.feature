# scripts/check-retired-front-matter.ts sweeps declared directories for front-matter keys that have
# been retired, each retirement backed by an fsh-guts record saying why, and guards against passing
# without checking. Each Scenario names the test that executes it.
Feature: Retired front-matter keys stay retired

  @test:scripts/tests/check-retired-front-matter.test.ts::the_registry::there_is_something_retired,_or_every_assertion_below_is_vacuous
  Scenario: The retirement registry is not empty
    When the retired keys are listed
    Then there is at least one

  @test:scripts/tests/check-retired-front-matter.test.ts::the_registry::every_entry_names_a_record_that_exists
  Scenario: Every retirement names a record that exists
    Given the instance's fsh-guts corpus directory
    When each retirement's record is looked up there
    Then the fsh-guts directory is declared
    And every record is a non-empty file

  @test:scripts/tests/check-retired-front-matter.test.ts::the_registry::every_entry_says_WHY,_not_just_what
  Scenario: Every retirement explains why
    When each retirement's reason is read
    Then every reason is longer than 80 characters

  @test:scripts/tests/check-retired-front-matter.test.ts::the_sweep_over_the_real_tree::is_clean,_and_scanned_enough_files_for_that_to_mean_anything
  Scenario: The sweep over the real tree is clean and scans enough files
    Given the real instance tree
    When it is swept
    Then there are no findings
    And no record is missing
    And more than 100 files were scanned

  @test:scripts/tests/check-retired-front-matter.test.ts::the_sweep_over_the_real_tree::the_fsh-guts_record_does_NOT_trip_the_check_it_explains
  Scenario: The record explaining a retirement does not trip the check
    Given the fsh-guts record for the retired "roles" key
    When the real tree is swept
    Then the record's text quotes "roles: string[];"
    And no finding names the record

  @test:scripts/tests/check-retired-front-matter.test.ts::the_guards::a_reintroduced_key_is_found,_wherever_in_the_front_matter_it_sits
  Scenario: A reintroduced key is found in inline and block form
    Given a fixture layer with skills a.md declaring "roles" inline, b.md declaring it as a block list, and ok.md without it
    When the layer is swept
    Then 3 files plus one record per retirement are scanned
    And the findings are a.md and b.md

  @test:scripts/tests/check-retired-front-matter.test.ts::the_guards::a_mention_in_the_BODY_is_not_a_finding_—_only_a_declaration_is
  Scenario: A retired key mentioned only in the body is not a finding
    Given a fixture skill whose body shows "roles: [reader, owner]" in a yaml code fence
    When the layer is swept
    Then there are no findings

  @test:scripts/tests/check-retired-front-matter.test.ts::the_guards::a_sweep_that_scanned_nothing_reports_zero_scanned,_so_the_caller_can_refuse_it
  Scenario: A sweep over undeclared directories reports zero scanned
    Given a fixture with no declaration and only a README.md
    When it is swept
    Then there are no findings
    And 0 files were scanned

  @test:scripts/tests/check-retired-front-matter.test.ts::the_guards::a_missing_record_is_reported_even_when_no_file_carries_the_key
  Scenario: Missing records are reported even when no file carries a retired key
    Given a fixture layer whose only skill declares no retired key
    And its own fsh-guts directory holds the record of every retirement but the first
    When it is swept
    Then the fsh-guts directory resolves inside the fixture
    And there are no findings
    And only the first retired key is reported as having a missing record

  @test:scripts/tests/check-retired-front-matter.test.ts::the_graph-typology_exemption::`roles:`_in_a_memory_entry_is_NOT_a_finding_—_different_kind,_real_reader
  Scenario: A roles key in a memory entry is exempt
    Given a fixture with a "folio-memory/v1" entry under skills/memory and a skill under skills/folio-core, both declaring "roles"
    When the layer is swept
    Then 2 files plus one record per retirement are scanned
    And the only finding is the skill

  @test:scripts/tests/check-retired-front-matter.test.ts::the_graph-typology_exemption::the_exemption_matches_the_DECLARATION,_not_the_directory
  Scenario: The exemption follows the schema declaration, not the directory
    Given a "folio-memory/v1" entry under skills/folio-core and a skill under skills/memory, both declaring "roles"
    When the layer is swept
    Then the only finding is the skill under skills/memory

  @test:scripts/tests/check-retired-front-matter.test.ts::the_graph-typology_exemption::on_the_REAL_tree_the_exemption_guards_a_non-empty_set,_and_only_that_set
  Scenario: On the real tree the exemption guards a non-empty set of memory entries only
    Given the first retirement's schema exemption is switched off
    When the real tree is swept
    Then there is at least one finding
    And every finding's front matter declares "folio-memory/v1"
    And with the exemption restored the sweep has no findings
