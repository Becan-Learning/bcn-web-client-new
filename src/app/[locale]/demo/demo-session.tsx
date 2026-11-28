"use client";

import { RoomAudioRenderer, RoomContext } from "@livekit/components-react";
import { SessionShell } from "@/components/session/session-start";
import { useReducedMotion } from "@/components/session/use-reduced-motion";
import { useIsMobile } from "@/components/session/use-is-mobile";
import { DemoView } from "./demo-view";
import { useDemoAsk } from "./use-demo-ask";
import { useDemoRoom } from "./use-demo-room";

/* سطح الجلسة الداكن نفسه (`data-theme="dark" data-surface="session"` داخل SessionShell). */
export function DemoSession({ url, token }: { url?: string; token?: string }) {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const { phase, room, tutor, stage, start, end, ask, microphone, micPublished, micUnavailable } = useDemoRoom(url, token);
  const voice = useDemoAsk({ room, phase, tutor, microphone, micPublished, micUnavailable, shortcuts: !isMobile });

  return (
    <SessionShell reduce={reduce}>
      <DemoView
        phase={phase}
        stage={stage}
        tutor={tutor}
        missingParams={!url || !token}
        onStart={() => void start()}
        onEnd={end}
        onAsk={ask}
        voice={voice}
        reduce={reduce}
      >
        {room ? (
          <RoomContext.Provider value={room}>
            <RoomAudioRenderer />
          </RoomContext.Provider>
        ) : null}
      </DemoView>
    </SessionShell>
  );
}
