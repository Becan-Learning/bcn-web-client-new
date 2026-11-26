import { splitLatinRuns, type TextRun } from "./bidi";
import type { ColorRole } from "./ops/figure";
import type { StageElement } from "./stage";

/* منطقة الشكل (figure): طيّ نقيّ لعناصر المنطقة إلى هندسة جاهزة للرسم.
   الـOps تصل بإحداثيات رياضية على محورين؛ هنا فقط تُحوَّل إلى وحدات الـSVG.
   لا يعرف الـDOM ولا الألوان (الدور اللوني يمرّ كما هو والمكوّن يحوّله إلى توكن)،
   ولا يقيّم أي تعبير: منحنى الدالة يصل مأخوذ العيّنات من الخادم. */

/** The SVG user-unit space of one panel. A phone shows it at about 1:1. */
export const PANEL = { width: 360, height: 300 } as const;
const MARGIN = { left: 34, right: 14, top: 14, bottom: 28 } as const;
const TICK_LENGTH = 4;
const DOT_GAP = 9;
export const FONT = { tick: 12, label: 14 } as const;
const ARROW_HEAD = { length: 10, halfWidth: 4.5 } as const;
const MAX_TICKS = 40;

export type Area = { left: number; top: number; width: number; height: number };
export type Segment = { x1: number; y1: number; x2: number; y2: number };
export type Tick = Segment & { value: number; label: string; lx: number; ly: number };
export type LabelView = { text: string; runs: TextRun[]; x: number; y: number };

type ItemBase = { id: string; meaning: string; color: ColorRole };
export type PlotItem = ItemBase & { kind: "plot"; paths: string[]; dashed: boolean };
export type DotItem = ItemBase & { kind: "dot"; cx: number; cy: number; label?: LabelView };
export type SegmentItem = ItemBase &
  Segment & { kind: "line" | "arrow"; dashed: boolean; /** SVG `points` of the arrow head. */ head?: string };
export type RectItem = ItemBase & {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  dashed: boolean;
  filled: boolean;
};
export type EllipseItem = ItemBase & {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  dashed: boolean;
  filled: boolean;
};
export type ItemView = PlotItem | DotItem | SegmentItem | RectItem | EllipseItem;

export type PanelView = {
  axesId: string;
  meaning: string;
  width: number;
  height: number;
  /** The plot area; everything the model draws is clipped to it. */
  area: Area;
  xAxis: Segment;
  yAxis: Segment;
  xTicks: Tick[];
  yTicks: Tick[];
  grid: Segment[];
  xLabel?: LabelView;
  yLabel?: LabelView;
  items: ItemView[];
};

export type FigureView = { panels: PanelView[] };

const round = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A tick distance from the span: 1, 2 or 5 times a power of ten, about six ticks over the span. */
export function niceStep(span: number): number {
  const raw = span / 6;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return Number((factor * magnitude).toPrecision(12));
}

/** A number as printed on an axis: Western digits (String of a number), a real minus, no float noise. */
export function formatTick(value: number): string {
  const clean = Number(value.toPrecision(10));
  const text = String(clean === 0 ? 0 : clean);
  return text.replace("-", "−");
}

/** Rough text width in SVG units; used only to keep labels inside the figure. */
const textWidth = (text: string, size: number) => text.length * size * 0.56;

function ticksFor(min: number, max: number, explicit: number | undefined): number[] {
  let step = explicit ?? niceStep(max - min);
  if ((max - min) / step > MAX_TICKS) step = niceStep(max - min);
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  const values: number[] = [];
  for (let k = first; k <= last; k++) values.push(Number((k * step).toPrecision(12)));
  return values;
}

function labelView(text: string, x: number, y: number, size: number, width: number): LabelView {
  const half = textWidth(text, size) / 2;
  return { text, runs: splitLatinRuns(text), x: round(clamp(x, 2 + half, width - 2 - half)), y: round(y) };
}

