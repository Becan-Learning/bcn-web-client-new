"use client";

import { RoomAudioRenderer, RoomContext } from "@livekit/components-react";
import { SessionShell } from "@/components/session/session-start";
import { useReducedMotion } from "@/components/session/use-reduced-motion";
import { DemoView } from "./demo-view";
import { useDemoRoom } from "./use-demo-room";

/* سطح الجلسة الداكن نفسه (`data-theme="dark" data-surface="session"` داخل SessionShell). */
export function DemoSession({ url, token }: { url?: string; token?: string }) {
  const reduce = useReducedMotion();
  const { phase, room, agentVersion, stage, start, end } = useDemoRoom(url, token);

  return (
    <SessionShell reduce={reduce}>
      <DemoView
        phase={phase}
        stage={stage}
        agentVersion={agentVersion}
        missingParams={!url || !token}
        onStart={() => void start()}
        onEnd={end}
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
