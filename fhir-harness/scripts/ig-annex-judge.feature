Feature: Judging an IG instance's annex declarations

  @test:scripts/ig-annex-judge.test.ts::judgeIgAnnexDir::heldFileCleanPageUnverified
  Scenario: a declaration whose file is held judges clean, and its page is said unverified without input/pagecontent/
    Given an annex declaration whose file is held, in an IG with no input/pagecontent
    When the annex directory is judged
    Then there are no findings, 1 record, and the page "dictionary.md" is unverified

  @test:scripts/ig-annex-judge.test.ts::judgeIgAnnexDir::pageJudgedWithPagecontent
  Scenario: with input/pagecontent/ the page is judged: held passes, missing is a finding
    Given an IG with input/pagecontent
    Then an annex on a page that exists passes with nothing unverified
    And an annex on "nope.md" is a finding that it is not a page under input/pagecontent

  @test:scripts/ig-annex-judge.test.ts::judgeIgAnnexDir::noAnnexesJsonIsFinding
  Scenario: no annexes.json is a finding, never an empty pass
    Given an annex directory with no annexes.json
    Then the first finding says it holds no annexes.json

  @test:scripts/ig-annex-judge.test.ts::judgeIgAnnexDir::bareArrayOrUnknownFieldInvalid
  Scenario: the bare array and an unknown field do not validate as ig-annexes/v1
    Then a bare array of annexes does not validate as ig-annexes/v1
    And a record with an unknown field does not validate as ig-annexes/v1

  @test:scripts/ig-annex-judge.test.ts::judgeIgAnnexDir::missingOutsideDuplicateFindings
  Scenario: a file not held, a file outside the instance, a record twice and a column twice are findings
    Given annexes naming a missing file, a file outside the instance, a column twice and the same record twice
    Then the findings say the file is not held, the file is outside its instance, a column is shown twice and a record is declared twice

  @test:scripts/ig-annex-judge.test.ts::judgeInstanceAnnexes::judgesDeclaredSaysAbsent
  Scenario: judges each declared ig-annex directory, and says one absent from the checkout rather than reading it as empty
    Given an instance declaring a held annex directory and one absent from the checkout
    Then the held directory is judged with no findings
    And the absent directory is listed as absent

  @test:scripts/ig-annex-judge.test.ts::judgeInstanceAnnexes::otherKindDirNotRead
  Scenario: a directory of another kind holding an annexes.json is not read
    Given an annexes.json in a directory declared as another kind
    Then only the declared annex directory's annexes.json is judged
