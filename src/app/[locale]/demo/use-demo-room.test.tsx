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
    micDenied: false,
    publishFails: false,
    log: [] as string[],
  };
  class FakeRoom {
    state = "disconnected";
    localParticipant = {
      publishTrack: async (track: { name: string }, options: unknown) => {
        if (state.publishFails) throw new Error("no");
        state.log.push(`publish:${track.name}:${JSON.stringify(options)}`);
        return { trackSid: "TR_1" };
      },
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
      state.log.push("connect");
      this.state = "connected";
    }
    async disconnect() {
      this.state = "disconnected";
    }
  }
  const createLocalAudioTrack = async () => {
    if (state.micDenied) throw new Error("denied");
    state.log.push("capture");
    return {
      name: "mic",
      mute: async () => void state.log.push("mute"),
      stop: () => void state.log.push("stop"),
    };
  };
  return { state, FakeRoom, createLocalAudioTrack };
});

vi.mock("livekit-client", () => ({
  Room: fake.FakeRoom,
  RoomEvent: { DataReceived: "dataReceived", Disconnected: "disconnected" },
  ConnectionState: { Connected: "connected" },
  Track: { Source: { Microphone: "microphone" } },
  createLocalAudioTrack: fake.createLocalAudioTrack,
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
  fake.state.micDenied = false;
  fake.state.publishFails = false;
  fake.state.log.length = 0;
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


describe("useDemoRoom: the microphone", () => {
  it("is captured and muted before it is published, and published as the microphone", async () => {
    const { result } = await joined();
    const log = fake.state.log;
    expect(log.indexOf("mute")).toBeGreaterThan(log.indexOf("capture"));
    const published = log.findIndex((entry) => entry.startsWith("publish:"));
    expect(published).toBeGreaterThan(log.indexOf("mute")); // never audible, not even briefly
    expect(log[published]).toContain('"source":"microphone"');
    expect(log[published]).toContain('"stopMicTrackOnMute":false'); // muting keeps the track published
    expect(result.current.micPublished).toBe(true);
    expect(result.current.micUnavailable).toBe(false);
    expect(result.current.microphone?.source).toBe("microphone");
  });

  it("a denied microphone leaves typing available and says the microphone is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.state.micDenied = true;
    const { result } = await joined();
    expect(result.current.phase).toBe("live");
    expect(result.current.micUnavailable).toBe(true);
    expect(result.current.micPublished).toBe(false);
    warn.mockRestore();
  });

  it("a microphone that cannot be published is stopped and reported unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.state.publishFails = true;
    const { result } = await joined();
    expect(fake.state.log).toContain("stop");
    expect(result.current.micUnavailable).toBe(true);
    warn.mockRestore();
  });
});
