import type { Moment, Phase, Role } from './types';
import REFS_JSON from './process-refs.json';
import { TRUST_DOMAINS } from './refs';

/** Each moment's steps in smart-trust's onboarding business processes; checked against the BPMN at build time. */
const REFS = REFS_JSON as unknown as Record<string, string[]>;

/**
 * The trust domains on offer: smart-trust's TrustDomain instances first, then the ones the GDHCN is
 * developing that have no instance in smart-trust yet. Picking any is right; picking none is right too.
 */
const PENDING_DOMAINS: { code: string; text: string }[] = [
  { code: 'ICVP', text: 'ICVP · Yellow fever vaccination (International Certificate of Vaccination or Prophylaxis) · in development' },
  { code: 'PH4H', text: 'PH4H · Pan-American Highway for Digital Health (the Americas)' },
];
function domainItems() {
  const have = new Set(TRUST_DOMAINS.map(d => d.code));
  return [
    ...TRUST_DOMAINS.map(d => ({ text: `${d.code} · ${d.name}`, required: false, domain: d.code })),
    ...PENDING_DOMAINS.filter(d => !have.has(d.code)).map(d => ({ text: d.text, required: false, domain: d.code })),
  ];
}

/**
 * The game script. Every moment maps to the WHO SMART Trust onboarding process
 * (https://smart.who.int/trust, "Details of the Onboarding Process" and the onboarding checklist).
 * Step numbers refer to that page. Game days are illustrative, not WHO timelines.
 *
 * Text uses {tokens} filled in at runtime from the player's settings (see settings.ts):
 * {country}, {code}, {codeLower} (3-letter, same as {code3}), {code3}, {code3Lower} (ISO 3-letter, for repo names), {domain}, {business}, {keymaster}, {legal}, {technical},
 * {keymasterFirst}, {legalFirst}, {technicalFirst}, {keymasterEmail}, {keymasterPersonal}.
 * Defaults: Country XC, with fictional people Dr Zawadi Nkosi, Kwame Mensah, Sara Diallo, Tendai Banda.
 */

export const PHASES: Record<Phase, string> = {
  A: 'Apply',
  B: 'Prepare keys',
  C: 'WHO checks and setup',
  D: 'Test and go live',
  E: 'Stay live',
};

/** Names and initials are overwritten from the player's settings at start-up. */
export const ROLES: Record<Role, { name: string; title: string; initials: string; job?: string }> = {
  business: { name: 'Dr Zawadi Nkosi', title: 'Business Owner', initials: 'ZN',
    job: "Accountable for the country's participation and its use cases. Puts the team together and signs off." },
  keymaster: { name: 'Kwame Mensah', title: 'Key Master', initials: 'KM',
    job: "Creates and safeguards the country's keys and certificates (the PKI)." },
  legal: { name: 'Sara Diallo', title: 'Legal', initials: 'SD',
    job: "WHO's contact on legal and policy matters. Prepares the Letter of Application." },
  technical: { name: 'Tendai Banda', title: 'Technical', initials: 'TB',
    job: 'Runs the backend, its security and the connection tests with the Gateway.' },
  who: { name: 'WHO', title: 'WHO does this part', initials: 'WHO' },
};

