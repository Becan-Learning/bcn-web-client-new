import { describe, expect, it } from "vitest";
import { exitPlan, holdsEmphasis, leavingId, pulseKey, svgEntrance, textEntrance } from "./animation";

const motion = { reduced: false, rtl: true };
const reduced = { reduced: true, rtl: true };
const cue = (animation: "indicate" | "highlight" | "fadeOut" | "transform", target = "a") => ({ op: "x1", target, animation });

describe("entrance plans", () => {
  it("runs nothing for an element that asked for no entrance (the default CSS entrance applies)", () => {
    expect(textEntrance(undefined, motion)).toBeNull();
    expect(svgEntrance(undefined, "plot", false, motion)).toEqual({ group: null, stroke: null });
  });

  it("fadeIn fades; write reveals along the reading direction; create falls back to a fade on text", () => {
    expect(textEntrance("fadeIn", motion)?.initial).toEqual({ opacity: 0 });
    expect(textEntrance("create", motion)).toEqual(textEntrance("fadeIn", motion));
    expect(textEntrance("write", { reduced: false, rtl: true })?.initial).toMatchObject({ clipPath: "inset(0 0 0 100%)" });
    expect(textEntrance("write", { reduced: false, rtl: false })?.initial).toMatchObject({ clipPath: "inset(0 100% 0 0)" });
  });

  it("create draws a stroke on, pops a dot, and fades a dashed line", () => {
    expect(svgEntrance("create", "plot", false, motion).stroke?.initial).toEqual({ pathLength: 0 });
    expect(svgEntrance("write", "arrow", false, motion).stroke).not.toBeNull();
    expect(svgEntrance("create", "dot", false, motion).group?.initial).toMatchObject({ scale: 0 });
    expect(svgEntrance("create", "line", true, motion)).toMatchObject({ stroke: null, group: { initial: { opacity: 0 } } });
  });

  it("under reduced motion every entrance is the end state at once, with no transition", () => {
    for (const enter of ["create", "write", "fadeIn"] as const) {
      expect(textEntrance(enter, reduced)).toEqual({ initial: false, animate: {}, transition: { duration: 0 } });
      for (const kind of ["plot", "dot", "line", "arrow", "rect", "ellipse"] as const)
        expect(svgEntrance(enter, kind, false, reduced)).toEqual({
          group: { initial: false, animate: {}, transition: { duration: 0 } },
          stroke: null,
        });
    }
  });
});

describe("cues", () => {
  it("pulses only the element the cue names, and never under reduced motion", () => {
    expect(pulseKey(cue("indicate"), "a", false)).toBe("x1");
    expect(pulseKey(cue("highlight"), "a", false)).toBe("x1");
    expect(pulseKey(cue("indicate"), "b", false)).toBeNull();
    expect(pulseKey(cue("fadeOut"), "a", false)).toBeNull();
    expect(pulseKey(cue("indicate"), "a", true)).toBeNull();
    expect(pulseKey(null, "a", false)).toBeNull();
  });

  it("under reduced motion the indicated element stays emphasised instead of pulsing", () => {
    expect(holdsEmphasis(cue("indicate"), "a", true)).toBe(true);
    expect(holdsEmphasis(cue("indicate"), "a", false)).toBe(false);
    expect(holdsEmphasis(cue("indicate"), "b", true)).toBe(false);
  });

  it("only the removed element fades out, and under reduced motion it leaves at once", () => {
    expect(leavingId(cue("fadeOut"))).toBe("a");
    expect(leavingId(cue("transform"))).toBe("a");
    expect(leavingId(cue("indicate"))).toBeNull();
    expect(exitPlan("a", "a", false)).toEqual({ opacity: 0, transition: { duration: 0.3 } });
    expect(exitPlan("a", "b", false).transition.duration).toBe(0);
    expect(exitPlan("a", "a", true).transition.duration).toBe(0);
  });
});
