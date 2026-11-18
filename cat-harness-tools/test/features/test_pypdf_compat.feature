# scripts/_pypdf_compat.py imports pypdf so that a cryptography import that panics with a
# BaseException (as pyo3's PanicException does) is recovered from rather than crashing.
# Each Scenario names the test that executes it.
Feature: pypdf import survives a panicking cryptography

  @test:test/test_pypdf_compat.py::test_survives_cryptography_panic
  Scenario: import_pypdf recovers when importing cryptography raises a BaseException
    Given a fresh Python process where importing "cryptography" raises a BaseException-derived panic
    When import_pypdf("PdfReader") from "_pypdf_compat" is called
    Then the process exits 0
    And it prints "RECOVERED PdfReader"

  @test:test/test_pypdf_compat.py::test_naive_guard_would_have_failed
  Scenario: A naive except ImportError guard does not catch the panic
    Given a fresh Python process where importing "cryptography" raises a BaseException-derived panic
    When "from pypdf import PdfReader" is wrapped in "except ImportError"
    Then the process exits non-zero
    And it does not print "caught as ImportError"
