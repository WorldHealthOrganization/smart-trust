# Covers scripts/serve-rendering.py, the Python standard-library rendering server: its declared media types,
# the directory-index rule, and containment within the served root. Each Scenario names the test that executes it.
Feature: Python rendering server

  @test:scripts/tests/ui/serve-rendering-py.test.ts::the_python_media-type_table::`.schema.json`_beats_`.json`_—_compound_extension_wins
  Scenario: The compound extension .schema.json beats .json
    Given the Python module "scripts/serve-rendering.py" loaded in a Python 3 process
    When the media types of "x.schema.json" and "x.json" are looked up
    Then they are "application/schema+json" and "application/json" respectively

  @test:scripts/tests/ui/serve-rendering-py.test.ts::the_python_media-type_table::the_compound_extension_is_listed_before_its_own_suffix
  Scenario: The compound extension is listed before its own suffix
    Given the Python module's media-type table
    Then ".schema.json" comes before ".json" in it

  @test:scripts/tests/ui/serve-rendering-py.test.ts::the_python_media-type_table::an_undeclared_extension_is_None,_not_a_guess
  Scenario: An undeclared extension has no media type
    Given the Python module loaded in a Python 3 process
    When the media types of "notes.txt" and "archive.tar.gz" are looked up
    Then both are None

  @test:scripts/tests/ui/serve-rendering-py.test.ts::what_a_client_actually_receives_from_python_server::%s_is_served_as_%s
  Scenario: Declared files are served with their declared media type
    Given the Python server running over a root holding ".jsonld", ".json" and ".schema.json" files
    When each of "/folio-assistant.jsonld", "/folio-assistant.json" and "/folio-assistant.schema.json" is fetched
    Then each answers 200
    And the content types are "application/ld+json", "application/json" and "application/schema+json" respectively

  @test:scripts/tests/ui/serve-rendering-py.test.ts::what_a_client_actually_receives_from_python_server::the_bare_stub_resolves_to_the_viewer,_as_text/html
  Scenario: The bare stub path is served as HTML
    # Gap: the body is not checked to be the viewer's index.html
    Given a "folio-assistant/index.html" under the served root
    When "/folio-assistant/" is fetched
    Then it answers 200
    And the content type is "text/html"

  @test:scripts/tests/ui/serve-rendering-py.test.ts::what_a_client_actually_receives_from_python_server::an_undeclared_file_keeps_the_server's_own_inference,_not_octet-stream
  Scenario: An undeclared file keeps the server's own media type inference
    When "/notes.txt" is fetched
    Then it answers 200
    And the content type contains "text/plain"

  @test:scripts/tests/ui/serve-rendering-py.test.ts::what_a_client_actually_receives_from_python_server::a_missing_path_is_404
  Scenario: A missing path is not found
    When "/nope.jsonld" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::traversal_over_the_wire_is_404
  Scenario: Percent-encoded traversal is not found
    When "/%2e%2e/%2e%2e/etc/passwd" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::plain_traversal_does_not_escape_the_root
  Scenario: Plain traversal does not escape the root
    When "/../../etc/passwd" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::mixed_separators_traversal_does_not_escape_the_root
  Scenario: Traversal with doubled separators does not escape the root
    When "/..//..//etc/passwd" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::a_symlink_pointing_outside_the_root_is_refused
  Scenario: A symlink pointing outside the root is refused
    Given "escape.txt" in the root is a symlink to a file outside it
    When "/escape.txt" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::a_symlink_staying_inside_the_root_still_works
  Scenario: A symlink staying inside the root is served
    Given "alias.jsonld" in the root is a symlink to "folio-assistant.jsonld"
    When "/alias.jsonld" is fetched
    Then it answers 200
    And the content type is "application/ld+json"

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::a_broken_symlink_is_404_rather_than_a_crash
  Scenario: A broken symlink is not found
    Given "dangling.jsonld" in the root is a symlink to a missing file
    When "/dangling.jsonld" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::a_directory_with_no_index_is_404,_not_a_listing
  Scenario: A directory with no index is not found rather than listed
    Given an empty directory "empty-dir" in the root
    When "/empty-dir/" is fetched
    Then it answers 404

  @test:scripts/tests/ui/serve-rendering-py.test.ts::containment_in_python_server::a_malformed_percent-escape_names_no_file
  Scenario: A malformed percent-escape names no file
    When "/%zz" is fetched
    Then it answers 404
