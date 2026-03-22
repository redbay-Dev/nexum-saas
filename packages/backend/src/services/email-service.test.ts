import { describe, it, expect } from "vitest";
import {
  calculateRetryDelay,
  determineEmailStatus,
  applyTemplate,
  htmlToText,
} from "./email-service.js";

describe("calculateRetryDelay", () => {
  it("should return 30000ms for retry 0", () => {
    expect(calculateRetryDelay(0)).toBe(30000);
  });

  it("should return 60000ms for retry 1", () => {
    expect(calculateRetryDelay(1)).toBe(60000);
  });

  it("should return 120000ms for retry 2", () => {
    expect(calculateRetryDelay(2)).toBe(120000);
  });

  it("should cap at 600000ms", () => {
    expect(calculateRetryDelay(10)).toBe(600000);
    expect(calculateRetryDelay(20)).toBe(600000);
  });
});

describe("determineEmailStatus", () => {
  it("should return sent on success", () => {
    expect(determineEmailStatus(true, 0, 3)).toBe("sent");
  });

  it("should return queued when failed with retries remaining", () => {
    expect(determineEmailStatus(false, 1, 3)).toBe("queued");
  });

  it("should return failed when retries exhausted", () => {
    expect(determineEmailStatus(false, 3, 3)).toBe("failed");
  });

  it("should return failed when retries exceeded", () => {
    expect(determineEmailStatus(false, 5, 3)).toBe("failed");
  });

  it("should return sent regardless of retry count on success", () => {
    expect(determineEmailStatus(true, 5, 3)).toBe("sent");
  });
});

describe("applyTemplate", () => {
  it("should substitute simple variables", () => {
    const result = applyTemplate("Hello {name}", { name: "Ryan" });
    expect(result).toBe("Hello Ryan");
  });

  it("should keep missing variables as-is", () => {
    const result = applyTemplate("Hello {name}, your order {order_id}", { name: "Ryan" });
    expect(result).toBe("Hello Ryan, your order {order_id}");
  });

  it("should handle multiple occurrences of same variable", () => {
    const result = applyTemplate("{name} is {name}", { name: "Nexum" });
    expect(result).toBe("Nexum is Nexum");
  });

  it("should handle template with no variables", () => {
    const result = applyTemplate("No variables here", { name: "Ryan" });
    expect(result).toBe("No variables here");
  });
});

describe("htmlToText", () => {
  it("should strip HTML tags", () => {
    expect(htmlToText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("should convert br tags to newlines", () => {
    expect(htmlToText("Line 1<br>Line 2<br/>Line 3")).toBe("Line 1\nLine 2\nLine 3");
  });

  it("should convert closing p tags to double newlines", () => {
    const result = htmlToText("<p>Para 1</p><p>Para 2</p>");
    expect(result).toContain("Para 1\n\nPara 2");
  });

  it("should decode HTML entities", () => {
    expect(htmlToText("Smith &amp; Sons &lt;Pty&gt; &quot;Ltd&quot;")).toBe('Smith & Sons <Pty> "Ltd"');
  });

  it("should convert nbsp to spaces", () => {
    expect(htmlToText("Hello&nbsp;world")).toBe("Hello world");
  });

  it("should convert li tags to bullet points", () => {
    const result = htmlToText("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(result).toContain("- Item 1");
    expect(result).toContain("- Item 2");
  });
});
