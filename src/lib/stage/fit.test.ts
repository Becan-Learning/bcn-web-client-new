import { describe, expect, it } from "vitest";
import { MIN_FIT, planFit, proseScale } from "./fit";

describe("auto-fit plan", () => {
  it("leaves content that fits alone", () => {
    expect(planFit(300, 400)).toEqual({ scale: 1, wrap: false });
    expect(planFit(400, 400)).toEqual({ scale: 1, wrap: false });
    expect(planFit(0, 400)).toEqual({ scale: 1, wrap: false }); // not measured yet
    expect(planFit(500, 0)).toEqual({ scale: 1, wrap: false });
  });

  it("shrinks by just enough, rounding down so it fits", () => {
    const plan = planFit(500, 400);
    expect(plan).toEqual({ scale: 0.8, wrap: false });
    expect(500 * plan.scale).toBeLessThanOrEqual(400);
  });

  it("stops shrinking at the minimum and wraps instead", () => {
    expect(planFit(1000, 400)).toEqual({ scale: MIN_FIT, wrap: true });
    expect(planFit(400 / MIN_FIT + 1, 400).wrap).toBe(true);
    expect(planFit(400 / MIN_FIT - 1, 400).wrap).toBe(false);
  });

  it("sets long prose a little smaller, never below the minimum", () => {
    expect(proseScale(40)).toBe(1);
    expect(proseScale(160)).toBe(1);
    expect(proseScale(320)).toBeLessThan(1);
    expect(proseScale(320)).toBeGreaterThan(MIN_FIT);
    expect(proseScale(600)).toBe(MIN_FIT);
  });
});
