# Testing - SMART ICVP v0.3.0

* [**Table of Contents**](toc.md)
* [**Deployment**](deployment.md)
* **Testing**

## Testing

This page will include testing artifacts for this implementation guide.

Artifacts will include Gherkin .feature files, with acceptance criteria for each test definition, and with defined test cases for PlanDefinitions and Measures. Example data will be in the form of FHIR shorthand (FSH) files or FHIR Resources, with examples listed under the example tab of the resources.

See [Test Data](test-data.md) for test data.

The testing artifacts in this implementation guide are not intended to be used to determine formal conformance, nor are they intended to be authoritative or comprehensive.

### Testing platforms

These files allow a quick setup of working servers, for testing of the specification in a known configuration.

Prerequisites: [Docker](https://www.docker.com)

#### Questionnaires and StructureMap Transformations

The matchbox server configuration allows you to test the mappings. For more information: [https://github.com/ahdis/matchbox](https://github.com/ahdis/matchbox)

How to setup the server:

1. Download the[.env file](https://raw.githubusercontent.com/WorldHealthOrganization/smart-empty/main/testing/docker/questionnaires/.env)
1. Download the[docker compose file](https://raw.githubusercontent.com/WorldHealthOrganization/smart-empty/main/testing/docker/questionnaires/docker-compose.yml)
1. From the same folder, run`docker-compose up -d`
1. Navigate to http://localhost:e.g.[http://localhost:8087](http://localhost:8087)
1. Follow the instructions there to setup and run the extractions

#### Scheduling and Decision Logic, Measures

CQFRuler

1. Download the[.env file](https://raw.githubusercontent.com/WorldHealthOrganization/smart-empty/main/testing/docker/logic/.env)
1. Download the[docker compose file](https://raw.githubusercontent.com/WorldHealthOrganization/smart-empty/main/testing/docker/logic/docker-compose.yml)
1. From the same folder, run`docker-compose up -d`
1. Navigate to http://localhost:e.g.[http://localhost:8080](http://localhost:8080)
1. Follow the instructions there to setup and run the plan definitions.

