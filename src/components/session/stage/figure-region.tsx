"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { exitPlan, holdsEmphasis, pulseKey, svgEntrance, type MotionPlan } from "@/lib/stage/animation";
import type { TextRun } from "@/lib/stage/bidi";
import {
  buildFigure,
  FONT,
  type DotItem,
  type ItemView,
  type LabelView,
  type PanelView,
  type Segment,
} from "@/lib/stage/figure";
import type { ColorRole } from "@/lib/stage/ops/figure";
import type { StageElement } from "@/lib/stage/stage";
import { usePulse, useSlide, useStageMotion, useStageScene } from "./motion-context";

/* منطقة الشكل: طبقة SVG لما يرسمه المعلّم على المحورين.
   الألوان أدوار فقط: كل دور يصير صنف `text-*` من توكنات الهوية، ويرثه الرسم
   عبر currentColor، فلا لون خام هنا. الأرقام غربية (تأتي جاهزة من الطيّ).
   النص عربي بأساسه، والمقاطع اللاتينية والأرقام تُعزل بـ direction ltr.
   الدخول الافتراضي حركة CSS تتوقّف مع «تقليل الحركة» من القاعدة العامة؛ وإن طلب الـOp دخولًا
   (create وwrite وfadeIn) فـMotion ينفّذه: الخطّ يُرسم بـpathLength والنقطة تنبثق، ومع «تقليل
   الحركة» يظهر العنصر في حالته الأخيرة. move ينزلق العنصر إلى مكانه الجديد، وindicate ينبض،
   وhighlight يثخّن الخطّ ويضيء حوله، وإزالة العنصر تُخفيه بتلاشٍ. */

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

function Line({ s, draw }: { s: Segment; draw?: ReturnType<typeof planProps> }) {
  return draw ? <motion.line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...draw} /> : <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />;
}

const centred = { transformBox: "fill-box", transformOrigin: "center" } as const;
/* Emphasis is a thicker stroke and a soft glow of the element's own role color. */
const GLOW = "[filter:drop-shadow(0_0_3px_currentColor)]";

/** The motion props a plan gives an element; no plan means the element is drawn in its end state. */
function planProps(plan: MotionPlan | null) {
  return plan ? { initial: plan.initial, animate: plan.animate, transition: plan.transition } : { initial: false as const };
}

function Item({ item }: { item: ItemView }) {
  const motionSettings = useStageMotion();
  const { reduced } = motionSettings;
  const scene = useStageScene();
  const ref = useRef<SVGGElement>(null);
  const restored = scene.restored.has(item.id);
  const emphasised = scene.highlighted.has(item.id) || holdsEmphasis(scene.cue, item.id, reduced);
  const dashed = "dashed" in item && item.dashed;
  const entrance = restored
    ? { group: null, stroke: null }
    : svgEntrance(item.enter, item.kind, dashed, motionSettings);
  usePulse(ref, pulseKey(scene.cue, item.id, reduced));
  useSlide(ref, item.origin.x, item.origin.y, reduced);

  const stroke = {
    stroke: "currentColor",
    strokeWidth: emphasised ? 3.5 : 2,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const dash = dashed ? DASH : undefined;
  const tint = "filled" in item && item.filled ? { fill: "currentColor", fillOpacity: 0.18 } : {};
  const draw = planProps(entrance.stroke);
  let body;
  switch (item.kind) {
    case "plot":
      body = item.paths.map((d, i) => <motion.path key={i} d={d} {...stroke} strokeDasharray={dash} {...draw} />);
      break;
    case "dot":
      body = <circle cx={item.cx} cy={item.cy} r={4.5} fill="currentColor" stroke="none" />;
      break;
    case "line":
    case "arrow":
      body = (
        <>
          <motion.line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...stroke} strokeDasharray={dash} {...draw} />
          {item.head ? <polygon points={item.head} fill="currentColor" stroke="none" /> : null}
        </>
      );
      break;
    case "rect":
      body = <motion.rect x={item.x} y={item.y} width={item.width} height={item.height} {...stroke} {...tint} strokeDasharray={dash} {...draw} />;
      break;
    case "ellipse":
      body = <motion.ellipse cx={item.cx} cy={item.cy} rx={item.rx} ry={item.ry} {...stroke} {...tint} strokeDasharray={dash} {...draw} />;
      break;
  }
  const cssEntrance = item.enter === undefined && !restored ? enter : "";
  return (
    <motion.g
      ref={ref}
      data-element-id={item.id}
      data-kind={item.kind === "rect" || item.kind === "ellipse" ? "shape" : item.kind}
      data-emphasis={emphasised ? "" : undefined}
      role="img"
      aria-label={item.meaning}
      className={`${ROLE_CLASS[item.color]} ${cssEntrance} ${emphasised ? GLOW : ""}`}
      style={centred}
      {...planProps(entrance.group)}
      variants={{ leave: (leaving: string | null) => exitPlan(leaving, item.id, reduced) }}
      exit="leave"
    >
      {body}
    </motion.g>
  );
}

/** A dot's label follows the dot: it comes in with it, slides with it and leaves with it. */
function DotLabel({ item, label }: { item: DotItem; label: LabelView }) {
  const { reduced } = useStageMotion();
  const scene = useStageScene();
  const ref = useRef<SVGGElement>(null);
  const restored = scene.restored.has(item.id);
  useSlide(ref, item.origin.x, item.origin.y, reduced);
  const cssEntrance = item.enter === undefined && !restored ? enter : "";
  const fade = restored || item.enter === undefined ? null : svgEntrance("fadeIn", "dot", false, { reduced, rtl: false }).group;
  return (
    <motion.g
      ref={ref}
      className={`${ROLE_CLASS[item.color]} ${cssEntrance}`}
      data-label-of={item.id}
      {...planProps(fade)}
      variants={{ leave: (leaving: string | null) => exitPlan(leaving, item.id, reduced) }}
      exit="leave"
    >
      <Label label={label} />
    </motion.g>
  );
}

function Panel({ panel }: { panel: PanelView }) {
  const clipId = useId();
  const scene = useStageScene();
  const motionSettings = useStageMotion();
  const entrance = scene.restored.has(panel.axesId)
    ? { group: null, stroke: null }
    : svgEntrance(panel.enter, "line", false, motionSettings);
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

      <motion.g
        data-axes
        className={`${ROLE_CLASS.muted} ${panel.enter === undefined && !scene.restored.has(panel.axesId) ? enter : ""}`}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
        {...planProps(entrance.group)}
      >
        {panel.grid.length > 0 ? (
          <g className="text-line" strokeWidth={1}>
            {panel.grid.map((s, i) => (
              <Line key={i} s={s} />
            ))}
          </g>
        ) : null}
        <Line s={panel.xAxis} draw={entrance.stroke ? planProps(entrance.stroke) : undefined} />
        <Line s={panel.yAxis} draw={entrance.stroke ? planProps(entrance.stroke) : undefined} />
        {[...panel.xTicks, ...panel.yTicks].map((t, i) => (
          <Line key={i} s={t} />
        ))}
      </motion.g>

      <g clipPath={`url(#${clipId})`}>
        <AnimatePresence custom={scene.leaving}>
          {panel.items.map((item) => (
            <Item key={item.id} item={item} />
          ))}
        </AnimatePresence>
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
      <AnimatePresence custom={scene.leaving}>
        {panel.items.map((item) =>
          item.kind === "dot" && item.label ? <DotLabel key={`label-${item.id}`} item={item} label={item.label} /> : null,
        )}
      </AnimatePresence>
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
