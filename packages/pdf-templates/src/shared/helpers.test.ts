import { describe, it, expect, beforeAll } from "vitest";
import Handlebars from "handlebars";
import { registerHelpers } from "./helpers.js";

beforeAll(() => {
  registerHelpers();
});

describe("Handlebars helpers", () => {
  it("formatDate should format as DD/MM/YYYY", () => {
    const template = Handlebars.compile("{{formatDate date}}");
    const result = template({ date: "2026-03-19T00:00:00Z" });
    expect(result).toBe("19/03/2026");
  });

  it("formatCurrency should format as $X,XXX.XX", () => {
    const template = Handlebars.compile("{{formatCurrency amount}}");
    const result = template({ amount: 1234.5 });
    expect(result).toBe("$1,234.50");
  });

  it("yesNo should return Yes or No", () => {
    const template = Handlebars.compile("{{yesNo value}}");
    expect(template({ value: true })).toBe("Yes");
    expect(template({ value: false })).toBe("No");
  });

  it("formatAbn should format as XX XXX XXX XXX", () => {
    const template = Handlebars.compile("{{formatAbn abn}}");
    expect(template({ abn: "51824753556" })).toBe("51 824 753 556");
  });
});
