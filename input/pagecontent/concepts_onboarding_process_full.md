####  Details of the Onboarding Process

This page describes the onboarding process of the GDHCN (the so called Future Onboarding Process, FOP), drawn in BPMN 2.0. Under each drawing is the text of the steps it shows. That text is kept in a Markdown file beside each BPMN file, with one section per task, and each task of the drawing links to its section, so the page and the drawings come from one source. The numbers **[n]** are the step numbers of [the original drawing](#original-drawing).

Where a drawing and a text differ, the text is authority: the GDHCN Administrative and Operational Framework first, then the step text. The drawings only refer to the documentation; requirements such as key sizes are stated in the documentation they name, for example [the requirements on GPG keys](concepts_certificate_governance.html#gpg-keys).

#### Overview of the onboarding processes

Onboarding runs in three phases. In **phase 1** the Participant applies and has its Letter of Application verified. In **phase 2** the gateway operator registers the Participant's keys, once for each environment. In **phase 3** the Participant connects to the gateway and passes the tests, first in UAT and then in PROD. After onboarding, a Participant may join a further Trust Domain, change its keys or its representatives, or end its participation, and an Eligible GDHCN Participant may propose a new Trust Domain.

Each drawing has one pool for each party (the GDHCN Participant, the GDHCN Secretariat at WHO, and the gateway operator) and one lane for each actor. A task with a **+** marker calls another process: select it in a drawing to go to that process. The environment (UAT, PROD, and DEV if used) is an input of the processes that run once for each environment.

It is highly recommended:

- **To use certificates issued from a public CA which follows the CAB Forum Rules**

- **Not to reuse any certificates across the different staging environments**

The processes are listed by phase: [Top level](#top-level), [Phase 1: apply and be verified](#phase-1), [Phase 2: register the keys](#phase-2), [Phase 3: go live](#phase-3), [After onboarding](#after-onboarding). A process that is reused later is listed under the phase where it first runs.

To try onboarding hands-on, play [*Join the Network*](en/cat-harness/apps/onboarding-game/), a simulation in which a sample country onboards to the GDHCN one choice at a time. Its steps are the processes on this page.

##### Actors

Each lane is one actor, defined as an ActorDefinition of this guide.

| Actor | Role in onboarding |
| --- | --- |
| [Business Owner Representative](ActorDefinition-BusinessOwnerRepresentative.html) | Sends the Statement of Interest and the Letter of Application; may meet WHO in person (Framework IX). |
| [Legal Representative](ActorDefinition-LegalRepresentative.html) | May meet WHO in person to convey the Letter (Framework IX); receives notice of amendments (XI.2). |
| [Official Delegate](ActorDefinition-OfficialDelegate.html) | Delegate at the World Health Assembly or another WHO governing body meeting (Framework IX). |
| [Key Master Representative](ActorDefinition-KeyMasterRepresentative.html) | Manages the Participant's Public Key Infrastructure and holds the GPG key named in the Letter (Framework IX). |
| [Technical Representative](ActorDefinition-TechnicalRepresentative.html) | Connects the Participant's systems to the Trust Network Gateway and runs the tests (Framework IX). |
| [GDHCN Secretariat](ActorDefinition-GDHCNSecretariat.html) | Authorized WHO staff of the GDHCN Secretariat (Framework V, VI). |
| [WHO Country Representative](ActorDefinition-WHOCountryRepresentative.html) | Meets the representative in country and sends the Letter by diplomatic pouch (Framework IX). |
| [Trust Network Anchor](ActorDefinition-TrustNetworkAnchor.html) | WHO as trust anchor for the Public Key Infrastructure (Framework VI.6). |
| [Operations Team](ActorDefinition-OperationsTeam.html) | The gateway service provider's operations team (steps [30]-[50]). |
| [Onboarding Team](ActorDefinition-OnboardingTeam.html) | The gateway service provider's onboarding team (steps [64]-[77]). |
| [GitHub Bot](ActorDefinition-GitHubBot.html) | The gateway's GitHub bot user for the environment (steps [11]-[13], [34]-[38]). |
| [Trust Network Gateway](ActorDefinition-TrustNetworkGateway.html) | The Trust Network Gateway (Framework V.1). |

<a name="top-level"></a>
#### Top level

| Process | What it does | Calls | Called by |
| --- | --- | --- | --- |
| [Onboard a Participant (top level)](#gdhcn-onb) | Onboard a GDHCN Participant to a Trust Domain, in three phases: apply and verify, set up and go live. | [Apply and be verified](#gdhcn-onb-apply), [Go live](#gdhcn-onb-golive), [Register the keys](#gdhcn-onb-registerkeys) | - |

<a name="gdhcn-onb"></a>
##### Onboard a Participant (top level)

Onboard a GDHCN Participant to a Trust Domain, in three phases: apply and verify, set up and go live.

Framework V.4, VI.5 and IX. Calls: [Apply and be verified](#gdhcn-onb-apply), [Go live](#gdhcn-onb-golive), [Register the keys](#gdhcn-onb-registerkeys). Called by: no other process. BPMN file: [GDHCN.ONB.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Onboard a Participant (top level)"><img src="GDHCN.ONB.svg" alt="Onboard a Participant (top level)" style="width:100%;"/></object>
</figure>

<a name="phase-1"></a>
#### Phase 1: apply and be verified

| Process | What it does | Calls | Called by |
| --- | --- | --- | --- |
| [Apply and be verified](#gdhcn-onb-apply) | Apply to join and have the Letter of Application verified. | [Prepare the keys and the repository](#gdhcn-onb-preparekeys), [Verify the Letter of Application](#gdhcn-onb-verifyletter) | [Onboard a Participant (top level)](#gdhcn-onb) |
| [Prepare the keys and the repository](#gdhcn-onb-preparekeys) | Prepare the keys and the repository for one environment. | - | [Apply and be verified](#gdhcn-onb-apply), [Change the keys or the representatives](#gdhcn-onb-changekeys) |
| [Verify the Letter of Application](#gdhcn-onb-verifyletter) | Verify one Letter of Application, and have it corrected if needed. | [Convey the Letter through a secure channel](#gdhcn-onb-conveyletter) | [Apply and be verified](#gdhcn-onb-apply), [Join a further Trust Domain](#gdhcn-trustdomain-join), [Change the keys or the representatives](#gdhcn-onb-changekeys) |
| [Convey the Letter through a secure channel](#gdhcn-onb-conveyletter) | Convey a Letter of Application through a secure channel. | - | [Verify the Letter of Application](#gdhcn-onb-verifyletter), [Change the keys or the representatives](#gdhcn-onb-changekeys) |

<a name="gdhcn-onb-apply"></a>
##### Apply and be verified

Apply to join and have the Letter of Application verified.

**[1]** The eligible Trust Network Participant (TNP) has to submit its Statement of Interest [link to the form. [Document 5] ] to gdhcn-support@who.int .

**[2 – 3]** WHO validates all provided data and verify that such a data follows WHO compliance with Trusted Network Terms of Participation (TOP 0 – 3) https://smart.who.int/trust/concepts.html as well as: Participant´s eligibility criteria, governmental entity/health agency, contact details of approvers and individuals. [See Elegibility Criteria]. [Document 16]

\< see chapter 9.5 in TOP details \> [Document 6]

**[4 - 5]** In case no compliance with WHO governance rules is given, the application is rejected. The rejection is communicated to the TNP by email.

**[6]** TNP needs to modify the data they shared with WHO and re-apply it.

**[7]** If the WHO’s technical team gives a positive opinion, the eligible Trust Network Participant will be invited to start the onboarding process. The following information is included:

1.  The necessary technical specifications and configuration information to connect the local backend systems to the WHO TNG
    1.  The request to provide the necessary information to be onboarded to the different environments (UAT, PROD, DEV (optional))
    2.  The request to comply with the Trust Network Terms of Participation

**[8]** The TNP receives the confirmation and necessary technical information to connect to the TNG and register the certificates.

For a successful connection to the Trust Network Gateway there are the following steps [9] – [11] to prepare:

Framework V.4 and IX. Calls: [Prepare the keys and the repository](#gdhcn-onb-preparekeys), [Verify the Letter of Application](#gdhcn-onb-verifyletter). Called by: [Onboard a Participant (top level)](#gdhcn-onb). BPMN file: [GDHCN.ONB.Apply.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.Apply.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.Apply.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Apply and be verified"><img src="GDHCN.ONB.Apply.svg" alt="Apply and be verified" style="width:100%;"/></object>
</figure>

<a name="gdhcn-onb-preparekeys"></a>
##### Prepare the keys and the repository

Prepare the keys and the repository for one environment.

**[9]** Create certificates per environment. Details can be found here: https://smart.who.int/trust/concepts_CertificatePreperation.html

1) Certificates must be prepared for all environments (self-signed allowed) following the requirements in Certificate Governance - Authentication: TNPTLS - Upload: TNPUP - SCA(s): TNPSCA

**Note** The participant must provide the CA certificate as well as the TLS certificate.

If the participant uses a self-signed TLS certificate, the TLS certificate can simply be copied and renamed to CA.crt.

In all other cases, the participant provides the appropriate CA certificate.




2) Prepare public keys in PEM format in your private GitHub repository (see [11]) dedicated to the used environment keys.

3) The prepared public keys must be tagged by the generated GPG keys:

1.  Tag the version of your latest information by using git tag + signing commands either from terminal or developer IDE. Please note that an update in GitHub web desktop itself is not working, because the platform will use an intermediate key.
2.  The bot user clones the latest tag of your private repo and verifies the signature of the tag against the onboarded GPG keys
3.  After verification of the provisioned material, the content will be taken over for the participant

**[10]** Create the GPG keys per environment and per each user needed.

Follow the instructions to create a key: https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key

The key must meet the [GPG key requirements](concepts_certificate_governance.html#gpg-keys) in the Certificate Governance.

**[11]** The TNP creates the private GitHub repositories per environment

1.  Create a private git repository on GitHub.
2.  Prepare the following information to be provided in the onboarding request:
    -   Environment repository URL’s (all private to hide uploader's identity) (DEV (optional), UAT, PROD)
    -   Invite the WHO bot user to the private repository (with read rights). The bot user is: [tng-bot](https://github.com/tng-bot) for PROD and [tng-bot-dev](https://github.com/tng-bot-dev) for DEV (optional) and UAT environments.

**[12]** Upon GitHub repository creation and invitation to GitHub bot user to WHO is sent, validity for accepting this invitation is 7 days by default. If no action is taken it loses validity.

**[13]** Invitation for GitHub bot user must be accepted by WHO within 7 days since invitation was emitted.

Framework V.4.c, VII.4-5 and IX. Calls: no other process. Called by: [Apply and be verified](#gdhcn-onb-apply), [Change the keys or the representatives](#gdhcn-onb-changekeys). BPMN file: [GDHCN.ONB.PrepareKeys.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.PrepareKeys.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.PrepareKeys.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Prepare the keys and the repository"><img src="GDHCN.ONB.PrepareKeys.svg" alt="Prepare the keys and the repository" style="width:100%;"/></object>
</figure>

<a name="gdhcn-onb-verifyletter"></a>
##### Verify the Letter of Application

Verify one Letter of Application, and have it corrected if needed.

**[14]** TNP is ready for onboarding according to WHO requirements and governance and has collected the following information in the Letter of Application [Document 16]:

- the URL of the private GitHub repositories for each environment (UAT, PROD, DEV (optional))

- the GPG keys per used environment and authorized/responsible person

- 3-digit ISO Participant code

- The contact details (including email address) of the people authorized to provide the certificates of the TNPThe TNP exchanges the Letter of Application to WHO.

**[15]** The Letter of Application is received and processed by WHO.

**[16 - 17]** The verification and confirmation of the named people that are allowed to provide the key material for the TNP takes place through either of different channels:

1.  Through a Face to Face meeting
2.  Through Diplomat Channel signed confirmation

    .

When the Letter of Application is received, identification of individuals take place with passport, finger printing or similar.

**[18]** WHO acknowledges the Letter of Application and proceeds to validate the provided data. At this stage verification of rules compliance takes place. Verification is in detailed according to process and individuals involved in the request.

**[19]** In case the compliance rules verification failed, WHO need to inform the TNP by email.

**[20]** The TNP receive an email with information indicating that validations failed. Corrective activities have to be taken.

**[21]** WHO is checking for each provided GPG key, if the given email address is included in the GPG key.

**[22]** Validate that GPG key matches cryptographic/governance criteria

- the [GPG key requirements](concepts_certificate_governance.html#gpg-keys) in the Certificate Governance, including the key length

- mail address in GPG key must match with the provided mail address in the Letter of Application

**[23]** WHO is collecting the required information to be provided to the operations team (OPS):

- GPG keys of all confirmed people and for all requested environments (UAT, PROD and optional DEV)

- the URL's of the applicant private GitHub repositories

- 3-digit ISO participant code of the TNP

- the confirmation that the invitation for the GitHub bot users has been accepted

Framework V.4.a-b and IX. Calls: [Convey the Letter through a secure channel](#gdhcn-onb-conveyletter). Called by: [Apply and be verified](#gdhcn-onb-apply), [Join a further Trust Domain](#gdhcn-trustdomain-join), [Change the keys or the representatives](#gdhcn-onb-changekeys). BPMN file: [GDHCN.ONB.VerifyLetter.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.VerifyLetter.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.VerifyLetter.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Verify the Letter of Application"><img src="GDHCN.ONB.VerifyLetter.svg" alt="Verify the Letter of Application" style="width:100%;"/></object>
</figure>

<a name="gdhcn-onb-conveyletter"></a>
##### Convey the Letter through a secure channel

Convey a Letter of Application through a secure channel.

Framework IX. Calls: no other process. Called by: [Verify the Letter of Application](#gdhcn-onb-verifyletter), [Change the keys or the representatives](#gdhcn-onb-changekeys). BPMN file: [GDHCN.ONB.ConveyLetter.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.ConveyLetter.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.ConveyLetter.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Convey the Letter through a secure channel"><img src="GDHCN.ONB.ConveyLetter.svg" alt="Convey the Letter through a secure channel" style="width:100%;"/></object>
</figure>

<a name="phase-2"></a>
#### Phase 2: register the keys

| Process | What it does | Calls | Called by |
| --- | --- | --- | --- |
| [Register the keys](#gdhcn-onb-registerkeys) | Register a Participant's keys for one environment. | - | [Onboard a Participant (top level)](#gdhcn-onb), [Join a further Trust Domain](#gdhcn-trustdomain-join), [Change the keys or the representatives](#gdhcn-onb-changekeys) |

<a name="gdhcn-onb-registerkeys"></a>
##### Register the keys

Register a Participant's keys for one environment.

**[30]** The collected onboarding information is sent to the operations (OPS) team. The onboarding (OB) team is informed as well.

**[31 - 35]** The onboarding data is taken over to the configuration files by the OPS team to automate the GitHub processes. As a result, a Pull Request (PR) is created. Dependent on the environment, the subsequent steps differ.

**[36 -37]** For PROD environment, the PR is verified by WHO. After successful verification, the air-gapped signing process is performed to sign the keys. Follow to **[47]**

**[38]** For UAT (and optional DEV), an auto signing process signs the keys.

**[39]** The service provider checks the PR as well.

**[47]** TSI Verification of Pull Request in PROD Environment.

**[40 - 41]** In case the verification failed, WHO is informed about the outcome.

**[48 - 50]** In case Pull Request failed, TSIS to communicate to Participant for them to Correct

**[42]** Correction.

Calls: no other process. Called by: [Onboard a Participant (top level)](#gdhcn-onb), [Join a further Trust Domain](#gdhcn-trustdomain-join), [Change the keys or the representatives](#gdhcn-onb-changekeys). BPMN file: [GDHCN.ONB.RegisterKeys.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.RegisterKeys.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.RegisterKeys.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Register the keys"><img src="GDHCN.ONB.RegisterKeys.svg" alt="Register the keys" style="width:100%;"/></object>
</figure>

<a name="phase-3"></a>
#### Phase 3: go live

| Process | What it does | Calls | Called by |
| --- | --- | --- | --- |
| [Go live](#gdhcn-onb-golive) | Connect to the gateway and pass the tests, in UAT and then PROD. | [Connect and test](#gdhcn-onb-connecttest) | [Onboard a Participant (top level)](#gdhcn-onb), [Join a further Trust Domain](#gdhcn-trustdomain-join) |
| [Connect and test](#gdhcn-onb-connecttest) | Connect to the gateway and pass the test, for one environment. | - | [Go live](#gdhcn-onb-golive) |

<a name="gdhcn-onb-golive"></a>
##### Go live

Connect to the gateway and pass the tests, in UAT and then PROD.

**[77 - 80]** After passing the Production Readiness Test, the participant is allowed to use the TNG PROD environment. A confirmation email is sent to the participant and to WHO with the confirmation about the successfully passed test and the completion of the onboarding process.

Calls: [Connect and test](#gdhcn-onb-connecttest). Called by: [Onboard a Participant (top level)](#gdhcn-onb), [Join a further Trust Domain](#gdhcn-trustdomain-join). BPMN file: [GDHCN.ONB.GoLive.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.GoLive.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.GoLive.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Go live"><img src="GDHCN.ONB.GoLive.svg" alt="Go live" style="width:100%;"/></object>
</figure>

<a name="gdhcn-onb-connecttest"></a>
##### Connect and test

Connect to the gateway and pass the test, for one environment.

**[43]** In case the verification was successful the whitelisting of the certificates is initiated.

**[67]** If the Dry Run Test has passed successfully, the whitelisting of the certificates in the gateway (PROD environment) continues.

**[44 - 46]** and the participant will be informed that the preparation has been completed successfully.

**[68 - 69]** The Onboarding team informs the TNP to be ready to connect to TNG PROD environment.

**[60]** The participant is connecting to UAT environment and the following steps has to be performed to check the connection:

<details> 

<summary> 1) check the connectivity with the following command:  </summary> 
input:

curl -v https://tng-uat.who.int/trustList --cert TLS.pem --key TLS_key.pem 

You should see an output like:

\`\`\`

[

{

"kid": "+jrpHSqdqZY=",

"timestamp": "2023-05-25T07:55:21Z",

"country": "XC",

"certificateType": "UPLOAD",

"thumbprint": "fa3ae91d...",

"signature": "MIAGCSqGSIb3D...",

"rawData": "MIIErTCCA5WgAwIBAgII..."

}

]

\`\`\`

</details> 

2) Test the other Trustlist Routes in the same style (e. g. with DSC/SCA/Upload/Authentication…)

**[70]** The participant is allowed and enabled to connect to TNG PROD environment (for detailed information see [60]).

**[61]** In case the connection fails, some corrective actions must be performed to analyze and solve the issue(s). The operations team is supporting the TNP.

**[71]** In case the connection fails, some corrective actions must be performed to analyze and solve the issue(s). The operations team is supporting the TNP.

**[62]** After the connection to the TNG is established the participant can start the dry run test on UAT.

This test includes the listed steps:

a) Upload one or more DSCs to the TNG

b) Delete at least one DSC again (revocation of a DSC)

c) Optional: Upload it again (if it is required for further testing)

d) Download the trust list from the TNG gateway [(API)](openapi)

e) Provide sample VDHC s to be verified by the service provider

f) Validate some sample VDHC 's to ensure the validation implementation is working fine

**[72]** After the connection to the TNG PROD is established the Production Readiness Test can start. 

<details> 
<summary> This test includes the listed steps: </summary> 

a) Create a Document Signer Certificate (DSC) and sign it by the SCA


b) Create an CMS package with the following command: 

Input:

openssl x509 -outform der -in cert.pem -out cert.der

openssl cms -sign -nodetach -in cert.der -signer signing.crt -inkey signing.key -out signed.der -outform DER -binary

openssl base64 -in signed.der -out cms.b64 -e -A

Note: cert.der is your DSC, signing.crt is the TNPUP


 c) Upload the CMS package to the gateway 

Input:

curl -v -X POST -H "Content-Type: application/cms" --cert TLS.pem --key TLS_key.pem --data @cms.b64 https://tng-uat.who.int/signerCertificate  



 d) Download the trustlist again and check if your DSC is available. <


**Note**: Some versions of curl don’t attach the client certificates automatically. This can be checked via curl –version. Ensure that the used version is linked to OpenSSL. Especially under Windows (https://curl.se/windows/):  
  
OpenSSL Test Example (working)


e) Delete at least one DSC again (Revocation)

f) Upload it again in case the DSC is required

</details>

**[63]** After executing all required steps, the participant must provide the test results to the onboarding team.

**[73 - 74]** After executing all required steps, the participant must provide the test results to the service provider by mail.

**[64 - 65]** The onboarding team checks the results and provides feedback to the participant.

**[75]** The service provider checks the results.

**[66]** In case of any issues additional corrective actions are bespoken and solved with the participant.

**[76]** and in case of any issues additional corrective actions are bespoken and solved with the participant.

Calls: no other process. Called by: [Go live](#gdhcn-onb-golive). BPMN file: [GDHCN.ONB.ConnectTest.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.ConnectTest.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.ConnectTest.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Connect and test"><img src="GDHCN.ONB.ConnectTest.svg" alt="Connect and test" style="width:100%;"/></object>
</figure>

<a name="after-onboarding"></a>
#### After onboarding

| Process | What it does | Calls | Called by |
| --- | --- | --- | --- |
| [Join a further Trust Domain](#gdhcn-trustdomain-join) | Join a further Trust Domain once onboarded. | [Verify the Letter of Application](#gdhcn-onb-verifyletter), [Go live](#gdhcn-onb-golive), [Register the keys](#gdhcn-onb-registerkeys) | - |
| [Change the keys or the representatives](#gdhcn-onb-changekeys) | Change the keys or the representatives after onboarding. | [Prepare the keys and the repository](#gdhcn-onb-preparekeys), [Convey the Letter through a secure channel](#gdhcn-onb-conveyletter), [Verify the Letter of Application](#gdhcn-onb-verifyletter), [Register the keys](#gdhcn-onb-registerkeys) | - |
| [Propose a new Trust Domain](#gdhcn-trustdomain-propose) | Propose a new Trust Domain and have it approved. | - | - |
| [End participation](#gdhcn-onb-terminate) | End participation in one or more Trust Domains. | - | - |

<a name="gdhcn-trustdomain-join"></a>
##### Join a further Trust Domain

Join a further Trust Domain once onboarded.

Framework V.4 and IX. Calls: [Verify the Letter of Application](#gdhcn-onb-verifyletter), [Go live](#gdhcn-onb-golive), [Register the keys](#gdhcn-onb-registerkeys). Called by: no other process. BPMN file: [GDHCN.TrustDomain.Join.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.TrustDomain.Join.bpmn).

<figure style="width:100%">
  <object data="GDHCN.TrustDomain.Join.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Join a further Trust Domain"><img src="GDHCN.TrustDomain.Join.svg" alt="Join a further Trust Domain" style="width:100%;"/></object>
</figure>

<a name="gdhcn-onb-changekeys"></a>
##### Change the keys or the representatives

Change the keys or the representatives after onboarding.

Framework IX. Calls: [Prepare the keys and the repository](#gdhcn-onb-preparekeys), [Convey the Letter through a secure channel](#gdhcn-onb-conveyletter), [Verify the Letter of Application](#gdhcn-onb-verifyletter), [Register the keys](#gdhcn-onb-registerkeys). Called by: no other process. BPMN file: [GDHCN.ONB.ChangeKeys.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.ChangeKeys.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.ChangeKeys.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Change the keys or the representatives"><img src="GDHCN.ONB.ChangeKeys.svg" alt="Change the keys or the representatives" style="width:100%;"/></object>
</figure>

<a name="gdhcn-trustdomain-propose"></a>
##### Propose a new Trust Domain

Propose a new Trust Domain and have it approved.

Framework V.3, VI.2-3 and XI. Calls: no other process. Called by: no other process. BPMN file: [GDHCN.TrustDomain.Propose.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.TrustDomain.Propose.bpmn).

<figure style="width:100%">
  <object data="GDHCN.TrustDomain.Propose.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="Propose a new Trust Domain"><img src="GDHCN.TrustDomain.Propose.svg" alt="Propose a new Trust Domain" style="width:100%;"/></object>
</figure>

<a name="gdhcn-onb-terminate"></a>
##### End participation

End participation in one or more Trust Domains.

Framework XV.1-3. Calls: no other process. Called by: no other process. BPMN file: [GDHCN.ONB.Terminate.bpmn](https://github.com/litlfred/smart-trust/blob/main/input/business-processes/GDHCN.ONB.Terminate.bpmn).

<figure style="width:100%">
  <object data="GDHCN.ONB.Terminate.svg" type="image/svg+xml" style="width:100%; max-width:1400px;" aria-label="End participation"><img src="GDHCN.ONB.Terminate.svg" alt="End participation" style="width:100%;"/></object>
</figure>

<a name="original-drawing"></a>
#### The original drawing

**Note:** In the embedded image the following relabels apply:

* DCCG -> TNG

* CSCA -> SCA

* DCC -> VDHC (Verifiable Digital Health Certificate)

* NB -> TNP

<img src="OnboardingProcess_Full.png" style="float:none; margin: 0px 0px 0px 0px;"/>
