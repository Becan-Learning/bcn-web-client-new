import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import { foldOps } from "@/lib/stage/stage";
import { Stage } from "./stage";

const dir = new URL("../../../lib/stage/__fixtures__/", import.meta.url);
const fixtures = readdirSync(dir)
  .filter((f) => /^(figure-\d+|figure-demo)\.ops\.jsonl$/.test(f))
  .sort()
  .map((name) => ({
    name,
    ops: readFileSync(new URL(name, dir), "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as { id: string; kind: string; region: string }),
  }));

function render(locale: "ar" | "en", ops: unknown[]) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
      <Stage state={foldOps(ops)} />
    </NextIntlClientProvider>,
  );
}

describe("Stage rendering the agent's figure fixtures", () => {
  it("has the worked examples and the parabola demo", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(5);
  });

  for (const { name, ops } of fixtures) {
    describe(name, () => {
      for (const locale of ["ar", "en"] as const) {
        it(`draws every element in the figure region (${locale})`, () => {
          const html = render(locale, ops);
          expect(html).toContain('data-region="figure"');
          expect(html).not.toContain("data-stage-empty");
          for (const op of ops) {
            if (op.kind === "axes") expect(html).toContain(`data-axes-id="${op.id}"`);
            else expect(html, op.id).toContain(`data-element-id="${op.id}"`);
          }
        });

        it(`uses tokens, logical directions and Western digits only (${locale})`, () => {
          const html = render(locale, ops);
          expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
          expect(html).not.toMatch(/\b(ml|mr|pl|pr)-\d|\b(left|right)-\d|text-(left|right)/);
          expect(html).not.toMatch(/[٠-٩۰-۹]/);
          expect(html.match(/<section[^>]*>/)?.[0]).not.toContain("dir=");
          // Colors come from role classes (tokens) and currentColor, nothing else.
          for (const [, value] of html.matchAll(/ (?:stroke|fill)="([^"]*)"/g)) {
            expect(["currentColor", "none"], value).toContain(value);
          }
        });
      }
    });
  }
});

describe("Stage rendering the parabola demo", () => {
  const parabola = fixtures.find((f) => f.name === "figure-demo.ops.jsonl")!.ops;

  it("plots the curve, marks the vertex with its label isolated left-to-right, and dashes the axis", () => {
    const html = render("ar", parabola);
    expect(html).toMatch(/data-element-id="parabola"[^>]*>.*?<path d="M[^"]+"/);
    expect(html).toContain('data-element-id="vertex"');
    expect(html).toMatch(/<tspan style="[^"]*direction:ltr[^"]*">\(1, -2\)<\/tspan>/);
    expect(html).toMatch(/data-element-id="symmetry"[^>]*>.*?stroke-dasharray="6 5"/);
  });

  it("writes tick numbers in Western digits, with a minus sign", () => {
    const html = render("ar", parabola);
    expect(html).toContain(">−2<");
    expect(html).toContain(">4<");
  });

  it("fades elements in with the shared CSS entrance, with no JavaScript animation", () => {
    expect(render("ar", parabola)).toContain("animate-board-in");
  });
});

describe("the figure region and robustness", () => {
  it("skips an invalid figure Op, including a pixel position or an unknown kind, without breaking the Stage", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ops = fixtures.find((f) => f.name === "figure-demo.ops.jsonl")!.ops;
    const html = render("ar", [
      ops[0],
      { op: "add", id: "px", kind: "dot", region: "figure", layer: "scene", props: { axes: "ax", at: [1, 1], left: 40 }, meaning: "m", anchor: { speech: "s", char: 0 } },
      { op: "add", id: "hex", kind: "hexagon", region: "figure", layer: "scene", props: {}, meaning: "m", anchor: { speech: "s", char: 0 } },
      ...ops.slice(1),
    ]);
    expect(html).toContain('data-element-id="vertex"');
    expect(html).not.toContain('data-element-id="px"');
    expect(html).not.toContain('data-element-id="hex"');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("draws nothing for an element whose axes never arrived", () => {
    const html = render("ar", [
      { op: "add", id: "d", kind: "dot", region: "figure", layer: "scene", props: { axes: "ghost", at: [1, 1] }, meaning: "m", anchor: { speech: "s", char: 0 } },
    ]);
    expect(html).not.toContain('data-element-id="d"');
  });
});