function buildPanel(axesEl: Extract<StageElement, { kind: "axes" }>, members: StageElement[]): PanelView {
  const { xRange, yRange } = axesEl.props;
  const area: Area = {
    left: MARGIN.left,
    top: MARGIN.top,
    width: PANEL.width - MARGIN.left - MARGIN.right,
    height: PANEL.height - MARGIN.top - MARGIN.bottom,
  };
  const sx = area.width / (xRange[1] - xRange[0]);
  const sy = area.height / (yRange[1] - yRange[0]);
  const px = (x: number) => round(area.left + (x - xRange[0]) * sx);
  const py = (y: number) => round(area.top + (yRange[1] - y) * sy);
  const right = area.left + area.width;
  const bottom = area.top + area.height;

  // Each axis line passes through zero of the other one when it is in range, else sits on the edge.
  const xAxisY = py(clamp(0, yRange[0], yRange[1]));
  const yAxisX = px(clamp(0, xRange[0], xRange[1]));

  const xTicks: Tick[] = ticksFor(xRange[0], xRange[1], axesEl.props.xStep).map((value) => ({
    value,
    x1: px(value),
    y1: xAxisY - TICK_LENGTH,
    x2: px(value),
    y2: xAxisY + TICK_LENGTH,
    label: formatTick(value),
    lx: px(value),
    ly: round(xAxisY + TICK_LENGTH + FONT.tick),
  }));
  const yTicks: Tick[] = ticksFor(yRange[0], yRange[1], axesEl.props.yStep)
    .filter((value) => value !== 0 || xRange[0] > 0 || xRange[1] < 0) // zero is already written on the x axis
    .map((value) => ({
      value,
      x1: yAxisX - TICK_LENGTH,
      y1: py(value),
      x2: yAxisX + TICK_LENGTH,
      y2: py(value),
      label: formatTick(value),
      lx: round(yAxisX - TICK_LENGTH - 3),
      ly: round(py(value) + FONT.tick / 3),
    }));

  const grid: Segment[] = axesEl.props.grid
    ? [
        ...xTicks.map((t) => ({ x1: t.x1, y1: area.top, x2: t.x2, y2: bottom })),
        ...yTicks.map((t) => ({ x1: area.left, y1: t.y1, x2: right, y2: t.y2 })),
      ]
    : [];

  const items: ItemView[] = [];
  for (const el of members) {
    const item = buildItem(el, { px, py, sx, sy, area });
    if (item) items.push(item);
  }

  return {
    axesId: axesEl.id,
    meaning: axesEl.meaning,
    width: PANEL.width,
    height: PANEL.height,
    area,
    xAxis: { x1: area.left, y1: xAxisY, x2: right, y2: xAxisY },
    yAxis: { x1: yAxisX, y1: area.top, x2: yAxisX, y2: bottom },
    xTicks,
    yTicks,
    grid,
    xLabel: axesEl.props.xLabel
      ? labelView(axesEl.props.xLabel, right - 4 - textWidth(axesEl.props.xLabel, FONT.label) / 2, xAxisY - 8, FONT.label, PANEL.width)
      : undefined,
    yLabel: axesEl.props.yLabel
      ? labelView(axesEl.props.yLabel, yAxisX + 10 + textWidth(axesEl.props.yLabel, FONT.label) / 2, area.top + FONT.label, FONT.label, PANEL.width)
      : undefined,
    items,
  };
}

type Mapper = {
  px: (x: number) => number;
  py: (y: number) => number;
  sx: number;
  sy: number;
  area: Area;
};