export const MOMENTS: Moment[] = [
  // ---------------- A · Apply ----------------
  {
    id: 'soi', phase: 'A', title: 'Say you want to join', steps: REFS.soi, place: 'ministry', role: 'business', type: 'choice',
    brief: '{country} wants to issue digital health certificates that other countries can verify. The first move is a formal Statement of Interest to WHO.',
    docs: [{ kind: 'letter', title: 'Statement of Interest', lines: ['From: Ministry of Health, {country}', 'To: WHO GDHCN Secretariat', '{country} wishes to join the Global Digital Health Certification Network as a Participant.'] }],
    prompt: 'How do you send it?',
    choices: [
      { id: 'email', correct: true, text: 'Email it to gdhcn-secretariat@who.int' },
      {
        id: 'gateway', text: 'Upload it to the Trust Network Gateway',
        consequence: {
          title: 'Wrong road', by: 'Trust Network Gateway', steps: ['GDHCN.ONB.Apply#A.P.Interest'],
          what: 'The Gateway refused the connection. {country} has no certificates registered, and the Gateway only accepts signed key material over mTLS.',
          why: 'Paperwork travels by email to the Secretariat. The Gateway carries keys, never letters.',
          days: 3, travel: { legs: [['backend-uat', 1]], label: 'Statement of Interest', kind: 'paper' },
        },
      },
      {
        id: 'github', text: 'Put it in a GitHub repository for WHO to find',
        consequence: {
          title: 'Nobody is looking there', by: 'WHO Secretariat', steps: ['GDHCN.ONB.Apply#A.P.Interest'],
          what: "No one at WHO watches a repository it hasn't been told about. tng-bot only reads repositories it is invited to, much later in onboarding.",
          why: 'The Statement of Interest goes to gdhcn-secretariat@who.int.',
          days: 4, travel: { legs: [['backend-github', 1]], label: 'Statement of Interest', kind: 'paper' },
        },
      },
    ],
    success: { travel: [{ legs: [['paper', 1]], label: 'Statement of Interest', kind: 'paper' }], note: 'Received by the GDHCN Secretariat.' },
    days: 2,
    learn: 'Onboarding starts with an email: the Statement of Interest goes to gdhcn-secretariat@who.int.',
  },
  {
    id: 'eligibility', phase: 'A', title: 'Prove you are eligible', steps: REFS.eligibility, place: 'ministry', role: 'legal', type: 'choice',
    brief: 'WHO checks that the applicant is eligible and accepts the [[top|Terms of Participation (TOP)]]. {legalFirst}, your Legal representative, prepares the response.',
    docs: [{
      kind: 'note', title: 'Terms of Participation', lines: [
        '[[top|TOP0]] · Share credentials for an mTLS connection to the Gateway',
        'TOP1 · Follow the PKI technical specifications',
        'TOP2 · Follow the certificate and API specifications for each trust domain',
        'TOP3 · Meet the policy and regulatory standards for each trust domain',
        'TOP4 · Provide your mandate and legal framework if WHO asks',
      ],
    }],
    prompt: 'Who applies, and on what terms?',
    choices: [
      { id: 'ministry', correct: true, text: 'The Ministry of Health applies as the government health authority and accepts TOP0 to TOP4' },
      {
        id: 'vendor', text: "Your software vendor applies on the ministry's behalf, with no delegation from the ministry",
        consequence: {
          title: 'Application rejected', by: 'WHO Secretariat', steps: ['GDHCN.ONB.Apply#A.S.Check'],
          what: 'WHO rejected the application by email. The applicant must be an eligible party, such as a ministry or an officially delegated health agency.',
          why: 'Eligibility is checked before anything technical happens. Correct the details and apply again.',
          days: 10, travel: { legs: [['paper', 1]], label: 'Application', kind: 'paper' },
        },
      },
      {
        id: 'partial', text: 'Accept TOP0 to TOP2 now and leave the legal and policy terms for later',
        consequence: {
          title: 'Application rejected', by: 'WHO Secretariat', steps: ['GDHCN.ONB.Apply#A.S.Check'],
          what: 'WHO rejected it. Compliance with the Terms of Participation is part of the eligibility check.',
          why: 'The policy and regulatory commitments are part of joining, not an optional extra.',
          days: 7, travel: { legs: [['paper', 1]], label: 'Application', kind: 'paper' },
        },
      },
    ],
    success: {
      travel: [{ legs: [['paper', -1]], label: 'Invitation + technical specs', kind: 'paper' }],
      note: 'WHO invites {country} to onboard and sends the technical specifications for UAT and PROD (DEV is optional).',
    },
    days: 10,
    learn: 'Eligibility and the Terms of Participation are checked before any keys exist.',
  },
  {
    id: 'domains', phase: 'A', title: 'Choose your trust domains', steps: REFS.domains, place: 'ministry', role: 'legal', type: 'checklist',
    brief: "A country can join the GDHCN for zero, one or more trust domains. Each trust domain has its own Letter of Application and its own legal and policy requirements ([[top|TOP2 and TOP3]]). With none, {country} joins the Trust Network Gateway now and joins trust domains later. {legalFirst} confirms which ones {country} has the mandate for.",
    prompt: 'Tick every trust domain {country} applies for now, or none.',
    checklist: {
      note: 'Ticking none is allowed: {country} then joins with the Letter for no trust domain, and applies for a trust domain later through "Join a further Trust Domain".',
      button: 'Confirm trust domains',
      minDomains: 0,
      items: [
        ...domainItems(),
        { text: 'No need to choose: one application covers every trust domain', required: false, why: 'Each trust domain has its own Letter and its own legal and policy requirements. Apply for each one you join, now or later.' },
      ],
      consequence: {
        title: 'Trust domain unclear', by: 'WHO Secretariat', steps: ['GDHCN.ONB.Apply#A.P.Letter', 'GDHCN.TrustDomain.Join#J.P.Letter'],
        what: "WHO couldn't tell which trust domains {country} is applying for.", why: '',
        days: 3, travel: { legs: [['paper', 1]], label: 'Application', kind: 'paper' },
      },
    },
    success: { note: 'Applying for: {domains}.' },
    days: 3,
    learn: 'Countries choose zero, one or more trust domains. Each has its own Letter and legal requirements, and more can be joined later.',
  },
  {
    id: 'team', phase: 'A', title: 'Name your team', steps: REFS.team, place: 'ministry', role: 'business', type: 'choice',
    brief: 'WHO needs named people it can verify. {business}, the Business Owner, puts the team together.',
    docs: [{
      kind: 'note', title: '{country} representatives',
      lines: (['business', 'keymaster', 'legal', 'technical'] as const).map(r => `${ROLES[r].title} · {${r}} · ${ROLES[r].job}`),
    }],
    prompt: 'How do you set the team up for onboarding?',
    choices: [
      { id: 'four', correct: true, text: 'Name all four, each with an official government email address' },
      {
        id: 'later', text: 'Let the software vendor handle the keys and name the people later',
        consequence: {
          title: "The Letter can't be finished", by: 'WHO Secretariat', steps: ['GDHCN.ONB.Apply#A.P.Letter'],
          what: "The Letter of Application must name the people authorised to provide {country}'s key material, with their contact details. It can't go out with a blank.",
          why: 'WHO verifies the named people in person or through the diplomatic channel, so they have to be named up front.',
          days: 4,
        },
      },
    ],
    success: { note: 'Four named representatives, each with an official address.' },
    days: 3,
    learn: 'Four named roles carry onboarding: Business Owner, Key Master, Legal and Technical.',
  },

  // ---------------- B · Prepare keys ----------------
  {
    id: 'tools', phase: 'B', title: 'Set up the workbench', steps: REFS.tools, place: 'backend', role: 'technical', type: 'choice',
    brief: "{technicalFirst} sets up the tools: OpenSSL, cURL, Git, [[gpg|GPG]] and a [[github|GitHub]] account. On Windows, WHO's <a href=\"https://github.com/WorldHealthOrganization/GDHCNOnboardingWizard\" target=\"_blank\" rel=\"noopener\">Onboarding Wizard</a> can do the repository, GPG and certificate steps for you.",
    docs: [{
      kind: 'terminal', title: "{technicalFirst}'s laptop", lines: [
        '$ openssl version', 'OpenSSL 3.0.13 30 Jan 2024', '$ git --version', 'git version 2.45.1',
        '$ curl --version', 'curl 8.5.0 (x86_64-pc-linux-gnu) libcurl/8.5.0 OpenSSL/3.0.13', '$ gpg --version', 'bash: gpg: command not found',
      ], mark: [7],
    }],
    prompt: 'GPG is missing. Do you need every tool?',
    choices: [
      { id: 'all', correct: true, text: 'Install GPG too: every named person needs a GPG key, and the release tag must be signed' },
      { id: 'nogpg', flag: 'nogpg', text: 'Skip GPG; Git and OpenSSL cover what we need' },
      {
        id: 'skip', text: 'Skip cURL; WHO tests the connection for us',
        consequence: {
          title: "It's your test", by: 'WHO onboarding team', steps: ['GDHCN.ONB.ConnectTest#X.P.Test'],
          what: 'The connectivity test is run by the participant, from its own backend, with its own TLS certificate.',
          why: 'You prove your backend can reach the Gateway. The operations team supports you if it fails.',
          days: 2,
        },
      },
    ],
    success: { note: 'Workbench ready.' },
    days: 2,
    learn: "Set up every tool before you start: OpenSSL, cURL, Git and GPG. On Windows, WHO's Onboarding Wizard can help.",
  },
  {
    id: 'certs', phase: 'B', title: 'Create your certificates', steps: REFS.certs, place: 'backend', role: 'keymaster', type: 'choice',
    brief: "{keymasterFirst} creates {country}'s certificates. Each environment needs its own [[sca|Signing CA (SCA)]], [[tls|TLS client certificate]] and [[upload|Upload certificate]]: [[dev]] (optional), [[uat]] and [[prod]].",
    docs: [
      { kind: 'cert', title: 'SCA · Signing CA', lines: ["{country}'s trust anchor", 'Issues [[dsc|Document Signer Certificates (DSCs)]]'] },
      { kind: 'cert', title: 'TLS client certificate', lines: ["Proves your backend's identity to the Gateway (mTLS)"] },
      { kind: 'cert', title: 'Upload certificate', lines: ['Signs the packages you upload to the Gateway'] },
    ],
    prompt: 'How many sets do you create?',
    choices: [
      { id: 'two', correct: true, text: 'A separate set for each environment: DEV (optional), UAT and PROD' },
      { id: 'one', flag: 'reuse', text: 'One set, used in DEV, UAT and PROD; less to manage' },
      {
        id: 'tls', text: 'Only the TLS certificate for now; the rest can wait',
        consequence: {
          title: 'Key material incomplete', by: 'WHO Secretariat', steps: ['GDHCN.ONB.PrepareKeys#K.Certs', 'GDHCN.ONB.Apply#A.P.Letter'],
          what: "tng-bot collects your SCA, TLS and Upload certificates from your GitHub repository, and two of them aren't there.",
          why: 'All three are prepared for every environment you onboard to.',
          days: 3,
        },
      },
    ],
    success: { note: 'A separate set for each environment, never shared.' },
    days: 3,
    learn: 'Never reuse keys or certificates between production and test environments.',
  },
  {
    id: 'sca', phase: 'B', title: 'Protect the trust anchor', steps: REFS.sca, place: 'backend', role: 'keymaster', type: 'choice',
    brief: "The SCA's private key is the root of trust for every Document Signer Certificate {country} will ever issue.",
    docs: [{ kind: 'key', title: 'SCA private key', lines: ['Signs Document Signer Certificates', 'Whoever holds it can speak for {country}'] }],
    prompt: 'Where does it live?',
    choices: [
      { id: 'vault', correct: true, text: 'Offline, in the vault, under multi-person control' },
      {
        id: 'server', text: 'On the backend server, so signing is quick',
        consequence: {
          title: 'Trust anchor exposed', by: 'Your own security review', steps: ['page:concepts_certificate_governance'],
          what: 'An online server can be compromised. If the SCA key leaks, every certificate it vouches for is in doubt.',
          why: 'Keep the SCA offline, with more than one person needed to use it. A hardware security module or smart card adds further protection.',
          days: 6,
        },
      },
      {
        id: 'repo', text: 'In the GitHub repo next to the public keys, so nothing gets lost',
        consequence: {
          title: 'Private key published', by: 'Your own security review', steps: ['GDHCN.ONB.PrepareKeys#K.Publish', 'GDHCN.ONB.PrepareKeys#K.Repo'],
          what: 'A private key left the country. It has to be treated as compromised: revoke it, regenerate, and prepare the key material again.',
          why: 'Only public keys go to GitHub. Private keys never cross the {country} boundary.',
          days: 12, travel: { legs: [['backend-github', 1]], label: 'SCA private key', kind: 'key' },
        },
      },
    ],
    success: { note: 'SCA private key locked in the offline vault.' },
    days: 1,
    learn: 'Private keys stay inside {country}, and the SCA key stays offline.',
  },
  {
    id: 'gpg', phase: 'B', title: 'Create GPG keys', steps: REFS.gpg, place: 'backend', role: 'keymaster', type: 'choice',
    brief: 'Every person authorised to provide key material needs a [[gpg|GPG key]] for each environment. WHO will compare it with the Letter of Application.',
    docs: [{ kind: 'key', title: 'New GPG key · {keymaster}', lines: ['Algorithm: RSA 4096', 'Email: ?'], mark: [1] }],
    prompt: "Which email goes in {keymasterFirst}'s GPG key?",
    choices: [
      { id: 'official', correct: true, text: "{keymasterEmail}, the address in the Letter and verified on {keymasterFirst}'s GitHub account" },
      { id: 'gmail', flag: 'gmail', text: '{keymasterPersonal}; their personal key is already set up' },
      {
        id: 'shared', text: 'One shared team key with it-team@{domain}',
        consequence: {
          title: 'Shared key refused', by: 'WHO Secretariat', steps: ['GDHCN.ONB.PrepareKeys#K.Gpg', 'GDHCN.ONB.VerifyLetter#V.S.Gpg'],
          what: 'GPG keys are created per authorised person and per environment.',
          why: 'WHO verifies each named person and their own key.',
          days: 3,
        },
      },
    ],
    checks: [{
      flag: 'nogpg',
      consequence: {
        title: "GPG isn't installed", by: 'Your own workbench', steps: ['GDHCN.ONB.PrepareKeys#K.Gpg'],
        what: "{keymasterFirst} can't create a GPG key: GPG was never installed on the workbench.",
        why: 'Every named person signs with a GPG key, and tng-bot only accepts a GPG-signed tag.',
        days: 2,
      },
      fix: '{technicalFirst} installs GPG, then {keymasterFirst} creates the key.',
    }],
    success: { note: 'GPG keys created for each authorised person, per environment.' },
    days: 1,
    learn: 'The email inside each GPG key must match the email in the Letter of Application.',
  },
  {
    id: 'repos', phase: 'B', title: 'Set up the private repos', steps: REFS.repos, place: 'github', role: 'technical', type: 'choice',
    brief: "{technicalFirst} creates the [[repo|private GitHub repositories]] that [[tngbot|WHO's bot]] will read.",
    docs: [{ kind: 'note', title: 'Repository setup', lines: ['tng-{code3Lower}-uat · public keys (PEM)', 'tng-{code3Lower}-prod · public keys (PEM)', 'Invite: ?'], mark: [2] }],
    prompt: 'How do you set them up?',
    choices: [
      { id: 'right', correct: true, text: 'A private repo per environment; invite tng-bot-dev to UAT and tng-bot to PROD' },
      {
        id: 'public', text: 'Make them public so WHO can find them easily',
        consequence: {
          title: 'Repositories must be private', by: 'WHO Operations', steps: ['GDHCN.ONB.PrepareKeys#K.Repo'],
          what: 'The repositories have to be private.',
          why: "Private repositories hide the uploader's identity.",
          days: 2,
        },
      },
      {
        id: 'onebot', text: 'Invite tng-bot to both repositories',
        consequence: {
          title: 'Wrong bot for UAT', by: 'tng-bot', steps: ['GDHCN.ONB.PrepareKeys#K.Repo'],
          what: 'Nothing arrived in UAT.',
          why: 'tng-bot serves PROD. tng-bot-dev serves DEV and UAT.',
          days: 2, bot: true,
        },
      },
    ],
    success: {
      travel: [{ legs: [['backend-github', 1]], label: 'Public keys (PEM)', kind: 'key' }],
      note: 'Public keys are in the repos. tng-bot-dev and tng-bot are invited.',
    },
    days: 1,
    learn: 'Public keys travel through private GitHub repos: tng-bot-dev reads UAT, tng-bot reads PROD.',
  },
  {
    id: 'tag', phase: 'B', title: 'Sign the tag', steps: REFS.tag, place: 'github', role: 'keymaster', type: 'choice',
    brief: "WHO's bot takes the latest git tag and checks its signature against your onboarded GPG keys. {keymasterFirst} marks the version WHO should use.",
    docs: [{ kind: 'note', title: 'Release v1.0', lines: ['GitHub website: Releases → Create a new tag', 'Terminal: git tag -s v1.0'] }],
    prompt: 'How do you create the tag?',
    choices: [
      { id: 'terminal', correct: true, text: "Sign it from the terminal with git tag -s, using {keymasterFirst}'s GPG key" },
      { id: 'web', flag: 'webtag', text: "Create it on the GitHub website; it's quicker" },
      {
        id: 'none', text: 'Skip the tag; the bot will take the latest commit',
        consequence: {
          title: 'Nothing to collect', by: 'tng-bot', steps: ['GDHCN.ONB.PrepareKeys#K.Publish'],
          what: 'tng-bot clones the latest tag. With no tag, there is nothing to take over.',
          why: 'Tag each version you want WHO to use, and sign it.',
          days: 2, bot: true,
        },
      },
    ],
    success: { note: 'Signed tag v1.0 pushed.' },
    days: 1,
    learn: "Sign the git tag locally, from the terminal or an IDE. Tags made on the GitHub website can't be verified by tng-bot.",
  },
  {
    id: 'invite', phase: 'B', title: 'Beat the 7-day clock', steps: REFS.invite, place: 'ministry', role: 'business', type: 'choice',
    brief: "The bot invitations expire after 7 days. WHO has to accept them in that window, and it only knows to look if you tell it. The Letter of Application is a separate step and can follow later.",
    docs: [{ kind: 'email', title: 'GitHub · invitations sent', lines: ['tng-bot-dev invited to tng-{code3Lower}-uat', 'tng-bot invited to tng-{code3Lower}-prod', 'Expires in 7 days'], mark: [2] }],
    prompt: 'What do you do?',
    choices: [
      { id: 'now', correct: true, text: 'Email gdhcn-support@who.int that the bot invitations are waiting, so WHO accepts them this week' },
      {
        id: 'wait', text: "Hold everything until the Letter is signed at next month's management meeting",
        consequence: {
          title: 'Invitations expired', by: 'GitHub', steps: ['GDHCN.ONB.PrepareKeys#K.Invite', 'GDHCN.ONB.PrepareKeys#K.Accept'],
          what: 'The invitations lapsed before WHO accepted them.',
          why: "The bot invitations don't wait for the Letter. Re-invite tng-bot and tng-bot-dev, then tell WHO straight away.",
          days: 5,
        },
      },
      {
        id: 'silent', text: 'Do nothing; WHO watches GitHub and will see them',
        consequence: {
          title: 'Invitations expired', by: 'GitHub', steps: ['GDHCN.ONB.PrepareKeys#K.Invite', 'GDHCN.ONB.PrepareKeys#K.Accept'],
          what: 'Nobody at WHO knew the invitations were there, and they lapsed.',
          why: 'Tell WHO by email when the invitations are ready. Re-invite tng-bot and tng-bot-dev and restart the 7-day clock.',
          days: 5,
        },
      },
    ],
    success: { note: 'WHO told; bot invitations accepted in time.' },
    days: 2,
    learn: "Bot invitations expire after 7 days, so tell WHO they're ready. The Letter of Application can follow later.",
  },
  {
    id: 'letter', phase: 'B', title: 'Assemble the Letter of Application', steps: REFS.letter, place: 'ministry', role: 'legal', type: 'checklist',
    brief: "{legalFirst} prepares the Letters of Application ({domainLetters}; trust domains: {domains}). Keep it to the basics. The Letter names the people and points to the PROD repository; certificates and public keys live in GitHub.",
    prompt: 'Tick everything that belongs in the Letter, then send it.',
    checklist: {
      items: [
        { text: 'The PROD private repository name', required: true },
        { text: 'GPG public key fingerprints of the named people', required: true },
        { text: 'The four named contacts (Business Owner, Key Master, Legal, Technical) with official email addresses', required: true },
        { text: 'Private repository URLs for UAT and DEV', required: false, why: 'Testing needs no Letter. Only the PROD repository goes in.' },
        { text: 'SCA, TLS and Upload certificates', required: false, why: 'Certificates live in your GitHub repository, where tng-bot collects them.' },
        { text: "{country}'s ISO participant code", required: false, why: 'WHO generates the ISO participant codes and matches them itself.' },
        { text: 'The SCA private key', required: false, why: 'Private keys never leave {country}.' },
        { text: 'The GitHub access token, so WHO can log in', required: false, why: 'WHO never needs your GitHub login. The bot is invited instead.' },
        { text: 'Scanned passports of the team', required: false, why: 'Identity is checked face to face or through the diplomatic channel (Convey the Letter).' },
        { text: "A statement accepting other participants' keys in the gateway lists", required: false, why: 'Not part of the WHO Letter templates.' },
      ],
      consequence: {
        title: 'Letter returned', by: 'WHO Secretariat', steps: ['GDHCN.ONB.VerifyLetter#V.S.Check', 'GDHCN.ONB.VerifyLetter#V.P.Correct'],
        what: "WHO's checks on the Letter failed.", why: '',
        days: 4, travel: { legs: [['paper', 1]], label: 'Letter of Application', kind: 'paper' },
      },
    },
    success: { travel: [{ legs: [['paper', 1]], label: 'Letter of Application', kind: 'paper' }], note: '{domainLetters} of Application received by WHO.' },
    days: 3,
    learn: 'The Letter names the people, their GPG keys and the PROD repository. Certificates stay in GitHub.',
  },

  // ---------------- C · WHO checks and setup ----------------
  {
    id: 'identity', phase: 'C', title: 'Prove who you are', steps: REFS.identity, place: 'ministry', role: 'business', type: 'choice',
    brief: 'Before anyone can provide key material for {country}, WHO verifies the named people. Then it checks each GPG key.',
    prompt: 'How do your representatives prove who they are?',
    choices: [
      { id: 'f2f', correct: true, text: 'Meet WHO face to face with passports, or confirm through the diplomatic channel' },
      {
        id: 'scan', text: 'Email scanned passports to the GDHCN Secretariat',
        consequence: {
          title: 'Not an accepted channel', by: 'WHO Secretariat', steps: ['GDHCN.ONB.ConveyLetter#C.P.Country', 'GDHCN.ONB.ConveyLetter#C.S.Meet'],
          what: "WHO can't verify identity from an emailed scan.",
          why: 'Named people are confirmed face to face or by a signed diplomatic confirmation.',
          days: 4,
        },
      },
    ],
    checks: [{
      flag: 'gmail',
      consequence: {
        title: 'Email mismatch', by: 'WHO Secretariat', steps: ['GDHCN.ONB.VerifyLetter#V.S.Gpg'],
        what: "{keymasterFirst}'s GPG key says {keymasterPersonal}. The Letter says {keymasterEmail}.",
        why: 'WHO checks that the email inside every GPG key matches the email in the Letter of Application.',
        days: 6, travel: { legs: [['paper', 1]], label: "{keymasterFirst}'s GPG key", kind: 'paper' },
      },
      fix: '{keymasterFirst} creates a new GPG key with the ministry address, signs the tag again and resends.',
    }],
    success: { travel: [{ legs: [['paper', -1]], label: 'Identities confirmed', kind: 'paper' }], note: 'Identities confirmed and GPG keys checked.' },
    days: 10,
    learn: 'WHO verifies people in person or diplomatically, then checks every GPG key against the Letter.',
  },
  {
    id: 'collect', phase: 'C', title: 'tng-bot collects your keys', steps: REFS.collect, place: 'github', role: 'who', type: 'watch',
    brief: "WHO passes {country}'s details to Operations. tng-bot clones your latest tag and checks its signature. For UAT, the keys are signed automatically and whitelisted.",
    prompt: 'Watch tng-bot collect your keys.',
    checks: [{
      flag: 'webtag',
      consequence: {
        title: "Signature can't be verified", by: 'tng-bot', steps: ['GDHCN.ONB.RegisterKeys#R.B.Pr'],
        what: "The tag was created on the GitHub website, which signs with GitHub's own key, not {keymasterFirst}'s.",
        why: 'tng-bot verifies the tag against the GPG keys WHO onboarded. Sign tags locally, from the terminal or an IDE.',
        days: 3, bot: true,
      },
      fix: '{keymasterFirst} creates the tag again from the terminal with git tag -s.',
    }],
    success: {
      effect: 'bot-collect',
      travel: [{ legs: [['ops-uat', 1]], label: 'UAT keys: auto-signed', kind: 'key' }],
      note: 'UAT keys whitelisted on the UAT gateway.',
    },
    days: 3,
    learn: 'tng-bot collects public keys from your repos, and UAT keys are signed automatically.',
  },
  {
    id: 'airgap', phase: 'C', title: 'WHO signs PROD offline', steps: REFS.airgap, place: 'ops', role: 'who', type: 'choice',
    brief: "PROD is different. WHO verifies the pull request, then signs your PROD keys with its [[anchor|Trust Anchor]] in an air-gapped process. The Trust Anchor's private key is never on the [[gateway|online gateway]].",
    prompt: 'Your team asks how to speed this up. What do you say?',
    choices: [
      { id: 'wait', correct: true, text: "Wait for WHO's air-gapped signing and get ready for testing" },
      {
        id: 'online', text: 'Ask WHO to put the Trust Anchor on the gateway so PROD can be signed automatically',
        consequence: {
          title: 'Not how trust works', by: 'WHO Operations', steps: ['GDHCN.ONB.RegisterKeys#R.T.Sign'],
          what: 'WHO declined.',
          why: "The Trust Anchor's private key is kept offline. Every participant in the network relies on that separation.",
          days: 2,
        },
      },
    ],
    checks: [{
      flag: 'reuse',
      consequence: {
        title: 'Same certificates in UAT and PROD', by: 'WHO Operations', steps: ['GDHCN.ONB.RegisterKeys#R.O.Verify'],
        what: "WHO's verification found {country}'s UAT certificates in the PROD request.",
        why: "Certificates and keys must never be reused between production and non-production. A test key can't become a production key.",
        days: 6, travel: { legs: [['github-ops', 1]], label: 'PROD keys', kind: 'key' },
      },
      fix: '{keymasterFirst} creates a fresh PROD set, updates the PROD repo and signs a new tag.',
    }],
    success: {
      travel: [{ legs: [['ops-prod', 1]], label: 'PROD keys: signed offline', kind: 'key' }],
      note: 'PROD keys signed offline. PROD whitelisting finishes, and the PROD gateway opens to you, only after the UAT dry run passes.',
    },
    days: 5,
    learn: "WHO's Trust Anchor stays offline, and PROD keys are signed in an air-gapped process.",
  },

  // ---------------- D · Test and go live ----------------
  {
    id: 'connect', phase: 'D', title: 'Connect to UAT', steps: REFS.connect, place: 'backend', role: 'technical', type: 'choice',
    brief: "{technicalFirst} connects {country}'s backend to the [[uat|UAT]] gateway for the first time. Testing can run on [[dev|DEV]], UAT or [[prod|PROD]]; this example uses UAT.",
    docs: [{ kind: 'terminal', title: 'Connectivity test', lines: ['$ curl -v https://tng-uat.who.int/trustList \\', '    --cert ????.pem --key ????_key.pem'], mark: [1] }],
    prompt: "Which certificate proves your backend's identity to the Gateway?",
    choices: [
      { id: 'tls', correct: true, text: 'The TLS client certificate and its key' },
      {
        id: 'upload', text: 'The Upload certificate',
        consequence: {
          title: 'Handshake failed', by: 'UAT gateway', steps: ['GDHCN.ONB.ConnectTest#X.P.Connect'],
          what: 'The Gateway refused the connection.',
          why: 'The TLS client certificate authenticates your backend (mTLS). The Upload certificate signs data packages.',
          days: 1, travel: { legs: [['backend-uat', 1]], label: 'Upload certificate', kind: 'data' },
        },
      },
      {
        id: 'sca', text: 'The SCA certificate',
        consequence: {
          title: 'Wrong key, wrong place', by: 'UAT gateway', steps: ['GDHCN.ONB.ConnectTest#X.P.Connect'],
          what: 'The connection failed, and the SCA key had to come out of the vault to try it.',
          why: 'The SCA stays offline and signs Document Signer Certificates. Connections use the TLS certificate.',
          days: 2, travel: { legs: [['backend-uat', 1]], label: 'SCA certificate', kind: 'data' },
        },
      },
    ],
    success: {
      travel: [
        { legs: [['backend-uat', 1]], label: 'GET /trustList (mTLS)', kind: 'data' },
        { legs: [['backend-uat', -1]], label: 'Trust list', kind: 'data' },
      ],
      note: 'Connected. The UAT trust list came back.',
    },
    days: 1,
    learn: 'Your TLS client certificate is what opens the mTLS connection to the Gateway.',
  },
  {
    id: 'dryrun', phase: 'D', title: 'Run the UAT dry run', steps: REFS.dryrun, place: 'backend', role: 'technical', type: 'choice',
    brief: "The dry run on UAT rehearses everything you'll do in production, including the bad day.",
    docs: [{
      kind: 'note', title: 'Dry-run checklist', lines: [
        'a) Upload one or more DSCs', 'b) Delete (revoke) at least one DSC', 'c) Upload it again if needed',
        'd) Download the trust list', 'e) Provide sample VDHCs', 'f) Validate sample VDHCs',
      ],
    }],
    prompt: 'What do you send to the onboarding team?',
    choices: [
      { id: 'full', correct: true, text: 'Results for the full dry run, revocation included' },
      {
        id: 'partial', text: 'Upload and download only; revocation can wait for production',
        consequence: {
          title: 'Dry run incomplete', by: 'WHO onboarding team', steps: ['GDHCN.ONB.GoLive#G.P.UAT', 'GDHCN.ONB.ConnectTest#X.P.Test'],
          what: 'The onboarding team sent the results back.',
          why: "Revoking a DSC is part of the dry run. It is the move you'll need on your worst day.",
          days: 3, travel: { legs: [['paper', 1]], label: 'Dry-run results', kind: 'paper' },
        },
      },
    ],
    success: {
      effect: 'prod-open',
      travel: [
        { legs: [['backend-uat', 1]], label: 'Upload · revoke · download', kind: 'data' },
        { legs: [['paper', 1]], label: 'Dry-run results', kind: 'paper' },
      ],
      note: 'Dry run passed. WHO opens the PROD gateway to {country}.',
    },
    days: 3,
    learn: 'The UAT dry run includes revocation: upload, revoke, download, then validate sample certificates.',
  },
  {
    id: 'prod', phase: 'D', title: 'Production readiness test', steps: REFS.prod, place: 'backend', role: 'keymaster', type: 'choice',
    brief: '{keymasterFirst} creates a Document Signer Certificate (DSC) signed by the SCA, offline, and wraps it in a CMS package to upload to PROD. The test then checks the trust list, revokes a DSC, and the results go to the service provider by email.',
    docs: [{
      kind: 'note', title: 'Production Readiness Test', lines: [
        'a) Create a DSC, signed by the SCA', 'b) Wrap it in a CMS package', 'c) Upload the package to the PROD gateway',
        'd) Download the trust list and check your DSC is there', 'e) Delete (revoke) at least one DSC', 'f) Upload it again if the DSC is needed',
        'Then: email the results to the service provider',
      ],
    }, { kind: 'terminal', title: 'Build the CMS package', lines: ['> openssl cms -sign -nodetach -in cert.der \\', '    -signer ????.crt -inkey ????.key -out signed.der'], mark: [1] }],
    prompt: 'Which certificate signs the CMS package?',
    choices: [
      { id: 'upload', correct: true, text: 'The Upload certificate' },
      {
        id: 'tls', text: 'The TLS certificate',
        consequence: {
          title: 'Upload rejected', by: 'PROD gateway', steps: ['GDHCN.ONB.GoLive#G.P.PROD'],
          what: 'The Gateway rejected the package.',
          why: 'Packages are signed with the Upload certificate. TLS only opens the connection.',
          days: 2, travel: { legs: [['backend-prod', 1]], label: 'CMS package', kind: 'data' },
        },
      },
      {
        id: 'sca', text: 'The SCA',
        consequence: {
          title: 'Upload rejected', by: 'PROD gateway', steps: ['GDHCN.ONB.GoLive#G.P.PROD'],
          what: 'The Gateway rejected the package.',
          why: 'The SCA signs the DSC itself, offline. The package around it is signed with the Upload certificate.',
          days: 2, travel: { legs: [['backend-prod', 1]], label: 'CMS package', kind: 'data' },
        },
      },
    ],
    success: {
      effect: 'live',
      travel: [
        { legs: [['backend-prod', 1]], label: 'CMS package (DSC)', kind: 'data' },
        { legs: [['backend-prod', -1]], label: 'Trust list: {code} DSC present', kind: 'data' },
        { legs: [['backend-prod', 1]], label: 'Delete a DSC (revocation)', kind: 'data' },
        { legs: [['backend-prod', 1]], label: 'DSC uploaded again', kind: 'data' },
        { legs: [['paper', 1]], label: 'Test results by email', kind: 'paper' },
        { legs: [['paper', -1]], label: 'Onboarding complete', kind: 'paper' },
      ],
      note: 'Production Readiness Test passed. A confirmation email tells {country} and WHO that onboarding is complete.',
    },
    days: 3,
    learn: 'In production, the SCA signs the DSC and the Upload certificate signs the package. The test also revokes a DSC, and the results go by email.',
  },

  // ---------------- E · Stay live ----------------
  {
    id: 'renew', phase: 'E', title: 'Stay live', steps: REFS.renew, place: 'dashboard', role: 'keymaster', type: 'choice',
    brief: "{country} is live. Its certificates expire: recommended validity is about 4 years for the SCA, 2 for a DSC, and 1 to 2 for Upload and TLS. WHO's certificate expiry dashboard (one each for DEV, UAT and PROD) shows {country}'s Upload certificate has 21 days left.",
    docs: [{
      kind: 'dashboard', title: 'Certificate expiry · PROD · {code}', lines: ['SCA|1100', 'DSC|540', 'TLS client|330', 'Upload|21'], mark: [3],
    }],
    prompt: 'Who makes sure they are renewed in time?',
    choices: [
      { id: 'us', correct: true, text: 'We do. We track expiry ourselves, renew in good time (for example a month before expiry) and send WHO the new certificate' },
      {
        id: 'who', text: 'WHO will send a reminder before anything expires',
        consequence: {
          title: 'Expired', by: 'The network', steps: ['page:concepts_certificate_governance'],
          what: "{country}'s Upload and TLS certificates expired. Uploads stopped and the backend lost its connection.",
          why: "The dashboard shows expiry dates, but no one sends reminders: each participant tracks its own certificates. Upload and TLS certificates must be renewed in good time, for example a month before expiry, and the new ones sent to WHO.",
          days: 30,
        },
      },
    ],
    success: { note: 'New Upload certificate made and sent to WHO. Renewal dates are in the team calendar.' },
    days: 0,
    learn: "Renewing certificates on time is {country}'s job for as long as it stays in the network.",
  },
];
