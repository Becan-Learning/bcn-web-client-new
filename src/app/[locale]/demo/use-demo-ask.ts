"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrackReference } from "@livekit/components-react";
import { ParticipantKind, type Room } from "livekit-client";
import {
  createStudentQuestion,
  type StudentQuestionStatus,
} from "@/components/session/student-question";
import { useAskShortcuts } from "@/components/session/use-ask-shortcuts";
import type { TutorState } from "@/lib/stage/tutor-state";
import type { DemoPhase } from "./use-demo-room";

/* Ask على صفحة التجربة: نفس سؤال الطالب في الجلسة القديمة (`createStudentQuestion`:
   start_turn / end_turn / cancel_turn، حارس الصمت 8 ثوانٍ، سقف 60 ثانية) ونفس الاختصارات.
   المايك منشور مكتومًا طوال الجلسة ولا يُفتح إلا بين start_turn وإغلاق السؤال.
   لا نراقب حالة الوكيل: لا إغلاق تلقائي للدور في هذا المعلّم، الإغلاق بـ«أرسل» أو الإلغاء أو السقف. */

export type DemoVoice = {
  canAsk: boolean;
  micUnavailable: boolean;
  /** Set while the microphone is open: when the Student question started. */
  startedAt: number | null;
  /** A turn is opening or closing. */
  busy: boolean;
  noSpeech: boolean;
  microphone: TrackReference | null;
  onAsk: () => void;
  onSend: () => void;
  onCancel: () => void;
  onSpeech: () => void;
};

type Inputs = {
  room: Room | null;
  phase: DemoPhase;
  tutor: TutorState;
  microphone: TrackReference | null;
  micPublished: boolean;
  micUnavailable: boolean;
  /** Keyboard shortcuts (Space, Escape) are for layouts with a keyboard. */
  shortcuts: boolean;
};

const IDLE: StudentQuestionStatus = { busy: false, startedAt: null };

export function useDemoAsk({ room, phase, tutor, microphone, micPublished, micUnavailable, shortcuts }: Inputs): DemoVoice {
  const [status, setStatus] = useState<StudentQuestionStatus>(IDLE);
  const [noSpeech, setNoSpeech] = useState(false);
  const studentQuestion = useMemo(
    () => (room ? createStudentQuestion(room.localParticipant, setStatus, () => setNoSpeech(true), () => {}) : null),
    [room],
  );

  useEffect(() => {
    if (!noSpeech) return;
    const timer = setTimeout(() => setNoSpeech(false), 3_000);
    return () => clearTimeout(timer);
  }, [noSpeech]);

  // The Session is over (or the page is going away): never leave the microphone open.
  const over = phase !== "live" || tutor.ending;
  useEffect(() => {
    if (over) void studentQuestion?.close("cancel_turn");
  }, [over, studentQuestion]);
  useEffect(() => () => void studentQuestion?.close("cancel_turn"), [studentQuestion]);

  // `hello` means the agent is in the room and takes questions.
  const canAsk =
    studentQuestion !== null && !over && tutor.agentVersion !== null && micPublished && !micUnavailable && !status.busy && status.startedAt === null;

  const onAsk = useCallback(() => {
    if (!canAsk || !room || !studentQuestion) return;
    const agent = [...room.remoteParticipants.values()].find((p) => p.kind === ParticipantKind.AGENT);
    if (!agent) return;
    setNoSpeech(false);
    void studentQuestion.start(agent.identity, "listening");
  }, [canAsk, room, studentQuestion]);
  const onSend = useCallback(() => void studentQuestion?.close("end_turn"), [studentQuestion]);
  const onCancel = useCallback(() => void studentQuestion?.close("cancel_turn"), [studentQuestion]);
  const onSpeech = useCallback(() => studentQuestion?.speechDetected(), [studentQuestion]);

  useAskShortcuts({
    enabled: shortcuts,
    canAsk,
    recording: status.startedAt !== null,
    busy: status.busy,
    onAsk,
    onSend,
    onCancel,
  });

  return { canAsk, micUnavailable, startedAt: status.startedAt, busy: status.busy, noSpeech, microphone, onAsk, onSend, onCancel, onSpeech };
}
