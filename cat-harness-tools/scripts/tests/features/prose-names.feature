# A general node's prose may name a file; the name has to still resolve (bean
# epbt). Four states, and only one is a finding. Each Scenario names the test that executes it.
Feature: Files named in prose

  @test:scripts/tests/prose-names.test.ts::namedFiles_—_what_prose_names::paths,_bare_names_and_backticked_names_are_all_read,_once_each
  Scenario: Paths, bare names and backticked names are read once each
    Then prose naming a backticked file, a path, and the same file again yields the file and the path once each

  @test:scripts/tests/prose-names.test.ts::namedFiles_—_what_prose_names::a_URL_is_not_a_file_in_this_checkout
  Scenario: A URL is not a file in this checkout
    Then prose holding a URL names no file

  @test:scripts/tests/prose-names.test.ts::namedFiles_—_what_prose_names::a_word_ending_in_a_dot_is_not_a_file
  Scenario: A word ending in a dot is not a file
    Then ordinary sentences name no file

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::a_path_that_exists_resolves
  Scenario: A path that exists resolves
    Then notes/proposals/here.md resolves

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::a_bare_name_some_tracked_file_carries_resolves
  Scenario: A bare name some tracked file carries resolves
    Then feature-staging.yml resolves

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::a_glob_or_placeholder_is_not_a_path
  Scenario: A glob or placeholder is not a path
    Then processes/*.bpmn and <slug>.md are not paths

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::a_bare_name_nothing_carries_is_UNDETERMINED_—_an_output_or_example_as_often_as_stale
  Scenario: A bare name nothing carries is undetermined
    Then qa.json is undetermined

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::a_path_in_a_directory_that_is_not_here_is_UNDETERMINED_—_no_claim_this_checkout_can_refute
  Scenario: A path in a directory that is not here is undetermined
    Then work/work.json is undetermined

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::a_path_whose_directory_IS_here_and_whose_file_is_not_is_MISSING_—_the_one_finding
  Scenario: A path whose directory is here and whose file is not is missing
    Then notes/proposals/gone.md is missing

  @test:scripts/tests/prose-names.test.ts::classifyName_—_four_states::any_root_may_resolve_it_—_a_sibling_instance's_path_spelled_from_its_own_root
  Scenario: Any root may resolve a name
    Then schemas/m.ts resolves when a sibling root holds it

  @test:scripts/tests/prose-names.test.ts::where_general_prose_is_read_from::a_@general_declaration's_doc_comment_and_body_are_read;_others_are_not
  Scenario: A @general declaration's doc comment and body are read; others are not
    Given a @general interface naming files in its doc comment and a member's, and a plain interface naming another
    Then only the general declaration is read, naming scripts/a.ts and scripts/b.ts

  @test:scripts/tests/prose-names.test.ts::where_general_prose_is_read_from::a_diagram's_documentation_is_read,_entity-decoded;_its_XML_comments_are_not
  Scenario: A diagram's documentation is read, entity-decoded; its XML comments are not
    Then a diagram whose comment names one file and whose documentation names two with an encoded ampersand names only the two
