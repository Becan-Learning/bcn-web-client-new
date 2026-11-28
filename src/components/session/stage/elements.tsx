"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";
import { exitPlan, holdsEmphasis, pulseKey, textEntrance } from "@/lib/stage/animation";
import { splitStep } from "@/lib/stage/derivation";
import { proseScale } from "@/lib/stage/fit";
import type { StageElement } from "@/lib/stage/stage";
import { Fit } from "./fit";
import { usePulse, useStageMotion, useStageScene } from "./motion-context";
import { Tex } from "./math";
import { RichText } from "./rich-text";

/* عناصر مناطق board وnotes. كلها تتدفّق بالترتيب بلا إحداثيات. الدخول الافتراضي حركة CSS
   `animate-board-in` (تتوقّف مع «تقليل الحركة» من القاعدة العامة في globals.css)؛ وإن طلب الـOp
   دخولًا (create وwrite وfadeIn) فـMotion ينفّذه، ومع «تقليل الحركة» يقفز إلى حالته الأخيرة.
   التلاشي عند الإزالة، وindicate وhighlight، كلها من Motion عبر `StageLi`.
   النص الغني يلتفّ بطبيعته (ويصغر قليلًا إن طال)؛ المعادلة والاشتقاق يقيسان أنفسهما في `Fit`. */

const item = "min-w-0";
const emphasis = "rounded-md outline outline-2 outline-offset-2 outline-warmth";

type Of<K extends StageElement["kind"]> = Extract<StageElement, { kind: K }>;

/** The `li` every board and notes element is: entrance, pulse, highlight and fade-out live here. */
function StageLi({
  element,
  className,
  attrs,
  children,
}: {
  element: StageElement;
  className: string;
  attrs?: Record<string, string | undefined>;
  children: ReactNode;
}) {
  const motionSettings = useStageMotion();
  const { reduced } = motionSettings;
  const scene = useStageScene();
  const ref = useRef<HTMLLIElement>(null);
  const restored = scene.restored.has(element.id);
  const plan = restored ? null : textEntrance(element.enter, motionSettings);
  usePulse(ref, pulseKey(scene.cue, element.id, reduced));
  const emphasised = scene.highlighted.has(element.id) || holdsEmphasis(scene.cue, element.id, reduced);
  const cssEntrance = element.enter === undefined && !restored ? "animate-board-in" : "";

  return (
    <motion.li
      ref={ref}
      data-element-id={element.id}
      data-kind={element.kind}
      data-emphasis={emphasised ? "" : undefined}
      {...attrs}
      className={`${className} ${cssEntrance} ${emphasised ? emphasis : ""}`}
      initial={plan ? plan.initial : false}
      animate={plan ? plan.animate : undefined}
      transition={plan ? plan.transition : undefined}
      variants={{ leave: (leaving: string | null) => exitPlan(leaving, element.id, reduced) }}
      exit="leave"
    >
      {children}
    </motion.li>
  );
}

function proseStyle(text: string) {
  return { fontSize: `calc(${proseScale(text.length)} * 1em)` };
}

function NoteCard({ element }: { element: Of<"note"> }) {
  const t = useTranslations("Demo.stage.tone");
  const { text, tone } = element.props;
  const toneClass =
    tone === "key"
      ? "border-s-4 border-s-warmth"
      : tone === "warning"
        ? "border-s-4 border-s-ink-3"
        : "";
  return (
    <StageLi
      element={element}
      attrs={{ "data-tone": tone }}
      className={`${item} rounded-md border border-line bg-panel px-4 py-3 text-lg leading-base text-ink ${toneClass}`}
    >
      {tone ? <p className="text-sm font-semibold text-ink-2">{t(tone)}</p> : null}
      <p className="[overflow-wrap:anywhere]" style={proseStyle(text)}>
        <RichText text={text} />
      </p>
    </StageLi>
  );
}

function TextBlock({ element }: { element: Of<"text"> }) {
  const { text, size } = element.props;
  const title = size === "title";
  return (
    <StageLi element={element} attrs={{ "data-size": size }} className={`${item} leading-base text-ink`}>
      <p
        className={`[overflow-wrap:anywhere] ${title ? "text-xl font-bold" : "text-lg"}`}
        style={proseStyle(text)}
      >
        <RichText text={text} />
      </p>
    </StageLi>
  );
}

function TexBlock({ element }: { element: Of<"tex"> }) {
  return (
    <StageLi element={element} className={`${item} text-ink`}>
      <Fit className="py-1 text-center text-xl md:text-2xl">
        <Tex tex={element.props.tex} />
      </Fit>
    </StageLi>
  );
}

function DerivationBlock({ element }: { element: Of<"derivation"> }) {
  const { steps } = element.props;
  return (
    <StageLi element={element} className={`${item} text-ink`}>
      <Fit className="py-1 text-lg md:text-xl">
        {/* The grid is a math block, so its columns run left-to-right whatever the page direction.
            Each comment keeps the direction of its own text. */}
        <ol
          dir="ltr"
          data-derivation
          className="grid grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1fr)] gap-y-2 group-data-[wrap=true]:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,auto)_minmax(0,1fr)]"
        >
          {steps.map((step, i) => {
            const split = splitStep(step.tex);
            return (
              <li key={i} data-step={i + 1} className="col-span-4 grid grid-cols-subgrid gap-y-1">
                {split.aligned ? (
                  <>
                    <span className="col-start-2 min-w-0 justify-self-end">
                      <Tex tex={split.lhs} />
                    </span>
                    <span className="col-start-3 min-w-0 justify-self-start ps-1">
                      <Tex tex={split.rhs} />
                    </span>
                  </>
                ) : (
                  <span className="col-span-2 col-start-2 min-w-0 justify-self-center">
                    <Tex tex={split.whole} />
                  </span>
                )}
                {step.comment ? (
                  <p dir="auto" className="col-span-4 w-0 min-w-full text-center text-sm leading-base text-ink-2 [overflow-wrap:anywhere]">
                    <RichText text={step.comment} />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Fit>
    </StageLi>
  );
}

export function StageItem({ element }: { element: StageElement }) {
  switch (element.kind) {
    case "note":
      return <NoteCard element={element} />;
    case "text":
      return <TextBlock element={element} />;
    case "tex":
      return <TexBlock element={element} />;
    case "derivation":
      return <DerivationBlock element={element} />;
  }
}
