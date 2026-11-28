/* سؤال الطالب المكتوب: نصّ على موضوع `lk.chat` (العقد v4، docs/contract.md في مستودع الوكيل).
   الوكيل يقرأ أول 500 حرف، فنقصّ هنا عند الحدّ نفسه. */

export const CHAT_TOPIC = "lk.chat";
export const MAX_QUESTION_CHARS = 500;

/** The part of a LiveKit participant that sending a question needs. */
export type QuestionSender = {
  sendText(text: string, options: { topic: string }): Promise<unknown>;
};

/** Sends the question; false for a blank message or a failed send. */
export async function sendQuestion(sender: QuestionSender, text: string): Promise<boolean> {
  const question = text.trim().slice(0, MAX_QUESTION_CHARS);
  if (!question) return false;
  try {
    await sender.sendText(question, { topic: CHAT_TOPIC });
    return true;
  } catch (error) {
    console.error("demo: could not send the question", error);
    return false;
  }
}
