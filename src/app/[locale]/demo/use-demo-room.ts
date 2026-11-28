"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { TrackReference } from "@livekit/components-react";
import { ConnectionState, createLocalAudioTrack, Room, RoomEvent, Track, type LocalAudioTrack } from "livekit-client";
import { sendQuestion } from "@/lib/stage/question";
import { createLineReader } from "@/lib/stage/scene-lines";
import { applyOp, EMPTY_STAGE } from "@/lib/stage/stage";
import { parseTutorMessage } from "@/lib/stage/tutor-message";
import { applyTutorMessage, INITIAL_TUTOR } from "@/lib/stage/tutor-state";
import { SCENE_TOPIC, TUTOR_TOPIC } from "./topics";

export type DemoPhase = "idle" | "connecting" | "live" | "ended" | "error";

/* الغرفة بلا خادم خلفي: الرمز والعنوان من الرابط. الميكروفون يُلتقط ويُكتم ثم يُنشر مكتومًا
   عند «ابدأ» (كما في الجلسة القديمة)، ولا يُفتح إلا أثناء سؤال الطالب (`use-demo-ask`).
   الصوت الوارد يُعرض بـ RoomAudioRenderer في الأعلى. */
export function useDemoRoom(url: string | undefined, token: string | undefined) {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [room, setRoom] = useState<Room | null>(null);
  const [tutor, dispatchTutor] = useReducer(applyTutorMessage, INITIAL_TUTOR);
  const [stage, dispatchOp] = useReducer(applyOp, EMPTY_STAGE);
  const [micTrack, setMicTrack] = useState<TrackReference | null>(null);
  const [micPublished, setMicPublished] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
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
      if (!message) return;
      dispatchTutor(message);
      // The Chapter is taught and the agent is leaving: end here too.
      if (message.type === "session_ending") void next.disconnect();
    });
    next.on(RoomEvent.Disconnected, () => setPhase((p) => (p === "error" ? p : "ended")));

    let microphone: Promise<LocalAudioTrack | null> | null = null;
    try {
      // Called from the Start click, so the browser lets the agent's audio play.
      void next.startAudio();
      // Acquire and mute BEFORE publishing, so the microphone is never open outside a Student
      // question. Connecting does not wait for the permission prompt.
      microphone = createLocalAudioTrack()
        .then(async (track) => {
          await track.mute();
          return track;
        })
        .catch((error) => {
          console.warn("demo: the microphone is unavailable", error);
          setMicUnavailable(true);
          return null;
        });
      await next.connect(url, token);
      setPhase("live");
      const track = await microphone;
      if (track) {
        await next.localParticipant
          .publishTrack(track, { source: Track.Source.Microphone, stopMicTrackOnMute: false })
          .then(
            (publication) => {
              setMicTrack({ participant: next.localParticipant, publication, source: Track.Source.Microphone });
              setMicPublished(true);
            },
            (error) => {
              track.stop();
              setMicUnavailable(true);
              console.warn("demo: could not publish the muted microphone", error);
            },
          );
      }
    } catch (error) {
      console.warn("demo: could not connect", error);
      void microphone?.then((track) => track?.stop());
      setPhase("error");
      void next.disconnect();
    }
  }, [url, token]);

  /* سؤال الطالب المكتوب إلى المعلّم على `lk.chat`. */
  const ask = useCallback(async (text: string) => {
    const joined = roomRef.current;
    if (!joined || joined.state !== ConnectionState.Connected) return false;
    return sendQuestion(joined.localParticipant, text);
  }, []);

  const end = useCallback(() => {
    void roomRef.current?.disconnect();
  }, []);

  useEffect(
    () => () => {
      void roomRef.current?.disconnect();
    },
    [],
  );

  return { phase, room, tutor, stage, start, end, ask, microphone: micTrack, micPublished, micUnavailable };
}