function buildItem(el: StageElement, m: Mapper): ItemView | null {
  const base = { id: el.id, meaning: el.meaning };
  switch (el.kind) {
    case "plot":
      return {
        ...base,
        kind: "plot",
        color: el.props.color ?? "ink",
        dashed: el.props.dashed ?? false,
        paths: el.props.segments.map(
          (seg) => `M${seg.map(([x, y], i) => `${i === 1 ? "L" : ""}${m.px(x)} ${m.py(y)}`).join(" ")}`,
        ),
      };
    case "dot": {
      const [x, y] = el.props.at;
      const cx = m.px(x);
      const cy = m.py(y);
      const visible = cx >= m.area.left && cx <= m.area.left + m.area.width && cy >= m.area.top && cy <= m.area.top + m.area.height;
      return {
        ...base,
        kind: "dot",
        color: el.props.color ?? "accent",
        cx,
        cy,
        label: visible && el.props.label ? dotLabel(el.props.label, el.props.side ?? "above", cx, cy) : undefined,
      };
    }
    case "line":
    case "arrow": {
      const x1 = m.px(el.props.from[0]);
      const y1 = m.py(el.props.from[1]);
      const x2 = m.px(el.props.to[0]);
      const y2 = m.py(el.props.to[1]);
      return {
        ...base,
        kind: el.kind,
        color: el.props.color ?? "ink",
        dashed: el.props.dashed ?? false,
        x1,
        y1,
        x2,
        y2,
        head: el.kind === "arrow" ? arrowHead(x1, y1, x2, y2) : undefined,
      };
    }
    case "shape": {
      const common = { color: el.props.color ?? "ink", dashed: el.props.dashed ?? false, filled: el.props.filled ?? false };
      if (el.props.shape === "rect") {
        const [ax, ay] = el.props.from;
        const [bx, by] = el.props.to;
        const x = Math.min(m.px(ax), m.px(bx));
        const y = Math.min(m.py(ay), m.py(by));
        return { ...base, ...common, kind: "rect", x, y, width: round(Math.abs(m.px(bx) - m.px(ax))), height: round(Math.abs(m.py(by) - m.py(ay))) };
      }
      return {
        ...base,
        ...common,
        kind: "ellipse",
        cx: m.px(el.props.center[0]),
        cy: m.py(el.props.center[1]),
        rx: round(el.props.radius * m.sx),
        ry: round(el.props.radius * m.sy),
      };
    }
    default:
      return null;
  }
}

function dotLabel(text: string, side: "above" | "below" | "start" | "end", cx: number, cy: number): LabelView {
  const half = textWidth(text, FONT.label) / 2;
  switch (side) {
    case "above":
      return labelView(text, cx, cy - DOT_GAP, FONT.label, PANEL.width);
    case "below":
      return labelView(text, cx, cy + DOT_GAP + FONT.label - 2, FONT.label, PANEL.width);
    case "start":
      return labelView(text, cx - DOT_GAP - half, cy + FONT.label / 3, FONT.label, PANEL.width);
    case "end":
      return labelView(text, cx + DOT_GAP + half, cy + FONT.label / 3, FONT.label, PANEL.width);
  }
}

/** The three corners of an arrow head, in SVG `points` form; undefined for a zero-length arrow. */
function arrowHead(x1: number, y1: number, x2: number, y2: number): string | undefined {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return undefined;
  const ux = dx / length;
  const uy = dy / length;
  const bx = x2 - ux * ARROW_HEAD.length;
  const by = y2 - uy * ARROW_HEAD.length;
  const nx = -uy * ARROW_HEAD.halfWidth;
  const ny = ux * ARROW_HEAD.halfWidth;
  return `${round(x2)},${round(y2)} ${round(bx + nx)},${round(by + ny)} ${round(bx - nx)},${round(by - ny)}`;
}

/**
 * Fold the figure region's elements into one panel per axes, in the order the axes were drawn.
 * An element whose axes are not on the Stage is skipped.
 */
export function buildFigure(elements: readonly StageElement[]): FigureView {
  const panels: PanelView[] = [];
  for (const el of elements) {
    if (el.kind !== "axes") continue;
    const members = elements.filter((m) => "axes" in m.props && m.props.axes === el.id);
    panels.push(buildPanel(el, members));
  }
  return { panels };
}
