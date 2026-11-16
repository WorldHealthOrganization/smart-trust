# Verify the Letter of Application

The text of the tasks of `GDHCN.ONB.VerifyLetter.bpmn`. Each section belongs to one task of that diagram, which links to it by the task's id. Edit the text here; the diagram holds only a one-line summary of each task.

<a name="V.P.Start"></a>
## Letter signed

**[14]** TNP is ready for onboarding according to WHO requirements and governance and has collected the following information in the Letter of Application [Document 16]:

- the URL of the private GitHub repositories for each environment (UAT, PROD, DEV (optional))

- the GPG keys per used environment and authorized/responsible person

- 3-digit ISO Participant code

- The contact details (including email address) of the people authorized to provide the certificates of the TNPThe TNP exchanges the Letter of Application to WHO.

<a name="V.S.Receive"></a>
## Receive the Letter

**[15]** The Letter of Application is received and processed by WHO.

**[16 - 17]** The verification and confirmation of the named people that are allowed to provide the key material for the TNP takes place through either of different channels:

1.  Through a Face to Face meeting
2.  Through Diplomat Channel signed confirmation

    .

When the Letter of Application is received, identification of individuals take place with passport, finger printing or similar.

<a name="V.S.Check"></a>
## Verify accuracy, eligibility and rules

**[18]** WHO acknowledges the Letter of Application and proceeds to validate the provided data. At this stage verification of rules compliance takes place. Verification is in detailed according to process and individuals involved in the request.

<a name="V.S.Fail"></a>
## Inform the Participant of the failure

**[19]** In case the compliance rules verification failed, WHO need to inform the TNP by email.

<a name="V.P.Correct"></a>
## Correct the Letter

**[20]** The TNP receive an email with information indicating that validations failed. Corrective activities have to be taken.

<a name="V.S.Gpg"></a>
## Check each GPG key

**[21]** WHO is checking for each provided GPG key, if the given email address is included in the GPG key.

**[22]** Validate that GPG key matches cryptographic/governance criteria

- the [GPG key requirements](concepts_certificate_governance.html#gpg-keys) in the Certificate Governance, including the key length

- mail address in GPG key must match with the provided mail address in the Letter of Application

<a name="V.S.Collect"></a>
## Collect the information for the operator

**[23]** WHO is collecting the required information to be provided to the operations team (OPS):

- GPG keys of all confirmed people and for all requested environments (UAT, PROD and optional DEV)

- the URL's of the applicant private GitHub repositories

- 3-digit ISO participant code of the TNP

- the confirmation that the invitation for the GitHub bot users has been accepted
