import { useTranslations } from "next-intl";
import { splitLatinRuns } from "@/lib/stage/bidi";
import { elementsIn, type StageElement, type StageState } from "@/lib/stage/stage";

/* المسرح (Stage): يعرض ما رسمه المعلّم. في العقد v1 منطقة واحدة هي `notes`،
   وعنصر واحد هو `note`. الاتجاه يتبع لغة المسار؛ والمقاطع اللاتينية داخل النص
   تُعزل في span باتجاه ltr. ظهور الملاحظة حركة CSS تتوقّف مع «تقليل الحركة»
   من القاعدة العامة في globals.css. */

function NoteText({ text }: { text: string }) {
  return (
    <>
      {splitLatinRuns(text).map((run, i) =>
        run.ltr ? (
          <span key={i} dir="ltr" className="[unicode-bidi:isolate]">
            {run.text}
          </span>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

function Note({ element }: { element: StageElement }) {
  return (
    <li
      data-element-id={element.id}
      data-kind={element.kind}
      className="animate-board-in rounded-md border border-line bg-panel px-4 py-3 text-lg leading-base text-ink"
    >
      <NoteText text={element.props.text} />
    </li>
  );
}

export function Stage({ state }: { state: StageState }) {
  const t = useTranslations("Demo.stage");
  const notes = elementsIn(state, "notes");

  return (
    <section aria-label={t("label")} data-stage className="mx-auto w-full max-w-measure">
      <h2 className="mb-3 text-sm font-semibold text-ink-2">{t("notes")}</h2>
      {notes.length === 0 ? (
        <p data-stage-empty className="rounded-md bg-panel px-4 py-3 text-ink-2">
          {t("empty")}
        </p>
      ) : (
        <ul data-region="notes" className="flex flex-col gap-3">
          {notes.map((element) => (
            <Note key={element.id} element={element} />
          ))}
        </ul>
      )}
    </section>
  );
}
