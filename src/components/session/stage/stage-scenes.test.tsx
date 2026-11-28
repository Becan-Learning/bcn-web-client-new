// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ar from "../../../../messages/ar.json";
import { foldOps, type StageState } from "@/lib/stage/stage";
import { StageMotionProvider } from "./motion-context";
import { Stage } from "./stage";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const anchor = { speech: "sp_1", char: 0 };
const note = (id: string, enter?: string) => ({
  op: "add", id, kind: "note", region: "notes", layer: "scene", props: { text: "ملاحظة" }, meaning: id, anchor,
  ...(enter ? { enter } : {}),
});
const sceneOp = (id: string, action: "new" | "restore") => ({ op: "scene", id, action, anchor });

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no matchMedia; the provider decides the motion setting, the hook only has to exist.
  window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

function show(state: StageState) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="ar" messages={ar} timeZone="UTC">
        <StageMotionProvider reduced={false} rtl>
          <Stage state={state} />
        </StageMotionProvider>
      </NextIntlClientProvider>,
    ),
  );
}
const ids = () => [...host.querySelectorAll("[data-element-id]")].map((e) => e.getAttribute("data-element-id"));
const style = (id: string) => host.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!.getAttribute("style") ?? "";

describe("Stage: Scenes put aside and restored, as the student sees them", () => {
  it("the Scene put aside disappears at once, and comes back as it was, with no entrance replayed", () => {
    const first = foldOps([note("a", "fadeIn"), note("b", "write")]);
    show(first);
    expect(ids()).toEqual(["a", "b"]);

    const aside = foldOps([sceneOp("s1", "new"), note("c")], first);
    show(aside);
    expect(ids()).toEqual(["c"]);

    const back = foldOps([sceneOp("s2", "restore")], aside);
    show(back);
    expect(ids()).toEqual(["a", "b"]);
    expect(style("a")).not.toContain("opacity: 0");
    expect(style("b")).not.toContain("clip-path");
  });

  it("clearing a layer removes its elements at once and keeps the kept ones", async () => {
    const drawn = foldOps([
      note("keep"),
      { ...note("lose"), layer: "answer" },
      { ...note("kept-answer"), layer: "answer" },
    ]);
    show(drawn);
    const cleared = foldOps([{ op: "clear", id: "c1", layer: "answer", keep: ["kept-answer"], anchor }], drawn);
    show(cleared);
    // An element that leaves without a fade is dropped as soon as Motion has seen it go.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(ids()).toEqual(["keep", "kept-answer"]);
  });
});
