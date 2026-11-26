import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Stage } from "@/components/session/stage/stage";
import { CONTRACT_VERSION } from "@/lib/stage/op";
import type { StageState } from "@/lib/stage/stage";
import { isContractMismatch } from "@/lib/stage/tutor-message";
import type { DemoPhase } from "./use-demo-room";

/* واجهة التجربة، عرضٌ فقط: الحالة كلها تأتي من الخطّاف في `demo-session`.
   زرّ كهرماني واحد في الشاشة (ابدأ)، وإنهاء زرّ ثانوي. */

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-pill bg-pressable px-6 text-base font-semibold text-on-pressable disabled:pointer-events-none disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-pill border border-line bg-surface px-5 text-base font-semibold text-ink hover:bg-surface-2";

export type DemoViewProps = {
  phase: DemoPhase;
  stage: StageState;
  /** From the agent's `hello`; null until it arrives. */
  agentVersion: number | null;
  /** The link had no usable server URL or token. */
  missingParams: boolean;
  onStart: () => void;
  onEnd: () => void;
  /** The agent's audio element(s). */
  children?: ReactNode;
};

export function DemoView({ phase, stage, agentVersion, missingParams, onStart, onEnd, children }: DemoViewProps) {
  const t = useTranslations("Demo");
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

      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 md:px-6">
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

        <Stage state={stage} />

        {phase === "connecting" ? <p className="text-ink-2">{t("connecting")}</p> : null}
        {phase === "live" && agentVersion === null ? <p className="text-ink-2">{t("waiting")}</p> : null}
        {phase === "ended" ? <p className="text-ink-2">{t("ended")}</p> : null}

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
