import { IconName } from '../../shared/icons';

/**
 * The words on the About, Support, Privacy, Terms and Contact pages.
 *
 * Kept as data in one file rather than inline in five templates for two
 * reasons. The support categories and the contact details have to agree
 * everywhere they appear - the Support form, the Privacy page's "Contact us",
 * the footer - and a phone number that is right in two places out of three is
 * worse than one that is wrong everywhere, because nobody notices. And the
 * legal pages are the part of this application most likely to be edited by
 * somebody who does not write Angular; a list of `{ title, body }` is
 * something a lawyer's markup can be pasted into.
 *
 * The contact details are also served by `GET /support/contact`, which is what
 * the mobile app reads. These are the fallback the page renders before that
 * call returns, and what it keeps if the call fails - a Support page that
 * shows no way to contact support because a request failed would be the one
 * failure that matters most.
 */

export const SUPPORT_EMAIL = 'offersoffersupport@gmail.com';
export const SUPPORT_PHONES = ['+91 7540043503', '+91 7904795700'];

/**
 * When the legal text last changed.
 *
 * A date rather than "today": a policy that claims to have been updated on
 * whatever day you happen to read it tells the reader nothing, and is the
 * first thing that looks dishonest under scrutiny. Update it when the text
 * below changes, and not otherwise.
 */
export const POLICY_LAST_UPDATED = '1 September 2026';

/** The legal entity these documents belong to. Kept here to be filled in. */
export const LEGAL_ENTITY = 'OffersOffer';

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

export interface SupportCategory {
  /** Matches the backend's `CATEGORIES` list exactly. */
  value: string;
  label: string;
  /** Shown under the label so the right one is picked without guessing. */
  hint: string;
}

/**
 * The twelve things people write in about.
 *
 * "Report an issue" is deliberately two entries. The platform lists
 * merchant-submitted content, so a customer needs a straightforward way to say
 * "this offer is misleading" - and that is a different queue, answered by
 * different people, from "the app crashed".
 */
export const SUPPORT_CATEGORIES: SupportCategory[] = [
  { value: 'account', label: 'Account / Login', hint: 'Signing in, verification, password, profile' },
  { value: 'offers', label: 'Offers', hint: 'An offer that looks wrong, missing or out of date' },
  { value: 'services', label: 'Services', hint: 'Service listings, availability and bookings' },
  { value: 'claim', label: 'Claim / Coupon', hint: 'Claiming an offer, or a code that will not appear' },
  { value: 'redemption', label: 'Redemption', hint: 'A code the shop could not accept' },
  { value: 'notifications', label: 'Notifications', hint: 'Alerts you are not getting, or getting too many of' },
  { value: 'location', label: 'Location / Near Me', hint: 'Nearby results, distance or the location picker' },
  { value: 'merchant', label: 'Merchant / Shop Account', hint: 'Running a shop, branches, staff and listings' },
  { value: 'billing', label: 'Subscription / Billing', hint: 'Plans, invoices and payments' },
  { value: 'technical', label: 'Technical problem', hint: 'Errors, blank screens and things that will not load' },
  {
    value: 'report_problem',
    label: 'Report a problem',
    hint: 'Something is broken or behaving badly across the app',
  },
  {
    value: 'report_content',
    label: 'Report an offer or shop',
    hint: 'Misleading, expired, inappropriate or possibly fraudulent content',
  },
  { value: 'other', label: 'Other', hint: 'Anything that does not fit above' },
];

export interface Faq {
  question: string;
  answer: string;
}

