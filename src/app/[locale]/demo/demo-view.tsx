import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { StudentQuestionRecorder } from "@/components/session/parts";
import { Stage } from "@/components/session/stage/stage";
import { MicIcon } from "@/components/becan/icons";
import { CONTRACT_VERSION } from "@/lib/stage/op";
import type { StageState } from "@/lib/stage/stage";
import { isContractMismatch } from "@/lib/stage/tutor-message";
import type { TutorState } from "@/lib/stage/tutor-state";
import { QuestionForm } from "./question-form";
import type { DemoVoice } from "./use-demo-ask";
import type { DemoPhase } from "./use-demo-room";

/* واجهة التجربة، عرضٌ فقط: الحالة كلها تأتي من الخطّاف في `demo-session`.
   زرّ كهرماني واحد في الشاشة: «ابدأ» قبل الجلسة، ثم «أرسل» السؤال المكتوب؛ وأثناء تسجيل سؤال
   منطوق يحلّ «أرسل» المسجِّل محلّه (النموذج المكتوب يُخفى). «اسأل» وإنهاء زرّان محدّدان بإطار. */

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-pill bg-pressable px-6 text-base font-semibold text-on-pressable disabled:pointer-events-none disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-pill border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-surface-2";

const outlinedButton =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-pill border border-line bg-surface px-4 text-base font-semibold text-ink hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50";

export type DemoViewProps = {
  phase: DemoPhase;
  stage: StageState;
  /** What the agent's `tutor` events say: its contract version, the current Lesson and Topic, and whether it ended. */
  tutor: TutorState;
  /** The link had no usable server URL or token. */
  missingParams: boolean;
  onStart: () => void;
  onEnd: () => void;
  /** Send a typed Student question on `lk.chat`; resolves false when it could not be sent. */
  onAsk: (text: string) => Promise<boolean>;
  /** Ask by voice (Student question): absent when the page has no microphone to offer. */
  voice?: DemoVoice;
  reduce?: boolean;
  /** The agent's audio element(s). */
  children?: ReactNode;
};

export function DemoView({ phase, stage, tutor, missingParams, onStart, onEnd, onAsk, voice, reduce = false, children }: DemoViewProps) {
  const t = useTranslations("Demo");
  const tSession = useTranslations("Session");
  const recording = voice !== undefined && voice.startedAt !== null;
  const { agentVersion, lesson, topic, answering, ending } = tutor;
  const mismatch = agentVersion !== null && isContractMismatch(agentVersion);

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        {phase === "live" ? (
          <button type="button" onClick={onEnd} className={secondaryButton}>
            {t("end")}
          </button>
        ) : null}
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-page flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 md:px-6">
        {mismatch ? (
          <p role="alert" data-contract-mismatch className="rounded-md border border-error px-4 py-3 text-error">
            {t("contractMismatch", { agent: agentVersion, page: CONTRACT_VERSION })}
          </p>
        ) : null}

        {missingParams ? (
          <p role="alert" className="rounded-md border border-error px-4 py-3 text-error">
            {t("missingParams")}
          </p>
        ) : null}
        {phase === "error" ? (
          <p role="alert" className="rounded-md border border-error px-4 py-3 text-error">
            {t("connectionError")}
          </p>
        ) : null}

        {lesson ? (
          <div data-progress aria-live="polite" className="flex flex-col gap-1">
            <p data-lesson className="text-sm text-ink-2">
              <span>{t("lessonLabel", { index: lesson.index })}</span>
              <span aria-hidden> · </span>
              <span className="font-semibold text-ink">{lesson.title}</span>
            </p>
            {answering ? (
              <p data-answering className="text-lg font-semibold text-ink">
                {t("answering")}
              </p>
            ) : topic ? (
              <p data-topic className="text-lg font-semibold text-ink">
                <span className="text-sm font-normal text-ink-2">{t("topicLabel", { index: topic.index })}</span>
                <span aria-hidden> · </span>
                {topic.title}
              </p>
            ) : (
              <p data-topic-pending className="text-ink-2">
                {t("preparing")}
              </p>
            )}
          </div>
        ) : null}

        <Stage state={stage} />

        {phase === "live" ? (
          <>
            {voice && recording && voice.startedAt !== null ? (
              <div data-recorder className="flex flex-col gap-2">
                <p role="status" className="sr-only">
                  {t("listening")}
                </p>
                <div className="rounded-pill border border-line bg-panel px-1.5 py-1">
                  <StudentQuestionRecorder
                    startedAt={voice.startedAt}
                    microphoneTrack={voice.microphone}
                    reduce={reduce}
                    onSend={voice.onSend}
                    onCancel={voice.onCancel}
                    onSpeech={voice.onSpeech}
                  />
                </div>
              </div>
            ) : null}
            {/* Kept mounted while recording so a half-typed question is not lost; hidden, so its amber Send is off screen. */}
            <div hidden={recording}>
              <QuestionForm
                onSend={onAsk}
                trailing={
                  voice ? (
                    <button
                      type="button"
                      data-ask
                      onClick={voice.onAsk}
                      disabled={!voice.canAsk}
                      title={voice.micUnavailable ? tSession("studentQuestionMicUnavailable") : tSession("studentQuestionShortcut")}
                      className={outlinedButton}
                    >
                      <MicIcon />
                      {tSession("studentQuestionAsk")}
                    </button>
                  ) : null
                }
              />
            </div>
            {voice ? (
              <p role="status" data-voice-note className="min-h-5 text-sm text-ink-2">
                {voice.noSpeech
                  ? tSession("studentQuestionNoSpeech")
                  : voice.micUnavailable
                    ? tSession("studentQuestionMicUnavailable")
                    : null}
              </p>
            ) : null}
          </>
        ) : null}

        {phase === "connecting" ? <p className="text-ink-2">{t("connecting")}</p> : null}
        {phase === "live" && agentVersion === null ? <p className="text-ink-2">{t("waiting")}</p> : null}
        {phase === "ended" ? (
          <p data-ended={ending ? "chapter" : "left"} className="text-ink-2">
            {ending ? t("chapterEnded") : t("ended")}
          </p>
        ) : null}

        {phase === "idle" || phase === "error" ? (
          <div className="mt-auto flex justify-center pb-4">
            <button type="button" onClick={onStart} disabled={missingParams} className={primaryButton}>
              {t("start")}
            </button>
          </div>
        ) : null}
      </main>
      {children}
    </>
  );
}
