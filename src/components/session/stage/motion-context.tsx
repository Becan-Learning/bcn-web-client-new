"use client";

import { animate } from "motion/react";
import { useLocale } from "next-intl";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { PULSE, SECONDS, type MotionContext } from "@/lib/stage/animation";
import type { Cue } from "@/lib/stage/scene-state";
import { useReducedMotion } from "../use-reduced-motion";

/* ما تحتاجه عناصر المسرح لتتحرّك، دون تمريره عبر كل مكوّن:
   - `StageMotionProvider`: «تقليل الحركة» واتجاه القراءة (الاختبارات تثبّتهما، والإنتاج يقرؤهما).
   - `StageSceneProvider`: ما يخصّ المشهد الحاضر (الإشارة الأخيرة، المُبرَز، من يغادر بتلاشٍ،
     وما استُعيد مع مشهده فيظهر فورًا دون حركة دخول). */

const MotionCtx = createContext<MotionContext | null>(null);

export function StageMotionProvider({ reduced, rtl, children }: MotionContext & { children: ReactNode }) {
  return <MotionCtx.Provider value={{ reduced, rtl }}>{children}</MotionCtx.Provider>;
}

/** The motion settings: the provider's when there is one, else the student's own preference and the locale's direction. */
export function useStageMotion(): MotionContext {
  const given = useContext(MotionCtx);
  const systemReduced = useReducedMotion();
  const locale = useLocale();
  return given ?? { reduced: systemReduced, rtl: locale === "ar" };
}

export type StageSceneInfo = {
  cue: Cue | null;
  highlighted: ReadonlySet<string>;
  /** The element the latest cue removes: it fades out; every other element leaves at once. */
  leaving: string | null;
  /** Elements that came back with a restored Scene: they are shown as they were, with no entrance. */
  restored: ReadonlySet<string>;
};

export const NO_SCENE_INFO: StageSceneInfo = { cue: null, highlighted: new Set(), leaving: null, restored: new Set() };

const SceneCtx = createContext<StageSceneInfo>(NO_SCENE_INFO);

export function StageSceneProvider({ value, children }: { value: StageSceneInfo; children: ReactNode }) {
  return <SceneCtx.Provider value={value}>{children}</SceneCtx.Provider>;
}

export function useStageScene(): StageSceneInfo {
  return useContext(SceneCtx);
}

/** `indicate`: pulse the element once each time a new cue names it. */
export function usePulse(ref: RefObject<Element | null>, key: string | null): void {
  useEffect(() => {
    const node = ref.current;
    if (key === null || node === null) return;
    const controls = animate(node, PULSE, { duration: SECONDS.pulse, ease: "easeInOut" });
    return () => controls.stop();
  }, [key, ref]);
}

/** `move`: when the element's place changes, slide it from where it was instead of jumping. */
export function useSlide(ref: RefObject<Element | null>, x: number, y: number, reduced: boolean): void {
  const last = useRef({ x, y });
  useLayoutEffect(() => {
    const from = last.current;
    last.current = { x, y };
    const node = ref.current;
    if (reduced || node === null || (from.x === x && from.y === y)) return;
    const controls = animate(node, { x: [from.x - x, 0], y: [from.y - y, 0] }, { duration: SECONDS.move, ease: "easeInOut" });
    return () => controls.stop();
  }, [x, y, reduced, ref]);
}