/** Below the form, because the point of it is to make the form unnecessary. */
export const SUPPORT_FAQS: Faq[] = [
  {
    question: 'How do I claim an offer?',
    answer:
      'Open the offer and choose Claim. You will need an account for this step, since the code has to belong to somebody. We generate a unique code and keep it under My claims until you use it or it expires.',
  },
  {
    question: 'How do I redeem an offer?',
    answer:
      'Show the code, or its QR, to the shop at the counter. Staff scan or type it into their verification screen, which confirms it is genuine and marks it used. A code can only be redeemed once.',
  },
  {
    question: 'What happens when an offer expires?',
    answer:
      'It stops appearing in discovery and can no longer be claimed. A code you claimed before the expiry is valid until its own expiry date, which is shown on the claim itself — that date, not the offer’s, is the one to go by.',
  },
  {
    question: 'How do I save an offer?',
    answer:
      'Use the heart on any offer or service to save it. Saved items sit under Saved offers, and we can remind you before one you saved is about to expire.',
  },
  {
    question: 'How do I enable notifications?',
    answer:
      'Notification settings live in your profile, where each kind can be switched on or off separately. On the website your browser also has to allow them; on the mobile app, your device does.',
  },
  {
    question: 'Why can’t I see nearby offers?',
    answer:
      'Usually because location access is off, or because there are no active offers in range yet. You can choose a city from the location picker in the header instead — nearby results do not require sharing your location.',
  },
  {
    question: 'How do I contact a shop?',
    answer:
      'Open the shop page. Phone numbers, branches, addresses and opening hours are listed there, along with everything the shop currently has on offer.',
  },
  {
    question: 'How does merchant verification work?',
    answer:
      'A shop is created and reviewed by our team before its listings go live, and staff are added to it by the shop’s own admin. Only members of a shop can publish or redeem on its behalf.',
  },
  {
    question: 'Do I need an account to browse?',
    answer:
      'No. Offers, services, shops and nearby discovery are all open without signing in. An account only adds the things that have to know who you are — saving, claiming, following and reminders.',
  },
];

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export interface AboutFeature {
  icon: IconName;
  title: string;
  body: string;
}

export const ABOUT_FEATURES: AboutFeature[] = [
  {
    icon: 'pricetags-outline',
    title: 'Discover offers',
    body: 'Find discounts across clothing, food, electronics, jewellery, footwear, beauty and more.',
  },
  {
    icon: 'briefcase-outline',
    title: 'Find services',
    body: 'Discover local services — salons, cleaning, repair, automotive, photography and others.',
  },
  {
    icon: 'location-outline',
    title: 'Find nearby deals',
    body: 'Use location-based discovery to see offers and services around you.',
  },
  {
    icon: 'heart-outline',
    title: 'Save what you like',
    body: 'Save offers and services for later, and get a reminder when a saved offer is about to expire.',
  },
  {
    icon: 'ticket-outline',
    title: 'Claim offers',
    body: 'Claim eligible offers and get a unique code that the shop can verify at the counter.',
  },
  {
    icon: 'eye-outline',
    title: 'Explore without signing up',
    body: 'Browse and discover without creating an account. Login is only needed for personalised features.',
  },
];

// ---------------------------------------------------------------------------
// Legal documents
// ---------------------------------------------------------------------------

export interface LegalSection {
  heading: string;
  /** Paragraphs. Rendered in order, above the list if there is one. */
  body?: string[];
  list?: string[];
  /** A short highlighted statement — the sentence the section exists for. */
  callout?: string;
}

/**
 * Privacy Policy.
 *
 * A product draft, not legal advice, and it says so on the page. Two things
 * are deliberate throughout. It describes only what the platform actually
 * does — there is no payment-processor disclosure, because payments are not
 * live, and claiming a data flow that does not exist is its own kind of
 * inaccuracy. And it never promises absolute security or immediate deletion,
 * because neither is true of any system and both are the sentences that get
 * quoted back at you.
 */
