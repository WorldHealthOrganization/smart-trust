
The following describes the onboarding processes for the GDHCN.


### Onboarding Process Overview

The WHO Global Digital Health Certification Network Secretariat is responsible to manage the onboarding process and applications of eligible Trust Network Participants to connect as a trusted party to the trust network. Prepared onboarding records will be handed over to the TNG operator with the request to process the technical onboarding of the trusted party. An organizational and technical successful application results in a confirmation and the Trust Network Participant can connect to the network as a trusted party.

<img src="OnboardingOverview.drawio.png" style="float:none; margin: 0px 0px 0px 0px;"/>

Starting in September of 2023, partipcation will be opened to other eligible participants following the Full Onboarding Process (FOP).

Starting in June of 2023 and running throough December 2023, participation in the GDHNC will be open to current participants of the European Union (EU) Digital Covid Certifcate (DCC) network following an Interim Onboarding Process (IOP).  The IOP is an abbreviated verison of the FOP leveraging the notion of transitive trust.

Please review the:
* [Concepts](concepts.html) underpinning the description of these onboarding processes including the general description of the Terms of Participation; and
* [Certificate Governance](concepts_certificate_governance.html) describing the governance of public key certificiates.


#### Onboarding Application Requirements

The application of the Trust Network Participant must contain at least:

* One or more DID or SCA, with a statement about the correctness (will not be additionally checked), optionally SHA256 hashes of the DID Document content to anchor it
* A statement about the acceptance of keys and processes of other jurisdictions which are present in the gateway lists
* Contact Persons - Technical, Legal, Governance etc.


#### Secretariat Tasks
The secretariat must handle the following tasks to establish the onboarding process:

* Providing a Secure Channel for the Trust Network Participant to deliver secure and trustworthy applications SCA and/or DID information
* Creation and Securing a Key Pair (Trust Anchor)  to sign/confirm onboarding requests for the gateway
* Delivering the Public Key of the Trust Anchor to the Gateway Operations
* Transmitting Onboarding Requests to the Gateway Operations


### Interim Onboarding Process

This section describes the steps for the Interim Onboarding Process (FOP) to the GDHCH.

As the launch of the WHO Digital Health Trust Network, is expected to be 1 June 2023, only the Trusted Services related to issuance and verification of COVID-19 Certificates will be supported.   WHO will not have access to any of the data contained within a Verifiable Digital Health Certificate that is issued by a Trust Network Participant underone of these Trusted Services.

#### Period of Applicability
The IOP will be in effect at the launch date of the GDHCN on 1 June 2023 and be in effect through December 31, 2023.

##### Eligibility
At launch of IOP , eligibiltiy to join the GDHNC is limited to WHO Member States which are participants in the EU DCC.


#### Transitive Trust
The principle of Transitive Trust leverages the trusted relationship that the EC has already established among its participants within the EU DCC network and uses that as a basis to allow for EU DCC participants to participate in the GDHCN without any overly burdensome onboarding process. This will be referred to as the WHO-EC transitive trust relationship. The IOP outlined in this document is intended to serve as a quick and structured mechanism to onboard those eligible Trust Network Participants.

#### Interim Terms of Participation
The requirements in this document will subsume those outlined in the EC DCC Equivalence Decision Annex II Technical procedure to onboard third countries.  The following abbreviated Terms of Participation will apply during the IOP:
* ***TOP0***  Will leverage current EC processes and share TNP<sub>TLS</sub> keys with WHO.  These TNP<sub>TLS</sub> keys will be signed by WHO.
* ***TOP1***  Will be considered fulfilled 
* ***TOP2***  Will be considered fulfilled
* ***TOP3***  WHO will ask for an assertion/pledge by eligible Trust Network participants to adhere to the applicable policies but will not be responsible for assessing or enforcing compliance the policies or regulatory on which trusted services which are operated by paricipants of the trust network.


#### Organizational Identify
The organizational identity will be considered established and verified under a WHO-EC Transitive Trust relationship.   The EC will provide to WHO necessary contact information for operators, owners or focal points of EC DCC Trust Network participants to facilitate communication.


#### Onboarding Steps

As permissible, configuration information related to connections of EU DCC participant backend systems will be provided by the EC to the WHO in order to facilitate establishing connections between EU DCC Trust Network Participants and the WHO Digital Health Trust Network infrastructure.  Otherwise, such configuration information will be shared directly by the eligible Trust Network Participant to the WHO


* An eligible Trust Network Participant should submit its Letter of Intent Form (TO BE DEFINED) to tng-secretariat@who.int.
* Once eligibility is verified the eligible Trust Network Participant will be invited to submit a signed Trust Network Application Form (TO BE DEFINED) tng-secretariat@who.int with:
    * the necessary information to connect to the production environment
    * attestation to comply with the Trust Network Terms of Participation.
* After positively assessing the application form,  WHO will:
    * provide the necessary technical specifications and configuration information to connect to their backend systems to the WHO TNG
    * invite the Trust Network Participant to register their production certificates and promote them to the production environment.




### Full Onboarding Process

This section describes the steps for the Full Onboarding Process (FOP)  to the GDHCH

#### Period of Applicability
The FOP will be in effect in September 2023.  

##### Eligibility
At launch of FOP at launch, eligibiltiy to join the GDHNC is limited to WHO Member States.



1. **Self-Assessment** Countries interested in joining the GDHCN should conduct a self-assessment using the provided checklist to ensure their system complies with the WHO's specifications. Eligible participants should adopt the same technical specifications described in the [Onboarding Checklist](concepts_onboarding_checklist.html) . Open source implementations should be utilized when possible.
2. **Official Request**  If the self-assessment is successful, countries should submit a formal request to the WHO via an official letter expressing their interest in joining the GDHCN. The letter should include a description of the eligible Trust Network Pariticpiant's system and the completed checklist as an annex Upon receipt, the WHO will initiate the procedure to assess the eligble Trust Network Partcipant's system and determine if the onboarding process can begin.
3. Steps for Onboarding


#### Organizational Identify
The organizational identity and contact will be estabalished in an offline process by WHO through it's Member State country offices with appropriate contacts at ministries of health or appropriate public health agency.

#### Onboarding Steps

* An eligible Trust Network Participant should complete the [Onboarding Checklist](concepts_onboarding_checklist.html) to self-assess its readiness for the onboarding process.
* If the assessment concludes that the Trust Network Participant is ready for joining the WHO CDN, the eligible Trust Network Participant should submit its Trust Network Technical Evaluation Form (TO BE DEFINED) to tng-secretariat@who.int.
* WHO acknowledges receipt of the application and provides the applicant with the contact details of the technical team that will assess the compatibility of the Trust Nestwork Participants's system with the WHO's specifications.
* If the WHO's technical team gives a positive opinion, the eligible Trust Network Participant will be invited to submit a signed Trust Network Application Form (TO BE DEFINED) tng-secretariat@who.int with:
    * the necessary information to connect to the production environment
    * attestation to comply with the Trust Network Terms of Participation.
* After positively assessing the application form,  WHO will:
    * provide the necessary technical specifications and configuration information to connect to their backend systems to the WHO TNG
    * invite the Trust Network Participant to register their production certificates and promote them to the production environment.


