import { describe, expect, it, vi } from "vitest";
import { CHAT_TOPIC, MAX_QUESTION_CHARS, sendQuestion, type QuestionSender } from "./question";

const participant = (result: "ok" | "fail" = "ok") => ({
  sendText: vi.fn<QuestionSender["sendText"]>(async () => {
    if (result === "fail") throw new Error("not connected");
    return { id: "s1" };
  }),
});

describe("sending a Student question", () => {
  it("sends the typed text on the lk.chat topic", async () => {
    const p = participant();
    expect(await sendQuestion(p, "  ما هو الرأس؟  ")).toBe(true);
    expect(p.sendText).toHaveBeenCalledWith("ما هو الرأس؟", { topic: "lk.chat" });
    expect(CHAT_TOPIC).toBe("lk.chat");
  });

  it("sends nothing for a blank message", async () => {
    const p = participant();
    expect(await sendQuestion(p, "   \n ")).toBe(false);
    expect(p.sendText).not.toHaveBeenCalled();
  });

  it("cuts a message at the length the tutor reads", async () => {
    const p = participant();
    await sendQuestion(p, "س".repeat(MAX_QUESTION_CHARS + 50));
    expect(p.sendText.mock.calls[0]?.[0]).toHaveLength(MAX_QUESTION_CHARS);
  });

  it("reports a failure instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendQuestion(participant("fail"), "سؤال")).toBe(false);
    error.mockRestore();
  });
});