export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'Information we collect',
    body: [
      'When you create a customer account we collect your name, email address, your password (stored only in hashed form, never as text we can read) and your phone number if you give us one.',
      'When a shop is registered we additionally collect the shop name and address, branch information, business contact details, shop images, and the offers and services the shop publishes.',
    ],
  },
  {
    heading: 'Location information',
    body: [
      'Offers App has a Near Me feature, so location deserves saying plainly. Where you allow it, we may use your current location, a location you select yourself, and the coordinates of shops and their branches.',
    ],
    list: [
      'To show nearby offers and services',
      'To calculate distance from you to a shop',
      'For map-based discovery',
      'For location-based recommendations',
    ],
    callout:
      'Location permission is optional. You can browse everything without granting it, and choose a location manually instead.',
  },
  {
    heading: 'Usage information',
    body: [
      'To run the service and improve it, we may record activity such as the offers and services you view, what you save and claim, coupons redeemed, searches, how you interact with notifications, and general app activity. These signals are what personalised recommendations and our own analytics are built from.',
    ],
  },
  {
    heading: 'Device information',
    body: [
      'Where applicable we may record your device type, operating system, app version, and — if you turn on push notifications — the notification token your device gives us.',
    ],
  },
  {
    heading: 'How we use this information',
    list: [
      'To provide and operate Offers App',
      'To display offers and services',
      'To provide Near Me and other location features',
      'To personalise recommendations',
      'To send notifications you have asked for',
      'To process claims and redemptions',
      'To manage merchant accounts',
      'To provide customer support',
      'To improve performance and reliability',
      'To detect misuse and fraud, and maintain security',
      'To produce aggregate analytics about how the platform is used',
    ],
  },
  {
    heading: 'Saved offers and notifications',
    body: [
      'If you save an offer, we may send you a notification when that offer is approaching its expiry, subject to your notification settings. Optional notifications can be turned off individually in your profile at any time, and turning them off does not affect anything else about your account.',
    ],
  },
  {
    heading: 'Claim and redemption data',
    body: [
      'When you claim an offer we record the unique claim code, the date you claimed it, which offer, shop and branch it belongs to, and whether it has been redeemed. This is what makes a coupon verifiable at the counter and is how we prevent the same code being used twice.',
      'Staff at the participating shop can see the information they need to verify your claim, and no more.',
    ],
  },
  {
    heading: 'Location privacy',
    body: [
      'Offers App may ask for location permission in order to show nearby offers and services. You can keep using general discovery without granting it, and where location is unavailable you can select a location manually.',
    ],
    callout: 'Your precise location is not exposed to merchants.',
  },
  {
    heading: 'Sharing your information',
    body: [
      'We do not sell your personal information. We share it with service providers only where that is what operating the platform requires, and only in the categories below.',
    ],
    list: [
      'Cloud hosting and database infrastructure',
      'Push notification delivery',
      'Maps and location services',
      'Email delivery',
      'Image and file storage',
      'AI service providers, for the merchant-facing content tools',
    ],
    callout:
      'Payment providers are not on this list because payments are not live yet. This section will be updated before they are.',
  },
  {
    heading: 'Payment information',
    body: [
      'Offers App is currently free to use and does not process payments. When paid subscriptions are introduced, payment will be handled by an authorised payment service provider, and Offers App will not store sensitive card details such as your CVV or your UPI PIN. This section will be updated at that point.',
    ],
  },
  {
    heading: 'Data security',
    body: [
      'We use reasonable technical and organisational measures designed to protect your information. These include encrypted connections (HTTPS), hashed passwords, role-based access controls, secure token handling, database access restrictions, audit logging and monitoring.',
    ],
    callout:
      'No online service can promise perfect security, and we do not make that promise. We can tell you what we do and that we take it seriously.',
  },
  {
    heading: 'How long we keep it',
    body: [
      'We keep information for as long as it is needed to provide the service, manage your account, meet legal and business requirements, investigate fraud or security incidents, and produce analytics where appropriate.',
      'Different records have different retention periods. Deleting your account does not delete everything instantly — transaction, audit and business records may need to be kept for longer, and we would rather say so than promise otherwise.',
    ],
  },
  {
    heading: 'Your choices',
    body: ['You can ask us to:'],
    list: [
      'Give you access to the personal information we hold about you',
      'Correct information that is wrong',
      'Delete your account, where that is possible',
      'Withdraw consent you gave for something optional',
      'Change your notification preferences',
      'Change or withdraw location permission',
      'Answer a question about how your information is handled',
    ],
    callout:
      'The quickest route is the support form on this site. Notification and location settings can also be changed yourself, in your profile and in your browser or device.',
  },
  {
    heading: 'Cookies and website tracking',
    body: [
      'On the website we use cookies and similar technologies to keep you signed in, to protect requests against cross-site forgery, to remember preferences such as your theme and chosen location, and to understand performance. Some of these are necessary for the site to work at all; blocking them will sign you out.',
    ],
  },
  {
    heading: 'Children’s privacy',
    body: [
      'Offers App is intended for people who are legally permitted to use the service under applicable law. We do not knowingly collect personal information from anyone who is not. If you believe a child has given us personal information, contact us and we will deal with it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. When we make material changes, the updated policy and a revised date will be published here and in the app.',
    ],
  },
];

