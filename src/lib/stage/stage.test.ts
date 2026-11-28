import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CONTRACT_VERSION, parseOpLine } from "./op";
import { createLineReader } from "./scene-lines";
import { splitLatinRuns } from "./bidi";
import { buildFigure } from "./figure";
import { applyOp, elementsIn, EMPTY_STAGE, foldOps } from "./stage";
import { isContractMismatch, parseTutorMessage } from "./tutor-message";
import { applyTutorMessage, INITIAL_TUTOR, type TutorState } from "./tutor-state";

const fixtureText = readFileSync(new URL("./__fixtures__/tracer.ops.jsonl", import.meta.url), "utf8");
const fixtureLines = fixtureText.trimEnd().split("\n");
const fixtureDir = new URL("./__fixtures__/", import.meta.url);
const fixtureFiles = readdirSync(fixtureDir)
  .filter((name) => name.endsWith(".jsonl"))
  .map((name) => ({ name, lines: readFileSync(new URL(name, fixtureDir), "utf8").trimEnd().split("\n") }));
const clearFixtureLines = readFileSync(new URL("./__fixtures__/clear.ops.jsonl", import.meta.url), "utf8")
  .trimEnd()
  .split("\n");
const clearOp = (id: string, layer = "scene") => ({
  op: "clear",
  id,
  layer,
  anchor: { speech: "sp_1", char: 0 },
});

const note = (id: string, text = "ملاحظة") => ({
  op: "add",
  id,
  kind: "note",
  region: "notes",
  layer: "scene",
  props: { text },
  meaning: "m",
  anchor: { speech: "sp_1", char: 0 },
});

describe("vendored contract", () => {
  it.each(["./op.ts", "./ops/text.ts"])("%s names the agent commit and the contract version in its header", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source).toMatch(/Commit: [0-9a-f]{40}/);
    expect(source).toContain(`CONTRACT_VERSION: ${CONTRACT_VERSION}`);
  });

  it("is contract version 3", () => {
    expect(CONTRACT_VERSION).toBe(3);
  });

  it("every line of every shared fixture is a valid Op", () => {
    expect(fixtureLines.length).toBeGreaterThan(0);
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(6); // tracer, text-demo and the prompt examples
    for (const { name, lines } of fixtureFiles)
      for (const line of lines) expect(() => parseOpLine(line), name).not.toThrow();
  });
});

