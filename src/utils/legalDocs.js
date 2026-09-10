/** Public legal copy — also mirrored in public/privacy.html and public/terms.html. */

export const LEGAL_CONTACT = 'admin@stageworkstudio.com';
export const LEGAL_SITE = 'https://www.stageworkstudio.com';
export const LEGAL_UPDATED = '9 September 2026';

export const PRIVACY_SECTIONS = [
  {
    title: 'What this product is',
    body: 'Stage Work Studio is an AI cinema production desk that runs in your browser or as a Mac app. Cloud is used for account, license, email codes, and (if you join a studio room) collaboration. We do not remote-control your computer or delete your files.'
  },
  {
    title: 'Your films',
    body: 'A public trial account gets its own library (starting with MY FIRST FILM). It does not receive another producer’s titles. Screenplay pages are stored per film on this device. Studio collaboration rooms are separate and only for people the studio owner invites.'
  },
  {
    title: 'Account data we process',
    body: 'Email address, display name, device id, plan, credits, and sign-up codes. Codes are emailed and are not shown in the app. API keys you paste (BYOK) stay in this browser; they are not sent to our license server. Managed generate uses a studio provider key only after you enable Stage Work Studio credits.'
  },
  {
    title: 'Cookies and local storage',
    body: 'We use first-party local storage and session storage to keep you signed in and to hold the open film on this device. We do not use third-party advertising cookies.'
  },
  {
    title: 'Mail',
    body: `We email one-time codes and (if you ask) access requests. Contact ${LEGAL_CONTACT} to correct or delete an account email.`
  },
  {
    title: 'Payments',
    body: 'A payment system for credit packs is held. Until it is live, credits are granted by the studio owner. This app does not take card numbers.'
  }
];

export const TERMS_SECTIONS = [
  {
    title: 'The desk',
    body: 'You get a personal trial: Writer, Matrix, and Form on your own film. Generate, export, compile, and live collaboration stay off until your plan or credits allow them. The owner of this studio remains on Enterprise.'
  },
  {
    title: 'Your content',
    body: 'You keep the rights to scripts and pictures you put in the desk. You grant us a limited license to process them so the product can parse, compile, and (if you choose) generate. Do not upload material you do not have the right to use.'
  },
  {
    title: 'Acceptable use',
    body: 'Do not probe other accounts, scrape the studio library, abuse email codes, or attempt to use managed generate without a license. We may suspend an account that burns provider keys or harasses other users.'
  },
  {
    title: 'No production guarantee',
    body: 'AI stills and parses are tools. You remain the producer. Output may be wrong, truncated, or unavailable when a provider is down.'
  },
  {
    title: 'Liability',
    body: 'The service is provided as-is. To the extent allowed by law, Stage Work Studio is not liable for lost footage, leaked keys you stored in BYOK, or third-party model output.'
  },
  {
    title: 'Contact',
    body: `Questions: ${LEGAL_CONTACT}. Site: ${LEGAL_SITE}.`
  }
];
