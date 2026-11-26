import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CONTRACT_VERSION, parseOpLine } from "./op";
import { createLineReader } from "./scene-lines";
import { splitLatinRuns } from "./bidi";
import { applyOp, elementsIn, EMPTY_STAGE, foldOps } from "./stage";
import { isContractMismatch, parseTutorMessage } from "./tutor-message";

const fixtureText = readFileSync(new URL("./__fixtures__/tracer.ops.jsonl", import.meta.url), "utf8");
const fixtureLines = fixtureText.trimEnd().split("\n");

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
  it("names the contract version in its header and exports the same one", () => {
    const source = readFileSync(new URL("./op.ts", import.meta.url), "utf8");
    expect(source).toMatch(/Commit: [0-9a-f]{40}/);
    expect(source).toContain(`CONTRACT_VERSION: ${CONTRACT_VERSION}`);
  });

  it("every line of the agent's shared fixture is a valid Op", () => {
    expect(fixtureLines.length).toBeGreaterThan(0);
    for (const line of fixtureLines) expect(() => parseOpLine(line)).not.toThrow();
  });
});

describe("Stage fold", () => {
  it("puts the fixture's note in the notes region, in order", () => {
    const stage = foldOps(fixtureLines.map((l) => JSON.parse(l) as unknown));
    const notes = elementsIn(stage, "notes");
    expect(notes.map((e) => e.id)).toEqual(["note-1"]);
    expect(notes[0]?.props.text).toBe("الدوال التربيعية: f(x) = ax² + bx + c");
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
  it("parses hello from bytes and flags a different contract version", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ type: "hello", contract_version: 2 }));
    const hello = parseTutorMessage(bytes);
    expect(hello).toEqual({ type: "hello", contract_version: 2 });
    expect(isContractMismatch(hello!.contract_version)).toBe(true);
    expect(isContractMismatch(CONTRACT_VERSION)).toBe(false);
    expect(parseTutorMessage("{")).toBeNull();
    expect(parseTutorMessage('{"type":"unknown"}')).toBeNull();
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
