/**
 * S3/DO Spaces client for document storage.
 * Uses the AWS SDK S3 client configured for DigitalOcean Spaces.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function getConfig(): S3Config {
  return {
    endpoint: process.env["SPACES_ENDPOINT"] ?? "https://syd1.digitaloceanspaces.com",
    region: process.env["SPACES_REGION"] ?? "syd1",
    accessKeyId: process.env["SPACES_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["SPACES_SECRET_ACCESS_KEY"] ?? "",
    bucket: process.env["SPACES_BUCKET"] ?? "nexum-documents",
  };
}

let clientInstance: S3Client | null = null;

function getClient(): S3Client {
  if (!clientInstance) {
    const config = getConfig();
    clientInstance = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: false,
    });
  }
  return clientInstance;
}

function getBucket(): string {
  return getConfig().bucket;
}

/**
 * Generate a presigned upload URL for direct browser upload.
 */
export async function generateUploadUrl(
  s3Key: string,
  mimeType: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    ContentType: mimeType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a presigned download URL.
 */
export async function generateDownloadUrl(
  s3Key: string,
  fileName: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a presigned view URL (inline display).
 */
export async function generateViewUrl(
  s3Key: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    ResponseContentDisposition: "inline",
  });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/**
 * Upload a file directly (for server-side uploads like PDF generation).
 */
export async function uploadFile(
  s3Key: string,
  body: Buffer | Uint8Array | string,
  mimeType: string,
  metadata?: Record<string, string>,
): Promise<void> {
  const params: PutObjectCommandInput = {
    Bucket: getBucket(),
    Key: s3Key,
    Body: body,
    ContentType: mimeType,
    ACL: "private",
  };
  if (metadata) {
    params.Metadata = metadata;
  }
  await getClient().send(new PutObjectCommand(params));
}

/**
 * Delete a file from S3.
 */
export async function deleteFile(s3Key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: s3Key,
    }),
  );
}

/**
 * Copy a file within S3 (used for versioning/rename).
 */
export async function copyFile(
  sourceKey: string,
  destinationKey: string,
): Promise<void> {
  await getClient().send(
    new CopyObjectCommand({
      Bucket: getBucket(),
      CopySource: `${getBucket()}/${sourceKey}`,
      Key: destinationKey,
    }),
  );
}

/**
 * Check if a file exists in S3.
 */
export async function fileExists(s3Key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: s3Key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Build S3 key path following human-readable bucket structure.
 * Example: tenant-slug/Jobs/JOB-2024-0153/Dockets/weighbridge_001.pdf
 */
export function buildS3Key(
  tenantSlug: string,
  entityFolder: string,
  entityName: string,
  subFolder: string,
  fileName: string,
): string {
  const slug = (s: string): string =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug(tenantSlug)}/${entityFolder}/${slug(entityName)}/${subFolder}/${fileName}`;
}

/**
 * Build standardised file name.
 * Example: Smith-Transport_Public-Liability_2026-03-19_001.pdf
 */
export function buildStandardFileName(
  entityName: string,
  documentType: string,
  date: string,
  sequence: number,
  extension: string,
): string {
  const slugPart = (s: string): string =>
    s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const seqStr = String(sequence).padStart(3, "0");
  return `${slugPart(entityName)}_${slugPart(documentType)}_${date}_${seqStr}.${extension}`;
}

/**
 * Extract file extension from filename.
 */
export function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Generate a secure random token for public links.
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