describe("Stage fold", () => {
  it("puts the fixture's note in the notes region, in order", () => {
    const stage = foldOps(fixtureLines.map((l) => JSON.parse(l) as unknown));
    const notes = elementsIn(stage, "notes");
    expect(notes.map((e) => e.id)).toEqual(["note-1"]);
    expect(notes[0]?.kind === "note" && notes[0].props.text).toBe("الدوال التربيعية: f(x) = ax² + bx + c");
  });

  it("puts the text demo's note on the notes region and its formula and derivation on the board", () => {
    const demo = fixtureFiles.find((f) => f.name === "text-demo.ops.jsonl")!;
    const stage = foldOps(demo.lines.map((l) => JSON.parse(l) as unknown));
    expect(elementsIn(stage, "notes").map((e) => e.kind)).toEqual(["note"]);
    expect(elementsIn(stage, "board").map((e) => e.kind)).toEqual(["tex", "derivation"]);
  });

  it("skips a tex op with an empty source, a too-long one, or a region it may not use", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tex = (id: string, props: unknown, region = "board") => ({ ...note(id), kind: "tex", region, props });
    const stage = foldOps([
      tex("a", { tex: "x^2" }),
      tex("b", { tex: "" }),
      tex("c", { tex: "x".repeat(401) }),
      tex("d", { tex: "x" }, "figure"),
      tex("e", { tex: "x", display: true }),
    ]);
    expect(stage.elements.map((e) => e.id)).toEqual(["a"]);
    warn.mockRestore();
  });

  it("keeps ops in arrival order and filters by layer", () => {
    const stage = foldOps([note("a"), { ...note("b"), layer: "answer:sp_2" }, note("c")]);
    expect(stage.elements.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(elementsIn(stage, "notes", "scene").map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("skips an invalid op with a warning and keeps going", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stage = foldOps([note("a"), { op: "add", id: "bad" }, "nonsense", null, note("b")]);
    expect(stage.elements.map((e) => e.id)).toEqual(["a", "b"]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("clear removes every element of its layer and leaves the other layers alone", () => {
    const stage = foldOps([note("a"), { ...note("b"), layer: "answer:sp_2" }, note("c"), clearOp("clear-1")]);
    expect(stage.elements.map((e) => e.id)).toEqual(["b"]);
    // Elements added after a clear show again, and ids of cleared elements are free to reuse.
    const again = foldOps([note("d"), note("a")], stage);
    expect(again.elements.map((e) => e.id)).toEqual(["b", "d", "a"]);
  });

  it("clear of the scene layer also clears figure and board elements, and the figure view is empty", () => {
    const read = (name: string) =>
      readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8")
        .trimEnd()
        .split("\n")
        .map((l) => JSON.parse(l) as unknown);
    const drawn = foldOps([...read("figure-demo.ops.jsonl"), ...read("text-demo.ops.jsonl")]);
    expect(new Set(drawn.elements.map((e) => e.region))).toEqual(new Set(["figure", "notes", "board"]));
    const cleared = foldOps([clearOp("clear-9")], drawn);
    expect(cleared.elements).toEqual([]);
    expect(buildFigure(cleared.elements).panels).toEqual([]);
    // Only the cleared layer goes: an answer layer drawn on the figure survives a scene clear.
    const answer = foldOps([{ ...read("figure-demo.ops.jsonl")[0] as object, id: "ax-a", layer: "answer:sp_2" }], drawn);
    expect(foldOps([clearOp("clear-10")], answer).elements.map((e) => e.id)).toEqual(["ax-a"]);
  });

  it("a clear of an empty or unknown layer returns the state unchanged", () => {
    const stage = foldOps([note("a")]);
    expect(applyOp(stage, clearOp("clear-1", "nowhere"))).toBe(stage);
    expect(applyOp(EMPTY_STAGE, clearOp("clear-2"))).toBe(EMPTY_STAGE);
  });

  it("the agent's clear fixture ends with only the note written after the clear", () => {
    const stage = foldOps(clearFixtureLines.map((l) => JSON.parse(l) as unknown));
    expect(stage.elements.map((e) => e.id)).toEqual(["second"]);
    // Midway, before the clear, the first note was on the Stage.
    const before = foldOps(clearFixtureLines.slice(0, 1).map((l) => JSON.parse(l) as unknown));
    expect(before.elements.map((e) => e.id)).toEqual(["first"]);
  });

  it("skips an invalid clear with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const stage = foldOps([note("a")]);
    expect(applyOp(stage, { op: "clear", layer: "scene" })).toBe(stage);
    expect(applyOp(stage, { ...clearOp("c"), region: "notes" })).toBe(stage);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("skips a duplicate id and rejects unknown fields", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const once = applyOp(EMPTY_STAGE, note("a"));
    expect(applyOp(once, note("a", "ثانية"))).toBe(once);
    expect(applyOp(once, { ...note("b"), left: 10 })).toBe(once);
    warn.mockRestore();
  });
});

describe("scene line reader", () => {
  it("gives the same values wherever the chunks split a line", () => {
    const text = fixtureText + fixtureText.replace(/note-1/g, "note-2");
    const whole: unknown[] = [];
    const a = createLineReader((v) => whole.push(v));
    a.push(text);
    a.end();
    for (let i = 0; i <= text.length; i += 7) {
      const got: unknown[] = [];
      const reader = createLineReader((v) => got.push(v));
      reader.push(text.slice(0, i));
      reader.push(text.slice(i));
      reader.end();
      expect(got).toEqual(whole);
    }
    expect(whole).toHaveLength(2);
  });

  it("skips a line that is not JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const got: unknown[] = [];
    const reader = createLineReader((v) => got.push(v));
    reader.push('oops\n{"a":1}\n');
    expect(got).toEqual([{ a: 1 }]);
    warn.mockRestore();
  });
});

describe("tutor messages", () => {
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

  it("parses hello from bytes and flags a different contract version", () => {
    const hello = parseTutorMessage(bytes({ type: "hello", contract_version: 2 }));
    expect(hello).toEqual({ type: "hello", contract_version: 2 });
    expect(isContractMismatch(2)).toBe(true);
    expect(isContractMismatch(CONTRACT_VERSION)).toBe(false);
    expect(parseTutorMessage("{")).toBeNull();
    expect(parseTutorMessage('{"type":"unknown"}')).toBeNull();
  });

  it("parses lesson_started, topic_started and session_ending", () => {
    expect(parseTutorMessage(bytes({ type: "lesson_started", index: 1, title: "الدرس الأول" }))).toEqual({
      type: "lesson_started",
      index: 1,
      title: "الدرس الأول",
    });
    expect(parseTutorMessage(JSON.stringify({ type: "topic_started", index: 2, title: "الرأس" }))).toEqual({
      type: "topic_started",
      index: 2,
      title: "الرأس",
    });
    expect(parseTutorMessage(bytes({ type: "session_ending" }))).toEqual({ type: "session_ending" });
  });

  it("ignores messages whose fields are wrong", () => {
    expect(parseTutorMessage(bytes({ type: "lesson_started", index: 0, title: "x" }))).toBeNull();
    expect(parseTutorMessage(bytes({ type: "topic_started", index: 1 }))).toBeNull();
    expect(parseTutorMessage(bytes({ type: "topic_started", index: 1, title: "" }))).toBeNull();
    expect(parseTutorMessage(bytes({ type: "hello" }))).toBeNull();
  });
});

describe("tutor state from tutor events", () => {
  const play = (messages: unknown[], from: TutorState = INITIAL_TUTOR) =>
    messages.reduce<TutorState>((state, m) => {
      const parsed = parseTutorMessage(JSON.stringify(m));
      return parsed ? applyTutorMessage(state, parsed) : state;
    }, from);

  it("follows the Lesson and the Topic as the agent moves on", () => {
    let state = play([{ type: "hello", contract_version: 2 }]);
    expect(state).toEqual({ ...INITIAL_TUTOR, agentVersion: 2 });
    state = play([{ type: "lesson_started", index: 1, title: "الدرس الأول" }], state);
    expect(state.lesson).toEqual({ index: 1, title: "الدرس الأول" });
    expect(state.topic).toBeNull(); // planned, not started
    state = play([{ type: "topic_started", index: 1, title: "الرأس" }], state);
    expect(state.topic).toEqual({ index: 1, title: "الرأس" });
    state = play([{ type: "topic_started", index: 2, title: "المحور" }], state);
    expect(state.topic).toEqual({ index: 2, title: "المحور" });
  });

  it("a new Lesson clears the Topic of the previous one", () => {
    const state = play([
      { type: "lesson_started", index: 1, title: "أ" },
      { type: "topic_started", index: 2, title: "ب" },
      { type: "lesson_started", index: 2, title: "ج" },
    ]);
    expect(state.lesson).toEqual({ index: 2, title: "ج" });
    expect(state.topic).toBeNull();
  });

  it("session_ending marks the end and keeps the last titles; junk changes nothing", () => {
    const before = play([
      { type: "lesson_started", index: 2, title: "ج" },
      { type: "topic_started", index: 1, title: "د" },
    ]);
    const after = play([{ type: "session_ending" }, { type: "nonsense" }, "x"], before);
    expect(after).toEqual({ ...before, ending: true });
    expect(before.ending).toBe(false);
  });
});

describe("Latin runs inside Arabic", () => {
  it("isolates equations and numbers, leaving Arabic and sentence punctuation outside", () => {
    expect(splitLatinRuns("الدوال التربيعية: f(x) = ax² + bx + c")).toEqual([
      { text: "الدوال التربيعية: ", ltr: false },
      { text: "f(x) = ax² + bx + c", ltr: true },
    ]);
    expect(splitLatinRuns("الرأس عند x = 1.")).toEqual([
      { text: "الرأس عند ", ltr: false },
      { text: "x = 1", ltr: true },
      { text: ".", ltr: false },
    ]);
    expect(splitLatinRuns("نص عربي فقط")).toEqual([{ text: "نص عربي فقط", ltr: false }]);
  });
});
