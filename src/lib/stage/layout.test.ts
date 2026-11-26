import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGE_LAYOUT } from "./layout";

/* Resolves the Tailwind direction/flex classes a slot carries at a viewport width, using the
   breakpoints from globals.css (md is Tailwind's 48rem default, xl is the project's 70rem). */
const css = readFileSync(new URL("../../styles/globals.css", import.meta.url), "utf8");
const xl = /--breakpoint-xl:\s*([\d.]+)rem/.exec(css)?.[1];
const BREAKPOINTS_REM: Record<string, number> = { md: 48, xl: Number(xl) };

function applied(classes: string, widthPx: number, pattern: RegExp): string | undefined {
  let winner: { min: number; cls: string } | undefined;
  for (const cls of classes.split(/\s+/)) {
    const [prefix, base] = cls.includes(":") ? cls.split(":") : [undefined, cls];
    if (!base || !pattern.test(base)) continue;
    const min = prefix === undefined ? 0 : (BREAKPOINTS_REM[prefix] ?? Infinity) * 16;
    if (widthPx >= min && (!winner || min >= winner.min)) winner = { min, cls: base };
  }
  return winner?.cls;
}

const direction = (classes: string, width: number) => applied(classes, width, /^flex-(row|col)$/);
const grow = (classes: string, width: number) => applied(classes, width, /^flex-(1|\[\d+\])$/);

describe("Stage region layout", () => {
  it("takes its 1120 breakpoint from the design tokens, in rem", () => {
    expect(xl).toBe("70");
    expect(Number(xl) * 16).toBe(1120);
  });

  it("stacks the regions at 390 px, with the figure first in source order", () => {
    expect(direction(STAGE_LAYOUT.root, 390)).toBe("flex-col");
    expect(direction(STAGE_LAYOUT.text, 390)).toBe("flex-col");
    expect(grow(STAGE_LAYOUT.figure, 390)).toBeUndefined();
  });

  it("puts the figure beside the text column at 768 px, with board above notes", () => {
    expect(direction(STAGE_LAYOUT.root, 768)).toBe("flex-row");
    expect(grow(STAGE_LAYOUT.figure, 768)).toBe("flex-1");
    expect(grow(STAGE_LAYOUT.text, 768)).toBe("flex-1");
    expect(direction(STAGE_LAYOUT.text, 768)).toBe("flex-col");
  });

  it("sits the three regions side by side at 1120 px", () => {
    expect(direction(STAGE_LAYOUT.root, 1120)).toBe("flex-row");
    expect(direction(STAGE_LAYOUT.text, 1120)).toBe("flex-row");
    expect(grow(STAGE_LAYOUT.board, 1120)).toBe("flex-1");
    expect(grow(STAGE_LAYOUT.notes, 1120)).toBe("flex-1");
    expect(grow(STAGE_LAYOUT.figure, 1120)).toBe("flex-1");
    expect(grow(STAGE_LAYOUT.text, 1120)).toBe("flex-[2]"); // figure, board and notes take a third each
  });

  it("stays stacked just below 768 and below 1120 keeps board above notes", () => {
    expect(direction(STAGE_LAYOUT.root, 767)).toBe("flex-col");
    expect(direction(STAGE_LAYOUT.text, 1119)).toBe("flex-col");
  });

  it("uses logical direction only and never writes a physical side or a direction", () => {
    const all = Object.values(STAGE_LAYOUT).join(" ");
    expect(all).not.toMatch(/\b(ml|mr|pl|pr)-|\b(left|right)-|text-(left|right)|\bdir=/);
  });
});
