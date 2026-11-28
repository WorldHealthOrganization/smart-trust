# pipeline/include-po.ts gives a page's HTML and SVG includes a gettext
# catalogue of their own. Each Scenario names the test that executes it.
Feature: gettext over a page's HTML and SVG includes

  @test:pipeline/include-po.test.ts::extractInclude::reads_an_HTML_include's_words_and_leaves_its_Liquid_out
  Scenario: extractInclude: Reads an HTML include's words and leaves its Liquid out
    Given the fixture in include-po.test.ts
    When extractInclude runs on it
    Then it reads an HTML include's words and leaves its Liquid out

  @test:pipeline/include-po.test.ts::extractInclude::reads_an_SVG_include's_labels_and_tooltips
  Scenario: extractInclude: Reads an SVG include's labels and tooltips
    Given the fixture in include-po.test.ts
    When extractInclude runs on it
    Then it reads an SVG include's labels and tooltips

  @test:pipeline/include-po.test.ts::injectInclude::puts_an_include's_words,_labels_and_tooltips_into_the_catalogue's_language
  Scenario: injectInclude: Puts an include's words, labels and tooltips into the catalogue's language
    Given the fixture in include-po.test.ts
    When injectInclude runs on it
    Then it puts an include's words, labels and tooltips into the catalogue's language

  @test:pipeline/include-po.test.ts::injectInclude::lays_an_Arabic_label_out_right_to_left,_its_edge_where_the_English_edge_was
  Scenario: injectInclude: Lays an Arabic label out right to left, its edge where the English edge was
    Given the fixture in include-po.test.ts
    When injectInclude runs on it
    Then it lays an Arabic label out right to left, its edge where the English edge was

  @test:pipeline/include-po.test.ts::injectInclude::names_an_include's_catalogue_by_its_file
  Scenario: injectInclude: Names an include's catalogue by its file
    Given the fixture in include-po.test.ts
    When injectInclude runs on it
    Then it names an include's catalogue by its file
