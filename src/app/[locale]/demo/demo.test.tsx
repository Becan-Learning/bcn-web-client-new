import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "../../../../messages/ar.json";
import en from "../../../../messages/en.json";
import { CONTRACT_VERSION } from "@/lib/stage/op";
import { EMPTY_STAGE, foldOps } from "@/lib/stage/stage";
import { firstParam, isDemoAvailable, parseServerUrl } from "./availability";
import { DemoView, type DemoViewProps } from "./demo-view";
import DemoPage from "./page";

/* next-intl/server needs the Next runtime; the not-found check runs before it is used. */
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(), setRequestLocale: vi.fn() }));
vi.mock("./demo-session", () => ({ DemoSession: () => null }));
vi.mock("@/i18n/routing", () => ({ routing: { locales: ["ar", "en"] } }));

const fixture = readFileSync(
  new URL("../../../lib/stage/__fixtures__/tracer.ops.jsonl", import.meta.url),
  "utf8",
)
  .trimEnd()
  .split("\n")
  .map((line) => JSON.parse(line) as unknown);

function view(props: Partial<DemoViewProps> = {}, locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
      <DemoView
        phase="idle"
        stage={EMPTY_STAGE}
        agentVersion={null}
        missingParams={false}
        onStart={() => {}}
        onEnd={() => {}}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("demo route availability", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is available in development and in production only with the flag", () => {
    expect(isDemoAvailable("development", undefined)).toBe(true);
    expect(isDemoAvailable("production", undefined)).toBe(false);
    expect(isDemoAvailable("production", "0")).toBe(false);
    expect(isDemoAvailable("production", "1")).toBe(true);
  });

  it("the page is not found in production without the flag", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO", "");
    const props = { params: Promise.resolve({ locale: "ar" }), searchParams: Promise.resolve({}) };
    await expect(DemoPage(props as never)).rejects.toMatchObject({
      digest: expect.stringContaining("404") as unknown,
    });
  });
});

describe("demo link parameters", () => {
  it("takes the first value and only accepts websocket server URLs", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam("")).toBeUndefined();
    expect(parseServerUrl("wss://x.livekit.cloud")).toBe("wss://x.livekit.cloud/");
    expect(parseServerUrl("https://x.livekit.cloud")).toBeUndefined();
    expect(parseServerUrl("not a url")).toBeUndefined();
    expect(parseServerUrl(undefined)).toBeUndefined();
  });
});

describe("DemoView", () => {
  it("offers Start as the one primary button before joining, in both locales", () => {
    for (const [locale, messages] of [["ar", ar], ["en", en]] as const) {
      const html = view({}, locale);
      expect(html).toContain(messages.Demo.start);
      expect(html.match(/bg-pressable/g)).toHaveLength(1);
      expect(html).not.toContain(`>${messages.Demo.end}<`);
    }
  });

  it("offers End while live, shows the Stage with the note, and no mismatch notice on a match", () => {
    const html = view({ phase: "live", agentVersion: CONTRACT_VERSION, stage: foldOps(fixture) });
    expect(html).toContain(`>${en.Demo.end}<`);
    expect(html).not.toContain(`>${en.Demo.start}<`);
    expect(html).toContain('data-element-id="note-1"');
    expect(html).not.toContain("data-contract-mismatch");
  });

  it("shows a visible notice when the agent's contract version differs", () => {
    const html = view({ phase: "live", agentVersion: CONTRACT_VERSION + 1 });
    expect(html).toContain("data-contract-mismatch");
    expect(html).toContain('role="alert"');
    expect(html).toContain(`(${CONTRACT_VERSION + 1})`);
    expect(view({ phase: "live", agentVersion: CONTRACT_VERSION + 1 }, "ar")).toContain("data-contract-mismatch");
  });

  it("waits for hello before claiming anything, and explains a link without a token", () => {
    expect(view({ phase: "live" })).toContain(en.Demo.waiting);
    const html = view({ missingParams: true });
    expect(html).toContain(en.Demo.missingParams);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
  });

  it("uses tokens and logical directions only", () => {
    const html = view({ phase: "live", agentVersion: 9, stage: foldOps(fixture) }, "ar");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
    expect(html).not.toMatch(/\b(ml|mr|pl|pr)-\d|\b(left|right)-\d|text-(left|right)/);
    expect(html).not.toMatch(/ dir="(rtl)"/);
  });
});