/**
 * Terms & Conditions.
 *
 * Not asked for, but added alongside the Privacy Policy because the footer,
 * the sign-up form and the mobile Profile menu all link to it — the sign-up
 * checkbox already says "I accept the terms and conditions", and a checkbox
 * agreeing to a document that does not exist is worse than no checkbox.
 */
export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'About these terms',
    body: [
      'These terms cover your use of Offers App — the website, the mobile app and everything reachable through them. By using the service you accept them. If you do not, please do not use the service.',
    ],
  },
  {
    heading: 'Who can use Offers App',
    body: [
      'You may browse offers, services and shops without an account. You need an account to save, claim, follow or book, and to receive reminders. You must be legally permitted to use the service under applicable law, and the details you give us when registering must be accurate.',
      'You are responsible for what happens under your account, so keep your password to yourself and tell us if you think somebody else has it.',
    ],
  },
  {
    heading: 'Offers are made by shops, not by us',
    body: [
      'Offers App is a discovery platform. The offers, discounts, services, prices, images and descriptions on it are published by the shops themselves, and each shop is responsible for what it publishes and for honouring it.',
      'We take reasonable steps to keep listings accurate, but we cannot guarantee that every listing is correct, current or available. The terms of a specific offer — what it applies to, what it excludes, when it ends — are set by the shop.',
    ],
    callout:
      'If an offer is wrong, misleading or was refused at the counter, report it from the Support page. Reports are read.',
  },
  {
    heading: 'Claims and coupon codes',
    body: [
      'Claiming an offer generates a unique code tied to your account. A code is for your own use, can be redeemed once, and stops working after its expiry date — which is shown on the claim itself and may differ from the offer’s end date.',
      'Codes must not be sold, transferred or shared. We may cancel a claim, or suspend an account, where a code is being misused or where the claim appears fraudulent.',
    ],
  },
  {
    heading: 'For merchants',
    body: [
      'If you publish a shop, offers or services on Offers App, you confirm you are entitled to represent that business and that what you publish is accurate, lawful and yours to publish. You must honour the offers you have listed, on the terms you listed them.',
      'We may decline, edit the visibility of, or remove a listing that breaks these terms, is misleading, or is the subject of substantiated reports.',
    ],
  },
  {
    heading: 'Acceptable use',
    list: [
      'Do not publish false, misleading, unlawful or offensive content',
      'Do not impersonate a person, a business or Offers App',
      'Do not attempt to break, overload, scrape or gain unauthorised access to the service',
      'Do not use anyone else’s account, or share your own',
      'Do not use claim codes in any way other than redeeming your own claim at the shop',
    ],
  },
  {
    heading: 'Subscriptions and payment',
    body: [
      'Offers App is currently free to use, for customers and for merchants. Paid merchant plans may be introduced later. If they are, the price, what each plan includes and how billing works will be shown before you agree to anything, and nothing will be charged without that.',
    ],
  },
  {
    heading: 'Availability',
    body: [
      'We aim to keep Offers App available and working, but we do not promise it will be uninterrupted or error-free. We may change, suspend or withdraw features, and we may carry out maintenance.',
    ],
  },
  {
    heading: 'Your content',
    body: [
      'You keep ownership of what you upload — images, reviews, shop and listing details. By uploading it, you give us permission to host, display and distribute it as part of running Offers App, and you confirm you have the right to do so.',
    ],
  },
  {
    heading: 'Ending your use',
    body: [
      'You can stop using Offers App and ask us to delete your account at any time. We may suspend or close an account that breaks these terms or is being used fraudulently.',
    ],
  },
  {
    heading: 'Changes to these terms',
    body: [
      'We may update these terms. When we make material changes, the updated terms and a revised date will be published here and in the app. Continuing to use the service after that means you accept the updated terms.',
    ],
  },
  {
    heading: 'Contact',
    body: [
      'Questions about these terms can be sent to us through the Support page, or by email to the address below.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Account & data deletion
// ---------------------------------------------------------------------------

/**
 * The page behind the "Data deletion" URL submitted in the Google Play
 * Console, which Play requires to be reachable **without installing the app
 * and without signing in** — the reader may be someone who has already
 * uninstalled it, or a reviewer who never had an account.
 *
 * That constraint is why this is a page of its own rather than a section of
 * the Privacy Policy: Play asks for a single URL that is about deletion and
 * nothing else, and the retention table below is the part reviewers actually
 * check. Keep it truthful against `DELETE /api/users/me` — a page that claims
 * to delete more than the code does is the version that causes a rejection.
 */
export const DELETE_ACCOUNT_SECTIONS: LegalSection[] = [
  {
    heading: 'Delete your account from the app',
    body: [
      'The fastest way to delete your OffersOffer account is from inside the app. It takes effect immediately — there is no waiting period and no request for us to process.',
    ],
    list: [
      'Open the OffersOffer app and sign in',
      'Go to Profile',
      'Tap Delete Account',
      'Enter your password and type DELETE to confirm',
    ],
    callout: 'Deletion is immediate and permanent. We cannot restore an account once it is deleted.',
  },
  {
    heading: 'Delete your account without the app',
    body: [
      'If you have already uninstalled the app, or cannot sign in, email us from the address on the account and we will delete it for you.',
      'Send the request to the support address at the bottom of this page with the subject "Delete my account". We will confirm within 30 days, and in practice much sooner.',
      'We will only act on a request sent from the email address registered to the account. That is a protection for you: it is the one thing that stops somebody else deleting your account.',
    ],
  },
  {
    heading: 'What is deleted',
    body: [
      'Deleting your account permanently removes the personal data we hold about you:',
    ],
    list: [
      'Your profile — name, email address, phone number and profile picture',
      'Saved offers, favourites and the shops you follow',
      'Your claims, bookings and the QR codes issued for them',
      'Reviews and ratings you have written',
      'Notifications, notification preferences and every device registered for push',
      'Your search history and saved locations',
      'All sign-in sessions, on every device',
    ],
  },
  {
    heading: 'What we keep, and for how long',
    body: [
      'Two kinds of record outlive the account, and both are stripped of anything that identifies you:',
    ],
    list: [
      'Redemptions a shop has already honoured. These are the shop’s record of a transaction rather than your personal data, so the redemption stays but your name is removed from it. Kept as long as the shop remains on OffersOffer.',
      'Security and audit records — that an account was deleted, and when. Kept for 12 months, and required to answer a later question about your own deletion request.',
    ],
    callout:
      'Neither record can be used to identify you or to rebuild your account. Nothing retained is used for marketing, and nothing is shared with shops.',
  },
  {
    heading: 'If you manage a shop',
    body: [
      'A shop with offers running cannot be left without anyone to manage it, so if you are an administrator of a shop on OffersOffer, the app will ask you to hand it over or close it first.',
      'Contact support and we will either transfer the shop to another administrator you nominate, or close the shop and then delete your account. Neither costs you anything and neither takes more than a day.',
    ],
  },
];
