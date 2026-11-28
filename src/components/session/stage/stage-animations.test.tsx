import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import { foldOps } from "@/lib/stage/stage";
import { StageItem } from "./elements";
import { FigureRegion } from "./figure-region";
import { StageMotionProvider } from "./motion-context";
import { Stage } from "./stage";

const anchor = { speech: "sp_1", char: 0 };
const note = (id: string, enter?: string) => ({
  op: "add", id, kind: "note", region: "notes", layer: "scene", props: { text: "ملاحظة" }, meaning: id, anchor,
  ...(enter ? { enter } : {}),
});
const axes = { op: "add", id: "ax", kind: "axes", region: "figure", layer: "scene", props: { xRange: [-2, 2], yRange: [-2, 2] }, meaning: "ax", anchor };
const plot = (enter?: string) => ({
  op: "add", id: "f", kind: "plot", region: "figure", layer: "scene", props: { axes: "ax", segments: [[[-2, -2], [2, 2]]] }, meaning: "f", anchor,
  ...(enter ? { enter } : {}),
});
const dot = (enter?: string) => ({
  op: "add", id: "p", kind: "dot", region: "figure", layer: "scene", props: { axes: "ax", at: [0, 0], label: "P" }, meaning: "p", anchor,
  ...(enter ? { enter } : {}),
});

function html(node: React.ReactNode, reduced: boolean) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="ar" messages={ar} timeZone="UTC">
      <StageMotionProvider reduced={reduced} rtl>
        {node}
      </StageMotionProvider>
    </NextIntlClientProvider>,
  );
}

describe("Stage: entrances run with Motion, and reduced motion shows the end state", () => {
  const element = foldOps([note("n", "fadeIn")]).elements[0]!;
  const written = foldOps([note("w", "write")]).elements[0]!;

  it("a fadeIn starts hidden and a write starts clipped along the reading direction", () => {
    expect(html(<StageItem element={element} />, false)).toMatch(/style="[^"]*opacity:0/);
    expect(html(<StageItem element={written} />, false)).toContain("clip-path:inset(0 0 0 100%)");
  });

  it("under reduced motion the same elements are drawn in their end state, with no hidden start", () => {
    for (const el of [element, written]) {
      const out = html(<StageItem element={el} />, true);
      expect(out).not.toContain("opacity:0");
      expect(out).not.toContain("clip-path");
      expect(out).not.toContain("animate-board-in");
      expect(out).toContain(`data-element-id="${el.id}"`);
    }
  });

  it("an element with no entrance keeps the default CSS entrance", () => {
    const plain = foldOps([note("p")]).elements[0]!;
    expect(html(<StageItem element={plain} />, false)).toContain("animate-board-in");
  });

  it("create draws a plot on with pathLength and pops a dot in; reduced motion draws them complete", () => {
    const state = foldOps([axes, plot("create"), dot("create")]);
    const normal = html(<FigureRegion elements={state.elements} />, false);
    expect(normal).toMatch(/<path[^>]*stroke-dasharray="0 1"/);
    expect(normal).toMatch(/<g[^>]*data-kind="dot"[^>]*style="[^"]*scale\(0\)/);
    const still = html(<FigureRegion elements={state.elements} />, true);
    expect(still).not.toContain("stroke-dasharray");
    expect(still).not.toMatch(/opacity:0|scale\(0\)/);
    expect(still).toContain('data-kind="plot"');
  });

  it("highlight draws the element emphasised, whatever the motion setting", () => {
    const state = foldOps([note("n"), { op: "animate", id: "h", target: "n", animation: "highlight", anchor }]);
    for (const reduced of [false, true]) {
      const out = html(<Stage state={state} />, reduced);
      expect(out).toContain("data-emphasis");
      expect(out).toContain("outline-warmth");
    }
  });

  it("under reduced motion the element indicated last stays emphasised; otherwise it is left to the pulse", () => {
    const state = foldOps([note("n"), { op: "animate", id: "i", target: "n", animation: "indicate", anchor }]);
    expect(html(<Stage state={state} />, true)).toContain("data-emphasis");
    expect(html(<Stage state={state} />, false)).not.toContain("data-emphasis");
  });

  it("a Scene put aside is not drawn; restoring it draws the first Scene again as it was", () => {
    const first = foldOps([note("a", "fadeIn"), note("b")]);
    const aside = foldOps([{ op: "scene", id: "s1", action: "new", anchor }, note("c")], first);
    expect(html(<Stage state={aside} />, false)).toContain('data-element-id="c"');
    expect(html(<Stage state={aside} />, false)).not.toContain('data-element-id="a"');
    const back = foldOps([{ op: "scene", id: "s2", action: "restore", anchor }], aside);
    const out = html(<Stage state={back} />, false);
    expect(out).toContain('data-element-id="a"');
    expect(out).toContain('data-element-id="b"');
    expect(out).not.toContain('data-element-id="c"');
  });
});

describe("Stage: the shared fixtures with animations render without errors", () => {
  const fixture = (name: string) =>
    readFileSync(new URL(`../../../lib/stage/__fixtures__/${name}.ops.jsonl`, import.meta.url), "utf8")
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line) as unknown);

  it.each(["animations-1", "animations-2", "animations-3", "animations-4", "scenes-1", "scenes-2", "scenes-3", "scenes-demo"])(
    "%s renders in both locales and both motion settings",
    (name) => {
      const state = foldOps(fixture(name));
      for (const reduced of [false, true])
        for (const locale of ["ar", "en"] as const)
          expect(() =>
            renderToStaticMarkup(
              <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
                <StageMotionProvider reduced={reduced} rtl={locale === "ar"}>
                  <Stage state={state} />
                </StageMotionProvider>
              </NextIntlClientProvider>,
            ),
          ).not.toThrow();
    },
  );
});
