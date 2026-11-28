import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { applyOp, elementsIn, EMPTY_STAGE, foldOps } from "./stage";

const anchor = { speech: "sp_1", char: 0 };
const add = (id: string, layer = "scene", kind: "note" | "axes" | "dot" = "note", extra: object = {}) => {
  const base = { op: "add", id, layer, meaning: id, anchor, ...extra };
  if (kind === "axes")
    return { ...base, kind, region: "figure", props: { xRange: [-2, 2], yRange: [-2, 2] } };
  if (kind === "dot") return { ...base, kind, region: "figure", props: { axes: "ax", at: [0, 0] } };
  return { ...base, kind, region: "notes", props: { text: "ملاحظة" } };
};
const sceneOp = (id: string, action: "new" | "restore") => ({ op: "scene", id, action, anchor });
const ids = (state: { elements: readonly { id: string }[] }) => state.elements.map((e) => e.id);
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}.ops.jsonl`, import.meta.url), "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as unknown);

describe("Stage: Scenes put aside and restored", () => {
  it("restoring a Scene put aside returns an identical state", () => {
    const before = foldOps([add("ax", "scene", "axes"), add("p", "scene", "dot"), add("n"), {
      op: "animate", id: "h1", target: "p", animation: "highlight", anchor,
    }]);
    const during = foldOps([sceneOp("s1", "new"), add("other"), add("more", "answer")], before);
    expect(ids(during)).toEqual(["other", "more"]);
    expect(during.highlighted).toEqual([]);
    const after = applyOp(during, sceneOp("s2", "restore"));
    expect(after.elements).toEqual(before.elements);
    expect(after.highlighted).toEqual(before.highlighted);
    expect(after.aside).toEqual(before.aside);
    expect(after.aside).toEqual([]);
  });

  it("a restored Scene is the same elements in the same order, however much happened to the Scene in between", () => {
    const first = foldOps([add("a"), add("b"), add("c")]);
    let state = foldOps([sceneOp("s1", "new"), add("x"), sceneOp("s2", "new"), add("y")], first);
    expect(state.aside).toHaveLength(2);
    state = foldOps([{ op: "clear", id: "c1", layer: "scene", anchor }, sceneOp("s3", "restore")], state);
    expect(ids(state)).toEqual(["x"]);
    state = applyOp(state, sceneOp("s4", "restore"));
    expect(state.elements).toEqual(first.elements);
  });

  it("a restore with nothing put aside is skipped with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = foldOps([add("a"), sceneOp("s1", "restore")]);
    expect(ids(state)).toEqual(["a"]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("an Op does not reach a Scene put aside", () => {
    const state = foldOps([add("a"), sceneOp("s1", "new"), add("b"), { op: "clear", id: "c1", layer: "scene", anchor }]);
    expect(ids(state)).toEqual([]);
    expect(ids(state.aside[0]!)).toEqual(["a"]);
  });
});

describe("Stage: clearing a layer while keeping ids", () => {
  const drawn = foldOps([
    add("n1"),
    add("ax", "answer", "axes"),
    add("keep-dot", "answer", "dot"),
    add("lose-dot", "answer", "dot"),
    add("answer-note", "answer"),
    add("n2"),
  ]);

  it("removes everything in the layer except the kept ids, and leaves the other layers", () => {
    const cleared = applyOp(drawn, { op: "clear", id: "c1", layer: "answer", keep: ["keep-dot", "ax"], anchor });
    expect(ids(cleared)).toEqual(["n1", "ax", "keep-dot", "n2"]);
    expect(elementsIn(cleared, "notes").map((e) => e.id)).toEqual(["n1", "n2"]);
  });

  it("clear without keep empties the layer; keep ids from other layers do not protect anything", () => {
    expect(ids(applyOp(drawn, { op: "clear", id: "c1", layer: "answer", anchor }))).toEqual(["n1", "n2"]);
    expect(ids(applyOp(drawn, { op: "clear", id: "c2", layer: "answer", keep: ["n1"], anchor }))).toEqual(["n1", "n2"]);
  });

  it("a highlight on a removed element is gone with it", () => {
    const marked = applyOp(drawn, { op: "animate", id: "h", target: "lose-dot", animation: "highlight", anchor });
    expect(marked.highlighted).toEqual(["lose-dot"]);
    expect(applyOp(marked, { op: "clear", id: "c", layer: "answer", anchor }).highlighted).toEqual([]);
  });
});

describe("Stage: animations and edits", () => {
  const base = foldOps([add("ax", "scene", "axes"), add("p", "scene", "dot"), add("n")]);

  it("indicate leaves the elements alone and sets the cue; highlight marks and unmarks", () => {
    const pulsed = applyOp(base, { op: "animate", id: "i1", target: "p", animation: "indicate", anchor });
    expect(pulsed.elements).toEqual(base.elements);
    expect(pulsed.cue).toEqual({ op: "i1", target: "p", animation: "indicate" });
    const on = applyOp(base, { op: "animate", id: "h1", target: "n", animation: "highlight", anchor });
    expect(on.highlighted).toEqual(["n"]);
    expect(applyOp(on, { op: "animate", id: "h2", target: "n", animation: "highlight", off: true, anchor }).highlighted).toEqual([]);
  });

  it("remove leaves the Scene and tells the Stage to fade it out", () => {
    const next = applyOp(base, { op: "remove", id: "r1", target: "p", anchor });
    expect(ids(next)).toEqual(["ax", "n"]);
    expect(next.cue).toEqual({ op: "r1", target: "p", animation: "fadeOut" });
  });

  it("move translates the element's props and keeps its place", () => {
    const next = applyOp(base, { op: "move", id: "m1", target: "p", by: [1.5, -2], anchor });
    expect(ids(next)).toEqual(["ax", "p", "n"]);
    expect(next.elements[1]).toMatchObject({ props: { at: [1.5, -2] } });
  });

  it("transform replaces the element in place", () => {
    const next = applyOp(base, { op: "transform", id: "t1", target: "n", to: add("n2"), anchor });
    expect(ids(next)).toEqual(["ax", "p", "n2"]);
    expect(next.cue).toMatchObject({ target: "n", animation: "transform" });
  });

  it("skips, with a warning, an Op that names an element that is not on the current Scene", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = foldOps([
      { op: "animate", id: "a", target: "ghost", animation: "indicate", anchor },
      { op: "remove", id: "r", target: "ghost", anchor },
      { op: "move", id: "m", target: "ghost", by: [1, 1], anchor },
      { op: "transform", id: "t", target: "ghost", to: add("x"), anchor },
    ]);
    expect(state).toEqual(EMPTY_STAGE);
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });

  it("an element of a put-aside Scene cannot be reached until it is restored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const aside = foldOps([sceneOp("s1", "new")], base);
    expect(applyOp(aside, { op: "remove", id: "r", target: "n", anchor })).toBe(aside);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Stage: the agent's shared fixtures for animations and Scenes", () => {
  it.each(["animations-1", "animations-2", "animations-3", "animations-4", "animations-5", "scenes-1", "scenes-2", "scenes-3"])(
    "%s folds without a skipped Op",
    (name) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ops = fixture(name);
      expect(ops.length).toBeGreaterThan(0);
      foldOps(ops);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    },
  );

  it("the scenes demo ends on the first Scene as it was: curve transformed, walker gone, nothing aside", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ops = fixture("scenes-demo");
    expect(foldOps(ops).elements.map((e) => e.id)).toEqual(["ax", "shifted"]);
    expect(foldOps(ops).aside).toEqual([]);

    // Halfway: the new Scene holds the formula and the kept answer note; the layer's other note is gone.
    const upToClear = ops.slice(0, ops.findIndex((o) => (o as { id: string }).id === "clear-1") + 1);
    const mid = foldOps(upToClear);
    expect(mid.elements.map((e) => [e.id, e.layer])).toEqual([["formula", "scene"], ["answer-key", "answer"]]);
    expect(mid.aside).toHaveLength(1);
    expect(mid.aside[0]!.elements.map((e) => e.id)).toEqual(["ax", "parabola", "walker"]);
    expect(mid.aside[0]!.highlighted).toEqual(["parabola"]);
    // The walker was moved to the vertex before the Scene was put aside.
    expect(mid.aside[0]!.elements[2]).toMatchObject({ props: { at: [1, -2] } });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
