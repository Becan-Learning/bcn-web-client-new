import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import { EMPTY_STAGE, foldOps } from "@/lib/stage/stage";
import { Stage } from "./stage";

const fixture = readFileSync(
  new URL("../../../lib/stage/__fixtures__/tracer.ops.jsonl", import.meta.url),
  "utf8",
)
  .trimEnd()
  .split("\n")
  .map((line) => JSON.parse(line) as unknown);

const fixtureDir = new URL("../../../lib/stage/__fixtures__/", import.meta.url);
const fixtures = Object.fromEntries(
  readdirSync(fixtureDir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => [
      name,
      readFileSync(new URL(name, fixtureDir), "utf8").trimEnd().split("\n").map((line) => JSON.parse(line) as unknown),
    ]),
);

function render(locale: "ar" | "en", ops: unknown[]) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
      <Stage state={foldOps(ops)} />
    </NextIntlClientProvider>,
  );
}

describe("Stage rendering the agent's shared fixture", () => {
  it("shows the note in the notes region, with the equation isolated left-to-right", () => {
    const html = render("ar", fixture);
    expect(html).toContain('data-region="notes"');
    expect(html).toContain('data-element-id="note-1"');
    expect(html).toContain("الدوال التربيعية: ");
    expect(html).toMatch(/<span dir="ltr"[^>]*>f\(x\) = ax² \+ bx \+ c<\/span>/);
  });

  it("is empty before any Op arrives, in both locales", () => {
    expect(render("ar", [])).toContain(ar.Demo.stage.empty);
    expect(render("en", [])).toContain(en.Demo.stage.empty);
    expect(renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC"><Stage state={EMPTY_STAGE} /></NextIntlClientProvider>,
    )).not.toContain("data-element-id");
  });

  it("uses tokens and logical directions only, and does not hard-code a direction on its wrapper", () => {
    const html = render("ar", fixture);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    expect(html).not.toMatch(/\b(ml|mr|pl|pr)-\d|\b(left|right)-\d|text-(left|right)/);
    expect(html.match(/<section[^>]*>/)?.[0]).not.toContain("dir=");
  });

  it("skips an invalid op without breaking the Stage", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = render("ar", [{ op: "add", id: "x" }, ...fixture]);
    expect(html).toContain('data-element-id="note-1"');
    warn.mockRestore();
  });

  it("renders a number in Arabic text with Western digits even when the agent sent Arabic-Indic ones", () => {
    const html = render("ar", [{ ...note("n"), props: { text: "العدد ٣٤ و x = ٢" } }]);
    expect(html).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
    expect(html).toMatch(/<span dir="ltr"[^>]*>34<\/span>/);
  });
});

function note(id: string) {
  return {
    op: "add", id, kind: "note", region: "notes", layer: "scene", props: { text: "ملاحظة" },
    meaning: "m", anchor: { speech: "sp_1", char: 0 },
  };
}

