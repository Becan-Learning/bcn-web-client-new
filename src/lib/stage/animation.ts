import type { Entrance } from "./op";
import type { Cue } from "./scene-state";

/* خطط الحركة: دوال نقيّة تقرّر ما تفعله كل حركة من حركات الـOps، ولا تعرف React ولا الـDOM.
   المكوّنات تمرّر الخطة إلى Motion كما هي. «تقليل الحركة» يعطي دائمًا حالة النهاية مباشرة:
   `initial: false` تعني أن العنصر يُرسم في حالته الأخيرة بلا انتقال. */

export type MotionValues = Record<string, number | string>;

export type MotionPlan = {
  /** `false`: render the end state at once. */
  initial: MotionValues | false;
  animate: MotionValues;
  transition: { duration: number; ease?: "easeOut" | "easeInOut" };
};

export const SECONDS = { enter: 0.45, draw: 0.8, exit: 0.3, pulse: 0.6, move: 0.7 } as const;

/** The end state that `reduced` motion jumps to. */
const NOW: MotionPlan = { initial: false, animate: {}, transition: { duration: 0 } };

export type MotionContext = { reduced: boolean; rtl: boolean };

const fade: MotionPlan = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: SECONDS.enter, ease: "easeOut" },
};

/** How a board or notes element (an `li`) enters; null when the Op asked for nothing (the CSS entrance runs). */
export function textEntrance(enter: Entrance | undefined, { reduced, rtl }: MotionContext): MotionPlan | null {
  if (enter === undefined) return null;
  if (reduced) return NOW;
  if (enter === "write") {
    // Revealed along the reading direction: from the right in Arabic, from the left in English.
    return {
      initial: { clipPath: rtl ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)", opacity: 1 },
      animate: { clipPath: "inset(0 0 0 0)" },
      transition: { duration: SECONDS.draw, ease: "easeOut" },
    };
  }
  return fade; // `create` has no strokes in a line of text: it fades in.
}

export type SvgEntrance = {
  /** The whole element (`g`). */
  group: MotionPlan | null;
  /** The stroke itself, drawn on with `pathLength`. */
  stroke: MotionPlan | null;
};

const POP: MotionPlan = {
  initial: { opacity: 0, scale: 0 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: SECONDS.enter, ease: "easeOut" },
};

const DRAW: MotionPlan = {
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { duration: SECONDS.draw, ease: "easeInOut" },
};

type StrokeKind = "plot" | "line" | "arrow" | "rect" | "ellipse" | "dot";

/** How a figure element enters. Dashed strokes cannot be drawn on (the dashes are the pattern), so they fade. */
export function svgEntrance(
  enter: Entrance | undefined,
  kind: StrokeKind,
  dashed: boolean,
  { reduced }: MotionContext,
): SvgEntrance {
  if (enter === undefined) return { group: null, stroke: null };
  if (reduced) return { group: NOW, stroke: null };
  if (enter === "fadeIn") return { group: fade, stroke: null };
  if (kind === "dot") return { group: POP, stroke: null };
  if (dashed) return { group: fade, stroke: null };
  // The arrow head and the fill are not strokes: they come in with a quick fade while the line draws.
  return { group: { ...fade, transition: { duration: SECONDS.enter / 2, ease: "easeOut" } }, stroke: DRAW };
}

/** The pulse of `indicate`, as keyframes for Motion's `animate`. */
export const PULSE = { scale: [1, 1.12, 1] } as const;

/** The element the cue's animation is aimed at, and whether it asks for a pulse. Anything else: no pulse. */
export function pulseKey(cue: Cue | null, id: string, reduced: boolean): string | null {
  if (reduced || cue === null || cue.target !== id) return null;
  return cue.animation === "indicate" || cue.animation === "highlight" ? cue.op : null;
}

/**
 * What the Stage shows for an element under reduced motion, where a pulse has no motion to play:
 * the element indicated last stays emphasised until the next cue.
 */
export function holdsEmphasis(cue: Cue | null, id: string, reduced: boolean): boolean {
  return reduced && cue !== null && cue.target === id && cue.animation === "indicate";
}

/** Who a removal fades out: the element the latest cue removed. Everything else leaves at once. */
export function leavingId(cue: Cue | null): string | null {
  return cue !== null && (cue.animation === "fadeOut" || cue.animation === "transform") ? cue.target : null;
}

/** The exit of an element: a fade when it is the one the cue removed, else none. */
export function exitPlan(leaving: string | null, id: string, reduced: boolean): { opacity: number; transition: { duration: number } } {
  const fades = leaving === id && !reduced;
  return { opacity: fades ? 0 : 1, transition: { duration: fades ? SECONDS.exit : 0 } };
}
