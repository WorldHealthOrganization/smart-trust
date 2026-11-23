Feature: The Library strippers and their upstream copies

  @test:scripts/library-strip/library-strip.test.ts::the_Library_strippers_run_on_a_non-WHO_IG::contentReplacesInlineCql
  Scenario: strip_library_content replaces inline CQL with a reference to the standalone file
    Given a Library with inline CQL and ELM
    When strip_library_content.py runs
    Then its first content is a reference to "Library-Foo.cql"

  @test:scripts/library-strip/library-strip.test.ts::the_Library_strippers_run_on_a_non-WHO_IG::binariesExtractsElm
  Scenario: strip_library_binaries extracts the ELM to a file and references it
    Given a Library with inline CQL and ELM
    When strip_library_binaries.py runs
    Then its second content is a reference to "Library-Foo.elm.json"
    And that file is written

  @test:scripts/library-strip/library-strip.test.ts::the_copies_are_the_upstream_bytes_the_README_records::copyMatchesReadmeSha[${String(f).replace(/\s+/g,_"_")}]
  Scenario Outline: <f> matches its recorded sha256
    Given the copied script <f>
    Then its sha256 is the one the README records

    Examples:
      | f |
      | strip_library_binaries.py |
      | strip_library_content.py |
