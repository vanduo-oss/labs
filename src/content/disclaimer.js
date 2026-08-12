/**
 * Terms of use / disclaimer copy for the mandatory consent gate.
 *
 * Bump `TOC_VERSION` when this text changes meaningfully so returning
 * visitors must re-accept. Stored acceptance shape:
 * `{ version: string, acceptedAt: string }` under `TOC_STORAGE_KEY`.
 */

/** Bump when disclaimer clauses change in a way that needs re-consent. */
export const TOC_VERSION = '1';

/** localStorage key for versioned acceptance JSON. */
export const TOC_STORAGE_KEY = 'vanduo-labs-toc-accepted';

/** sessionStorage key while the visitor has declined this TOC version. */
export const TOC_DECLINED_SESSION_KEY = 'vanduo-labs-toc-declined';

export const DISCLAIMER_TITLE = 'Before you continue';

export const DISCLAIMER_INTRO =
  'Please read and accept these terms to use Vanduo Labs (demos, tools, documentation, and related pages). If you decline, the site stays locked until you accept — you can return later to re-read these terms.';

/** EUR-Lex link for Art. 50 / AI Act transparency (plain-language citation). */
export const AI_ACT_EUR_LEX_URL = 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj';

/** @typedef {{ heading: string, body: string, linkHref?: string, linkLabel?: string }} DisclaimerSection */

/** @type {DisclaimerSection[]} */
export const DISCLAIMER_SECTIONS = [
  {
    heading: 'Hobby / experimental playground — not a product',
    body: 'Vanduo Labs is a personal / open-source playground for prototypes and demos. It is not a commercial product, not professional training or certification, and not legal, security, or production advice. Demos may change, break, or disappear without notice. Components may graduate into the Vanduo framework — or may not. Labs is not affiliated with, endorsed by, or sponsored by third-party model or toolchain vendors unless a page explicitly says otherwise.',
  },
  {
    heading: 'As-is — no warranties',
    body: 'The site, demos, tools, documentation, AI chat answers, search results, and related materials are provided free of charge, “as is,” without warranties of any kind — express or implied — including merchantability, fitness for a particular purpose, accuracy, completeness, or uninterrupted availability. Experimental APIs are for exploration only — not a stable production surface.',
  },
  {
    heading: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, the authors and contributors assume no responsibility and are not liable for any loss, damage, security incident, outage, data loss, or other consequence arising from your use of Labs or from following (or not following) its demos, docs, or assistant output. You alone decide what to run in your projects and how to verify it. You use Labs at your own risk.',
  },
  {
    heading: 'AI-assisted content & on-device AI (EU AI Act Art. 50)',
    body: 'Substantial parts of this site’s content may be AI-generated or AI-assisted. Optional demos such as vdl-ai-chat are AI systems that produce machine-generated text. That is disclosed here to meet the transparency spirit of Article 50 of the EU Artificial Intelligence Act (Regulation (EU) 2024/1689). AI output — whether authored pages or live chat — can be wrong, incomplete, or invented. Prefer tool-backed citations and authored docs over free-form claims. Humans remain responsible for verifying anything they rely on. Do not paste secrets into chat or apply suggested changes to production systems without your own review.',
    linkHref: AI_ACT_EUR_LEX_URL,
    linkLabel: 'Official EUR-Lex text of Regulation (EU) 2024/1689',
  },
  {
    heading: 'On-device models — local resources',
    body: 'Loading model weights (for example Gemma via LiteRT) can use substantial RAM and GPU (WebGPU) and may briefly freeze the tab. Prefer smaller models on machines under ~16 GB RAM. You choose when to load; nothing downloads until you opt in (local `.models/` mirror, browser Cache Storage after the first download, or Hugging Face / CDN hosts allowed by the site). After a refresh you may still need to click Load — GPU context is rebuilt — but cached weights should not re-download from the network.',
  },
  {
    heading: 'Privacy & local storage',
    body: 'Theme preference, terms acceptance, and any demo/chat state stay in this browser’s localStorage (Labs uses a `vdl-` theme prefix so prefs do not collide with other Vanduo sites on the same origin). Chat transcripts are not uploaded to a Vanduo Labs server. There is no account or cloud sync. Opt-in model or embedding fetches may contact Hugging Face / CDN hosts. Clearing site data, switching browsers or devices, or using private/incognito mode can erase everything.',
  },
  {
    heading: 'License vs disclaimer',
    body: 'Project source is offered under the MIT License (see the repository LICENSE). MIT covers copyright permission to use the code. This disclaimer covers liability, warranties, affiliation, AI/assistant risks, and how you use the material. Accepting these terms does not replace or conflict with MIT; declining means you simply do not use the site.',
  },
  {
    heading: 'Your responsibility',
    body: 'By accepting, you confirm you are old enough to use the site where you live, that you understand the limits above (including experimental demos and AI risks), and that you will not treat Labs output as professional advice or guaranteed outcomes. If you do not agree, decline — you can re-read these terms later, but the site remains unavailable until you accept.',
  },
];

export const FAREWELL_TITLE = 'You chose not to accept';

export const FAREWELL_BODY =
  'That’s okay. Without accepting the terms, Vanduo Labs cannot unlock demos, tools, or related pages. Come back to re-read the disclaimer whenever you are ready.';
