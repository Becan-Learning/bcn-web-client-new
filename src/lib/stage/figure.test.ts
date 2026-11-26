import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFigure, formatTick, niceStep, type ItemView } from "./figure";
import { foldOps } from "./stage";

const dir = new URL("./__fixtures__/", import.meta.url);
const fixtures = readdirSync(dir)
  .filter((f) => /^(figure-\d+|figure-demo)\.ops\.jsonl$/.test(f))
  .sort()
  .map((f) => ({
    name: f,
    ops: readFileSync(new URL(f, dir), "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as unknown),
  }));

const base = { op: "add", region: "figure", layer: "scene", meaning: "m", anchor: { speech: "sp_1", char: 0 } };
const axes = (id = "ax", extra = {}) => ({
  ...base,
  id,
  kind: "axes",
  props: { xRange: [-2, 4], yRange: [-3, 5], ...extra },
});
const dot = (id: string, at: [number, number], extra = {}) => ({
  ...base,
  id,
  kind: "dot",
  props: { axes: "ax", at, ...extra },
});

function figure(ops: unknown[]) {
  const stage = foldOps(ops);
  return buildFigure(stage.elements.filter((e) => e.region === "figure"));
}

describe("figure layout", () => {
  it("maps math coordinates onto the plot area, with y growing upward", () => {
    const [panel] = figure([axes(), dot("a", [-2, 5]), dot("b", [4, -3]), dot("c", [1, 1])]).panels;
    const [a, b, c] = panel!.items as Extract<ItemView, { kind: "dot" }>[];
    const area = panel!.area;
    expect([a!.cx, a!.cy]).toEqual([area.left, area.top]); // min x, max y: top start
    expect([b!.cx, b!.cy]).toEqual([area.left + area.width, area.top + area.height]);
    expect(c!.cx).toBeCloseTo(area.left + area.width / 2, 5); // x = 1 is the middle of -2..4
    expect(c!.cy).toBeCloseTo(area.top + area.height / 2, 5); // y = 1 is the middle of -3..5
  });

  it("puts each axis line through zero when zero is in range, else on the edge", () => {
    const [mid] = figure([axes()]).panels;
    expect(mid!.xAxis.y1).toBeCloseTo(mid!.area.top + (mid!.area.height * 5) / 8, 5);
    expect(mid!.yAxis.x1).toBeCloseTo(mid!.area.left + mid!.area.width / 3, 5);
    const [edge] = figure([axes("ax", { xRange: [1, 5], yRange: [2, 6] })]).panels;
    expect(edge!.xAxis.y1).toBe(edge!.area.top + edge!.area.height);
    expect(edge!.yAxis.x1).toBe(edge!.area.left);
  });

  it("draws plot segments as path data and a circle in math units as an ellipse", () => {
    const { panels } = figure([
      axes(),
      { ...base, id: "p", kind: "plot", props: { axes: "ax", segments: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] } },
      { ...base, id: "c", kind: "shape", props: { axes: "ax", shape: "circle", center: [1, 1], radius: 1 } },
    ]);
    const [plot, circle] = panels[0]!.items as [Extract<ItemView, { kind: "plot" }>, Extract<ItemView, { kind: "ellipse" }>];
    expect(plot.paths).toHaveLength(2);
    expect(plot.paths[0]).toMatch(/^M[\d. ]+L[\d. ]+$/);
    // 6 x units over the area width, 8 y units over its height.
    expect(circle.rx).toBeCloseTo(panels[0]!.area.width / 6, 5);
    expect(circle.ry).toBeCloseTo(panels[0]!.area.height / 8, 5);
  });

  it("gives an arrow a head at its end and a dashed line its flag", () => {
    const { panels } = figure([
      axes(),
      { ...base, id: "ar", kind: "arrow", props: { axes: "ax", from: [0, 0], to: [2, 0] } },
      { ...base, id: "l", kind: "line", props: { axes: "ax", from: [1, -3], to: [1, 5], dashed: true } },
    ]);
    const [arrow, line] = panels[0]!.items as Extract<ItemView, { kind: "line" | "arrow" }>[];
    expect(arrow!.kind).toBe("arrow");
    expect(arrow!.head).toMatch(/^[\d. ,]+$/);
    expect(arrow!.head!.split(" ")).toHaveLength(3);
    expect(line!.dashed).toBe(true);
    expect(line!.head).toBeUndefined();
  });

  it("keeps a label inside the figure and skips the label of a dot that is out of range", () => {
    const [panel] = figure([axes(), dot("edge", [4, 5], { label: "طويل جدا جدا جدا (4, 5)", side: "end" }), dot("out", [40, 50], { label: "x" })]).panels;
    const [edge, out] = panel!.items as Extract<ItemView, { kind: "dot" }>[];
    expect(edge!.label).toBeDefined();
    expect(edge!.label!.x).toBeLessThanOrEqual(panel!.width);
    expect(edge!.label!.x).toBeGreaterThanOrEqual(0);
    expect(out!.label).toBeUndefined();
  });

  it("makes one panel per axes and ignores elements of unknown axes", () => {
    const { panels } = figure([axes("a1"), axes("a2"), { ...dot("d", [0, 0]), props: { axes: "a2", at: [0, 0] } }, { ...dot("x", [0, 0]), props: { axes: "ghost", at: [0, 0] } }]);
    expect(panels.map((p) => p.axesId)).toEqual(["a1", "a2"]);
    expect(panels[0]!.items).toHaveLength(0);
    expect(panels[1]!.items.map((i) => i.id)).toEqual(["d"]);
  });
});

