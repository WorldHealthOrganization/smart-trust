# scripts/content-holds-code.ts (`content-instance-holds-code`): a layer that declares itself
# content may hold no code files, shown failing on planted repositories.
# Each Scenario names the test that executes it.
Feature: A content instance holds no code

  @test:scripts/tests/content-holds-code.test.ts::codeFiles::keeps_code_extensions,_drops_content,_sorts,_and_exempts_folio_directories
  Scenario: Code files are filtered by extension, sorted and exclude folio directories
    Given an instance listing "b.ts", "a.py", "notes.md", "data.json", "content/blocks/b1.ts", "run.sh" and "x.d/y"
    When its code files are selected with "content" as a folio directory
    Then they are "a.py", "b.ts" and "run.sh" in that order

  @test:scripts/tests/content-holds-code.test.ts::contentInstanceCode_—_planted::FAILS_on_a_content_instance_holding_code,_naming_each_file
  Scenario: A content instance holding code is judged with each code file named
    Given a planted instance declaring separation "content"
    And it lists "scripts/gen.ts", "README.md" and "themes/t.ts"
    When it is judged
    Then the state is "judged" with files "scripts/gen.ts" and "themes/t.ts"
    And its findings are located at those two files
    And the first finding's detail mentions "FR-7"

  @test:scripts/tests/content-holds-code.test.ts::contentInstanceCode_—_planted::passes_on_a_content_instance_with_no_code
  Scenario: A content instance with no code is judged with no files
    Given a planted content instance listing "README.md" and "catalogue/nodes/a.json"
    When it is judged
    Then the state is "judged" with no files

  @test:scripts/tests/content-holds-code.test.ts::contentInstanceCode_—_planted::is_n/a_on_an_instance_that_does_not_declare_itself_content
  Scenario: An instance that is not content is n/a
    Given a planted instance with no separation declared
    And it lists "scripts/gen.ts"
    When it is judged
    Then the verdict is exactly state "n/a"

  @test:scripts/tests/content-holds-code.test.ts::contentInstanceCode_—_planted::reads_the_content_half_from_a_tools_instance's_`supports`
  Scenario: An instance is content when a tools instance supports it
    Given a planted instance "inst" with no separation declared
    And a sibling "inst-tools" whose supports names "inst"
    When "inst" listing "x.ts" is judged
    Then the state is "judged"
    And the basis names "inst-tools"

  @test:scripts/tests/content-holds-code.test.ts::contentInstanceCode_—_planted::could-not-list_is_UNKNOWN,_never_a_pass
  Scenario: An instance whose files cannot be listed is unknown
    Given a planted content instance
    And a lister that returns nothing
    When it is judged
    Then the state is "unknown"
