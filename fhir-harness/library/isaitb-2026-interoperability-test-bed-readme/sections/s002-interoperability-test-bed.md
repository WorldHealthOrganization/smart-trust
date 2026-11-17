---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s002-interoperability-test-bed
section_title: "Interoperability Test Bed"
file: "README.md"
lines: 3-29
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
# Interoperability Test Bed

![BuildStatus](https://github.com/ISAITB/gitb/actions/workflows/quality.yml/badge.svg)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ISAITB_gitb&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=ISAITB_gitb)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ISAITB_gitb&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=ISAITB_gitb)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=ISAITB_gitb&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=ISAITB_gitb)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=ISAITB_gitb&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=ISAITB_gitb)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=ISAITB_gitb&metric=bugs)](https://sonarcloud.io/summary/new_code?id=ISAITB_gitb)
[![licence](https://img.shields.io/github/license/ISAITB/gitb.svg?color=blue)](https://github.com/ISAITB/gitb/blob/master/LICENCE.txt)
[![docs](https://img.shields.io/static/v1?label=docs&message=Interoperable%20Europe%20Portal&color=blue)](https://www.itb.ec.europa.eu)
[![docs](https://img.shields.io/static/v1?label=docs&message=Test%20Bed%20guides&color=blue)](https://www.itb.ec.europa.eu/docs/guides/latest/)
[![docs](https://img.shields.io/static/v1?label=docs&message=GITB%20TDL%20&color=blue)](https://www.itb.ec.europa.eu/docs/tdl/latest/)
[![docs](https://img.shields.io/static/v1?label=docs&message=GITB%20test%20services&color=blue)](https://www.itb.ec.europa.eu/docs/services/latest/)
[![Gurubase](https://img.shields.io/badge/Gurubase-Ask%20ITB%20Guru-006BFF?color=blue)](https://gurubase.io/g/itb)
[![docker](https://img.shields.io/docker/pulls/isaitb/gitb-ui?color=blue&logo=docker&logoColor=white)](https://hub.docker.com/r/isaitb/gitb-ui)

The [Interoperability Test Bed](https://interoperable-europe.ec.europa.eu/collection/interoperability-test-bed-repository/solution/interoperability-test-bed) is a service offered by the European Commission’s DIGIT for the **conformance testing** of IT systems.
It approaches conformance testing by means of scenario-based test cases expressed in the [GITB Test Description Language (TDL)](https://www.itb.ec.europa.eu/docs/tdl/latest/),
that defines test steps implemented using built-in capabilities or by orchestration of [extension services](https://www.itb.ec.europa.eu/docs/services/latest/).

Test cases typically involve **message exchanges** with a system under test, with **validation** of individual messages and the overall conversation,
but also steps including control flow, user interactions, and arbitrary processing of test session data. Besides the test engine itself, the Test Bed also
provides a **rich user interface** for administrators and testers, as well as a **REST API** and **webhooks** for integrations and automation workflows.

DIGIT operates its own [Test Bed instance](https://www.itb.ec.europa.eu/itb/) shared by several projects, but also makes
available all software as components (shared as public Docker images) that can be installed and used locally.
