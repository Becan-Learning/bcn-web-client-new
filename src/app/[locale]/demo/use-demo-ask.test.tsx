// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "livekit-client";
import { CONTRACT_VERSION } from "@/lib/stage/op";
import { INITIAL_TUTOR, type TutorState } from "@/lib/stage/tutor-state";
import { useDemoAsk } from "./use-demo-ask";

vi.mock("livekit-client", () => ({ ParticipantKind: { AGENT: "agent", STANDARD: "standard" } }));

/* The same approach as student-question.test.ts: a stand-in participant records the RPCs and the
   microphone gate, so the order (start_turn, then the mic opens; the mic closes, then end_turn) is
   observable. */
function fakeRoom() {
  const calls: string[] = [];
  const performRpc = vi.fn(async ({ method, destinationIdentity }: { method: string; destinationIdentity: string }) => {
    calls.push(`${method}@${destinationIdentity}`);
    return "";
  });
  const setMicrophoneEnabled = vi.fn(async (enabled: boolean) => {
    calls.push(`mic:${enabled ? "open" : "muted"}`);
    return undefined;
  });
  const room = {
    localParticipant: { performRpc, setMicrophoneEnabled },
    remoteParticipants: new Map([
      ["student", { identity: "student", kind: "standard" }],
      ["tutor-agent", { identity: "tutor-agent", kind: "agent" }],
    ]),
  } as unknown as Room;
  return { room, calls };
}

const tutorAt = (state: Partial<TutorState> = {}): TutorState => ({
  ...INITIAL_TUTOR,
  agentVersion: CONTRACT_VERSION,
  ...state,
});

type Inputs = Parameters<typeof useDemoAsk>[0];

function setup(overrides: Partial<Inputs> = {}) {
  const { room, calls } = fakeRoom();
  const initial: Inputs = {
    room,
    phase: "live",
    tutor: tutorAt(),
    microphone: null,
    micPublished: true,
    micUnavailable: false,
    shortcuts: true,
    ...overrides,
  };
  const hook = renderHook((props: Inputs) => useDemoAsk(props), { initialProps: initial });
  return { ...hook, calls, room, initial };
}

const press = (init: KeyboardEventInit) => act(async () => void window.dispatchEvent(new KeyboardEvent("keydown", init)));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Ask on the demo page", () => {
  it("opens a Student question: start_turn to the agent, and only then the microphone", async () => {
    const { result, calls } = setup();
    expect(result.current.canAsk).toBe(true);
    await act(async () => result.current.onAsk());
    expect(calls).toEqual(["start_turn@tutor-agent", "mic:open"]); // never the student's own identity
    expect(result.current.startedAt).not.toBeNull();
    expect(result.current.canAsk).toBe(false);
  });

  it("Send mutes the microphone before it calls end_turn", async () => {
    const { result, calls } = setup();
    await act(async () => result.current.onAsk());
    calls.length = 0;
    await act(async () => result.current.onSend());
    expect(calls).toEqual(["mic:muted", "end_turn@tutor-agent"]);
    expect(result.current.startedAt).toBeNull();
    expect(result.current.canAsk).toBe(true);
  });

  it("Cancel mutes the microphone and calls cancel_turn", async () => {
    const { result, calls } = setup();
    await act(async () => result.current.onAsk());
    calls.length = 0;
    await act(async () => result.current.onCancel());
    expect(calls).toEqual(["mic:muted", "cancel_turn@tutor-agent"]);
  });

  it("cancels by itself after 8 seconds without speech and says so", async () => {
    const { result, calls } = setup();
    await act(async () => result.current.onAsk());
    calls.length = 0;
    await act(async () => void vi.advanceTimersByTimeAsync(8_000));
    expect(calls).toEqual(["mic:muted", "cancel_turn@tutor-agent"]);
    expect(result.current.noSpeech).toBe(true);
    await act(async () => void vi.advanceTimersByTimeAsync(3_000));
    expect(result.current.noSpeech).toBe(false);
  });

  it("does not cancel for silence once speech was detected, and sends at the 60 second cap", async () => {
    const { result, calls } = setup();
    await act(async () => result.current.onAsk());
    act(() => result.current.onSpeech());
    calls.length = 0;
    await act(async () => void vi.advanceTimersByTimeAsync(30_000));
    expect(calls).toEqual([]);
    await act(async () => void vi.advanceTimersByTimeAsync(30_000));
    expect(calls).toEqual(["mic:muted", "end_turn@tutor-agent"]);
    expect(result.current.noSpeech).toBe(false);
  });

  it.each([
    ["before the tutor said hello", { tutor: INITIAL_TUTOR }],
    ["without a published microphone", { micPublished: false }],
    ["when the microphone is unavailable", { micUnavailable: true }],
    ["before the session is live", { phase: "connecting" as const }],
    ["once the tutor is ending the session", { tutor: tutorAt({ ending: true }) }],
  ])("cannot ask %s", async (_name, overrides) => {
    const { result, calls } = setup(overrides);
    expect(result.current.canAsk).toBe(false);
    await act(async () => result.current.onAsk());
    expect(calls).toEqual([]);
  });

  it("closes an open question when the session ends, so the microphone is not left open", async () => {
    const { result, rerender, calls, initial } = setup();
    await act(async () => result.current.onAsk());
    calls.length = 0;
    await act(async () => rerender({ ...initial, tutor: tutorAt({ ending: true }) }));
    expect(calls).toEqual(["mic:muted", "cancel_turn@tutor-agent"]);
    expect(result.current.startedAt).toBeNull();
  });
});

describe("the existing shortcuts", () => {
  it("Space asks, Space again sends, Escape cancels", async () => {
    const { result, calls } = setup();
    await press({ code: "Space", key: " " });
    expect(calls).toEqual(["start_turn@tutor-agent", "mic:open"]);
    expect(result.current.startedAt).not.toBeNull();
    calls.length = 0;
    await press({ code: "Space", key: " " });
    expect(calls).toEqual(["mic:muted", "end_turn@tutor-agent"]);

    await press({ code: "Space", key: " " });
    calls.length = 0;
    await press({ key: "Escape", code: "Escape" });
    expect(calls).toEqual(["mic:muted", "cancel_turn@tutor-agent"]);
  });

  it("are ignored while typing in a field and when they are switched off", async () => {
    const { calls } = setup();
    const input = document.createElement("input");
    document.body.append(input);
    await act(async () => void input.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })));
    expect(calls).toEqual([]);
    input.remove();

    const off = setup({ shortcuts: false });
    await press({ code: "Space", key: " " });
    expect(off.calls).toEqual([]);
  });
});
