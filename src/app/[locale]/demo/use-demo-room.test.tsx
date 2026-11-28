// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/* A stand-in for the LiveKit room: it records what the page registers and sends, and lets the
   test deliver `tutor` data packets as the agent would. */
const fake = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const state = {
    handlers: new Map<string, Handler>(),
    sent: [] as Array<{ text: string; options: unknown }>,
    sendFails: false,
  };
  class FakeRoom {
    state = "disconnected";
    localParticipant = {
      sendText: async (text: string, options: unknown) => {
        if (state.sendFails) throw new Error("closed");
        state.sent.push({ text, options });
        return { id: "s" };
      },
    };
    registerTextStreamHandler() {}
    on(event: string, handler: Handler) {
      state.handlers.set(event, handler);
      return this;
    }
    async startAudio() {}
    async connect() {
      this.state = "connected";
    }
    async disconnect() {
      this.state = "disconnected";
    }
  }
  return { state, FakeRoom };
});

vi.mock("livekit-client", () => ({
  Room: fake.FakeRoom,
  RoomEvent: { DataReceived: "dataReceived", Disconnected: "disconnected" },
  ConnectionState: { Connected: "connected" },
}));

import { useDemoRoom } from "./use-demo-room";

const deliver = (message: unknown) =>
  fake.state.handlers.get("dataReceived")?.(
    new TextEncoder().encode(JSON.stringify(message)),
    undefined,
    undefined,
    "tutor",
  );

afterEach(() => {
  fake.state.handlers.clear();
  fake.state.sent.length = 0;
  fake.state.sendFails = false;
});

async function joined() {
  const hook = renderHook(() => useDemoRoom("wss://x.example/", "token"));
  await act(async () => {
    await hook.result.current.start();
  });
  return hook;
}

describe("useDemoRoom: Student questions", () => {
  it("sends a typed question on lk.chat once joined", async () => {
    const { result } = await joined();
    let sent = false;
    await act(async () => {
      sent = await result.current.ask("ما هو الرأس؟");
    });
    expect(sent).toBe(true);
    expect(fake.state.sent).toEqual([{ text: "ما هو الرأس؟", options: { topic: "lk.chat" } }]);
  });

  it("does not send before joining the room", async () => {
    const { result } = renderHook(() => useDemoRoom("wss://x.example/", "token"));
    await act(async () => {
      expect(await result.current.ask("hello")).toBe(false);
    });
    expect(fake.state.sent).toEqual([]);
  });

  it("reports a send that failed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = await joined();
    fake.state.sendFails = true;
    await act(async () => {
      expect(await result.current.ask("hello")).toBe(false);
    });
    error.mockRestore();
  });

  it("reflects answer_started and answer_ended from the agent in the page state", async () => {
    const { result } = await joined();
    act(() => deliver({ type: "topic_started", index: 1, title: "الرأس" }));
    expect(result.current.tutor.answering).toBe(false);
    act(() => deliver({ type: "answer_started" }));
    expect(result.current.tutor.answering).toBe(true);
    expect(result.current.tutor.topic?.title).toBe("الرأس");
    act(() => deliver({ type: "answer_ended" }));
    expect(result.current.tutor.answering).toBe(false);
  });
});