describe("ticks", () => {
  it("picks a readable step and honors an explicit one", () => {
    expect(niceStep(6)).toBe(1);
    expect(niceStep(8)).toBe(1);
    expect(niceStep(0.5)).toBe(0.1);
    expect(niceStep(100)).toBe(20);
    const [auto] = figure([axes()]).panels;
    expect(auto!.xTicks.map((t) => t.label)).toEqual(["−2", "−1", "0", "1", "2", "3", "4"]);
    const [fixed] = figure([axes("ax", { xStep: 2 })]).panels;
    expect(fixed!.xTicks.map((t) => t.label)).toEqual(["−2", "0", "2", "4"]);
  });

  it("writes numbers with Western digits only, a real minus sign and no float noise", () => {
    expect(formatTick(-1)).toBe("−1");
    expect(formatTick(0.1 + 0.2)).toBe("0.3");
    expect(formatTick(-0)).toBe("0");
    expect(formatTick(1234.5)).toBe("1234.5");
    for (const v of [0, 7, -12.5, 3e-3, 4e5]) expect(formatTick(v)).toMatch(/^[0-9−.e+-]+$/);
  });

  it("does not repeat zero on the y axis", () => {
    const [panel] = figure([axes()]).panels;
    expect(panel!.yTicks.map((t) => t.label)).not.toContain("0");
    expect(panel!.xTicks.map((t) => t.label)).toContain("0");
  });
});

describe("the agent's shared fixtures", () => {
  it("includes the figure examples and the parabola demo", () => {
    expect(fixtures.map((f) => f.name)).toEqual(expect.arrayContaining(["figure-1.ops.jsonl", "figure-demo.ops.jsonl"]));
  });

  for (const fixture of fixtures) {
    it(`${fixture.name} folds into figure items for every element it draws`, () => {
      const drawn = foldOps(fixture.ops).elements.filter((e) => e.region === "figure" && e.kind !== "axes");
      const { panels } = figure(fixture.ops);
      expect(panels.length).toBeGreaterThan(0);
      const ids = panels.flatMap((p) => p.items.map((i) => i.id));
      expect(ids.sort()).toEqual(drawn.map((e) => e.id).sort());
    });
  }
});
