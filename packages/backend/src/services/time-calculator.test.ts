import { describe, it, expect } from "vitest";
import {
  parseTimeToHours,
  calculateTimeWorked,
  aggregateTimeSessions,
} from "./time-calculator.js";

describe("time-calculator", () => {
  describe("parseTimeToHours", () => {
    it("should parse HH:MM to decimal hours", () => {
      expect(parseTimeToHours("06:00")).toBe(6);
      expect(parseTimeToHours("06:30")).toBe(6.5);
      expect(parseTimeToHours("14:15")).toBe(14.25);
      expect(parseTimeToHours("00:00")).toBe(0);
      expect(parseTimeToHours("23:59")).toBeCloseTo(23.9833, 3);
    });

    it("should handle invalid input", () => {
      expect(parseTimeToHours("")).toBe(0);
      expect(parseTimeToHours("abc")).toBe(0);
    });
  });

  describe("calculateTimeWorked", () => {
    it("should calculate basic hours worked", () => {
      const result = calculateTimeWorked({
        startTime: "06:00",
        endTime: "14:00",
      });
      expect(result.hoursWorked).toBe(8);
      expect(result.totalBillableHours).toBe(8);
      expect(result.overtimeHours).toBe(0);
      expect(result.breakHours).toBe(0);
    });

    it("should deduct break time", () => {
      const result = calculateTimeWorked({
        startTime: "06:00",
        endTime: "14:30",
        breakMinutes: 30,
      });
      expect(result.hoursWorked).toBe(8);
      expect(result.breakHours).toBe(0.5);
    });

    it("should calculate overtime when threshold exceeded", () => {
      const result = calculateTimeWorked({
        startTime: "06:00",
        endTime: "16:00",
        overtimeThresholdHours: 8,
      });
      expect(result.hoursWorked).toBe(10);
      expect(result.standardHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
      expect(result.totalBillableHours).toBe(10);
    });

    it("should handle overnight shifts", () => {
      const result = calculateTimeWorked({
        startTime: "22:00",
        endTime: "06:00",
      });
      expect(result.hoursWorked).toBe(8);
    });

    it("should handle break deduction with overtime", () => {
      const result = calculateTimeWorked({
        startTime: "06:00",
        endTime: "17:00",
        breakMinutes: 60,
        overtimeThresholdHours: 8,
      });
      expect(result.hoursWorked).toBe(10);
      expect(result.breakHours).toBe(1);
      expect(result.standardHours).toBe(8);
      expect(result.overtimeHours).toBe(2);
    });

    it("should return zero for same start and end", () => {
      const result = calculateTimeWorked({
        startTime: "06:00",
        endTime: "06:00",
      });
      expect(result.hoursWorked).toBe(0);
    });

    it("should not produce negative hours with excessive breaks", () => {
      const result = calculateTimeWorked({
        startTime: "06:00",
        endTime: "07:00",
        breakMinutes: 120,
      });
      expect(result.hoursWorked).toBe(0);
    });
  });

  describe("aggregateTimeSessions", () => {
    it("should aggregate multiple time sessions", () => {
      const result = aggregateTimeSessions([
        { hoursWorked: 4, overtimeHours: 0, breakHours: 0.5, totalBillableHours: 4, standardHours: 4 },
        { hoursWorked: 5, overtimeHours: 1, breakHours: 0.5, totalBillableHours: 5, standardHours: 4 },
      ]);
      expect(result.totalHoursWorked).toBe(9);
      expect(result.totalOvertimeHours).toBe(1);
      expect(result.totalBreakHours).toBe(1);
      expect(result.totalBillableHours).toBe(9);
    });

    it("should handle empty sessions", () => {
      const result = aggregateTimeSessions([]);
      expect(result.totalHoursWorked).toBe(0);
      expect(result.totalOvertimeHours).toBe(0);
    });
  });
});