describe("every shared fixture renders on the Stage", () => {
  it("covers the tracer, the text demo and the prompt examples", () => {
    expect(Object.keys(fixtures)).toEqual(expect.arrayContaining(["tracer.ops.jsonl", "text-demo.ops.jsonl", "text-1.ops.jsonl"]));
  });

  for (const [name, ops] of Object.entries(fixtures)) {
    it(`${name}: every element appears, in either locale, with no warnings and no hard-coded colors or sides`, () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      for (const locale of ["ar", "en"] as const) {
        const html = render(locale, ops);
        // A `clear` in the fixture removes what was drawn before it: only the survivors show.
        const survivors = foldOps(ops).elements;
        const survivorIds = new Set(survivors.map((e) => e.id));
        for (const op of survivors) {
          expect(html, `${locale} ${op.id}`).toContain(`data-element-id="${op.id}"`);
          expect(html).toContain(`data-kind="${op.kind}"`);
        }
        for (const op of ops as Array<{ op: string; id: string }>)
          if (op.op === "add" && !survivorIds.has(op.id)) expect(html).not.toContain(`data-element-id="${op.id}"`);
        expect(html).not.toContain("data-tex-error"); // every fixture formula parses in KaTeX
        expect(html).not.toMatch(/\b(ml|mr|pl|pr)-\d|\b(left|right)-\d|text-(left|right)/);
        expect(html).not.toMatch(/style="[^"]*(color|#[0-9a-fA-F]{3,8}|rgb\()/);
        // No layout wrapper carries a direction; only Latin runs and math blocks do.
        for (const tag of html.match(/<(section|ul|ol|div|li|h2)\b[^>]*>/g) ?? []) {
          if (tag.startsWith("<ol") && tag.includes("data-derivation")) continue; // a math block
          expect(tag, tag).not.toContain("dir=");
        }
      }
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  }
});

describe("board and notes regions", () => {
  const demo = fixtures["text-demo.ops.jsonl"]!;
  const html = render("ar", demo);

  it("puts the formula and the derivation on the board and the note in the notes, in that order", () => {
    const board = /<ul data-region="board"[\s\S]*?<\/ul>(?=<\/div>)/.exec(html)?.[0] ?? "";
    expect(board.indexOf('data-element-id="formula"')).toBeGreaterThan(-1);
    expect(board.indexOf('data-element-id="formula"')).toBeLessThan(board.indexOf('data-element-id="steps"'));
    expect(board).not.toContain('data-element-id="problem"');
    const notes = html.slice(html.indexOf('data-region="notes"'));
    expect(notes).toContain('data-element-id="problem"');
  });

  it("renders the formula with KaTeX, left-to-right and isolated, and the Arabic note with isolated Latin runs", () => {
    expect(html).toMatch(/<span dir="ltr" data-math[^>]*><span class="katex">/);
    expect(html).toMatch(/<span dir="ltr"[^>]*>x<\/span>/);
    expect(html).toMatch(/<span dir="ltr"[^>]*>x² − 4 = 0<\/span>/);
    expect(html).toContain('data-tone="key"');
    expect(html).toContain(ar.Demo.stage.tone.key);
  });

  it("lays the derivation out as three aligned steps with their Arabic comments", () => {
    const steps = html.match(/data-step="\d"/g);
    expect(steps).toEqual(['data-step="1"', 'data-step="2"', 'data-step="3"']);
    expect(html).toContain("نحلل فرق مربعين");
    // Each step has its left side and its relation-and-right side in separate cells.
    expect(html.match(/col-start-2 min-w-0 justify-self-end/g)).toHaveLength(3);
    expect(html.match(/col-start-3 min-w-0 justify-self-start/g)).toHaveLength(3);
  });

  it("shows a formula that does not parse as its source, not as an error", () => {
    const bad = { ...note("bad"), kind: "tex", region: "board", props: { tex: "\\frac{1}{" } };
    const out = render("en", [bad]);
    expect(out).toContain("data-tex-error");
    expect(out).not.toContain("katex-error");
  });

  it("does not execute or link anything from a formula (trust is off)", () => {
    const evil = { ...note("evil"), kind: "tex", region: "board", props: { tex: "\\href{javascript:alert(1)}{x} \\includegraphics{a.png}" } };
    const out = render("en", [evil]);
    expect(out).toContain("data-tex-error"); // shown as source, never rendered
    expect(out).not.toContain("href=");
    expect(out).not.toContain("<a ");
    expect(out).not.toMatch(/cc0000/i);
    expect(out).not.toContain("<img");
  });

  it("draws only the regions that have elements, and lays them out in the three slots", () => {
    const onlyNotes = render("en", fixtures["tracer.ops.jsonl"]!);
    expect(onlyNotes).toContain('data-slot="notes"');
    expect(onlyNotes).not.toContain('data-slot="board"');
    expect(onlyNotes).not.toContain('data-slot="figure"'); // empty until the figure region lands
    expect(html).toContain('data-slot="board"');
    expect(html).toContain('data-slot="notes"');
  });
});
