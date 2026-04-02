# Endpoints - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Deployment**](deployment.md)
* **Endpoints**

## Endpoints

### Endpoints

The following describes the active services and endpoints for the GDHCN Trust Network Gateway.

#### Operational Metadata

##### Trust Domains

The list of active trust domains is maintained in the [GDHCN Trust Domain Value Set](ValueSet-Domains.md).

##### Key Usage Codes

The list of key usage codes is maintained in the [GDHCN Key Usage Value Set](ValueSet-KeyUsage.md).

##### Participants

The list of onboarded Trust Network Participants is availabe in the [GDHCN Participants Value Set](ValueSet-Participants.md).

#### Trustlist Distribution Endpoints

THe following are the endpoints for the [GDHCN DID Trust List](concepts_did_gdhcn.md) for each of development (DEV), user-acceptence testing (UAT) and production (PROD) ***environment**s:

| | | |
| :--- | :--- | :--- |
| DEV | Embedded | [https://tng-cdn-dev.who.int/v2/trustlist/did.json](https://tng-cdn-dev.who.int/v2/trustlist/did.json) |
| DEV | Reference | [https://tng-cdn-dev.who.int/v2/trustlist-ref/did.json](https://tng-cdn-dev.who.int/v2/trustlist-ref/did.json) |
| UAT | Embedded | [https://tng-cdn-uat.who.int/v2/trustlist/did.json](https://tng-cdn-uat.who.int/v2/trustlist/did.json) |
| UAT | Reference | [https://tng-cdn-uat.who.int/v2/trustlist-ref/did.json](https://tng-cdn-uat.who.int/v2/trustlist-ref/did.json) |
| PROD | Embedded | [https://tng-cdn.who.int/v2/trustlist/did.json](https://tng-cdn.who.int/v2/trustlist/did.json) |
| PROD | Reference | [https://tng-cdn.who.int/v2/trustlist-ref/did.json](https://tng-cdn.who.int/v2/trustlist-ref/did.json) |

#### Trust Network Gateway

THe following are the endpoints for the [Trust Network Gateway](concepts.md#trust-network-gateway-tng) for each of development (DEV), user-acceptence testing (UAT) and production (PROD) ***environment**s:

| | |
| :--- | :--- |
| PROD | https://tng.who.int |
| UAT | https://tng-uat.who.int |
| DEV | https://tng-dev.who.int |

#### Status Monitoring Dashboards

The following dashboards reflect the realtime status of key materials for each of development (DEV), user-acceptence testing (UAT) and production (PROD) ***environment**s:

| | |
| :--- | :--- |
| DEV | [Country certificate expiry](https://tng-monitor-dev.who.int/grafana/d/dev-cert-expiry/dev-country-certificate-expiry) |
| DEV | [Country Onboarding Status](https://tng-monitor-dev.who.int/grafana/d/ddh0xqz9diio0c/dev-country-onboarding-status) |
| DEV | [Country Queries](https://tng-monitor-dev.who.int/grafana/d/dev-country-queries/dev-country-queries) |
| DEV | [Gateway Availability Dashboard](https://tng-monitor-dev.who.int/grafana/d/gw-availability/dev-gateway-availability-dashboard) |
| UAT | [Country certificate expiry](https://tng-monitor-uat.who.int/grafana/d/uat-cert-expiry/uat-country-certificate-expiry) |
| UAT | [Country Queries](https://tng-monitor-uat.who.int/grafana/d/uat-country-queries/uat-country-queries) |
| UAT | [Gateway Availability Dashboard](https://tng-monitor-uat.who.int/grafana/d/c3ed3dbe-6cc0-4f16-8f0a-c7bcebd36420/uat-gateway-availability-dashboard) |
| PROD | [Country certificate expiry](https://tng-monitor.who.int/grafana/d/cert-expiry/prod-country-certificate-expiry) |
| PROD | [Country Queries](https://tng-monitor.who.int/grafana/d/prod-country-queries/prod-country-queries) |
| PROD | [Gateway Availability Dashboard](https://tng-monitor.who.int/grafana/d/gateway-availability/prod-gateway-availability-dashboard) |

