
The following describes the on-boarding processes for the GDHCN.


### On-boarding Process Overview

The WHO Global Digital Health Certification Network Secretariat is responsible to manage the on-boarding process and applications of eligible Trust Network Participants to connect as a trusted party to the trust network. Prepared on-boarding records will be handed over to the TNG operator with the request to process the technical on-boarding of the trusted party. An organizational and technical successful application results in a confirmation and the Trust Network Participant can connect to the network as a trusted party.

<img src="OnboardingOverview.drawio.png" style="float:none; margin: 0px 0px 0px 0px;"/>

Starting in September of 2023, participation will be opened to other eligible participants following the Full On-boarding Process (FOP).

Starting in June of 2023 and running through December 2023, participation in the GDHCN will be open to current participants of the European Union (EU) Digital COVID Certificate (DCC) network following an Interim On-boarding Process (IOP).  The IOP is an abbreviated version of the FOP leveraging the notion of transitive trust.

Please review the:
* [Concepts](concepts.html) underpinning the description of these on-boarding processes including the general description of the Terms of Participation; and
* [Certificate Governance](concepts_certificate_governance.html) describing the governance of public key certificates.


#### On-boarding Application Requirements

The application of the Trust Network Participant must contain at least:

* One or more DID or SCA, with a statement about the correctness (will not be additionally checked), optionally SHA256 hashes of the DID Document content to anchor it
* A statement about the acceptance of keys and processes of other jurisdictions which are present in the gateway lists
* Contact Persons - Technical, Legal, Governance etc.


#### Secretariat Tasks
The secretariat must handle the following tasks to establish the on-boarding process:

* Providing a Secure Channel for the Trust Network Participant to deliver secure and trustworthy applications SCA and/or DID information
* Creation and Securing a Key Pair (Trust Anchor)  to sign/confirm on-boarding requests for the gateway
* Delivering the Public Key of the Trust Anchor to the Gateway Operations
* Transmitting On-boarding Requests to the Gateway Operations


### Interim On-boarding Process

This section describes the steps for the Interim On-boarding Process (FOP) to the GDHCN.

As the launch of the WHO Digital Health Trust Network, is expected to be 1 June 2023, only the Trusted Services related to issuance and verification of COVID-19 Certificates will be supported.   WHO will not have access to any of the data contained within a Verifiable Digital Health Certificate that is issued by a Trust Network Participant under one of these Trusted Services.

#### Period of Applicability
The IOP will be in effect at the launch date of the GDHCN on 1 June 2023 and be in effect through December 31, 2023.

##### Eligibility
At launch of IOP , eligibility to join the GDHCN is limited to WHO Member States which are participants in the EU DCC.


#### Transitive Trust
The principle of Transitive Trust leverages the trusted relationship that the EC has already established among its participants within the EU DCC network and uses that as a basis to allow for EU DCC participants to participate in the GDHCN without any overly burdensome on-boarding process. This will be referred to as the WHO-EC transitive trust relationship. The IOP outlined in this document is intended to serve as a quick and structured mechanism to onboard those eligible Trust Network Participants.

#### Interim Terms of Participation
The requirements in this document will subsume those outlined in the EC DCC Equivalence Decision Annex II Technical procedure to onboard third countries.  The following abbreviated Terms of Participation will apply during the IOP:
* ***TOP0***  Will leverage current EC processes and share TNP<sub>TLS</sub> keys with WHO.  These TNP<sub>TLS</sub> keys will be signed by WHO.
* ***TOP1***  Will be considered fulfilled 
* ***TOP2***  Will be considered fulfilled
* ***TOP3***  WHO will ask for an assertion/pledge by eligible Trust Network participants to adhere to the applicable policies but will not be responsible for assessing or enforcing compliance the policies or regulatory on which trusted services which are operated by participants of the trust network.


#### Organizational Identify
The organizational identity will be considered established and verified under a WHO-EC Transitive Trust relationship.   The EC will provide to WHO necessary contact information for operators, owners or focal points of EC DCC Trust Network participants to facilitate communication.


#### On-boarding Steps

As permissible, configuration information related to connections of EU DCC participant back-end systems will be provided by the EC to the WHO in order to facilitate establishing connections between EU DCC Trust Network Participants and the WHO Digital Health Trust Network infrastructure.  Otherwise, such configuration information will be shared directly by the eligible Trust Network Participant to the WHO


* An eligible Trust Network Participant should submit its Letter of Intent Form (TO BE DEFINED) to tng-secretariat@who.int.
* Once eligibility is verified the eligible Trust Network Participant will be invited to submit a signed Trust Network Application Form (TO BE DEFINED) tng-secretariat@who.int with:
    * the necessary information to connect to the production environment
    * attestation to comply with the Trust Network Terms of Participation.
* After positively assessing the application form,  WHO will:
    * provide the necessary technical specifications and configuration information to connect to their back-end systems to the WHO TNG
    * invite the Trust Network Participant to register their production certificates and promote them to the production environment.




### Full On-boarding Process

This section describes the steps for the Full On-boarding Process (FOP)  to the GDHCN

#### Period of Applicability
The FOP will be in effect in September 2023.  

##### Eligibility
At launch of FOP at launch, eligibility to join the GDHCN is limited to WHO Member States.



1. **Self-Assessment** Countries interested in joining the GDHCN should conduct a self-assessment using the provided checklist to ensure their system complies with the WHO's specifications. Eligible participants should adopt the same technical specifications described in the [On-boarding Checklist](concepts_onboarding_checklist.html) . Open source implementations should be utilized when possible.
2. **Official Request**  If the self-assessment is successful, countries should submit a formal request to the WHO via an official letter expressing their interest in joining the GDHCN. The letter should include a description of the eligible Trust Network Participant's system and the completed checklist as an annex Upon receipt, the WHO will initiate the procedure to assess the eligible Trust Network Participant's system and determine if the on-boarding process can begin.
3. Steps for On-boarding


#### Organizational Identify
The organizational identity and contact will be established in an offline process by WHO through it's Member State country offices with appropriate contacts at ministries of health or appropriate public health agency.

#### On-boarding Steps

* An eligible Trust Network Participant should complete the [On-boarding Checklist](concepts_onboarding_checklist.html) to self-assess its readiness for the on-boarding process.
* If the assessment concludes that the Trust Network Participant is ready for joining the WHO GDHCN, the eligible Trust Network Participant should submit its Trust Network Technical Evaluation Form (TO BE DEFINED) to tng-secretariat@who.int.
* WHO acknowledges receipt of the application and provides the applicant with the contact details of the technical team that will assess the compatibility of the Trust Network Participant's system with the WHO's specifications.
* If the WHO's technical team gives a positive opinion, the eligible Trust Network Participant will be invited to submit a signed Trust Network Application Form (TO BE DEFINED) tng-secretariat@who.int with:
    * the necessary information to connect to the production environment
    * attestation to comply with the Trust Network Terms of Participation.
* After positively assessing the application form,  WHO will:
    * provide the necessary technical specifications and configuration information to connect to their back-end systems to the WHO TNG
    * invite the Trust Network Participant to register their production certificates and promote them to the production environment.


