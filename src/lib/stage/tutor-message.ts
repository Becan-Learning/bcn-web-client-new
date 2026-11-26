import { z } from "zod";
import { CONTRACT_VERSION } from "./op";

/* رسائل موضوع `tutor` (بيانات موثوقة، من الوكيل إلى المتصفح). العقد v2:
   hello، lesson_started، topic_started، session_ending. الفهارس تبدأ من 1. */

const HelloSchema = z.object({
  type: z.literal("hello"),
  contract_version: z.number().int(),
});

const LessonStartedSchema = z.object({
  type: z.literal("lesson_started"),
  index: z.number().int().min(1),
  title: z.string().min(1).max(200),
});

const TopicStartedSchema = z.object({
  type: z.literal("topic_started"),
  index: z.number().int().min(1),
  title: z.string().min(1).max(200),
});

const SessionEndingSchema = z.object({ type: z.literal("session_ending") });

const TutorMessageSchema = z.discriminatedUnion("type", [
  HelloSchema,
  LessonStartedSchema,
  TopicStartedSchema,
  SessionEndingSchema,
]);

export type TutorMessage = z.infer<typeof TutorMessageSchema>;

export function parseTutorMessage(payload: Uint8Array | string): TutorMessage | null {
  try {
    const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    const parsed = TutorMessageSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** True when the agent speaks a different contract version than this build. */
export function isContractMismatch(agentVersion: number): boolean {
  return agentVersion !== CONTRACT_VERSION;
}
