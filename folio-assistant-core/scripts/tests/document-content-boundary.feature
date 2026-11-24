Feature: the document adapter's content half stays apart from the server half

  @test:scripts/tests/document-content-boundary.test.ts::the_document_adapter's_content_half::importsNothingMoving[${file}]
  Scenario Outline: <file> imports nothing that moves to cat-harness-tools
    Given the content-half file <file>
    When its imports are read
    Then it has imports
    And none of them is a module moving to cat-harness-tools

    Examples:
      | file |
      | content.ts |
      | resolver.ts |
      | intake-records.ts |
      | paths.ts |

  @test:scripts/tests/document-content-boundary.test.ts::the_document_adapter's_content_half::contentDeclaresClass
  Scenario: content.ts declares the class the server half extends
    When content.ts and index.ts are read
    Then content.ts declares DocumentContent and index.ts extends it as DocumentContentAdapter

  @test:scripts/tests/document-content-boundary.test.ts::the_document_adapter's_content_half::guardHasTeeth
  Scenario: the guard has teeth — the server half DOES import moving modules
    When index.ts's imports are read
    Then some of them are moving modules
