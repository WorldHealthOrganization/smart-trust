# Escaping a Markdown table cell's pipes escapes backslashes in the same pass,
# and no source in this layer does otherwise. Each Scenario names the test that executes it.
Feature: Markdown pipe escaping

  @test:scripts/tests/md-pipe-escape.test.ts::Markdown_pipe_escaping::the_idiom_escapes_backslashes_and_pipes_in_one_pass
  Scenario: The idiom escapes backslashes and pipes in one pass
    When a|b, a value ending in a backslash and a pipe, and plain text are escaped with the idiom
    Then the pipe is escaped, the backslash and pipe are each escaped, and plain text is unchanged

  @test:scripts/tests/md-pipe-escape.test.ts::Markdown_pipe_escaping::no_source_in_this_layer_escapes_pipes_without_escaping_backslashes
  Scenario: No source in this layer escapes pipes without escaping backslashes
    When this layer's .ts files outside node_modules are scanned
    Then there is at least one, and none holds the pipe-only escape
