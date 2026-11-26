import { useId } from "react";
import { useTranslations } from "next-intl";
import type { TextRun } from "@/lib/stage/bidi";
import {
  buildFigure,
  FONT,
  type ItemView,
  type LabelView,
  type PanelView,
  type Segment,
} from "@/lib/stage/figure";
import type { ColorRole } from "@/lib/stage/ops/figure";
import type { StageElement } from "@/lib/stage/stage";

/* منطقة الشكل: طبقة SVG لما يرسمه المعلّم على المحورين.
   الألوان أدوار فقط: كل دور يصير صنف `text-*` من توكنات الهوية، ويرثه الرسم
   عبر currentColor، فلا لون خام هنا. الأرقام غربية (تأتي جاهزة من الطيّ).
   النص عربي بأساسه، والمقاطع اللاتينية والأرقام تُعزل بـ direction ltr.
   ظهور العنصر حركة CSS تتوقّف مع «تقليل الحركة» من القاعدة العامة. */

const ROLE_CLASS: Record<ColorRole, string> = {
  ink: "text-ink",
  muted: "text-ink-2",
  accent: "text-aubergine-soft",
  olive: "text-olive-soft",
};

const DASH = "6 5";
const enter = "animate-board-in";
/* هالة بلون أرضية الجلسة خلف النص حتى لا يخترقه خطٌّ أو منحنى. */
const halo = "stroke-ground [paint-order:stroke]";
const isolate = { direction: "ltr", unicodeBidi: "isolate" } as const;

function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.ltr ? (
          <tspan key={i} style={isolate}>
            {run.text}
          </tspan>
        ) : (
          <tspan key={i}>{run.text}</tspan>
        ),
      )}
    </>
  );
}

function Label({ label, size = FONT.label }: { label: LabelView; size?: number }) {
  return (
    <text x={label.x} y={label.y} textAnchor="middle" fontSize={size} fill="currentColor" strokeWidth={4} strokeLinejoin="round" className={halo}>
      <Runs runs={label.runs} />
    </text>
  );
}

function Line({ s }: { s: Segment }) {
  return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
}

function Item({ item }: { item: ItemView }) {
  const stroke = { stroke: "currentColor", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const dash = "dashed" in item && item.dashed ? DASH : undefined;
  const tint = "filled" in item && item.filled ? { fill: "currentColor", fillOpacity: 0.18 } : {};
  let body;
  switch (item.kind) {
    case "plot":
      body = item.paths.map((d, i) => <path key={i} d={d} {...stroke} strokeDasharray={dash} />);
      break;
    case "dot":
      body = <circle cx={item.cx} cy={item.cy} r={4.5} fill="currentColor" stroke="none" />;
      break;
    case "line":
    case "arrow":
      body = (
        <>
          <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...stroke} strokeDasharray={dash} />
          {item.head ? <polygon points={item.head} fill="currentColor" stroke="none" /> : null}
        </>
      );
      break;
    case "rect":
      body = <rect x={item.x} y={item.y} width={item.width} height={item.height} {...stroke} {...tint} strokeDasharray={dash} />;
      break;
    case "ellipse":
      body = <ellipse cx={item.cx} cy={item.cy} rx={item.rx} ry={item.ry} {...stroke} {...tint} strokeDasharray={dash} />;
      break;
  }
  return (
    <g data-element-id={item.id} data-kind={item.kind === "rect" || item.kind === "ellipse" ? "shape" : item.kind} role="img" aria-label={item.meaning} className={`${ROLE_CLASS[item.color]} ${enter}`}>
      {body}
    </g>
  );
}

function Panel({ panel }: { panel: PanelView }) {
  const clipId = useId();
  const { area } = panel;
  return (
    <svg
      viewBox={`0 0 ${panel.width} ${panel.height}`}
      role="group"
      aria-label={panel.meaning}
      data-element-id={panel.axesId}
      data-kind="axes"
      data-axes-id={panel.axesId}
      className="mx-auto block h-auto w-full max-w-xl"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={area.left} y={area.top} width={area.width} height={area.height} />
        </clipPath>
      </defs>

      <g data-axes className={`${ROLE_CLASS.muted} ${enter}`} stroke="currentColor" strokeWidth={1.5} fill="none">
        {panel.grid.length > 0 ? (
          <g className="text-line" strokeWidth={1}>
            {panel.grid.map((s, i) => (
              <Line key={i} s={s} />
            ))}
          </g>
        ) : null}
        <Line s={panel.xAxis} />
        <Line s={panel.yAxis} />
        {[...panel.xTicks, ...panel.yTicks].map((t, i) => (
          <Line key={i} s={t} />
        ))}
      </g>

      <g clipPath={`url(#${clipId})`}>
        {panel.items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </g>
      <g data-axes-labels className={`${ROLE_CLASS.muted} ${enter}`}>
        {panel.xTicks.map((t) => (
          <text key={`xl-${t.value}`} x={t.lx} y={t.ly} textAnchor="middle" fontSize={FONT.tick} fill="currentColor" strokeWidth={4} strokeLinejoin="round" className={halo} style={isolate}>
            {t.label}
          </text>
        ))}
        {panel.yTicks.map((t) => (
          <text key={`yl-${t.value}`} x={t.lx} y={t.ly} textAnchor="end" fontSize={FONT.tick} fill="currentColor" strokeWidth={4} strokeLinejoin="round" className={halo} style={isolate}>
            {t.label}
          </text>
        ))}
        {panel.xLabel ? <Label label={panel.xLabel} /> : null}
        {panel.yLabel ? <Label label={panel.yLabel} /> : null}
      </g>
      {panel.items.map((item) =>
        item.kind === "dot" && item.label ? (
          <g key={`label-${item.id}`} className={`${ROLE_CLASS[item.color]} ${enter}`} data-label-of={item.id}>
            <Label label={item.label} />
          </g>
        ) : null,
      )}
    </svg>
  );
}

/** The `figure` region of the Stage: one SVG per axes the tutor has drawn. */
export function FigureRegion({ elements }: { elements: readonly StageElement[] }) {
  const t = useTranslations("Demo.stage");
  const { panels } = buildFigure(elements);
  if (panels.length === 0) return null;
  return (
    <div data-region="figure" role="group" aria-label={t("figure")} className="flex flex-col gap-4">
      {panels.map((panel) => (
        <Panel key={panel.axesId} panel={panel} />
      ))}
    </div>
  );
}
