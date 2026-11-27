# The script-quality Python checkers (pipeline/qa-checkers-python.ts). For
# does_not_default_to_float, a "cast hit" is a hit starting "bare `float(" and
# a "literal hit" one starting "bare float literal". Each Scenario names the
# test that executes it.
Feature: The Python script-quality checkers

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_sentinel_exemption::float('inf')_is_exempt
  Scenario: float("inf") is exempt
    Given a Python file 'x = float("inf")'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_sentinel_exemption::float('nan')_is_exempt
  Scenario: float('nan') is exempt
    Given a Python file "y = float('nan')"
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_sentinel_exemption::float('-inf')_is_exempt
  Scenario: float("-inf") is exempt
    Given a Python file 'z = float("-inf")'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_sentinel_exemption::float('infinity')_is_exempt_(Python_long_form)
  Scenario: float("infinity") is exempt
    Given a Python file 'a = float("infinity")'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_sentinel_exemption::sentinel_exemption_is_case-insensitive
  Scenario: The sentinel exemption is case-insensitive
    Given a Python file 'a = float("INF")'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_no_double-flag::float(1.0)_is_reported_ONCE_as_a_cast
  Scenario: float(1.0) is reported once, as a cast
    Given a Python file "a = float(1.0)"
    When does_not_default_to_float checks it
    Then there is one cast hit and no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_no_double-flag::float(x)_on_a_name_is_a_cast_hit,_no_literal_hit
  Scenario: float(x) on a name is a cast hit
    Given a Python file "b = float(x)"
    When does_not_default_to_float checks it
    Then there is one cast hit and no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_bare_literals::bare_float_literal_outside_any_cast_is_reported_once
  Scenario: A bare float literal is reported once
    Given a Python file "c = 1.5"
    When does_not_default_to_float checks it
    Then there is one literal hit and no cast hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_bare_literals::scientific_notation_literal_is_reported
  Scenario: A scientific-notation literal is reported
    Given a Python file "d = 3.14e-10"
    When does_not_default_to_float checks it
    Then there is one literal hit and no cast hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_bare_literals::two_bare_literals_on_one_line_each_report
  Scenario: Two bare literals on one line each report
    Given a Python file "i = 1.0 + 2.0"
    When does_not_default_to_float checks it
    Then there are two literal hits and no cast hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_bare_literals::cast_+_unrelated_literal_both_report
  Scenario: A cast and an unrelated literal both report
    Given a Python file "j = float(x) + 2.0"
    When does_not_default_to_float checks it
    Then there is one literal hit and one cast hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_string_+_comment_exemption::float_literal_inside_a_`#`_comment_is_exempt
  Scenario: A float literal in a comment is exempt
    Given a Python file "e = 1  # set to 1.5 later"
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_string_+_comment_exemption::float_literal_inside_a_single-line_string_is_exempt
  Scenario: A float literal in a single-line string is exempt
    Given a Python file 'f = "value is 1.5 by default"'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_string_+_comment_exemption::float_literal_inside_a_triple-quoted_docstring_is_exempt
  Scenario: A float literal in a triple-quoted docstring is exempt
    Given a Python file whose docstring says "1.0 is allowed here"
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_string_+_comment_exemption::mpmath.mpf('0.5')_string_arg_is_exempt
  Scenario: A string argument to mpf is exempt
    Given a Python file 'h = mpf("0.5")'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_string_+_comment_exemption::no_floats_at_all_→_pass_with_zero_hits
  Scenario: A file with no floats has no hits
    Given a Python file with an integer and a plain string
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_PEP_515_underscores::1_000.5_is_reported_as_a_bare_float_literal
  Scenario: A PEP 515 literal 1_000.5 is a bare literal
    Given a Python file "m = 1_000.5"
    When does_not_default_to_float checks it
    Then there is one literal hit, its text containing "1_000.5"

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_PEP_515_underscores::1.5_5e1_0_(underscore_in_mantissa_+_exponent)_is_reported
  Scenario: Underscores in mantissa and exponent are one literal
    Given a Python file "n = 1.5_5e1_0"
    When does_not_default_to_float checks it
    Then there is one literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_PEP_515_underscores::1.5e10_is_reported_as_the_full_e-form,_not_split_at_the_dot
  Scenario: 1.5e10 is reported whole
    Given a Python file "p = 1.5e10"
    When does_not_default_to_float checks it
    Then there is one literal hit, its text containing "1.5e10"

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_nested_parens::float(int(x))_is_captured_as_a_single_cast_(one_level_of_nesting)
  Scenario: float(int(x)) is one cast
    Given a Python file "q = float(int(x))"
    When does_not_default_to_float checks it
    Then there is one cast hit and no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_nested_parens::float(int(1.0))_reports_cast_once;_inner_literal_blanked_by_cast
  Scenario: float(int(1.0)) is one cast and its inner literal is not reported
    Given a Python file "r = float(int(1.0))"
    When does_not_default_to_float checks it
    Then there is one cast hit and no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_multiline_casts::multiline_float("inf")_sentinel_(Black-style)_is_exempt
  Scenario: A multiline float("inf") is exempt
    Given a Python file with float( and "inf" on the next line and ) after
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_multiline_casts::multiline_float(1.0)_(Black-style)_reports_cast_once
  Scenario: A multiline float(1.0,) is one cast
    Given a Python file with float( and "1.0," on the next line and ) after
    When does_not_default_to_float checks it
    Then there is one cast hit and no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_trailing-comma_sentinel_(Black)::single-line_float("inf",)_is_exempt
  Scenario: float("inf",) with a trailing comma is exempt
    Given a Python file 'u = float("inf",)'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_trailing-comma_sentinel_(Black)::multiline_float(\n_"inf",\n)_is_exempt
  Scenario: A multiline float("inf",) with a trailing comma is exempt
    Given a Python file whose float( call spans three lines, holding "inf" and a trailing comma
    When does_not_default_to_float checks it
    Then there are no casts, no literals and no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_trailing-comma_sentinel_(Black)::float("nan",)_is_exempt
  Scenario: float("nan",) with a trailing comma is exempt
    Given a Python file 'w = float("nan",)'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_format-spec_exemption::f-string_format_spec_{x:.2f}_does_not_flag_.2_as_a_bare_float
  Scenario: An f-string precision spec is not a float
    Given a Python file 'aa = f"value is {x:.2f}"'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_format-spec_exemption::f-string_width.precision_spec_{x:10.5f}_does_not_flag_10.5
  Scenario: An f-string width.precision spec is not a float
    Given a Python file 'ab = f"{x:10.5f}"'
    When does_not_default_to_float checks it
    Then there are no hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_format-spec_exemption::regular_`.format()`_spec_is_also_exempt
  Scenario: A .format() spec is not a bare literal
    Given a Python file 'ac = "{x:.2f}".format(x=v)'
    When does_not_default_to_float checks it
    Then there is no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_f-string_limitations_(documented)::bare_float_inside_f-string_expression_is_a_(documented)_false_negative
  Scenario: A float inside an f-string expression is not reported (a known false negative)
    Given a Python file 'ad = f"{1.0}"'
    When does_not_default_to_float checks it
    Then there is no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkDoesNotDefaultToFloat_—_f-string_limitations_(documented)::text-only_f-string_content_does_not_produce_false_positives
  Scenario: Text-only f-string content is not reported
    Given a Python file 'ae = f"value is 1.0 by default"'
    When does_not_default_to_float checks it
    Then there is no literal hit

  @test:scripts/tests/qa-checkers-python.test.ts::checkRespectsArchimedeanWall::flags_math.sqrt(x)
  Scenario: math.sqrt breaks the Archimedean wall
    Given a Python file calling math.sqrt(x)
    When respects_archimedean_wall checks it
    Then it fails with a hit naming "math.sqrt"

  @test:scripts/tests/qa-checkers-python.test.ts::checkRespectsArchimedeanWall::flags_numpy.cos_and_np.exp
  Scenario: numpy.cos and np.exp break the Archimedean wall
    Given a Python file calling np.exp and numpy.cos
    When respects_archimedean_wall checks it
    Then it fails with at least two hits

  @test:scripts/tests/qa-checkers-python.test.ts::checkRespectsArchimedeanWall::flags_numpy.float64_type_usage
  Scenario: numpy.float64 breaks the Archimedean wall
    Given a Python file annotating a variable as numpy.float64
    When respects_archimedean_wall checks it
    Then it fails with a hit naming "numpy.float64"

  @test:scripts/tests/qa-checkers-python.test.ts::checkRespectsArchimedeanWall::passes_when_only_mpmath_is_used
  Scenario: mpmath alone respects the Archimedean wall
    Given a Python file using only mp.sqrt from mpmath
    When respects_archimedean_wall checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkRespectsArchimedeanWall::comments_mentioning_math.sqrt_do_not_trigger
  Scenario: A comment naming math.sqrt does not break the wall
    Given a Python file whose comment mentions math.sqrt and whose code uses mp.sqrt
    When respects_archimedean_wall checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkCodeIsCommented::passes_with_a_top-of-file_docstring
  Scenario: A module docstring makes code commented
    Given a Python file starting with a module docstring
    When code_is_commented checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkCodeIsCommented::passes_with_docstring_after_`from___future__`
  Scenario: A docstring after a __future__ import counts
    Given a Python file with "from __future__ import annotations" then a docstring
    When code_is_commented checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkCodeIsCommented::fails_with_no_docstring_and_<_10%_comments
  Scenario: No docstring and under 10% comments fails
    Given a Python file of 20 assignments and no comments
    When code_is_commented checks it
    Then it fails with a hit containing "0/20"

  @test:scripts/tests/qa-checkers-python.test.ts::checkCodeIsCommented::passes_with_≥_10%_comment_density
  Scenario: At least 10% comment density passes
    Given a Python file of 2 comment lines and 15 assignments
    When code_is_commented checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkCodeIsCommented::passes_for_empty_file_(n/a)
  Scenario: An empty file is n/a for code_is_commented
    Given an empty Python file
    When code_is_commented checks it
    Then the result is "n/a"

  @test:scripts/tests/qa-checkers-python.test.ts::checkVariablesTyped::flags_def_foo(x):
  Scenario: An untyped parameter is flagged
    Given a Python file with "def foo(x):"
    When variables_typed checks it
    Then it fails with a hit containing "def foo"

  @test:scripts/tests/qa-checkers-python.test.ts::checkVariablesTyped::passes_def_foo(x:_int)_->_int:
  Scenario: A fully typed function passes
    Given a Python file with "def foo(x: int) -> int:"
    When variables_typed checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkVariablesTyped::self_/_cls_/_*args_/_**kwargs_are_exempt
  Scenario: self, *args and **kwargs are exempt from typing
    Given a method "def m(self, x: int, *args, **kwargs)"
    When variables_typed checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkVariablesTyped::partial_typing_—_flags_only_the_untyped_params
  Scenario: Partial typing flags the untyped parameter
    Given a Python file with "def foo(x: int, y):"
    When variables_typed checks it
    Then it fails with a hit containing "y"

  @test:scripts/tests/qa-checkers-python.test.ts::checkVariablesTyped::no-arg_function_is_trivially_typed
  Scenario: A no-argument function is typed
    Given a Python file with "def foo():"
    When variables_typed checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::a_`#_Ref:_[key]`_comment_in_SOURCE_does_not_count_—_metadata_only
  Scenario: A Ref comment in source does not count as references
    Given a Python file starting "# Ref: [kassel1995] Quantum Groups" and no sidecar references
    When has_references_to_paper checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::an_indented_Ref_comment_does_not_count_either
  Scenario: An indented Ref comment does not count either
    Given a Python file with an indented "# Ref: [jones1985]" comment and no sidecar references
    When has_references_to_paper checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::passes_when_the_sidecar_declares_references
  Scenario: Sidecar references pass
    Given a Python file and sidecar references "prop:foo" and "kassel1995"
    When has_references_to_paper checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::an_explicit_empty_array_is_a_deliberate_declaration_and_passes
  Scenario: An explicit empty references list passes
    Given a Python file and an empty sidecar references list
    When has_references_to_paper checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::the_failure_message_tells_the_author_what_to_add
  Scenario: The failure tells the author what to add
    Given a Python file with no sidecar references
    When has_references_to_paper checks it
    Then it fails with a hit mentioning "references"

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::fails_with_no_Ref_citation
  Scenario: No references at all fails
    Given a Python file with an ordinary comment and no sidecar references
    When has_references_to_paper checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::checkHasReferencesToPaper::does_not_match_`Ref:`_mid-line_(must_be_a_comment)
  Scenario: Ref: inside a string does not count
    # Gap: the checker reads only sidecar metadata, so any source without sidecar references fails; the test cannot tell a mid-line "Ref:" apart from any other text.
    Given a Python file whose string holds "see Ref: [key]" and no sidecar references
    When has_references_to_paper checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::checkConnectedToCiPipeline::passes_when_basename_appears_in_a_workflow_file
  Scenario: A script named in a workflow is connected to CI
    Given a repository whose workflow runs "python scripts/foo.py"
    When connected_to_ci_pipeline checks "scripts/foo.py"
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkConnectedToCiPipeline::fails_when_not_referenced_anywhere
  Scenario: A script referenced nowhere is not connected
    Given a repository whose workflow has no steps and a script "scripts/orphan.py"
    When connected_to_ci_pipeline checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::checkConnectedToCiPipeline::passes_when_imported_by_a_sibling_script
  Scenario: A script imported by a CI-run sibling is connected
    Given "scripts/helper.py" imported by "scripts/main.py", which a workflow runs
    When connected_to_ci_pipeline checks "scripts/helper.py"
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkConnectedToCiPipeline::__init__.py_is_n/a
  Scenario: __init__.py is n/a for CI connection
    Given a repository with "scripts/__init__.py"
    When connected_to_ci_pipeline checks it
    Then the result is "n/a"

  @test:scripts/tests/qa-checkers-python.test.ts::checkConnectedToCiPipeline::scripts_under__deprecated/_are_n/a
  Scenario: A script under _deprecated/ is n/a for CI connection
    Given a repository with "scripts/_deprecated/old.py"
    When connected_to_ci_pipeline checks it
    Then the result is "n/a"

  @test:scripts/tests/qa-checkers-python.test.ts::checkDeprecated::flags_scripts_under_/_deprecated/
  Scenario: A script under _deprecated/ is flagged deprecated
    Given a Python file under a "_deprecated" directory
    When deprecated checks it
    Then it fails with a hit containing "_deprecated/"

  @test:scripts/tests/qa-checkers-python.test.ts::checkDeprecated::flags_`#_DEPRECATED`_marker
  Scenario: A "# DEPRECATED" marker is flagged
    Given a Python file starting "# DEPRECATED — use foo.py instead"
    When deprecated checks it
    Then it fails with a hit containing "# DEPRECATED"

  @test:scripts/tests/qa-checkers-python.test.ts::checkDeprecated::flags_DEPRECATED_in_module_docstring
  Scenario: DEPRECATED in the module docstring is flagged
    Given a Python file whose docstring starts "DEPRECATED"
    When deprecated checks it
    Then it fails with a hit mentioning "docstring"

  @test:scripts/tests/qa-checkers-python.test.ts::checkDeprecated::passes_for_normal_scripts
  Scenario: A normal script is not deprecated
    Given a Python file with a normal docstring
    When deprecated checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkDeprecated::does_not_match_`deprecated`_lowercase_in_prose
  Scenario: Lowercase "deprecated" in prose is not a marker
    Given a Python file whose docstring says "This module is not deprecated."
    When deprecated checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkUsesLibraryFrameworkAppropriately::flags_witness-write_without_WitnessBuilder_import
  Scenario: Writing a witness without WitnessBuilder is flagged
    Given a Python file writing "foo.witness.json" with open()
    When uses_library_framework_appropriately checks it
    Then it fails with a hit naming "WitnessBuilder"

  @test:scripts/tests/qa-checkers-python.test.ts::checkUsesLibraryFrameworkAppropriately::passes_witness-write_WITH_WitnessBuilder_import
  Scenario: Writing a witness with WitnessBuilder imported passes
    Given a Python file importing WitnessBuilder and naming "foo.witness.json"
    When uses_library_framework_appropriately checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkUsesLibraryFrameworkAppropriately::flags_hardcoded_`pi_=_3.14…`_constant
  Scenario: A hardcoded pi is flagged
    Given a Python file with "pi = 3.14159265"
    When uses_library_framework_appropriately checks it
    Then it fails with a hit containing "pi = 3.14"

  @test:scripts/tests/qa-checkers-python.test.ts::checkUsesLibraryFrameworkAppropriately::flags_hardcoded_`e_=_2.71…`_constant
  Scenario: A hardcoded e is flagged
    Given a Python file with "e = 2.71828"
    When uses_library_framework_appropriately checks it
    Then it fails with a hit containing "e = 2.71"

  @test:scripts/tests/qa-checkers-python.test.ts::checkUsesLibraryFrameworkAppropriately::passes_script_with_no_witness-write_and_no_hardcoded_constants
  Scenario: Library constants and no witness write pass
    Given a Python file with "x = mp.pi + mp.e"
    When uses_library_framework_appropriately checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::checkUsesLibraryFrameworkAppropriately::comment_mentioning_`.witness.json`_does_not_require_WitnessBuilder
  Scenario: A comment naming a witness file does not require WitnessBuilder
    Given a Python file whose comment says "we generate foo.witness.json"
    When uses_library_framework_appropriately checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::fires_when_computed_and_expected_are_the_same_expression
  Scenario: An assertion comparing an expression to itself is unfalsifiable
    Given add_assertion with computed=sel[0] and expected=sel[0]
    When assertions_are_falsifiable checks it
    Then it fails with a hit saying it "compares `sel[0]` to itself"

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::fires_on_literal-vs-literal,_the_clearest_form
  Scenario: A literal compared with the same literal is unfalsifiable
    Given add_assertion with computed=1 and expected=1
    When assertions_are_falsifiable checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::fires_across_a_multi-line_call
  Scenario: A tautology across a multi-line call is found
    Given a multi-line add_assertion with computed and expected both r["tr_M"]
    When assertions_are_falsifiable checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::does_NOT_fire_when_the_two_sides_differ
  Scenario: Differing sides are falsifiable
    Given add_assertion with computed=vol_computed and expected=2.0298
    When assertions_are_falsifiable checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::does_NOT_fire_inside_a_docstring
  Scenario: A same-value example in a docstring is ignored
    Given a docstring holding add_assertion with computed and expected both 2.0298, and no code assertion
    When assertions_are_falsifiable checks it
    Then it passes

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::still_sees_string-valued_tautologies
  Scenario: String-valued tautologies are still seen
    Given add_assertion with computed="0" and expected="0"
    When assertions_are_falsifiable checks it
    Then it fails

  @test:scripts/tests/qa-checkers-python.test.ts::assertions_are_falsifiable::n/a_when_the_file_has_no_assertions_at_all
  Scenario: A file with no assertions is n/a
    Given a Python file "x = 1"
    When assertions_are_falsifiable checks it
    Then the result is "n/a"
