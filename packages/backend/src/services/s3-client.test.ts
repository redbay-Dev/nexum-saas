import { describe, it, expect } from "vitest";
import {
  buildS3Key,
  buildStandardFileName,
  getFileExtension,
  generateSecureToken,
} from "./s3-client.js";

describe("buildS3Key", () => {
  it("should build a key with slugified segments", () => {
    const result = buildS3Key("Acme Transport", "Jobs", "JOB-2024-0153", "Dockets", "weighbridge_001.pdf");
    expect(result).toBe("acme-transport/Jobs/job-2024-0153/Dockets/weighbridge_001.pdf");
  });

  it("should handle special characters in tenant slug", () => {
    const result = buildS3Key("Smith & Sons Pty Ltd", "Jobs", "JOB-001", "Photos", "site.jpg");
    expect(result).toBe("smith-sons-pty-ltd/Jobs/job-001/Photos/site.jpg");
  });

  it("should strip leading/trailing hyphens from slugs", () => {
    const result = buildS3Key("--Acme--", "Invoices", "--INV-001--", "PDF", "inv.pdf");
    expect(result).toBe("acme/Invoices/inv-001/PDF/inv.pdf");
  });

  it("should preserve the entity folder and sub folder casing", () => {
    const result = buildS3Key("tenant", "Compliance", "cert-123", "Certificates", "file.pdf");
    expect(result).toBe("tenant/Compliance/cert-123/Certificates/file.pdf");
  });
});

describe("buildStandardFileName", () => {
  it("should build a standard file name with all parts", () => {
    const result = buildStandardFileName("Smith Transport", "Public-Liability", "2026-03-19", 1, "pdf");
    expect(result).toBe("Smith-Transport_Public-Liability_2026-03-19_001.pdf");
  });

  it("should sanitise special characters in entity name", () => {
    const result = buildStandardFileName("O'Brien & Co", "Invoice", "2026-01-01", 5, "pdf");
    expect(result).toBe("O-Brien-Co_Invoice_2026-01-01_005.pdf");
  });

  it("should pad sequence to 3 digits", () => {
    const result = buildStandardFileName("Acme", "Report", "2026-06-15", 42, "xlsx");
    expect(result).toBe("Acme_Report_2026-06-15_042.xlsx");
  });

  it("should not pad sequence beyond 3 digits", () => {
    const result = buildStandardFileName("Acme", "Docket", "2026-06-15", 1234, "pdf");
    expect(result).toBe("Acme_Docket_2026-06-15_1234.pdf");
  });
});

describe("getFileExtension", () => {
  it("should return extension for normal files", () => {
    expect(getFileExtension("document.pdf")).toBe("pdf");
  });

  it("should return empty string when no extension", () => {
    expect(getFileExtension("README")).toBe("");
  });

  it("should return last extension for multiple dots", () => {
    expect(getFileExtension("archive.tar.gz")).toBe("gz");
  });

  it("should return lowercase extension", () => {
    expect(getFileExtension("Photo.JPG")).toBe("jpg");
  });
});

describe("generateSecureToken", () => {
  it("should return a 64-character hex string", () => {
    const token = generateSecureToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should produce different tokens on successive calls", () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();
    expect(token1).not.toBe(token2);
  });
});
