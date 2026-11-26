"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { createLineReader } from "@/lib/stage/scene-lines";
import { applyOp, EMPTY_STAGE } from "@/lib/stage/stage";
import { parseTutorMessage } from "@/lib/stage/tutor-message";
import { SCENE_TOPIC, TUTOR_TOPIC } from "./topics";

export type DemoPhase = "idle" | "connecting" | "live" | "ended" | "error";

/* الغرفة بلا خادم خلفي: الرمز والعنوان من الرابط. الميكروفون لا يُنشر أبدًا
   في هذه التذكرة؛ الصوت الوارد يُعرض بـ RoomAudioRenderer في الأعلى. */
export function useDemoRoom(url: string | undefined, token: string | undefined) {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [room, setRoom] = useState<Room | null>(null);
  const [agentVersion, setAgentVersion] = useState<number | null>(null);
  const [stage, dispatchOp] = useReducer(applyOp, EMPTY_STAGE);
  const roomRef = useRef<Room | null>(null);

  const start = useCallback(async () => {
    if (!url || !token || roomRef.current) return;
    const next = new Room();
    roomRef.current = next;
    setRoom(next);
    setPhase("connecting");

    next.registerTextStreamHandler(SCENE_TOPIC, async (reader) => {
      const lines = createLineReader(dispatchOp);
      try {
        for await (const chunk of reader) lines.push(chunk);
        lines.end();
      } catch (error) {
        console.warn("stage: the scene stream ended with an error", error);
      }
    });
    next.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (topic !== TUTOR_TOPIC) return;
      const message = parseTutorMessage(payload);
      if (message?.type === "hello") setAgentVersion(message.contract_version);
    });
    next.on(RoomEvent.Disconnected, () => setPhase((p) => (p === "error" ? p : "ended")));

    try {
      // Called from the Start click, so the browser lets the agent's audio play.
      void next.startAudio();
      await next.connect(url, token);
      setPhase("live");
    } catch (error) {
      console.warn("demo: could not connect", error);
      setPhase("error");
      void next.disconnect();
    }
  }, [url, token]);

  const end = useCallback(() => {
    void roomRef.current?.disconnect();
  }, []);

  useEffect(
    () => () => {
      void roomRef.current?.disconnect();
    },
    [],
  );

  return { phase, room, agentVersion, stage, start, end };
}
