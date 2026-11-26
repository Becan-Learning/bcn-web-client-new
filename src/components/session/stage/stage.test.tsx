import { readFileSync } from "node:fs";
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
});
