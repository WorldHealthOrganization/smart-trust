# The structure-accessor gate must fail on the thing it exists for, not only
# pass on today's tree. Each Scenario names the test that executes it.
Feature: Structure accessor gate

  Background:
    Given sources building structure.json paths from quoted tokens, mentioning it in comments and messages, and using the constant

  @test:scripts/tests/structure-accessor.test.ts::what_the_gate_matches::a_path_built_from_the_quoted_token_is_caught,_in_either_quote_style
  Scenario: A path from the quoted token is caught
    Then the double-quoted and single-quoted joins are hits

  @test:scripts/tests/structure-accessor.test.ts::what_the_gate_matches::prose_is_not:_doc_comments,_line_comments_and_the_name_inside_a_message
  Scenario: Prose mentions are not caught
    Then the doc comment, the line comment and the error message are not hits

  @test:scripts/tests/structure-accessor.test.ts::what_the_gate_matches::the_constant_is_the_way_through
  Scenario: The constant is not caught
    Then the join using STRUCTURE_FILENAME is not a hit

  @test:scripts/tests/structure-accessor.test.ts::the_real_corpus::passes,_and_every_allowlist_entry_still_earns_its_place
  Scenario: The real corpus passes
    # Gap: asserts only exit 0 and empty stderr; whether every allowlist entry still earns its place is left to the script.
    When check-structure-accessor.ts runs on the repository
    Then it exits 0 with nothing on stderr

  @test:scripts/tests/structure-accessor.test.ts::the_real_corpus::every_allowlist_entry_carries_a_reason,_the_declared_ones_included
  Scenario: Every allowlist entry has a reason
    Then every built-in and declared allowlist entry's reason is longer than 20 characters

  @test:scripts/tests/structure-accessor.test.ts::the_real_corpus::this_layer's_own_list_names_no_file_of_an_instance_above_it
  Scenario: The built-in allowlist names only this layer's and cat-harness's files
    Then every built-in entry starts with cat-harness/ or cat-harness-tools/

  @test:scripts/tests/structure-accessor.test.ts::entries_an_instance_declares_for_its_own_files::are_read_repo-relative,_with_their_reason,_for_this_gate_only
  Scenario: Declared exemptions are read for this gate only
    Given an instance "up" exempting one file for this gate and one for another gate
    Then the declared allowlist is up/schemas/x.ts with its reason

  @test:scripts/tests/structure-accessor.test.ts::entries_an_instance_declares_for_its_own_files::an_instance_declaring_none_contributes_none
  Scenario: An instance declaring no file exemptions contributes none
    Then an instance whose exemptions list no files contributes nothing
