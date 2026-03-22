/**
 * Email delivery service using queue-based sending.
 * Supports staggered delivery, retry logic, and delivery tracking.
 * In production, integrates with SMTP2GO/SendGrid/Postmark via SMTP.
 */

import type { EmailStatus } from "@nexum/shared";

interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: EmailAttachment[];
}

interface EmailAttachment {
  fileName: string;
  mimeType: string;
  content?: string; // base64
  documentId?: string;
}

interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via the configured transactional email provider.
 * In development, emails are routed to MailHog (port 1025).
 */
export async function sendEmail(message: EmailMessage): Promise<DeliveryResult> {
  const smtpHost = process.env["SMTP_HOST"] ?? "localhost";
  const smtpPort = parseInt(process.env["SMTP_PORT"] ?? "1025", 10);
  const smtpUser = process.env["SMTP_USER"] ?? "";
  const smtpPass = process.env["SMTP_PASS"] ?? "";
  const fromEmail = process.env["EMAIL_FROM"] ?? "noreply@nexum.app";
  const fromName = process.env["EMAIL_FROM_NAME"] ?? "Nexum";

  try {
    // Use dynamic import so nodemailer is optional in builds
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    const mailOptions: Record<string, unknown> = {
      from: `"${fromName}" <${fromEmail}>`,
      to: message.to.join(", "),
      subject: message.subject,
      html: message.htmlBody,
      text: message.textBody,
    };

    if (message.cc?.length) {
      mailOptions["cc"] = message.cc.join(", ");
    }
    if (message.bcc?.length) {
      mailOptions["bcc"] = message.bcc.join(", ");
    }
    if (message.attachments?.length) {
      mailOptions["attachments"] = message.attachments
        .filter((a) => a.content)
        .map((a) => ({
          filename: a.fileName,
          content: a.content,
          encoding: "base64",
          contentType: a.mimeType,
        }));
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId as string };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown email error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Calculate next retry delay with exponential backoff.
 */
export function calculateRetryDelay(retryCount: number): number {
  // Base: 30s, exponential: 30s, 60s, 120s, 240s, ...
  return Math.min(30000 * Math.pow(2, retryCount), 600000);
}

/**
 * Determine the next status after a send attempt.
 */
export function determineEmailStatus(
  success: boolean,
  retryCount: number,
  maxRetries: number,
): EmailStatus {
  if (success) return "sent";
  if (retryCount >= maxRetries) return "failed";
  return "queued";
}

/**
 * Apply template variables to a template string.
 * Variables use {variable_name} syntax.
 */
export function applyTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key: string) => variables[key] ?? match,
  );
}

/**
 * Generate plain text from HTML (basic strip tags).
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
