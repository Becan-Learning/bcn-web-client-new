"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_QUESTION_CHARS } from "@/lib/stage/question";

/* مربع كتابة سؤال الطالب. Enter يرسل (إرسال النموذج الأصلي)، والزرّ `<button>` هو الكهرماني
   الوحيد في الشاشة أثناء الجلسة. `dir="auto"` على الحقل وحده: الطالب قد يكتب عربيًا أو لاتينيًا. */

const sendButton =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-pressable px-6 text-base font-semibold text-on-pressable disabled:pointer-events-none disabled:opacity-50";

export function QuestionForm({ onSend }: { onSend: (text: string) => Promise<boolean> }) {
  const t = useTranslations("Demo");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const empty = text.trim() === "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (empty || sending) return;
    setSending(true);
    const sent = await onSend(text);
    setSending(false);
    if (sent) setText("");
  };

  return (
    <form data-question-form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
      <label htmlFor="demo-question" className="text-sm text-ink-2">
        {t("questionLabel")}
      </label>
      <div className="flex gap-2">
        <input
          id="demo-question"
          dir="auto"
          autoComplete="off"
          maxLength={MAX_QUESTION_CHARS}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("questionPlaceholder")}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-ground px-4 text-ink placeholder:text-ink-2"
        />
        <button type="submit" disabled={empty || sending} className={sendButton}>
          {t("send")}
        </button>
      </div>
    </form>
  );
}
