# Frequently Asked Questions - WHO SMART Trust v1.3.0

* [**Table of Contents**](toc.md)
* [**Home**](index.md)
* **Frequently Asked Questions**

## Frequently Asked Questions

### FAQs

#### Participation and Roles

##### Who can serve as the Application Form Representative for GDHCN participation?

A designated public health authority from a WHO Member State, with decision-making authority regarding participation in the GDHCN, should be the representative.

##### What is the role of the Business Owner Contact?

A senior official with decision-making powers, involved in strategic decisions but not daily operations.

##### Who should be the Technical Contact?

An individual responsible for addressing technical inquiries and issues during the project's lifecycle.

##### What does the Legal Contact do?

Manages legal aspects, including regulatory compliance and contractual matters related to GDHCN participation.

#### Financial Information

##### Are there any fees associated with participating in the GDHCN?

Participation in the GDHCN is currently free, supported by existing WHO funding.

#### Technical Requirements and Infrastructure

##### How will the transition to WHO's product catalog management tool affect vaccine codes?

The tool aims to manage vaccine codes effectively, addressing the complexities of medical terminology coding.

##### Can we continue participation in the UAT environment without moving to production?

Yes, continuing in the UAT environment is possible and does not hinder future transition to the production environment.

##### How does GDHCN support open-source collaboration?

Through platforms like GitHub, enabling community contributions to enhance technical specifications and documentation.

##### How is GDHCN integrating existing EU DCC technical specifications?

By incorporating EU DCC specifications like APIs for key access, business rules, and value sets, ensuring compatibility.

##### What are the plans for future developments and maintenance of the GDHCN infrastructure?

Future developments will be guided by WHO, focusing on compatibility with existing systems and ensuring security and backward compatibility.

#### Transition and Onboarding

##### How is the transition of technical assets from EU DCC to GDHCN managed?

This includes moving APIs and sets into GDHCN specifications, with WHO ensuring a smooth integration.

##### What is the onboarding process for new applications not previously connected to EU DCC?

It involves verifying technical connections and compatibility with existing systems, especially regarding TLS certificates.

#### Security and Compliance

##### How is the key material and exchange process managed within GDHCN?

With detailed definitions for key materials, ensuring clarity and visibility in the key exchange process, closely resembling EU DCC definitions.

##### How are security-related incidents managed during the transition to WHO governance?

The focus is on addressing security incidents, with no changes to the repository unless necessary for security reasons.

#### Certificate Management

##### What is the current policy on TLS certificate renewal for national backends?

The policy is under review, with discussions on alternatives to the three-month renewal policy, including longer expiry times or self-signed certificates.

##### Can WHO host networks use self-signed TLS certificates?

The possibility of WHO using self-signed certificates with extended expiry times is under discussion.

##### What is the process for proposing alternatives to the current TLS certificate policy?

Proposals for alternatives, like extended expiry times, are being considered to alleviate concerns with short renewal policies.

###!## How does WHO ensure trust without relying solely on the TLS certificate? Trusting the CA rather than the certificate itself may provide a solution to frequent renewals.

