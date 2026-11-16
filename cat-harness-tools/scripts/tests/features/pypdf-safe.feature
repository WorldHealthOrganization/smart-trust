# scripts/pypdf_safe.py: a cryptography whose import raises a BaseException
# (pyo3's PanicException) must not take pypdf, or the PDF scripts, down. The
# poison is a planted package on PYTHONPATH. Every test returns early, passing,
# when pypdf is not installed. Each Scenario names the test that executes it.
Feature: pypdf survives a cryptography that panics on import

  @test:scripts/tests/pypdf-safe.test.ts::pypdf_safe::imports_pypdf_when_cryptography_is_healthy,_without_stubbing_it
  Scenario: pypdf_safe imports and reports its branch with a healthy cryptography
    # Gap: the title says "without stubbing it"; the body checks only that "STUBBED" is printed, not that its value is False. Passes without running anything when pypdf is absent.
    Given pypdf is installed and cryptography is not poisoned
    When python imports pypdf_safe and prints CRYPTOGRAPHY_STUBBED
    Then it exits 0 and prints "STUBBED"

  @test:scripts/tests/pypdf-safe.test.ts::pypdf_safe::survives_a_cryptography_that_raises_BaseException_on_import
  Scenario: pypdf_safe survives a cryptography that raises BaseException
    # Gap: passes without running anything when pypdf is absent.
    Given a poisoned cryptography on PYTHONPATH
    When python imports pypdf_safe and prints the PdfReader class name
    Then stderr has no "PanicException", it exits 0 and prints "READER PdfReader"

  @test:scripts/tests/pypdf-safe.test.ts::pypdf_safe::reports_that_it_stubbed,_when_it_stubbed
  Scenario: pypdf_safe reports that it stubbed cryptography
    # Gap: passes without running anything when pypdf is absent.
    Given a poisoned cryptography on PYTHONPATH
    When python imports pypdf_safe and prints CRYPTOGRAPHY_STUBBED
    Then it exits 0 and prints "STUBBED True"

  @test:scripts/tests/pypdf-safe.test.ts::pypdf_safe::pdf-structure.py_starts_under_a_poisoned_cryptography
  Scenario: pdf-structure.py starts under a poisoned cryptography
    # Gap: passes without running anything when pypdf is absent.
    Given a poisoned cryptography on PYTHONPATH
    When "pdf-structure.py --help" is run
    Then stderr has no "PanicException", it exits 0 and prints "usage"

  @test:scripts/tests/pypdf-safe.test.ts::pypdf_safe::split-pdf-by-chapter.py_starts_under_a_poisoned_cryptography
  Scenario: split-pdf-by-chapter.py starts under a poisoned cryptography
    # Gap: passes without running anything when pypdf is absent.
    Given a poisoned cryptography on PYTHONPATH
    When "split-pdf-by-chapter.py --help" is run
    Then stderr has no "PanicException", it exits 0 and prints "usage"

  @test:scripts/tests/pypdf-safe.test.ts::pypdf_safe::the_poison_actually_reproduces_the_bug_(a_bare_pypdf_import_dies)
  Scenario: The poison reproduces the bug in a bare pypdf import
    # Gap: passes without running anything when pypdf is absent.
    Given a poisoned cryptography on PYTHONPATH
    When python runs "from pypdf import PdfReader" and prints "SURVIVED"
    Then "SURVIVED" is not printed and it exits non-zero
