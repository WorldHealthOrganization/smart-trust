Feature: describe-dir — what a file or a directory is, read from itself

  Extractive and offline: a directory README describes an undeclared
  subdirectory, and a file nothing else names, from the words already in it.

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::tsDocCommentAfterImports
  Scenario: a TypeScript doc comment after the imports gives its title line, its @tags dropped
    Then a TypeScript doc comment after the imports gives its title line, its @tags dropped

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::licenceHeaderSkipped
  Scenario: a licence header is not documentation; the next doc comment is read
    Then a licence header is not documentation; the next doc comment is read

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::pythonDocstring
  Scenario: a Python module docstring gives its first sentence, after a shebang
    Then a Python module docstring gives its first sentence, after a shebang

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::shellCommentBlock
  Scenario: a shell script's leading comment block gives its first sentence, rules of = dropped
    Then a shell script's leading comment block gives its first sentence, rules of = dropped

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::leanModuleDoc
  Scenario: a Lean module docstring gives its heading
    Then a Lean module docstring gives its heading

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::gherkinFeatureLine
  Scenario: a Gherkin file names itself on its Feature line
    Then a Gherkin file names itself on its Feature line

  @test:scripts/describe-dir.test.ts::leading_documentation,_by_language::noDocIsUndefined
  Scenario: a file with no leading documentation has none
    Then a file with no leading documentation has none

  @test:scripts/describe-dir.test.ts::a_file_nothing_inside_describes::kindNounsAreNeutral
  Scenario: an archive, a lockfile and a PDF are named by their kind, and code is not
    Then an archive, a lockfile and a PDF are named by their kind, and code is not

  @test:scripts/describe-dir.test.ts::a_file_nothing_inside_describes::textTitleNeedsWords
  Scenario: a plain-text first line is a title only when it has words, so a data header is not printed
    Then a plain-text first line is a title only when it has words, so a data header is not printed

  @test:scripts/describe-dir.test.ts::a_file_nothing_inside_describes::describeFileReadsCodeAndKinds
  Scenario: a file row reads code's doc comment, names an archive by its kind, and leaves binary and data text neutral
    Then a file row reads code's doc comment, names an archive by its kind, and leaves binary and data text neutral

  @test:scripts/describe-dir.test.ts::a_subdirectory,_from_what_it_holds::jsonTitleBeforeParagraph
  Scenario: a JSON file's title comes before its paragraph, and an array names nothing
    Then a JSON file's title comes before its paragraph, and an array names nothing

  @test:scripts/describe-dir.test.ts::a_subdirectory,_from_what_it_holds::readmeSkipsWritersOwnParagraphs
  Scenario: a README's placeholder and "Part of" paragraphs are this writer's own and are not taken
    Then a README's placeholder and "Part of" paragraphs are this writer's own and are not taken

  @test:scripts/describe-dir.test.ts::a_subdirectory,_from_what_it_holds::cutNeverLeavesCodeSpanOpen
  Scenario: cutting a long line never leaves a code span open
    Then cutting a long line never leaves a code span open

  @test:scripts/describe-dir.test.ts::a_subdirectory,_from_what_it_holds::kindsPhraseHasNoNumber
  Scenario: the kinds phrase names kinds in name order, then "and other", never a number
    Then the kinds phrase names kinds in name order, then "and other", never a number

  @test:scripts/describe-dir.test.ts::a_subdirectory,_from_what_it_holds::onlyCommittedFilesAreRead
  Scenario: only committed files are read, and an empty subdirectory has no description
    Then only committed files are read, and an empty subdirectory has no description
