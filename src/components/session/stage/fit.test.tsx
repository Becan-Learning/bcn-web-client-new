// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIN_FIT } from "@/lib/stage/fit";
import { Fit } from "./fit";

/* jsdom has no layout, so the widths the component reads are stubbed per test. */

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let natural = 0;
let available = 0;
const original = {
  scroll: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth"),
  client: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => natural });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => available });
});

afterEach(() => {
  for (const [name, d] of [["scrollWidth", original.scroll], ["clientWidth", original.client]] as const) {
    if (d) Object.defineProperty(HTMLElement.prototype, name, d);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
  }
  document.body.innerHTML = "";
});

function mount(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<Fit>content</Fit>));
  return host.querySelector<HTMLElement>("[data-fit]")!;
}

describe("Fit", () => {
  it("keeps content that fits at full size", () => {
    natural = 300;
    available = 400;
    const el = mount();
    expect(el.style.getPropertyValue("--fit")).toBe("1");
    expect(el.hasAttribute("data-wrap")).toBe(false);
  });

  it("shrinks content that is too wide, down to the minimum", () => {
    natural = 500;
    available = 400;
    const el = mount();
    expect(el.style.getPropertyValue("--fit")).toBe("0.8");
    expect(el.hasAttribute("data-wrap")).toBe(false);
  });

  it("wraps content that would need to shrink past the minimum, at the minimum size", () => {
    natural = 2000;
    available = 390;
    const el = mount();
    expect(el.style.getPropertyValue("--fit")).toBe(String(MIN_FIT));
    expect(el.getAttribute("data-wrap")).toBe("true");
  });
});
