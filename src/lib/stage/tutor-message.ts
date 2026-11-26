import { z } from "zod";
import { CONTRACT_VERSION } from "./op";

/* رسائل موضوع `tutor` (بيانات موثوقة، من الوكيل إلى المتصفح). في الإصدار 1: hello فقط. */

const HelloSchema = z.object({
  type: z.literal("hello"),
  contract_version: z.number().int(),
});

export type TutorMessage = z.infer<typeof HelloSchema>;

export function parseTutorMessage(payload: Uint8Array | string): TutorMessage | null {
  try {
    const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    const parsed = HelloSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** True when the agent speaks a different contract version than this build. */
export function isContractMismatch(agentVersion: number): boolean {
  return agentVersion !== CONTRACT_VERSION;
}
