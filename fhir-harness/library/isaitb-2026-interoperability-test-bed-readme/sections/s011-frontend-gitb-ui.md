---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s011-frontend-gitb-ui
section_title: "Frontend (gitb-ui)"
file: "README.md"
lines: 126-146
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
## Frontend (gitb-ui)

To build and run the ``gitb-ui`` component carry out the following steps:
1. From the ``gitb-ui`` folder issue ``sbt compile``.
2. Define in your IDE a run configuration as a sbt application to run ``sbt run``.
3. Set environment variables as needed. For example set ``THEME = ec`` for a EC-themed UI.

The next step is to choose how to build and run the Angular UI application. Its resources are defined in
the ``gitb-ui/ui`` folder and its build is managed by Angular CLI. You have two options on how to work with
the Angular app - choose the preferred approach for you from the two following sections. As a common first
step regardless of the approach you choose you need to issue ``npm install`` from folder ``gitb-ui/ui``. 

**Developing with EU Login enabled:** In case you are developing with EU Login enabled (i.e. against a local EU 
Login test instance), you need to ensure that the following environment variables are set:
- ``SESSION_SECURE`` set to ``false`` 
- ``SESSION_COOKIE_NAME`` set to ``ITB_SESSION``.

Failure to set these properties will result in session cookies never getting served over HTTP, resulting in endless
authentication loops. The alternative is to test over HTTPS via a local SSL-enabled proxy (e.g. a local nginx server
with a self-signed server certificate).
