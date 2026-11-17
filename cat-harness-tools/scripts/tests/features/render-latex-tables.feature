# Tables in the LaTeX render: every tabular is wrapped in an adjustbox that
# only shrinks, over-wide prose columns wrap at a computed width, and long
# math and identifiers get break points. Each Scenario names the test that
# executes it.
Feature: LaTeX tables fit the line width

  @test:scripts/tests/render-latex-tables.test.ts::table_rendering_wraps_tabular_in_adjustbox::GFM_markdown_table_(renderTable_path)
  Scenario: A GFM table is wrapped in an adjustbox
    When a three-column GFM table is rendered
    Then it has a tabular inside exactly one adjustbox of max width \linewidth
    And the result validates with no errors

  @test:scripts/tests/render-latex-tables.test.ts::table_rendering_wraps_tabular_in_adjustbox::HTML_<table>_(htmlTableToLatex_path)
  Scenario: An HTML table is wrapped in an adjustbox
    When an HTML table is rendered
    Then it has a tabular inside exactly one adjustbox of max width \linewidth
    And the result validates with no errors

  @test:scripts/tests/render-latex-tables.test.ts::table_rendering_wraps_tabular_in_adjustbox::booktabs_rules_are_preserved_inside_the_wrapper
  Scenario: booktabs rules are kept
    When the GFM table is rendered
    Then it has \toprule, \midrule and \bottomrule

  @test:scripts/tests/render-latex-tables.test.ts::table_rendering_wraps_tabular_in_adjustbox::non-table_prose_is_not_wrapped_(no_spurious_adjustbox)
  Scenario: Prose is not wrapped
    When a paragraph with inline math is rendered
    Then it contains no "adjustbox"

  @test:scripts/tests/render-latex-tables.test.ts::smart_column_sizing_for_over-wide_tables::narrow_table_keeps_a_plain_l/c/r_spec_(no_p{}_wrapping)
  Scenario: A narrow table keeps a plain column spec
    When a three-cell table aligned left, centre and right is rendered
    Then its tabular spec is "l c r" with no p{}

  @test:scripts/tests/render-latex-tables.test.ts::smart_column_sizing_for_over-wide_tables::over-wide_prose_table_wraps_its_long_column_at_a_computed_p{<frac>\linewidth}
  Scenario: An over-wide prose table wraps its long column at a computed fraction of the line width
    Given a three-column table whose description column holds sentences well over forty-five characters
    When it is rendered to LaTeX
    Then a column is ragged-right p{0.<digits>\linewidth}
    And the adjustbox safety net is kept, and the LaTeX validates with no errors

  @test:scripts/tests/render-latex-tables.test.ts::smart_column_sizing_for_over-wide_tables::over-wide_DENSE_table_(nothing_wraps)_stays_plain_for_adjustbox_to_scale
  Scenario: An over-wide dense table stays plain for the adjustbox to scale
    When an eight-column table of short cells is rendered
    Then it has no p{} and is wrapped in the adjustbox

  @test:scripts/tests/render-latex-tables.test.ts::smart_column_sizing_for_over-wide_tables::chooseColumnSpec:_fits_→_plain;_one_long_prose_column_→_weighted_p{}
  Scenario: The column spec stays plain when it fits and wraps one long prose column
    Then short cells keep the spec "l c"
    And a long definition column becomes a ragged-right p{0.N\linewidth} after an "l"

  @test:scripts/tests/render-latex-tables.test.ts::smart_column_sizing_for_over-wide_tables::water-fill:_a_huge_column_does_not_crush_the_other_wrapped_columns
  Scenario: A huge column does not crush the other wrapped columns
    Given a moderately long heading column and a very long prose column
    When the column spec is chosen
    Then both columns wrap, each at least 0.1 of the line width, and the huge one gets more

  @test:scripts/tests/render-latex-tables.test.ts::smart_column_sizing_for_over-wide_tables::a_many-column_wide_table_scales_rather_than_cram_unreadable_slivers
  Scenario: A many-column wide table scales rather than wraps
    Given eight columns of fairly long text
    When the column spec is chosen
    Then it is "l l l l l l l l" with no p{}

  @test:scripts/tests/render-latex-tables.test.ts::breaking_non-breaking_blobs_(long_math_+_identifiers)::splitLongMath_breaks_top-level_operators,_not_inside_\frac_/_groups
  Scenario: splitLongMath breaks top-level operators, not those inside \frac groups
    Given long math joining four \frac terms with top-level +, - and =
    When splitLongMath splits it
    Then \frac{a+b}{c+d} is untouched, a top-level + is followed by \allowbreak{}, and there are at least three break points

  @test:scripts/tests/render-latex-tables.test.ts::breaking_non-breaking_blobs_(long_math_+_identifiers)::short_math_is_returned_unchanged
  Scenario: Short math is unchanged
    Then splitting "a + b" returns "a + b"

  @test:scripts/tests/render-latex-tables.test.ts::breaking_non-breaking_blobs_(long_math_+_identifiers)::a_long_polynomial_cell_makes_its_column_wrap_and_breakable
  Scenario: A long polynomial cell makes its column wrap and break
    When a table holding a long polynomial is rendered
    Then it has a p{} column and "\allowbreak{}"
    And it validates with no errors

  @test:scripts/tests/render-latex-tables.test.ts::breaking_non-breaking_blobs_(long_math_+_identifiers)::long_inline-code_identifier_is_breakable
  Scenario: A long inline-code identifier is breakable
    When a long dotted identifier in code is rendered
    Then its \texttt holds an \allowbreak

  @test:scripts/tests/render-latex-tables.test.ts::breaking_non-breaking_blobs_(long_math_+_identifiers)::a_formula_abutting_a_word_(dropped_space)_gets_a_zero-width_break
  Scenario: A formula abutting a word gets a zero-width break
    Then "at $V_{(2,1)}$discharged by it" renders with "$\allowbreak{}discharged"
    And "$n$th", "$\mathbb{Z}$-module" and an already spaced "$V$ discharged" get no break

  @test:scripts/tests/render-latex-tables.test.ts::breaking_non-breaking_blobs_(long_math_+_identifiers)::findMathTextSeams_reports_dropped-space_seams_(for_the_audit_sidecar)
  Scenario: Dropped-space seams are reported
    When the seams of a text with "$V$discharged", "$n$th" and a spaced "$A$" on line 3 are found
    Then there is one seam, mentioning "discharged", on line 3
