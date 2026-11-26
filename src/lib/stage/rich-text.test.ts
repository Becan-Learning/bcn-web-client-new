import { describe, expect, it } from "vitest";
import { inlineRuns, westernDigits } from "./rich-text";

describe("rich text runs", () => {
  it("isolates Latin runs, numbers and inline math inside Arabic", () => {
    expect(inlineRuns("أوجد قيم x التي تحقق x² − 4 = 0")).toEqual([
      { type: "text", text: "أوجد قيم " },
      { type: "ltr", text: "x" },
      { type: "text", text: " التي تحقق " },
      { type: "ltr", text: "x² − 4 = 0" },
    ]);
    expect(inlineRuns("المساحة $\\frac{1}{2}bh$ دائما")).toEqual([
      { type: "text", text: "المساحة " },
      { type: "math", tex: "\\frac{1}{2}bh" },
      { type: "text", text: " دائما" },
    ]);
  });

  it("turns Arabic-Indic and Persian digits into Western ones before splitting", () => {
    expect(westernDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789 0123456789");
    expect(inlineRuns("العدد ٣٤")).toEqual([
      { type: "text", text: "العدد " },
      { type: "ltr", text: "34" },
    ]);
  });

  it("shows a dollar sign that is not math as it is", () => {
    expect(inlineRuns("سعر \\$5 فقط")).toEqual([
      { type: "text", text: "سعر $" },
      { type: "ltr", text: "5" },
      { type: "text", text: " فقط" },
    ]);
  });
});
