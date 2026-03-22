/**
 * Xero API client — handles OAuth2 PKCE flow, token management,
 * and API calls to Xero for contacts, invoices, bills, and payments.
 *
 * All tokens are stored encrypted (AES-256-GCM) per tenant.
 * Token refresh happens automatically before expiry.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac } from "node:crypto";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

function getXeroConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  return {
    clientId: process.env["XERO_CLIENT_ID"] ?? "",
    clientSecret: process.env["XERO_CLIENT_SECRET"] ?? "",
    redirectUri: process.env["XERO_REDIRECT_URI"] ?? "http://localhost:5173/settings/xero/callback",
  };
}

function getEncryptionKey(): Buffer {
  const key = process.env["ENCRYPTION_KEY"] ?? "0".repeat(64);
  return Buffer.from(key, "hex");
}

// ── Token Encryption ──

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted token format");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  if (authTag.length !== 16) {
    throw new Error("Invalid authentication tag length — expected 16 bytes");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv, {
    authTagLength: 16,
  });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── OAuth2 PKCE Flow ──

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  // S256 challenge
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { codeVerifier: verifier, codeChallenge: challenge };
}

export function buildAuthUrl(codeChallenge: string, state: string): string {
  const config = getXeroConfig();
  const scopes = [
    "openid",
    "profile",
    "email",
    "accounting.transactions",
    "accounting.contacts",
    "accounting.settings",
    "offline_access",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${XERO_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = getXeroConfig();

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const config = getXeroConfig();

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  return response.json() as Promise<TokenResponse>;
}

// ── Xero API Calls ──

interface XeroApiOptions {
  accessToken: string;
  xeroTenantId: string;
}

async function xeroRequest<T>(
  endpoint: string,
  options: XeroApiOptions,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.accessToken}`,
    "Xero-Tenant-Id": options.xeroTenantId,
    Accept: "application/json",
  };

  const fetchOptions: RequestInit = { method, headers };

  if (body) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${XERO_API_BASE}${endpoint}`, fetchOptions);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Xero API error (${response.status}): ${error}`);
  }

  return response.json() as Promise<T>;
}

// ── Contact Sync ──

interface XeroContact {
  ContactID: string;
  Name: string;
  TaxNumber?: string;
  EmailAddress?: string;
  IsCustomer: boolean;
  IsSupplier: boolean;
  Phones?: Array<{ PhoneType: string; PhoneNumber: string }>;
}

export async function createXeroContact(
  options: XeroApiOptions,
  contact: {
    name: string;
    abn?: string;
    email?: string;
    phone?: string;
    isCustomer: boolean;
    isSupplier: boolean;
  },
): Promise<XeroContact> {
  const payload = {
    Name: contact.name,
    TaxNumber: contact.abn,
    EmailAddress: contact.email,
    IsCustomer: contact.isCustomer,
    IsSupplier: contact.isSupplier,
    Phones: contact.phone
      ? [{ PhoneType: "DEFAULT", PhoneNumber: contact.phone }]
      : undefined,
  };

  const result = await xeroRequest<{ Contacts: XeroContact[] }>(
    "/Contacts",
    options,
    "POST",
    { Contacts: [payload] },
  );
  return result.Contacts[0]!;
}

export async function getXeroContacts(
  options: XeroApiOptions,
): Promise<XeroContact[]> {
  const result = await xeroRequest<{ Contacts: XeroContact[] }>(
    "/Contacts",
    options,
  );
  return result.Contacts;
}

// ── Invoice Sync ──

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Status: string;
  AmountDue: number;
  AmountPaid: number;
  Total: number;
}

export async function createXeroInvoice(
  options: XeroApiOptions,
  invoice: {
    contactId: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType?: string;
    }>;
    reference?: string;
  },
): Promise<XeroInvoice> {
  const payload = {
    Type: "ACCREC",
    Contact: { ContactID: invoice.contactId },
    InvoiceNumber: invoice.invoiceNumber,
    Date: invoice.issueDate,
    DueDate: invoice.dueDate,
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
    Reference: invoice.reference,
    LineItems: invoice.lineItems.map((li) => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitAmount,
      AccountCode: li.accountCode,
      TaxType: li.taxType ?? "OUTPUT",
    })),
  };

  const result = await xeroRequest<{ Invoices: XeroInvoice[] }>(
    "/Invoices",
    options,
    "POST",
    { Invoices: [payload] },
  );
  return result.Invoices[0]!;
}

// ── Bill Sync (RCTI → ACCPAY) ──

export async function createXeroBill(
  options: XeroApiOptions,
  bill: {
    contactId: string;
    reference: string;
    issueDate: string;
    dueDate: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
      accountCode: string;
      taxType?: string;
    }>;
  },
): Promise<XeroInvoice> {
  const payload = {
    Type: "ACCPAY",
    Contact: { ContactID: bill.contactId },
    Reference: bill.reference,
    Date: bill.issueDate,
    DueDate: bill.dueDate,
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
    LineItems: bill.lineItems.map((li) => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitAmount,
      AccountCode: li.accountCode,
      TaxType: li.taxType ?? "INPUT",
    })),
  };

  const result = await xeroRequest<{ Invoices: XeroInvoice[] }>(
    "/Invoices",
    options,
    "POST",
    { Invoices: [payload] },
  );
  return result.Invoices[0]!;
}

// ── Chart of Accounts ──

interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  TaxType: string;
  Status: string;
}

export async function getChartOfAccounts(
  options: XeroApiOptions,
): Promise<XeroAccount[]> {
  const result = await xeroRequest<{ Accounts: XeroAccount[] }>(
    "/Accounts",
    options,
  );
  return result.Accounts;
}

// ── Tax Rates ──

interface XeroTaxRate {
  Name: string;
  TaxType: string;
  EffectiveRate: number;
  Status: string;
}

export async function getTaxRates(
  options: XeroApiOptions,
): Promise<XeroTaxRate[]> {
  const result = await xeroRequest<{ TaxRates: XeroTaxRate[] }>(
    "/TaxRates",
    options,
  );
  return result.TaxRates;
}

// ── Tracking Categories ──

interface XeroTrackingCategory {
  TrackingCategoryID: string;
  Name: string;
  Status: string;
  Options: Array<{ TrackingOptionID: string; Name: string; Status: string }>;
}

export async function getTrackingCategories(
  options: XeroApiOptions,
): Promise<XeroTrackingCategory[]> {
  const result = await xeroRequest<{ TrackingCategories: XeroTrackingCategory[] }>(
    "/TrackingCategories",
    options,
  );
  return result.TrackingCategories;
}

// ── Payment Polling ──

export async function getInvoicePayments(
  options: XeroApiOptions,
  xeroInvoiceId: string,
): Promise<{ AmountPaid: number; Status: string }> {
  const result = await xeroRequest<{ Invoices: Array<{ AmountPaid: number; Status: string }> }>(
    `/Invoices/${xeroInvoiceId}`,
    options,
  );
  return result.Invoices[0]!;
}

// ── Webhook Validation ──

export function validateWebhookSignature(
  payload: string,
  signature: string,
  webhookKey: string,
): boolean {
  const hmac = createHmac("sha256", webhookKey);
  hmac.update(payload);
  const computed = hmac.digest("base64");
  return computed === signature;
}
