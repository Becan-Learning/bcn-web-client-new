import { describe, expect, it } from "vitest";
import { splitStep } from "./derivation";

describe("derivation steps", () => {
  it("splits at the first relation, keeping it with the right-hand side", () => {
    expect(splitStep("x^2 - 4 = 0")).toEqual({ aligned: true, lhs: "x^2 - 4", rhs: "= 0" });
    expect(splitStep("(x - 2)(x + 2) = 0")).toEqual({ aligned: true, lhs: "(x - 2)(x + 2)", rhs: "= 0" });
    expect(splitStep("x = 2 \\quad \\text{or} \\quad x = -2")).toEqual({
      aligned: true,
      lhs: "x",
      rhs: "= 2 \\quad \\text{or} \\quad x = -2",
    });
    expect(splitStep("a \\leq b")).toEqual({ aligned: true, lhs: "a", rhs: "\\leq b" });
    expect(splitStep("a \\Rightarrow b")).toEqual({ aligned: true, lhs: "a", rhs: "\\Rightarrow b" });
  });

  it("starts the right-hand side of a continuation line with an empty left-hand side", () => {
    expect(splitStep("= 5")).toEqual({ aligned: true, lhs: "", rhs: "= 5" });
  });

  it("ignores relations inside braces and \\left...\\right, and escaped commands", () => {
    expect(splitStep("\\frac{a = b}{c} = d")).toEqual({ aligned: true, lhs: "\\frac{a = b}{c}", rhs: "= d" });
    expect(splitStep("\\left( a = b \\right) + 1 = 2")).toEqual({
      aligned: true,
      lhs: "\\left( a = b \\right) + 1",
      rhs: "= 2",
    });
    expect(splitStep("\\text{a} \\& b")).toEqual({ aligned: false, whole: "\\text{a} \\& b" });
  });

  it("lets an explicit & choose the alignment point", () => {
    expect(splitStep("x &\\approx 1.4")).toEqual({ aligned: true, lhs: "x", rhs: "\\approx 1.4" });
  });

  it("keeps a step with no relation as one centered cell", () => {
    expect(splitStep("\\sqrt{x}")).toEqual({ aligned: false, whole: "\\sqrt{x}" });
  });
});
