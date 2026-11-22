---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s003-about-this-repository
section_title: "About this repository"
file: "README.md"
lines: 30-47
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
## About this repository

This repository contains the main application components that are used by the Interoperability Test Bed. These are:
- The **test engine**, responsible for executing test cases and reporting their progress and outcome.
  In terms of Docker images, this component represents the ``gitb-srv`` image.
- The **frontend**, responsible for the Test Bed's user interface and its test, user, and configuration
  management features. In terms of Docker images, this component represents the ``gitb-ui`` image.

In subsequent sections these components are referred to using their Docker image names (``gitb-srv`` and ``gitb-ui``).

> **Note**
> 
> This repository is used to build the Test Bed's software components from their source. The simplest approach
> to use the Test Bed is via its **published Docker images** ([gitb-ui](https://hub.docker.com/r/isaitb/gitb-ui) and [gitb-srv](https://hub.docker.com/r/isaitb/gitb-srv)) following
> our [installation guide](https://www.itb.ec.europa.eu/docs/guides/latest/installingTheTestBed/index.html).
> 
> Alternatively, you may build and launch the Docker service directly from its sources. See [here](#build-for-deployment) for details.
