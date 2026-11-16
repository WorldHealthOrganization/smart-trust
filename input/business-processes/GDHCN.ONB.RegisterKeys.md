# Register the keys

The text of the tasks of `GDHCN.ONB.RegisterKeys.bpmn`. Each section belongs to one task of that diagram, which links to it by the task's id. Edit the text here; the diagram holds only a one-line summary of each task.

<a name="R.O.Start"></a>
## Onboarding information received

**[30]** The collected onboarding information is sent to the operations (OPS) team. The onboarding (OB) team is informed as well.

<a name="R.O.Config"></a>
## Add the data to the configuration files

**[31 - 35]** The onboarding data is taken over to the configuration files by the OPS team to automate the GitHub processes. As a result, a Pull Request (PR) is created. Dependent on the environment, the subsequent steps differ.

<a name="R.T.Sign"></a>
## Verify the PR and sign air-gapped

**[36 -37]** For PROD environment, the PR is verified by WHO. After successful verification, the air-gapped signing process is performed to sign the keys. Follow to **[47]**

<a name="R.B.Auto"></a>
## Sign the keys automatically

**[38]** For UAT (and optional DEV), an auto signing process signs the keys.

<a name="R.O.Verify"></a>
## Verify the pull request

**[39]** The service provider checks the PR as well.

**[47]** TSI Verification of Pull Request in PROD Environment.

<a name="R.O.Fail"></a>
## Send the failure

**[40 - 41]** In case the verification failed, WHO is informed about the outcome.

**[48 - 50]** In case Pull Request failed, TSIS to communicate to Participant for them to Correct

<a name="R.P.Fix"></a>
## Correct the key material

**[42]** Correction.
