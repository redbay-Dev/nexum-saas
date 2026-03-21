import type { MaterialPricingBehaviour } from "@nexum/shared";

interface MaterialContext {
  materialSourceType: string;
  materialName: string;
  quantity: number;
  unitOfMeasure: string;
  /** Supplier purchase price (from supplier_materials) */
  purchasePrice?: number;
  /** Customer sale price (from customer_materials) */
  salePrice?: number;
  /** Disposal tip fee */
  tipFee?: number;
  /** Disposal environmental levy */
  environmentalLevy?: number;
  /** Destination has buyback pricing */
  destinationSalePrice?: number;
  /** Has subcontractor rate */
  hasSubcontractorRate?: boolean;
  /** Subcontractor rate amount */
  subcontractorRate?: number;
}

interface GeneratedPricingLine {
  lineType: "revenue" | "cost";
  category: string;
  description: string;
  rateType: string;
  quantity: number;
  unitRate: number;
  total: number;
  source: string;
}

/**
 * Infer pricing behaviour from material context per doc 09:
 * 1. Destination company + destination price → buyback
 * 2. Supplier with purchase price → material_cost
 * 3. Supplier without purchase price → material_cost (needs manual price)
 * 4. No supplier, no destination pricing → transport_revenue
 */
export function inferPricingBehaviour(material: MaterialContext): MaterialPricingBehaviour {
  if (material.destinationSalePrice && material.destinationSalePrice > 0) {
    return "buyback";
  }

  if (material.materialSourceType === "supplier") {
    if (material.salePrice && material.purchasePrice) {
      return "material_resale";
    }
    return "material_cost";
  }

  if (material.materialSourceType === "disposal") {
    return "transport_revenue";
  }

  return "transport_revenue";
}

/**
 * Generate pricing lines based on the inferred behaviour.
 */
export function generatePricingLinesFromBehaviour(
  material: MaterialContext,
  behaviour: MaterialPricingBehaviour,
  _customerId?: string,
  _customerName?: string,
): GeneratedPricingLine[] {
  const lines: GeneratedPricingLine[] = [];
  const rateType = mapUnitToRateType(material.unitOfMeasure);

  switch (behaviour) {
    case "transport_revenue": {
      lines.push({
        lineType: "revenue",
        category: "cartage",
        description: `Cartage — ${material.materialName}`,
        rateType,
        quantity: material.quantity,
        unitRate: 0, // Manual entry required
        total: 0,
        source: "material",
      });
      break;
    }

    case "material_cost": {
      // Cost line: purchase from supplier
      lines.push({
        lineType: "cost",
        category: "material",
        description: `Purchase — ${material.materialName}`,
        rateType,
        quantity: material.quantity,
        unitRate: material.purchasePrice ?? 0,
        total: Math.round((material.purchasePrice ?? 0) * material.quantity * 100) / 100,
        source: "material",
      });
      // Revenue line: delivery charge
      lines.push({
        lineType: "revenue",
        category: "cartage",
        description: `Delivery — ${material.materialName}`,
        rateType,
        quantity: material.quantity,
        unitRate: 0, // Manual or rate card
        total: 0,
        source: "material",
      });
      break;
    }

    case "material_resale": {
      // Cost line: purchase price
      lines.push({
        lineType: "cost",
        category: "material",
        description: `Purchase — ${material.materialName}`,
        rateType,
        quantity: material.quantity,
        unitRate: material.purchasePrice ?? 0,
        total: Math.round((material.purchasePrice ?? 0) * material.quantity * 100) / 100,
        source: "material",
      });
      // Revenue line: sale price
      lines.push({
        lineType: "revenue",
        category: "material",
        description: `Supply — ${material.materialName}`,
        rateType,
        quantity: material.quantity,
        unitRate: material.salePrice ?? 0,
        total: Math.round((material.salePrice ?? 0) * material.quantity * 100) / 100,
        source: "material",
      });
      break;
    }

    case "buyback": {
      lines.push({
        lineType: "revenue",
        category: "material",
        description: `Buyback — ${material.materialName}`,
        rateType,
        quantity: material.quantity,
        unitRate: material.destinationSalePrice ?? 0,
        total: Math.round((material.destinationSalePrice ?? 0) * material.quantity * 100) / 100,
        source: "material",
      });
      break;
    }

    case "tracking_only": {
      // No pricing lines generated
      break;
    }
  }

  // Subcontractor rate auto-generation
  if (material.hasSubcontractorRate && material.subcontractorRate && material.subcontractorRate > 0) {
    lines.push({
      lineType: "cost",
      category: "subcontractor",
      description: `Subcontractor — ${material.materialName}`,
      rateType,
      quantity: material.quantity,
      unitRate: material.subcontractorRate,
      total: Math.round(material.subcontractorRate * material.quantity * 100) / 100,
      source: "subcontractor",
    });
  }

  return lines;
}

/**
 * Generate tip fee pricing lines when a job location is a disposal site.
 */
export function generateTipFeeLines(
  tipFee: number,
  environmentalLevy: number,
  minimumCharge: number,
  quantity: number,
  locationName: string,
): GeneratedPricingLine[] {
  const lines: GeneratedPricingLine[] = [];

  if (tipFee > 0) {
    const tipTotal = Math.max(tipFee * quantity, minimumCharge);
    lines.push({
      lineType: "cost",
      category: "tip_fee",
      description: `Tip fee — ${locationName}`,
      rateType: "per_tonne",
      quantity,
      unitRate: tipFee,
      total: Math.round(tipTotal * 100) / 100,
      source: "tip_fee",
    });
  }

  if (environmentalLevy > 0) {
    lines.push({
      lineType: "cost",
      category: "tip_fee",
      description: `Environmental levy — ${locationName}`,
      rateType: "per_tonne",
      quantity,
      unitRate: environmentalLevy,
      total: Math.round(environmentalLevy * quantity * 100) / 100,
      source: "tip_fee",
    });
  }

  return lines;
}

function mapUnitToRateType(unitOfMeasure: string): string {
  switch (unitOfMeasure) {
    case "tonne": return "per_tonne";
    case "cubic_metre": return "per_cubic_metre";
    case "load": return "per_load";
    case "hour": return "per_hour";
    case "kilometre": return "per_km";
    default: return "flat";
  }
}
