import { describe, it, expect } from "vitest";
import {
  inferPricingBehaviour,
  generatePricingLinesFromBehaviour,
  generateTipFeeLines,
} from "./pricing-behaviour.js";

describe("inferPricingBehaviour", () => {
  it("should infer buyback when destination has sale price", () => {
    expect(inferPricingBehaviour({
      materialSourceType: "tenant",
      materialName: "Recycled Concrete",
      quantity: 100,
      unitOfMeasure: "tonne",
      destinationSalePrice: 5,
    })).toBe("buyback");
  });

  it("should infer material_resale when supplier has purchase and customer has sale price", () => {
    expect(inferPricingBehaviour({
      materialSourceType: "supplier",
      materialName: "Topsoil",
      quantity: 50,
      unitOfMeasure: "tonne",
      purchasePrice: 30,
      salePrice: 45,
    })).toBe("material_resale");
  });

  it("should infer material_cost when supplier has purchase price only", () => {
    expect(inferPricingBehaviour({
      materialSourceType: "supplier",
      materialName: "Sand",
      quantity: 200,
      unitOfMeasure: "tonne",
      purchasePrice: 25,
    })).toBe("material_cost");
  });

  it("should infer material_cost when supplier has no prices", () => {
    expect(inferPricingBehaviour({
      materialSourceType: "supplier",
      materialName: "Gravel",
      quantity: 100,
      unitOfMeasure: "tonne",
    })).toBe("material_cost");
  });

  it("should infer transport_revenue as default", () => {
    expect(inferPricingBehaviour({
      materialSourceType: "tenant",
      materialName: "Clean Fill",
      quantity: 300,
      unitOfMeasure: "tonne",
    })).toBe("transport_revenue");
  });

  it("should infer transport_revenue for disposal source", () => {
    expect(inferPricingBehaviour({
      materialSourceType: "disposal",
      materialName: "Mixed Waste",
      quantity: 50,
      unitOfMeasure: "tonne",
    })).toBe("transport_revenue");
  });
});

describe("generatePricingLinesFromBehaviour", () => {
  it("should generate one revenue line for transport_revenue", () => {
    const lines = generatePricingLinesFromBehaviour(
      {
        materialSourceType: "tenant",
        materialName: "Clean Fill",
        quantity: 100,
        unitOfMeasure: "tonne",
      },
      "transport_revenue",
    );

    expect(lines.length).toBe(1);
    expect(lines[0]?.lineType).toBe("revenue");
    expect(lines[0]?.category).toBe("cartage");
    expect(lines[0]?.rateType).toBe("per_tonne");
  });

  it("should generate cost + revenue for material_cost", () => {
    const lines = generatePricingLinesFromBehaviour(
      {
        materialSourceType: "supplier",
        materialName: "Sand",
        quantity: 50,
        unitOfMeasure: "tonne",
        purchasePrice: 25,
      },
      "material_cost",
    );

    expect(lines.length).toBe(2);
    expect(lines[0]?.lineType).toBe("cost");
    expect(lines[0]?.category).toBe("material");
    expect(lines[0]?.unitRate).toBe(25);
    expect(lines[0]?.total).toBe(1250);
    expect(lines[1]?.lineType).toBe("revenue");
    expect(lines[1]?.category).toBe("cartage");
  });

  it("should generate cost + revenue for material_resale", () => {
    const lines = generatePricingLinesFromBehaviour(
      {
        materialSourceType: "supplier",
        materialName: "Topsoil",
        quantity: 100,
        unitOfMeasure: "cubic_metre",
        purchasePrice: 30,
        salePrice: 45,
      },
      "material_resale",
    );

    expect(lines.length).toBe(2);
    expect(lines[0]?.lineType).toBe("cost");
    expect(lines[0]?.total).toBe(3000);
    expect(lines[1]?.lineType).toBe("revenue");
    expect(lines[1]?.total).toBe(4500);
    expect(lines[1]?.rateType).toBe("per_cubic_metre");
  });

  it("should generate revenue line for buyback", () => {
    const lines = generatePricingLinesFromBehaviour(
      {
        materialSourceType: "tenant",
        materialName: "Recycled Concrete",
        quantity: 200,
        unitOfMeasure: "tonne",
        destinationSalePrice: 5,
      },
      "buyback",
    );

    expect(lines.length).toBe(1);
    expect(lines[0]?.lineType).toBe("revenue");
    expect(lines[0]?.total).toBe(1000);
  });

  it("should generate no lines for tracking_only", () => {
    const lines = generatePricingLinesFromBehaviour(
      {
        materialSourceType: "tenant",
        materialName: "Included Material",
        quantity: 50,
        unitOfMeasure: "tonne",
      },
      "tracking_only",
    );

    expect(lines.length).toBe(0);
  });

  it("should add subcontractor cost line when has_subcontractor_rate", () => {
    const lines = generatePricingLinesFromBehaviour(
      {
        materialSourceType: "tenant",
        materialName: "Clean Fill",
        quantity: 100,
        unitOfMeasure: "tonne",
        hasSubcontractorRate: true,
        subcontractorRate: 12,
      },
      "transport_revenue",
    );

    expect(lines.length).toBe(2);
    expect(lines[1]?.lineType).toBe("cost");
    expect(lines[1]?.category).toBe("subcontractor");
    expect(lines[1]?.unitRate).toBe(12);
    expect(lines[1]?.total).toBe(1200);
  });
});

describe("generateTipFeeLines", () => {
  it("should generate tip fee and environmental levy lines", () => {
    const lines = generateTipFeeLines(15, 3, 50, 100, "Smith Quarry Tip");

    expect(lines.length).toBe(2);
    expect(lines[0]?.category).toBe("tip_fee");
    expect(lines[0]?.unitRate).toBe(15);
    expect(lines[0]?.total).toBe(1500);
    expect(lines[1]?.description).toContain("Environmental levy");
    expect(lines[1]?.total).toBe(300);
  });

  it("should enforce minimum charge on tip fee", () => {
    const lines = generateTipFeeLines(15, 0, 200, 5, "Small Tip");

    expect(lines.length).toBe(1);
    // 15 * 5 = 75, but minimum is 200
    expect(lines[0]?.total).toBe(200);
  });

  it("should generate nothing when tip fee is zero", () => {
    const lines = generateTipFeeLines(0, 0, 0, 100, "No Fee");
    expect(lines.length).toBe(0);
  });

  it("should generate only levy when tip fee is zero but levy exists", () => {
    const lines = generateTipFeeLines(0, 5, 0, 100, "Levy Only");
    expect(lines.length).toBe(1);
    expect(lines[0]?.description).toContain("Environmental levy");
  });
});
