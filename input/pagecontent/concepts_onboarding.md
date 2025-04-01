
### Onboarding Process


The following describes the on-boarding processes for the Global Digital Health Certification Network (GDHCN).

 

The GDHCN Secretariat manages the Onboarding Process and Letters of Applications of eligible GDHCN Participants to connect as a trusted party to the trust network. Prepared onboarding records will be handed over to the GDHCN Secretariat with the request to process the technical on-boarding of the trusted party. An organizational and technical successful application results in a confirmation and the GDHCN Participant can connect to the trust network as a trusted party.

<div style="display:block">
	<img src="OnboardingOverview.drawio.png" style="float:none; margin: 0px 0px 0px 0px;"/>
</div>


Please review the:
* [Concepts](concepts.html) underpinning the description of these on-boarding processes including the general description of the Terms of Participation;
* [Onboarding Overview](concepts_onboarding_process_full.html) describing the overview of the onboarding process; 
* [Certificate Governance](concepts_certificate_governance.html) describing the governance of public key certificates; 

An eligible GDHCN Participant should complete the [Onboarding Checklist](concepts_onboarding_checklist.html) which contains guiding videos through the onboarding process.

After positively assessing the Letter of Application and assessing the Technical Evaluation Form, WHO will:
* provide the necessary technical specifications and configuration information to connect to their back-end systems to the WHO GDHCN Trust Network Gateway (TNG)
 * invite the GDHCN Participant to register their production certificates and promote them to the production environment.

The <a href="GDHCN_Administrative_and_Operational_Framework.pdf">GDHCN Administrative and Operational Framework</a> should be considered the authoritative source of definitions and concepts in case of any discrepncies.


#### Overview of the Onboarding Process

The full GDHCN onboarding process is divided it into three main stages as per the following figure:

<div style="display:block">
	<img src="OnboardingProcessStepsSimple.png" alt="Onboarding Stages" style="width:600px; float:none; margin: 0px 0px 0px 0px;"/>
</div>
Figure 1: Onboarding Stages




##### Prepare Key Material Submission


To establish a connection with the Trust Network Gateway (TNG) and become a participant of the GDHCN, the participant is required to prepare their own key materials for us to onboard onto the gateway. This process necessitates technical expertise for the preparation of X.509 certificates, which are to be stored in a GitHub repository owned by the participant for submission. 

In order to start the onboarding participants need to Prepare Key Material Submission.


 Please follow the steps described in the: [tng-participant-template](https://github.com/WorldHealthOrganization/tng-participant-template)
and [README.md](https://github.com/WorldHealthOrganization/tng-participant-template/blob/main/README.md).

 For more information, you can check the following resources:

 A [Diagram](https://smart.who.int/trust/OnboardingProcessInteractionParticipantAndWHO.png) that gives and overview about the steps in order to start the Full Onboarding.
 
The [document](https://smart.who.int/trust/blob/docs/OnboardingProcess_Documents/input/pagecontent/concepts_onboarding_process_full.md) contain a detailed description of the tasks to be carried out by the participant.
 Note: Please note that the participant’s work begins at step 8 and ends at step 14.


Once we have received your submission and successfully onboarded the material, we will contact you to start the next phase of testing.




#####  Perform Acceptance Testing

After we contacted the participant about successful onboarding, a connectivity test should be the first action of the process. When connectivity is successfully established the participant should execute their acceptance tests. These acceptance tests must be performed on dedicated test environment called User Acceptance Testing (UAT) which already connects other trust network participants, that applied for onboarding.

The [Trust Network Gateway API](openapi) can be used for interaction keeping the full functionality of the EU DCC Gateway. In addition, various HL7 FHIR services are being added.

The participant needs to [communicate the results] of their tests to us, a quality check about the communicated results will be carried out, so that we can check for any issues or approve their readiness for production rollout.

#####  Go Live on Production Environment


Once the acceptance stage has been successfully completed and approved, the process to Go Live on Production Environment can commence. This involves submitting the key material targeted for the production environment (as outlined in stage 1), followed by onboarding to the production environment. The participant will be notified once the Go Live on Production Environment has been successful.



#### Onboarding Application Requirements


Eligible GDHCN Participants are invited to submit a signed with:
* the necessary information to connect to the production environment
* attestation to comply with the Terms of Participation.

The application of the GDHCN Participant must contain at least:

* One or more TNP<sub>SCA</sub>s, one TNP<sub>TLS</sub> and one TNP<sub>UP</sub> ; 
* A statement about the acceptance of keys and processes of other jurisdictions which are present in the gateway lists; and
* Contact Persons - Technical, Legal, Business Owner.

#### Letters of Application

##### Letters of Application - DDCC

DDCC: The Trust Domain for the Digital Documentation of COVID-19 Certificates
* <a href="Letter_of_Application_Transitive_Trust.docx">Letter of Application for DDCC using the Transitive Trust</a> 
* <a href="Letter_of_Application_DDCC.docx">Letter of Application for DDCC by the Full Onboarding Process</a>
* <a href="Letter_of_Application_DDCC-Arabic.docx">Letter of Application for DDCC by the Full Onboarding Process - Arabic Version</a>
* <a href="Letter_of_Application_DDCC_Chinese.docx">Letter of Application for DDCC by the Full Onboarding Process - Chinese Version</a>
* <a href="Letter_of_Application_DDCC_French.docx">Letter of Application for DDCC by the Full Onboarding Process - French Version</a>
* <a href="Letter_of_Application_DDCC_Russian.docx">Letter of Application for DDCC by the Full Onboarding Process - Russian Version</a>
* <a href="Letter_of_Application_DDCC-Spanish.docx">Letter of Application for DDCC by the Full Onboarding Process - Spanish Version</a>

##### Letters of Application - PH4H
##### Letters of Application - IPS Pilgrimage




#### Secretariat Tasks
The secretariat must handle the following tasks to establish the on-boarding process:

* The organizational identity and contact will be established in an offline process by WHO through it's Member State country offices with appropriate contacts at ministries of health or appropriate public health agency.
* providing a Secure Channel for the GDHCN Participant to deliver secure and trustworthy applications SCA and/or DID information; 
* creation and Securing a Key Pair (Trust Anchor)  to sign/confirm on-boarding requests for the gateway; 
* delivering the Public Key of the Trust Anchor to the Gateway Operations; and
* transmitting On-boarding Requests to the Gateway Operations.





{% include concepts_onboarding_process_full.md %}
