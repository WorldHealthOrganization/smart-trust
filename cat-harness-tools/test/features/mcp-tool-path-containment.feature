# MCP tool arguments that name a path (src/tools/translation.ts, src/tools/nquads-query.ts,
# src/tools/folio-init.ts, src/workflow/store.ts) are refused when they leave the repository.
# Each Scenario names the test that executes it.
Feature: MCP tool path arguments stay inside the repository

  @test:test/mcp-tool-path-containment.test.ts::translation_tools::still_injects_for_an_ordinary_source,_po_file_and_locale
  Scenario: translation_inject writes an ordinary translation inside the repository
    Given a repository with docs/a.md and its po file docs/a.po
    When translation_inject is called with source "docs/a.md", po file "docs/a.po" and locale "fr"
    Then the result is not an error
    And translations/fr/a.md exists in the repository

  @test:test/mcp-tool-path-containment.test.ts::translation_tools::refuses_a_locale_that_is_not_a_BCP_47_tag,_and_writes_nothing_outside
  Scenario: translation_inject refuses a locale that is not a BCP 47 tag
    Given a repository with docs/a.md and docs/a.po beside an outside directory
    When translation_inject is called with each locale "../../../outside/x", "..", "fr/../../x" and "fr" followed by a NUL
    Then each result is an error mentioning "BCP 47"
    And no "x" is written in the outside directory or the parent directory

  @test:test/mcp-tool-path-containment.test.ts::translation_tools::refuses_to_write_through_a_locale_directory_that_links_out_of_the_translations_root
  Scenario: translation_inject refuses a locale directory that links out of the translations root
    Given translations/de in the repository is a symlink to a directory outside it
    When translation_inject is called with locale "de"
    Then the result is an error
    And no a.md is written in the outside directory

  @test:test/mcp-tool-path-containment.test.ts::translation_tools::refuses_a_source_or_po_file_outside_the_repository,_including_through_a_link
  Scenario: translation_inject refuses a source or po file outside the repository, including through a symlink
    Given docs/link.md in the repository is a symlink to a file outside it
    When translation_inject is called with source "../outside/secret.md", the absolute outside path, or "docs/link.md"
    Then each result is an error saying "not an existing path inside the repository"
    And a po file of "../outside/secret.md" is also refused with an error

  @test:test/mcp-tool-path-containment.test.ts::translation_tools::extract,_status,_signoff_and_validate_refuse_the_same_values
  Scenario: The other translation tools refuse the same escaping paths and locales
    When translation_extract is called with path "../outside" or locale "../../x"
    And translation_status is called with locale "../../outside"
    And translation_signoff is called with locale "../../x" or source "../outside/secret.md"
    And translation_validate is called with pot file "../outside/secret.md"
    Then each result is an error
    And no "x" is written in the parent directory

  @test:test/mcp-tool-path-containment.test.ts::workflow_instance_store::does_not_read_or_write_an_instance_id_that_is_not_one_segment
  Scenario: The workflow instance store refuses an instance id that is not one path segment
    Given a planted.json in a directory outside the repository
    When the instance "../../outside/planted" is loaded
    Then nothing is loaded
    And saving an instance with id "../../outside/evil" throws "not one path segment"
    And no evil.json is written outside

  @test:test/mcp-tool-path-containment.test.ts::nquads_query_and_folio_init::nquads_query_refuses_a_dataset_outside_the_working_tree
  Scenario: nquads_query refuses a dataset outside the working tree
    When nquads_query is called with a dataset directory outside the repository
    Then the result is an error containing "Refused"

  @test:test/mcp-tool-path-containment.test.ts::nquads_query_and_folio_init::folio_init_refuses_a_dir_outside_the_working_tree_and_an_assistant_path_with_shell_or_code_characters
  Scenario: folio_init refuses an outside dir and an assistant path with shell characters
    When folio_init is called as a dry run with a dir outside the repository
    Then the result is an error containing "not inside the repository"
    And when it is called with dir "." and an assistant path containing a quote and a command substitution, the result is an error
