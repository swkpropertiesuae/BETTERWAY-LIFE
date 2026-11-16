// External connectors. "ready" is computed from environment variables; every connector has a manual path that always works.
export type Connector = { key: string; name: string; env: string[]; built: boolean; manual: string; note: string };

export const CONNECTORS: Connector[] = [
  { key: 'whatsapp', name: 'WhatsApp Business (inbound)', env: ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'], built: true, manual: 'Staff message clients from the notification outbox and log calls and chats in the CRM.', note: 'Webhook: /api/v1/intake/whatsapp. Outbound sending is not built.' },
  { key: 'sanctions', name: 'Sanctions / watchlist', env: [], built: true, manual: 'Compliance uploads the latest list (CSV, XLSX or JSON) on the Compliance screen.', note: 'Manual import is live. No automatic feed.' },
  { key: 'peppol', name: 'Peppol e-invoicing (Accredited Service Provider)', env: ['PEPPOL_ASP_URL', 'PEPPOL_ASP_KEY'], built: false, manual: 'PINT-AE XML is generated and downloaded; upload it to your provider portal.', note: 'Needs an accredited provider contract. Not built.' },
  { key: 'aecb', name: 'AECB credit bureau', env: ['AECB_API_KEY'], built: false, manual: 'Upload the AECB report PDF to the vault; enter liabilities by hand.', note: 'Needs a bureau agreement. Not built.' },
  { key: 'uaepass', name: 'UAE PASS (login and signature)', env: ['UAEPASS_CLIENT_ID', 'UAEPASS_CLIENT_SECRET'], built: false, manual: 'Borrowers sign the KFS in the portal; staff verify identity from Emirates ID.', note: 'Needs government onboarding. Not built.' },
  { key: 'esign', name: 'E-signature provider', env: ['ESIGN_API_KEY'], built: false, manual: 'KFS acknowledgement is recorded in the OS; other documents are signed outside and uploaded.', note: 'Needs a provider account. Not built.' },
  { key: 'ocr', name: 'Document OCR', env: ['OCR_API_KEY'], built: false, manual: 'Staff read and enter document figures; the vault checks dates and expiry.', note: 'Needs an OCR provider. Not built.' },
  { key: 'lender', name: 'Lender APIs / bank portals', env: [], built: false, manual: 'Submit through each bank desk; record references and decisions in the OS.', note: 'Each bank needs its own agreement. Not built.' },
];
export const connectorState = (c: Connector) => (c.built && c.env.every((e) => !!process.env[e]) ? 'READY' : c.built && c.env.length === 0 ? 'MANUAL (built)' : c.built ? 'BUILT, NOT CONFIGURED' : 'NOT BUILT');
