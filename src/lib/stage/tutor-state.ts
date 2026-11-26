import type { TutorMessage } from "./tutor-message";

/* ما يعرضه الصفحة عن مسار الشرح: الدرس والموضوع الحاليان من أحداث `tutor`،
   وهل أنهى المعلّم الجلسة. طيّ نقيّ؛ لا يعرف الشبكة. */

export type TutorState = {
  /** From `hello`; null until it arrives. */
  readonly agentVersion: number | null;
  readonly lesson: { readonly index: number; readonly title: string } | null;
  readonly topic: { readonly index: number; readonly title: string } | null;
  /** The agent said `session_ending`: the Chapter is taught. */
  readonly ending: boolean;
};

export const INITIAL_TUTOR: TutorState = { agentVersion: null, lesson: null, topic: null, ending: false };

export function applyTutorMessage(state: TutorState, message: TutorMessage): TutorState {
  switch (message.type) {
    case "hello":
      return { ...state, agentVersion: message.contract_version };
    case "lesson_started":
      // A new Lesson has no Topic until its first `topic_started`.
      return { ...state, lesson: { index: message.index, title: message.title }, topic: null };
    case "topic_started":
      return { ...state, topic: { index: message.index, title: message.title } };
    case "session_ending":
      return { ...state, ending: true };
  }
}
